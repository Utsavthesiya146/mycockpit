<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use Cockpit\Utils\Encryption;
use Cockpit\Services\Automation\PlatformAutomationDriverInterface;
use Cockpit\Services\Automation\EAFWebAutomationDriver;
use Cockpit\Services\Automation\BNIWebAutomationDriver;
use Cockpit\Services\Automation\KVVWebAutomationDriver;
use PDO;

class AppHubController {

    private static bool $schemaMigrated = false;

    /**
     * Ensure database schema compatibility for Render / MySQL 8 strict mode.
     * Safely widens rigid ENUM status columns to VARCHAR(50) and creates required tables.
     */
    public static function ensureSchemaCompatibility(?PDO $db = null): void {
        if (self::$schemaMigrated) {
            return;
        }

        try {
            $db = $db ?? Database::getConnection();

            // 1. Check and convert connected_apps columns if they are ENUM
            $connColStmt = $db->query("SHOW COLUMNS FROM `connected_apps` LIKE 'connection_status'");
            if ($col = $connColStmt->fetch(PDO::FETCH_ASSOC)) {
                $type = strtolower((string)($col['Type'] ?? ''));
                if (str_starts_with($type, 'enum')) {
                    $db->exec("ALTER TABLE `connected_apps` 
                        MODIFY COLUMN `connection_status` VARCHAR(50) DEFAULT 'launcher_only',
                        MODIFY COLUMN `auth_type` VARCHAR(50) DEFAULT 'direct_link',
                        MODIFY COLUMN `category` VARCHAR(50) DEFAULT 'business'");
                }
            }

            // 2. Ensure lead_platform_sessions table exists and has VARCHAR(50) session_status
            $db->exec("CREATE TABLE IF NOT EXISTS `lead_platform_sessions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `source_key` VARCHAR(50) NOT NULL,
                `session_status` VARCHAR(50) DEFAULT 'disconnected',
                `encrypted_session_data` TEXT NULL,
                `last_validated_at` DATETIME NULL,
                `session_expires_at` DATETIME NULL,
                `rate_limit_reset_at` DATETIME NULL,
                `notes` TEXT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_tenant_platform_session` (`tenant_id`, `source_key`),
                INDEX `idx_session_tenant_source` (`tenant_id`, `source_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // Check if existing lead_platform_sessions has ENUM session_status
            try {
                $sessColStmt = $db->query("SHOW COLUMNS FROM `lead_platform_sessions` LIKE 'session_status'");
                if ($sessCol = $sessColStmt->fetch(PDO::FETCH_ASSOC)) {
                    $sessType = strtolower((string)($sessCol['Type'] ?? ''));
                    if (str_starts_with($sessType, 'enum')) {
                        $db->exec("ALTER TABLE `lead_platform_sessions` 
                            MODIFY COLUMN `session_status` VARCHAR(50) DEFAULT 'disconnected'");
                    }
                }
            } catch (\Throwable $e) {}

            // 3. Ensure lead_sources_config table exists and has VARCHAR(50) status
            $db->exec("CREATE TABLE IF NOT EXISTS `lead_sources_config` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `source_key` VARCHAR(50) NOT NULL,
                `name` VARCHAR(100) NOT NULL,
                `category` VARCHAR(50) DEFAULT 'referral',
                `status` VARCHAR(50) DEFAULT 'manual_csv_import',
                `api_key` VARCHAR(150) NULL,
                `webhook_secret` VARCHAR(150) NULL,
                `settings_json` LONGTEXT NULL,
                `encrypted_credentials` TEXT NULL,
                `last_sync_at` DATETIME NULL,
                `sync_checkpoint` VARCHAR(255) NULL,
                `sync_interval_minutes` INT DEFAULT 15,
                `last_error_message` TEXT NULL,
                `last_error_at` DATETIME NULL,
                `retry_count` INT DEFAULT 0,
                `auto_assign_user_id` INT NULL,
                `sync_count` INT DEFAULT 0,
                `is_enabled` TINYINT(1) DEFAULT 1,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_sources_tenant` (`tenant_id`),
                INDEX `idx_sources_key` (`source_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            try {
                $srcColStmt = $db->query("SHOW COLUMNS FROM `lead_sources_config` LIKE 'status'");
                if ($srcCol = $srcColStmt->fetch(PDO::FETCH_ASSOC)) {
                    $srcType = strtolower((string)($srcCol['Type'] ?? ''));
                    if (str_starts_with($srcType, 'enum')) {
                        $db->exec("ALTER TABLE `lead_sources_config` 
                            MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'manual_csv_import'");
                    }
                }
            } catch (\Throwable $e) {}

            // 4. Ensure lead_writeback_queue table exists
            $db->exec("CREATE TABLE IF NOT EXISTS `lead_writeback_queue` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `lead_id` INT NOT NULL,
                `source_platform` VARCHAR(50) NOT NULL,
                `source_lead_id` VARCHAR(100) NOT NULL,
                `action_type` VARCHAR(50) NOT NULL,
                `proposed_payload` JSON NOT NULL,
                `original_snapshot` JSON NULL,
                `status` VARCHAR(50) DEFAULT 'pending_confirmation',
                `conflict_details` JSON NULL,
                `error_message` TEXT NULL,
                `retry_count` INT DEFAULT 0,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_wb_queue_tenant_status` (`tenant_id`, `status`),
                INDEX `idx_wb_queue_lead` (`lead_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        } catch (\Throwable $e) {
            error_log('Schema compatibility check notice: ' . $e->getMessage());
        }

        self::$schemaMigrated = true;
    }

    /**
     * Resolve EAF Automation Driver with deterministic loading and graceful error handling
     */
    private static function getEAFDriver(): EAFWebAutomationDriver {
        if (!class_exists(EAFWebAutomationDriver::class)) {
            $driverFile = __DIR__ . '/../services/automation/EAFWebAutomationDriver.php';
            if (file_exists($driverFile)) {
                require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
                require_once $driverFile;
            }
        }

        if (!class_exists(EAFWebAutomationDriver::class)) {
            Response::error('EAF Web Automation Driver is unavailable on this server.', 500);
        }

        return new EAFWebAutomationDriver('https://eafconnect.com');
    }

    private static function resolveSourceKey(string $name, string $url): ?string {
        $n = strtolower($name);
        $u = strtolower($url);
        if (str_contains($n, 'eaf') || str_contains($u, 'eafconnect')) return 'eaf';
        if (str_contains($n, 'bni') || str_contains($u, 'bniconnect')) return 'bni';
        if (str_contains($n, 'kvv') || str_contains($u, 'kannadigara')) return 'kvv';
        return null;
    }

    public static function listApps(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        // Ensure database schema compatibility for Render / MySQL 8
        self::ensureSchemaCompatibility($db);

        // 1. Ensure all standard applications and Master CRM Portals exist for this tenant
        $standardApps = [
            [
                'name' => 'EAF Connect',
                'url' => 'https://eafconnect.com',
                'category' => 'business',
                'icon' => 'Users',
                'check' => '%eafconnect%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'BNI Connect',
                'url' => 'https://www.bniconnectglobal.com',
                'category' => 'business',
                'icon' => 'Briefcase',
                'check' => '%bniconnect%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'KVV Portal',
                'url' => 'https://app.kannadigaravyaapaaravedike.com',
                'category' => 'business',
                'icon' => 'Briefcase',
                'check' => '%kannadigara%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'Google Calendar',
                'url' => 'https://calendar.google.com',
                'category' => 'productivity',
                'icon' => 'Calendar',
                'check' => '%calendar.google.com%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'Google Drive',
                'url' => 'https://drive.google.com',
                'category' => 'cloud',
                'icon' => 'HardDrive',
                'check' => '%drive.google.com%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'Gmail',
                'url' => 'https://mail.google.com',
                'category' => 'communication',
                'icon' => 'Mail',
                'check' => '%mail.google.com%',
                'status' => 'launcher_only',
                'pinned' => 1
            ],
            [
                'name' => 'Right Form',
                'url' => 'https://rightform.com',
                'category' => 'productivity',
                'icon' => 'FileText',
                'check' => '%rightform.com%',
                'status' => 'launcher_only',
                'pinned' => 0
            ],
            [
                'name' => 'My iNotes',
                'url' => 'https://myinotes.com',
                'category' => 'productivity',
                'icon' => 'BookOpen',
                'check' => '%myinotes.com%',
                'status' => 'launcher_only',
                'pinned' => 0
            ],
        ];

        foreach ($standardApps as $p) {
            $check = $db->prepare("SELECT id FROM connected_apps WHERE tenant_id = ? AND (app_url LIKE ? OR name LIKE ?) LIMIT 1");
            $check->execute([$tenantId, $p['check'], '%' . $p['name'] . '%']);
            if (!$check->fetchColumn()) {
                $ins = $db->prepare("INSERT INTO connected_apps 
                    (tenant_id, name, category, icon_name, app_url, connection_status, auth_type, is_pinned)
                    VALUES (?, ?, ?, ?, ?, ?, 'direct_link', ?)");
                $ins->execute([$tenantId, $p['name'], $p['category'], $p['icon'], $p['url'], $p['status'], $p['pinned']]);
            }
        }

        // 2. Ensure names and URLs are normalized for consistency
        $db->prepare("UPDATE connected_apps SET name = 'Gmail' WHERE tenant_id = ? AND name LIKE '%Gmail Workspace%'")->execute([$tenantId]);
        $db->prepare("UPDATE connected_apps SET app_url = 'https://app.kannadigaravyaapaaravedike.com' WHERE tenant_id = ? AND app_url LIKE '%kvv.gov.in%'")->execute([$tenantId]);

        // 3. Fetch apps
        $stmt = $db->prepare("
            SELECT * FROM connected_apps
            WHERE tenant_id = ?
            ORDER BY is_pinned DESC, name ASC
        ");
        $stmt->execute([$tenantId]);
        $apps = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. Enrich portal apps with real connection metadata
        $enriched = [];
        foreach ($apps as $app) {
            $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
            
            if ($sourceKey) {
                $app['is_portal'] = true;
                $app['source_key'] = $sourceKey;

                // Query lead_platform_sessions (NO secrets returned!)
                $sStmt = $db->prepare("SELECT session_status, last_validated_at, 
                    (encrypted_session_data IS NOT NULL AND LENGTH(encrypted_session_data) > 0) AS has_creds
                    FROM lead_platform_sessions 
                    WHERE tenant_id = ? AND source_key = ? LIMIT 1");
                $sStmt->execute([$tenantId, $sourceKey]);
                $sess = $sStmt->fetch(PDO::FETCH_ASSOC);

                // Query lead_sources_config
                $cStmt = $db->prepare("SELECT status, last_sync_at, last_error_message, sync_count 
                    FROM lead_sources_config 
                    WHERE tenant_id = ? AND source_key = ? LIMIT 1");
                $cStmt->execute([$tenantId, $sourceKey]);
                $cfg = $cStmt->fetch(PDO::FETCH_ASSOC);

                $sessionStatus = $sess['session_status'] ?? 'disconnected';
                $hasStoredCreds = !empty($sess['has_creds']);
                $cfgStatus = $cfg['status'] ?? null;
                $lastError = $cfg['last_error_message'] ?? null;

                // Determine honest UI connection_status according to the Authentication Truth Rule:
                // An app is ONLY connected if session is active, no active error exists, and config is connected
                if ($sessionStatus === 'active' && empty($lastError) && $cfgStatus === 'connected') {
                    $app['connection_status'] = 'connected';
                } elseif ($sessionStatus === 'captcha_required') {
                    $app['connection_status'] = 'captcha_required';
                } elseif ($sessionStatus === 'mfa_required') {
                    $app['connection_status'] = 'mfa_required';
                } elseif ($sessionStatus === 'expired') {
                    $app['connection_status'] = 'expired';
                } elseif ($sessionStatus === 'auth_required' || $cfgStatus === 'auth_required' || !empty($lastError)) {
                    $app['connection_status'] = 'auth_required';
                } elseif ($hasStoredCreds) {
                    $app['connection_status'] = 'auth_required';
                } else {
                    $app['connection_status'] = 'disconnected';
                }

                $app['session_status'] = $sessionStatus;
                $app['has_stored_credentials'] = $hasStoredCreds;
                $app['last_synced_at'] = $cfg['last_sync_at'] ?? null;
                $app['last_error'] = $lastError;
                $app['sync_count'] = (int)($cfg['sync_count'] ?? 0);
            } else {
                $app['is_portal'] = false;
                $app['source_key'] = null;
                $app['has_stored_credentials'] = false;
            }

            $enriched[] = $app;
        }

        Response::success($enriched);
    }

    public static function connectPortal(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("SELECT * FROM connected_apps WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tenantId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            Response::error('Application not found or unauthorized.', 404);
        }

        $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
        if (!$sourceKey) {
            Response::error('This application is a generic web shortcut and does not support portal authentication.', 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = trim((string)($input['username'] ?? ($input['email'] ?? ($input['userId'] ?? ''))));
        $password = (string)($input['password'] ?? '');

        if (empty($username) || empty($password)) {
            Response::error('User ID / Email and Password are required.', 422);
        }

        if ($sourceKey === 'eaf') {
            $driver = self::getEAFDriver();
            $authResult = $driver->authenticateSession($username, $password);

            if (($authResult['status'] ?? '') === 'captcha_required') {
                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, last_validated_at)
                    VALUES (?, 'eaf', 'captcha_required', NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'captcha_required', last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('CAPTCHA / Security verification challenge detected on EAF Connect. Interactive challenge required.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required',
                    'source_key' => 'eaf'
                ]);
            }

            if (($authResult['status'] ?? '') !== 'active') {
                $errMsg = $authResult['message'] ?? 'Invalid email or password on EAF Connect.';

                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                    ->execute([$errMsg, $tenantId]);

                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                    VALUES (?, 'eaf', 'expired', NULL, NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'expired', encrypted_session_data = NULL, last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'auth_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Authentication failed: ' . $errMsg, 401, [
                    'session_status' => 'expired',
                    'connection_status' => 'auth_required',
                    'source_key' => 'eaf',
                    'reason' => $authResult['reason'] ?? 'auth_failed',
                    'diagnostics' => $authResult['diagnostics'] ?? null
                ]);
            }

            // Live Authentication Succeeded
            $sessionPayload = [
                'email' => $username,
                'password' => $password,
                'cookie_jar' => $authResult['cookie_jar'] ?? '',
                'cookies' => $authResult['cookies'] ?? [],
                'ci_session' => $authResult['ci_session'] ?? null,
                'is_live' => true,
                'authenticated_at' => date('Y-m-d H:i:s')
            ];
            $encrypted = Encryption::encrypt(json_encode($sessionPayload));

            $sStmt = $db->prepare("INSERT INTO lead_platform_sessions 
                (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                VALUES (?, 'eaf', 'active', ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    session_status = 'active',
                    encrypted_session_data = VALUES(encrypted_session_data),
                    last_validated_at = NOW()");
            $sStmt->execute([$tenantId, $encrypted]);

            $cStmt = $db->prepare("UPDATE lead_sources_config 
                SET encrypted_credentials = ?, status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW()
                WHERE tenant_id = ? AND source_key = 'eaf'");
            $cStmt->execute([$encrypted, $tenantId]);

            $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::success([
                'id' => $id,
                'source_key' => 'eaf',
                'session_status' => 'active',
                'connection_status' => 'connected',
                'has_stored_credentials' => true,
                'message' => 'Successfully authenticated with EAF Connect (https://eafconnect.com). Active session verified and securely encrypted (AES-256-GCM).'
            ], 'EAF Connect authenticated successfully');
        }

        // Encrypt credentials using AES-256-GCM for platforms awaiting their phase
        $sessionPayload = [
            'email' => $username,
            'password' => $password,
            'updated_at' => date('Y-m-d H:i:s')
        ];
        $encrypted = Encryption::encrypt(json_encode($sessionPayload));

        // Save to lead_platform_sessions with status 'disconnected' and credentials present (validated in future phases)
        $sStmt = $db->prepare("INSERT INTO lead_platform_sessions 
            (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
            VALUES (?, ?, 'disconnected', ?, NOW())
            ON DUPLICATE KEY UPDATE 
                session_status = 'disconnected',
                encrypted_session_data = VALUES(encrypted_session_data),
                last_validated_at = NOW()");
        $sStmt->execute([$tenantId, $sourceKey, $encrypted]);

        // Also update lead_sources_config with 'auth_required'
        $cStmt = $db->prepare("UPDATE lead_sources_config 
            SET encrypted_credentials = ?, status = 'auth_required', last_error_message = NULL, updated_at = NOW()
            WHERE tenant_id = ? AND source_key = ?");
        $cStmt->execute([$encrypted, $tenantId, $sourceKey]);

        // Update connected_apps status
        $db->prepare("UPDATE connected_apps SET connection_status = 'auth_required', updated_at = NOW() WHERE id = ?")
            ->execute([$id]);

        Response::success([
            'id' => $id,
            'source_key' => $sourceKey,
            'session_status' => 'disconnected',
            'connection_status' => 'auth_required',
            'has_stored_credentials' => true,
            'message' => 'Credentials securely encrypted with AES-256-GCM and stored. Live production authentication will be verified in its phase.'
        ], 'Portal credentials encrypted and securely saved');
    }

    public static function testConnection(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("SELECT * FROM connected_apps WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tenantId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            Response::error('Application not found or unauthorized.', 404);
        }

        $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
        if (!$sourceKey) {
            Response::error('This application does not support portal testing.', 400);
        }

        // Check if encrypted credentials exist
        $sStmt = $db->prepare("SELECT session_status, encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = ? LIMIT 1");
        $sStmt->execute([$tenantId, $sourceKey]);
        $sess = $sStmt->fetch(PDO::FETCH_ASSOC);

        if (empty($sess['encrypted_session_data'])) {
            Response::error('No credentials configured for ' . $app['name'] . '. Please enter User ID and Password.', 400, [
                'session_status' => 'disconnected',
                'connection_status' => 'disconnected'
            ]);
        }

        // Validate decryption without revealing secrets
        try {
            $dec = json_decode((string)Encryption::decrypt($sess['encrypted_session_data']), true);
            if (!is_array($dec) || (empty($dec['email']) && empty($dec['cookie_jar']))) {
                Response::error('Stored credentials format invalid. Please reconnect.', 400);
            }
        } catch (\Throwable $e) {
            Response::error('Failed to decrypt credentials: ' . $e->getMessage(), 500);
        }

        if ($sourceKey === 'eaf') {
            $driver = self::getEAFDriver();
            $validation = $driver->validateSession($tenantId, $dec);

            if (($validation['status'] ?? '') === 'active') {
                if (!empty($validation['session_updates'])) {
                    $dec['cookie_jar'] = $validation['session_updates']['cookie_jar'] ?? ($dec['cookie_jar'] ?? '');
                    $dec['cookies'] = $validation['session_updates']['cookies'] ?? ($dec['cookies'] ?? []);
                    $newEncrypted = Encryption::encrypt(json_encode($dec));
                    $db->prepare("UPDATE lead_platform_sessions SET encrypted_session_data = ?, session_status = 'active', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                        ->execute([$newEncrypted, $tenantId]);
                } else {
                    $db->prepare("UPDATE lead_platform_sessions SET last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                        ->execute([$tenantId]);
                }

                $db->prepare("UPDATE lead_sources_config SET status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::success([
                    'id' => $id,
                    'source_key' => 'eaf',
                    'session_status' => 'active',
                    'connection_status' => 'connected',
                    'has_stored_credentials' => true,
                    'message' => 'EAF Connect session is active and verified against member dashboard.'
                ], 'EAF session active and verified');
            }

            if (($validation['status'] ?? '') === 'captcha_required') {
                $db->prepare("UPDATE lead_platform_sessions SET session_status = 'captcha_required', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = 'CAPTCHA challenge required', last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('CAPTCHA / Security challenge detected on EAF Connect. Please complete challenge in browser.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required'
                ]);
            }

            $errMsg = $validation['message'] ?? 'EAF Connect session has expired or is invalid. Re-authentication required.';
            $db->prepare("UPDATE lead_platform_sessions SET session_status = 'expired', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                ->execute([$tenantId]);
            $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                ->execute([$errMsg, $tenantId]);
            $db->prepare("UPDATE connected_apps SET connection_status = 'expired', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::error($errMsg, 401, [
                'session_status' => 'expired',
                'connection_status' => 'expired',
                'message' => $errMsg
            ]);
        }

        // Honest reporting per Strict Rules for other platforms
        Response::success([
            'id' => $id,
            'source_key' => $sourceKey,
            'session_status' => $sess['session_status'] ?? 'auth_required',
            'has_stored_credentials' => true,
            'message' => 'Secure credential storage verified (AES-256-GCM). Live external authentication validation scheduled for its phase.'
        ], 'Portal credentials verified in encrypted storage');
    }

    public static function disconnectPortal(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("SELECT * FROM connected_apps WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tenantId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            Response::error('Application not found or unauthorized.', 404);
        }

        $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
        if (!$sourceKey) {
            Response::error('This application does not support portal disconnection.', 400);
        }

        // Purge session credentials
        $db->prepare("UPDATE lead_platform_sessions SET encrypted_session_data = NULL, session_status = 'disconnected', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = ?")
            ->execute([$tenantId, $sourceKey]);

        $db->prepare("UPDATE lead_sources_config SET encrypted_credentials = NULL, status = 'manual_csv_import', last_error_message = NULL, updated_at = NOW() WHERE tenant_id = ? AND source_key = ?")
            ->execute([$tenantId, $sourceKey]);

        $db->prepare("UPDATE connected_apps SET connection_status = 'disconnected', updated_at = NOW() WHERE id = ?")
            ->execute([$id]);

        Response::success([
            'id' => $id,
            'source_key' => $sourceKey,
            'session_status' => 'disconnected',
            'connection_status' => 'disconnected',
            'has_stored_credentials' => false,
            'message' => "Portal '{$app['name']}' has been disconnected and saved credentials purged."
        ], 'Portal disconnected successfully');
    }

    public static function syncPortalNow(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("SELECT * FROM connected_apps WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tenantId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            Response::error('Application not found or unauthorized.', 404);
        }

        $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
        if (!$sourceKey) {
            Response::error('This application does not support portal sync.', 400);
        }

        // Honest phase reporting: Live automated lead sync is Phase 4
        Response::error("Automated live synchronization for {$app['name']} is scheduled for Phase 4. Please complete portal connection and authentication in Phase 2 first.", 400, [
            'id' => $id,
            'source_key' => $sourceKey,
            'phase' => 'Phase 4 requirement'
        ]);
    }

    public static function getPortalReferrals(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("SELECT * FROM connected_apps WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tenantId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            Response::error('Application not found or unauthorized.', 404);
        }

        $sourceKey = self::resolveSourceKey($app['name'] ?? '', $app['app_url'] ?? '');
        if ($sourceKey !== 'eaf') {
            Response::error('Read-only referral inspection is currently supported for EAF Connect in Phase 2A.', 400);
        }

        $sStmt = $db->prepare("SELECT session_status, encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = 'eaf' LIMIT 1");
        $sStmt->execute([$tenantId]);
        $sess = $sStmt->fetch(PDO::FETCH_ASSOC);

        if (empty($sess['encrypted_session_data'])) {
            Response::error('EAF Connect is not connected. Please connect with valid credentials first.', 400);
        }

        $dec = json_decode((string)Encryption::decrypt($sess['encrypted_session_data']), true);
        if (!is_array($dec)) {
            Response::error('Unable to decrypt session data. Please re-authenticate.', 400);
        }

        $driver = self::getEAFDriver();
        $result = $driver->fetchReceivedReferrals($tenantId, $dec);

        if (!$result['success']) {
            Response::error($result['message'] ?? 'Failed to fetch referrals from EAF Connect.', 400, $result);
        }

        // Staged read-only output WITHOUT modifying crm_leads table
        Response::success([
            'app_id' => $id,
            'source_key' => 'eaf',
            'count' => $result['count'],
            'referrals' => $result['referrals'],
            'mode' => 'read_only_staging',
            'note' => 'Staged referrals retrieved from EAF member interface. Central CRM leads table was NOT mutated.'
        ], 'EAF referrals retrieved successfully (Read-Only)');
    }

    public static function addApp(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $appUrl = trim($input['app_url'] ?? '');

        if (empty($name) || empty($appUrl)) {
            Response::error('Application name and valid URL are required.', 422);
        }

        if (!filter_var($appUrl, FILTER_VALIDATE_URL)) {
            Response::error('Invalid URL format. Include http:// or https://', 422);
        }

        self::ensureSchemaCompatibility();

        $validStatuses = ['connected', 'launcher_only', 'config_required', 'unsupported', 'disconnected', 'expired', 'captcha_required', 'auth_required', 'mfa_required', 'error'];
        $status = in_array($input['connection_status'] ?? '', $validStatuses, true) 
            ? $input['connection_status'] 
            : 'launcher_only';

        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);
        $stmt = $db->prepare("
            INSERT INTO connected_apps (tenant_id, name, category, icon_name, app_url, connection_status, auth_type, is_pinned, settings_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            $input['category'] ?? 'business',
            $input['icon_name'] ?? 'Globe',
            $appUrl,
            $status,
            $input['auth_type'] ?? 'direct_link',
            !empty($input['is_pinned']) ? 1 : 0,
            !empty($input['settings_json']) ? json_encode($input['settings_json']) : null
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Application shortcut added', 201);
    }

    public static function updateApp(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $appUrl = trim($input['app_url'] ?? '');

        if (empty($name) || empty($appUrl)) {
            Response::error('Application name and URL are required.', 422);
        }

        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);
        $stmt = $db->prepare("
            UPDATE connected_apps 
            SET name = ?, category = ?, icon_name = ?, app_url = ?, connection_status = ?, is_pinned = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $name,
            $input['category'] ?? 'business',
            $input['icon_name'] ?? 'Globe',
            $appUrl,
            $input['connection_status'] ?? 'launcher_only',
            !empty($input['is_pinned']) ? 1 : 0,
            $id,
            $tenantId
        ]);

        Response::success(null, 'Application updated');
    }

    public static function deleteApp(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);
        $stmt = $db->prepare("DELETE FROM connected_apps WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application deleted');
    }

    public static function togglePin(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();
        self::ensureSchemaCompatibility($db);

        $stmt = $db->prepare("UPDATE connected_apps SET is_pinned = 1 - is_pinned WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application pin toggled');
    }
}
