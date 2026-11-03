<?php
declare(strict_types=1);

namespace Cockpit\Services;

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

    public static function getConnector(string $sourceKey): ?LeadConnectorInterface {
        self::initConnectors();
        return self::$connectors[$sourceKey] ?? null;
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
        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE tenant_id = ? AND source_key = ? LIMIT 1");
        $stmt->execute([$tenantId, $sourceKey]);
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
        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE tenant_id = ? AND source_key = ? LIMIT 1");
        $stmt->execute([$tenantId, $sourceKey]);
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
                        status = 'connected_syncing',
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

    /**
     * Synchronize all enabled pull sources for a single tenant
     */
    public static function syncAllSourcesForTenant(int $tenantId, string $syncType = 'cron'): array {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT source_key FROM lead_sources_config 
            WHERE tenant_id = ? AND is_enabled = 1 AND sync_mode = 'api_pull'
        ");
        $stmt->execute([$tenantId]);
        $sources = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $results = [];
        foreach ($sources as $sourceKey) {
            $results[$sourceKey] = self::syncSource($tenantId, $sourceKey, $syncType);
        }

        return $results;
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
}
