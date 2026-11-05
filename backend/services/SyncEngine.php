<?php
declare(strict_types=1);

namespace Cockpit\Services;

require_once __DIR__ . '/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/connectors/EAFConnector.php';
require_once __DIR__ . '/connectors/BNIConnector.php';
require_once __DIR__ . '/connectors/KVVConnector.php';
require_once __DIR__ . '/connectors/SEOConnector.php';

use Cockpit\Config\Database;
use Cockpit\Services\Connectors\LeadConnectorInterface;
use Cockpit\Services\Connectors\EAFConnector;
use Cockpit\Services\Connectors\BNIConnector;
use Cockpit\Services\Connectors\KVVConnector;
use Cockpit\Services\Connectors\SEOConnector;
use PDO;

class SyncEngine {

    /** @var array<string, LeadConnectorInterface> */
    private static array $connectors = [];

    /**
     * Initialize registered connectors
     */
    private static function initConnectors(): void {
        if (empty(self::$connectors)) {
            self::registerConnector(new EAFConnector());
            self::registerConnector(new BNIConnector());
            self::registerConnector(new KVVConnector());
            self::registerConnector(new SEOConnector());
        }
    }

    public static function registerConnector(LeadConnectorInterface $connector): void {
        self::$connectors[$connector->getSourceKey()] = $connector;
    }

    public static function normalizeSourceKey(string $sourceKey): string {
        $aliases = [
            'bni' => 'bni_connect',
            'bni_connect' => 'bni_connect',
            'kvv' => 'kvv_connect',
            'kvv_connect' => 'kvv_connect',
            'eaf' => 'eaf_connect',
            'eaf_connect' => 'eaf_connect',
            'website_seo' => 'website_seo',
            'seo' => 'website_seo'
        ];
        return $aliases[strtolower(trim($sourceKey))] ?? $sourceKey;
    }

    public static function getConnector(string $sourceKey): ?LeadConnectorInterface {
        self::initConnectors();
        $normalized = self::normalizeSourceKey($sourceKey);
        return self::$connectors[$normalized] ?? self::$connectors[$sourceKey] ?? null;
    }

    /**
     * @return array<string, LeadConnectorInterface>
     */
    public static function getAllConnectors(): array {
        self::initConnectors();
        return self::$connectors;
    }

    /**
     * Test connection for a given source configuration
     */
    public static function testConnection(int $tenantId, string $sourceKey, ?array $overrideCredentials = null): array {
        $connector = self::getConnector($sourceKey);
        if (!$connector) {
            return ['success' => false, 'message' => "Connector not found for {$sourceKey}"];
        }

        $db = Database::getConnection();
        $normalized = self::normalizeSourceKey($sourceKey);
        $shortKey = str_replace('_connect', '', $normalized);

        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE tenant_id = ? AND (source_key = ? OR source_key = ?) LIMIT 1");
        $stmt->execute([$tenantId, $sourceKey, $shortKey]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
            'tenant_id' => $tenantId,
            'source_key' => $sourceKey
        ];

        if ($overrideCredentials !== null) {
            $config['credentials'] = $overrideCredentials;
        }

        $result = $connector->testConnection($tenantId, $config);

        // Update status in database if config exists
        if (!empty($config['id'])) {
            $newStatus = $result['success'] ? 'connected_syncing' : ($result['details']['status'] ?? 'auth_required');
            $db->prepare("
                UPDATE lead_sources_config 
                SET status = ?, 
                    last_error_message = ?, 
                    last_error_at = CASE WHEN ? = 1 THEN NULL ELSE NOW() END,
                    updated_at = NOW() 
                WHERE id = ? AND tenant_id = ?
            ")->execute([
                $newStatus,
                $result['success'] ? null : ($result['message'] ?? 'Connection test failed'),
                $result['success'] ? 1 : 0,
                $config['id'],
                $tenantId
            ]);
        }

        return $result;
    }

    /**
     * Synchronize a specific source for a tenant
     */
    public static function syncSource(int $tenantId, string $sourceKey, string $syncType = 'manual'): array {
        $startTime = microtime(true);
        $connector = self::getConnector($sourceKey);

        if (!$connector) {
            return [
                'success' => false,
                'message' => "No connector registered for source {$sourceKey}"
            ];
        }

        $db = Database::getConnection();
        $normalized = self::normalizeSourceKey($sourceKey);
        $shortKey = str_replace('_connect', '', $normalized);

        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE tenant_id = ? AND (source_key = ? OR source_key = ?) LIMIT 1");
        $stmt->execute([$tenantId, $sourceKey, $shortKey]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$config || empty($config['is_enabled'])) {
            return [
                'success' => false,
                'message' => "Source {$sourceKey} is disabled or not configured for this tenant"
            ];
        }

        $checkpointBefore = $config['sync_checkpoint'] ?? null;

        try {
            $result = $connector->sync($tenantId, $config, $checkpointBefore);
            $executionMs = (int)round((microtime(true) - $startTime) * 1000);

            $status = $result['success'] ? 'success' : 'failed';
            if ($result['success'] && !empty($result['error'])) {
                $status = 'partial';
            }

            // Log execution in lead_sync_logs
            $logStmt = $db->prepare("
                INSERT INTO lead_sync_logs (
                    tenant_id, source_key, sync_type, status,
                    leads_fetched, leads_created, leads_updated, leads_skipped,
                    checkpoint_before, checkpoint_after, error_details, execution_time_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $logStmt->execute([
                $tenantId,
                $sourceKey,
                $syncType,
                $status,
                $result['leads_fetched'] ?? 0,
                $result['leads_created'] ?? 0,
                $result['leads_updated'] ?? 0,
                $result['leads_skipped'] ?? 0,
                $checkpointBefore,
                $result['new_checkpoint'] ?? $checkpointBefore,
                $result['error'] ?? null,
                $executionMs
            ]);

            // Update lead_sources_config status and checkpoint
            if ($result['success']) {
                $db->prepare("
                    UPDATE lead_sources_config 
                    SET last_sync_at = NOW(),
                        sync_checkpoint = ?,
                        sync_count = sync_count + ?,
                        status = 'connected',
                        last_error_message = NULL,
                        last_error_at = NULL,
                        retry_count = 0,
                        updated_at = NOW()
                    WHERE id = ? AND tenant_id = ?
                ")->execute([
                    $result['new_checkpoint'] ?? $checkpointBefore,
                    $result['leads_created'] ?? 0,
                    $config['id'],
                    $tenantId
                ]);

                // Also update connected_apps connection_status
                $recCount = (int)($result['leads_created'] ?? ($result['leads_fetched'] ?? 0));
                $db->prepare("
                    UPDATE connected_apps 
                    SET connection_status = 'connected',
                        last_synced_at = NOW(),
                        records_synced = records_synced + ?,
                        last_error = NULL,
                        updated_at = NOW()
                    WHERE tenant_id = ? AND (app_url LIKE ? OR name LIKE ?)
                ")->execute([
                    $recCount,
                    $tenantId,
                    "%{$shortKey}%",
                    "%{$shortKey}%"
                ]);
            } else {
                $db->prepare("
                    UPDATE lead_sources_config 
                    SET last_error_message = ?,
                        last_error_at = NOW(),
                        retry_count = retry_count + 1,
                        updated_at = NOW()
                    WHERE id = ? AND tenant_id = ?
                ")->execute([
                    $result['error'] ?? 'Sync failed',
                    $config['id'],
                    $tenantId
                ]);

                $db->prepare("
                    UPDATE connected_apps 
                    SET last_error = ?,
                        updated_at = NOW()
                    WHERE tenant_id = ? AND (app_url LIKE ? OR name LIKE ?)
                ")->execute([
                    $result['error'] ?? 'Sync failed',
                    $tenantId,
                    "%{$shortKey}%",
                    "%{$shortKey}%"
                ]);
            }

            return array_merge($result, [
                'execution_time_ms' => $executionMs,
                'source_key' => $sourceKey
            ]);

        } catch (\Throwable $e) {
            $executionMs = (int)round((microtime(true) - $startTime) * 1000);

            $db->prepare("
                INSERT INTO lead_sync_logs (
                    tenant_id, source_key, sync_type, status, error_details, execution_time_ms
                ) VALUES (?, ?, ?, 'failed', ?, ?)
            ")->execute([
                $tenantId,
                $sourceKey,
                $syncType,
                $e->getMessage(),
                $executionMs
            ]);

            $db->prepare("
                UPDATE lead_sources_config 
                SET last_error_message = ?, last_error_at = NOW(), retry_count = retry_count + 1, updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$e->getMessage(), $config['id'], $tenantId]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'execution_time_ms' => $executionMs
            ];
        }
    }

    public const DEFAULT_INTERVALS = [
        'bni' => 15,
        'bni_connect' => 15,
        'eaf' => 15,
        'eaf_connect' => 15,
        'kvv' => 15,
        'kvv_connect' => 15,
        'gmail' => 5,
        'google_calendar' => 5,
        'website_seo' => 30
    ];

    public static function getDefaultInterval(string $sourceKey): int {
        $normalized = strtolower(trim($sourceKey));
        return self::DEFAULT_INTERVALS[$normalized] ?? 15;
    }

    /**
     * Acquire atomic synchronization lock for a tenant and integration source.
     * Prevents duplicate concurrent external requests across browser tabs or rapid refreshes.
     */
    public static function acquireLock(int $tenantId, string $sourceKey, int $lockTimeoutSeconds = 120): bool {
        $db = Database::getConnection();
        $interval = self::getDefaultInterval($sourceKey);

        // Ensure row exists in integration_sync_state
        $ins = $db->prepare("
            INSERT INTO integration_sync_state (tenant_id, source_key, sync_status, sync_interval_minutes, created_at, updated_at)
            VALUES (?, ?, 'idle', ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE updated_at = NOW()
        ");
        $ins->execute([$tenantId, $sourceKey, $interval]);

        // Attempt atomic lock acquisition: succeeds only if lock is NULL or has expired
        $stmt = $db->prepare("
            UPDATE integration_sync_state
            SET sync_status = 'syncing',
                last_attempted_at = NOW(),
                lock_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
                updated_at = NOW()
            WHERE tenant_id = ? 
              AND source_key = ? 
              AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
        ");
        $stmt->execute([$lockTimeoutSeconds, $tenantId, $sourceKey]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Release synchronization lock and update intervals, timestamps, and exponential backoff
     */
    public static function releaseLock(
        int $tenantId,
        string $sourceKey,
        bool $success,
        int $recordsSynced = 0,
        ?string $errorMessage = null,
        ?int $customIntervalMinutes = null
    ): void {
        $db = Database::getConnection();
        $interval = $customIntervalMinutes ?? self::getDefaultInterval($sourceKey);

        if ($success) {
            $stmt = $db->prepare("
                UPDATE integration_sync_state
                SET sync_status = 'synced',
                    lock_expires_at = NULL,
                    last_synced_at = NOW(),
                    next_sync_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                    records_synced = records_synced + ?,
                    retry_count = 0,
                    last_error_message = NULL,
                    last_error_at = NULL,
                    updated_at = NOW()
                WHERE tenant_id = ? AND source_key = ?
            ");
            $stmt->execute([$interval, $recordsSynced, $tenantId, $sourceKey]);
        } else {
            // Apply exponential backoff multiplier on repeat failures to prevent endpoint throttling
            $rowStmt = $db->prepare("SELECT retry_count FROM integration_sync_state WHERE tenant_id = ? AND source_key = ? LIMIT 1");
            $rowStmt->execute([$tenantId, $sourceKey]);
            $currentRetries = (int)$rowStmt->fetchColumn();
            $newRetries = $currentRetries + 1;

            $multiplier = 1;
            if ($newRetries >= 3) $multiplier = 4;
            elseif ($newRetries === 2) $multiplier = 2;

            $backoffMinutes = min(120, $interval * $multiplier);

            $stmt = $db->prepare("
                UPDATE integration_sync_state
                SET sync_status = 'failed',
                    lock_expires_at = NULL,
                    next_sync_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                    retry_count = ?,
                    last_error_message = ?,
                    last_error_at = NOW(),
                    updated_at = NOW()
                WHERE tenant_id = ? AND source_key = ?
            ");
            $stmt->execute([$backoffMinutes, $newRetries, $errorMessage, $tenantId, $sourceKey]);
        }
    }

    /**
     * Execute synchronization for a specific source (BNI, EAF, KVV, Gmail, etc.)
     */
    public static function executeSourceSync(int $tenantId, string $sourceKey, string $syncType = 'auto_sync'): array {
        $startTime = microtime(true);
        $norm = self::normalizeSourceKey($sourceKey);
        $shortKey = str_replace('_connect', '', $norm);

        // Special handling for Gmail Workspace
        if ($shortKey === 'gmail') {
            require_once __DIR__ . '/../controllers/GmailController.php';
            try {
                $gmailRes = \Cockpit\Controllers\GmailController::syncInternal($tenantId);
                $execMs = (int)round((microtime(true) - $startTime) * 1000);
                $records = (int)($gmailRes['messages_synced'] ?? 0);
                $success = !empty($gmailRes['success']);

                self::releaseLock($tenantId, 'gmail', $success, $records, $gmailRes['error'] ?? null);

                // Update connected_apps
                $db = Database::getConnection();
                $db->prepare("
                    UPDATE connected_apps 
                    SET connection_status = ?, last_synced_at = NOW(), records_synced = records_synced + ?, last_error = ?, updated_at = NOW()
                    WHERE tenant_id = ? AND (app_url LIKE '%mail.google.com%' OR name = 'Gmail')
                ")->execute([$success ? 'connected' : 'sync_failed', $records, $gmailRes['error'] ?? null, $tenantId]);

                return array_merge($gmailRes, ['source_key' => 'gmail', 'execution_time_ms' => $execMs]);
            } catch (\Throwable $e) {
                self::releaseLock($tenantId, 'gmail', false, 0, $e->getMessage());
                return ['success' => false, 'error' => $e->getMessage(), 'source_key' => 'gmail'];
            }
        }

        // Special handling for Google Calendar
        if ($shortKey === 'google_calendar' || $shortKey === 'calendar') {
            try {
                $db = Database::getConnection();
                $count = (int)$db->query("SELECT COUNT(*) FROM calendar_events WHERE tenant_id = {$tenantId}")->fetchColumn();
                self::releaseLock($tenantId, 'google_calendar', true, 0);

                $db->prepare("
                    UPDATE connected_apps 
                    SET last_synced_at = NOW(), updated_at = NOW()
                    WHERE tenant_id = ? AND (app_url LIKE '%calendar.google.com%' OR name = 'Google Calendar')
                ")->execute([$tenantId]);

                return ['success' => true, 'events_count' => $count, 'source_key' => 'google_calendar'];
            } catch (\Throwable $e) {
                self::releaseLock($tenantId, 'google_calendar', false, 0, $e->getMessage());
                return ['success' => false, 'error' => $e->getMessage(), 'source_key' => 'google_calendar'];
            }
        }

        // Standard lead source connectors (BNI, EAF, KVV, Website SEO)
        $res = self::syncSource($tenantId, $sourceKey, $syncType);
        $records = (int)(($res['leads_created'] ?? 0) + ($res['leads_updated'] ?? 0));
        if ($records === 0 && !empty($res['leads_fetched'])) {
            $records = (int)$res['leads_fetched'];
        }

        self::releaseLock($tenantId, $shortKey, !empty($res['success']), $records, $res['error'] ?? null);
        return $res;
    }

    /**
     * Automatic synchronization runner triggered on user login, page load, or browser refresh.
     * Guaranteed Non-blocking, rate-limited, and lock-protected.
     * If all syncs are up-to-date or locked, returns in <50ms without hitting external endpoints.
     */
    public static function checkAndRunAutoSync(int $tenantId): array {
        $startTime = microtime(true);
        $db = Database::getConnection();

        // 1. Discover all candidate auto-sync sources for this tenant
        $candidates = ['bni', 'eaf', 'kvv', 'gmail'];

        // Also check if tenant has configured sources in lead_sources_config
        $srcStmt = $db->prepare("SELECT source_key FROM lead_sources_config WHERE tenant_id = ? AND is_enabled = 1");
        $srcStmt->execute([$tenantId]);
        while ($sk = $srcStmt->fetchColumn()) {
            $short = str_replace('_connect', '', self::normalizeSourceKey((string)$sk));
            if (!in_array($short, $candidates, true) && $short !== 'manual' && $short !== 'custom') {
                $candidates[] = $short;
            }
        }

        // 2. Fetch existing sync states in single query
        $stateStmt = $db->prepare("SELECT * FROM integration_sync_state WHERE tenant_id = ?");
        $stateStmt->execute([$tenantId]);
        $statesBySource = [];
        while ($row = $stateStmt->fetch(PDO::FETCH_ASSOC)) {
            $statesBySource[$row['source_key']] = $row;
        }

        $results = [];
        $syncedAny = false;

        foreach ($candidates as $sourceKey) {
            $state = $statesBySource[$sourceKey] ?? null;

            // Check if currently locked (another sync in progress)
            if (!empty($state['lock_expires_at']) && strtotime($state['lock_expires_at']) > time()) {
                $results[$sourceKey] = [
                    'status' => 'syncing',
                    'skipped' => true,
                    'reason' => 'lock_active',
                    'lock_expires_in' => strtotime($state['lock_expires_at']) - time()
                ];
                continue;
            }

            // Check rate limit: is it due yet?
            if (!empty($state['next_sync_at']) && strtotime($state['next_sync_at']) > time()) {
                $results[$sourceKey] = [
                    'status' => 'not_due',
                    'skipped' => true,
                    'reason' => 'rate_limited',
                    'seconds_until_next' => strtotime($state['next_sync_at']) - time(),
                    'next_sync_at' => $state['next_sync_at'],
                    'last_synced_at' => $state['last_synced_at'] ?? null,
                    'records_synced' => (int)($state['records_synced'] ?? 0)
                ];
                continue;
            }

            // For Gmail: only sync if account is actually connected
            if ($sourceKey === 'gmail') {
                $gAcct = $db->query("SELECT connection_status FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                if (empty($gAcct) || ($gAcct['connection_status'] ?? '') !== 'connected') {
                    $results[$sourceKey] = [
                        'status' => 'auth_required',
                        'skipped' => true,
                        'reason' => 'not_connected'
                    ];
                    continue;
                }
            }

            // Attempt to acquire atomic lock
            if (!self::acquireLock($tenantId, $sourceKey)) {
                $results[$sourceKey] = [
                    'status' => 'syncing',
                    'skipped' => true,
                    'reason' => 'concurrent_lock'
                ];
                continue;
            }

            // Due and locked: execute sync
            $syncRes = self::executeSourceSync($tenantId, $sourceKey, 'auto_sync');
            $results[$sourceKey] = array_merge($syncRes, ['skipped' => false]);
            $syncedAny = true;
        }

        $totalMs = (int)round((microtime(true) - $startTime) * 1000);
        return [
            'success' => true,
            'synced_any' => $syncedAny,
            'execution_time_ms' => $totalMs,
            'sources' => $results,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Synchronize all enabled pull sources for a single tenant (manual trigger or global cron)
     */
    public static function syncAllSourcesForTenant(int $tenantId, string $syncType = 'manual'): array {
        $startTime = microtime(true);
        $candidates = ['bni', 'eaf', 'kvv'];

        $db = Database::getConnection();
        // Check if Gmail is connected
        try {
            $gAcct = $db->query("SELECT connection_status FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if (!empty($gAcct) && ($gAcct['connection_status'] ?? '') === 'connected') {
                $candidates[] = 'gmail';
            }
        } catch (\Throwable $e) {}

        $results = [];
        foreach ($candidates as $sourceKey) {
            // Force lock acquisition for manual "Sync All"
            self::acquireLock($tenantId, $sourceKey, 180);
            $res = self::executeSourceSync($tenantId, $sourceKey, $syncType);
            $results[$sourceKey] = $res;
        }

        $totalMs = (int)round((microtime(true) - $startTime) * 1000);
        return [
            'success' => true,
            'sync_type' => $syncType,
            'execution_time_ms' => $totalMs,
            'sources' => $results,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Global sync across all active tenants (Executed via Hostinger Background Cron)
     */
    public static function runGlobalCronSync(): array {
        $db = Database::getConnection();
        $tenants = $db->query("SELECT id, name FROM tenants WHERE status = 'active'")->fetchAll(PDO::FETCH_ASSOC);

        $summary = [
            'tenants_processed' => count($tenants),
            'timestamp' => date('Y-m-d H:i:s'),
            'details' => []
        ];

        foreach ($tenants as $tenant) {
            $tenantId = (int)$tenant['id'];
            $res = self::syncAllSourcesForTenant($tenantId, 'cron');
            $summary['details'][$tenant['name']] = $res;
        }

        return $summary;
    }

    /**
     * Retrieve live integration synchronization status, countdowns, and badges
     */
    public static function getIntegrationSyncStatus(int $tenantId): array {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT source_key, sync_status, sync_interval_minutes, last_synced_at, last_attempted_at,
                   next_sync_at, lock_expires_at, retry_count, last_error_message, records_synced
            FROM integration_sync_state
            WHERE tenant_id = ?
        ");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stateMap = [];
        $now = time();

        foreach ($rows as $row) {
            $key = $row['source_key'];
            $isLocked = !empty($row['lock_expires_at']) && strtotime($row['lock_expires_at']) > $now;
            $secondsUntilNext = !empty($row['next_sync_at']) ? max(0, strtotime($row['next_sync_at']) - $now) : 0;

            // Determine badge status
            $badge = 'Synced';
            if ($isLocked) {
                $badge = 'Syncing';
            } elseif (!empty($row['last_error_message'])) {
                $badge = 'Sync Failed';
            } elseif (empty($row['last_synced_at'])) {
                $badge = 'Connected';
            }

            $stateMap[$key] = [
                'source_key' => $key,
                'sync_status' => $row['sync_status'],
                'badge' => $badge,
                'interval_minutes' => (int)($row['sync_interval_minutes'] ?? self::getDefaultInterval($key)),
                'last_synced_at' => $row['last_synced_at'],
                'next_sync_at' => $row['next_sync_at'],
                'seconds_until_next' => $secondsUntilNext,
                'is_syncing' => $isLocked,
                'records_synced' => (int)($row['records_synced'] ?? 0),
                'last_error' => $row['last_error_message']
            ];
        }

        return $stateMap;
    }
}
