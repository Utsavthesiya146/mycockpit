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
                `sync_mode` VARCHAR(50) DEFAULT 'manual_import',
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
                $srcColStmt = $db->query("SHOW COLUMNS FROM `lead_sources_config`");
                $srcCols = [];
                while ($sc = $srcColStmt->fetch(PDO::FETCH_ASSOC)) {
                    $srcCols[] = strtolower($sc['Field']);
                    if (strtolower($sc['Field']) === 'status') {
                        $srcType = strtolower((string)($sc['Type'] ?? ''));
                        if (str_starts_with($srcType, 'enum')) {
                            $db->exec("ALTER TABLE `lead_sources_config` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'manual_csv_import'");
                        }
                    }
                }
                if (!in_array('sync_mode', $srcCols)) {
                    $db->exec("ALTER TABLE `lead_sources_config` ADD COLUMN `sync_mode` VARCHAR(50) DEFAULT 'manual_import' AFTER `category`");
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

            // 5. Ensure lead_activities table exists
            $db->exec("CREATE TABLE IF NOT EXISTS `lead_activities` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `lead_id` INT NOT NULL,
                `user_id` INT NULL,
                `activity_type` VARCHAR(50) NOT NULL,
                `title` VARCHAR(255) NOT NULL,
                `description` TEXT NULL,
                `activity_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `metadata` JSON NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_lead_act_tenant` (`tenant_id`),
                INDEX `idx_lead_act_lead` (`lead_id`),
                INDEX `idx_lead_act_date` (`activity_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // 6. Ensure lead_sync_logs table exists
            $db->exec("CREATE TABLE IF NOT EXISTS `lead_sync_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `source_key` VARCHAR(50) NOT NULL,
                `sync_type` VARCHAR(50) NOT NULL,
                `status` VARCHAR(50) NOT NULL,
                `leads_fetched` INT DEFAULT 0,
                `leads_created` INT DEFAULT 0,
                `leads_updated` INT DEFAULT 0,
                `leads_skipped` INT DEFAULT 0,
                `checkpoint_before` VARCHAR(255) NULL,
                `checkpoint_after` VARCHAR(255) NULL,
                `error_details` TEXT NULL,
                `execution_time_ms` INT DEFAULT 0,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_sync_logs_tenant` (`tenant_id`, `source_key`),
                INDEX `idx_sync_logs_date` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // 7. Ensure crm_leads tracking columns exist
            try {
                $colsStmt = $db->query("SHOW COLUMNS FROM `crm_leads`");
                $existingCols = [];
                while ($c = $colsStmt->fetch(PDO::FETCH_ASSOC)) {
                    $existingCols[] = strtolower($c['Field']);
                }
                if (!in_array('service_requirement', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `service_requirement` VARCHAR(255) NULL AFTER `source`");
                }
                if (!in_array('priority', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `priority` VARCHAR(50) DEFAULT 'medium' AFTER `status`");
                }
                if (!in_array('assigned_to', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `assigned_to` INT NULL AFTER `service_requirement`");
                }
                if (!in_array('source_lead_id', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `source_lead_id` VARCHAR(100) NULL AFTER `assigned_to`");
                }
                if (!in_array('last_contact_date', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `last_contact_date` DATETIME NULL AFTER `source_lead_id`");
                }
                if (!in_array('next_followup_date', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `next_followup_date` DATETIME NULL AFTER `last_contact_date`");
                }
                if (!in_array('sync_status', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `sync_status` VARCHAR(50) DEFAULT 'manual' AFTER `source_lead_id`");
                }
                if (!in_array('source_platform', $existingCols)) {
                    $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `source_platform` VARCHAR(50) NULL AFTER `sync_status`");
                }
            } catch (\Throwable $e) {}

            // 8. Ensure follow_ups tracking columns exist
            try {
                $fuColsStmt = $db->query("SHOW COLUMNS FROM `follow_ups`");
                $fuExistingCols = [];
                while ($fc = $fuColsStmt->fetch(PDO::FETCH_ASSOC)) {
                    $fuExistingCols[] = strtolower($fc['Field']);
                }
                if (!in_array('contact_method', $fuExistingCols)) {
                    $db->exec("ALTER TABLE `follow_ups` ADD COLUMN `contact_method` VARCHAR(50) DEFAULT 'call' AFTER `title`");
                }
                if (!in_array('assigned_to', $fuExistingCols)) {
                    $db->exec("ALTER TABLE `follow_ups` ADD COLUMN `assigned_to` INT NULL AFTER `lead_id`");
                }
                if (!in_array('outcome', $fuExistingCols)) {
                    $db->exec("ALTER TABLE `follow_ups` ADD COLUMN `outcome` VARCHAR(255) NULL AFTER `notes`");
                }
                if (!in_array('completed_at', $fuExistingCols)) {
                    $db->exec("ALTER TABLE `follow_ups` ADD COLUMN `completed_at` DATETIME NULL AFTER `status`");
                }
            } catch (\Throwable $e) {}

            // 9. Ensure Gmail Integration tables exist for Render deployment compatibility
            $db->exec("CREATE TABLE IF NOT EXISTS `gmail_accounts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `email_address` VARCHAR(255) NOT NULL,
                `account_name` VARCHAR(255) NULL,
                `connection_status` ENUM('connected', 'disconnected', 'expired', 'auth_required') DEFAULT 'auth_required',
                `encrypted_tokens` LONGTEXT NULL,
                `history_id` VARCHAR(64) NULL,
                `messages_total` INT DEFAULT 0,
                `threads_total` INT DEFAULT 0,
                `last_sync_at` DATETIME NULL,
                `sync_status` ENUM('sync_successful', 'sync_failed', 'syncing', 'not_synced') DEFAULT 'not_synced',
                `last_error` TEXT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_tenant_email` (`tenant_id`, `email_address`),
                INDEX `idx_tenant_status` (`tenant_id`, `connection_status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS `gmail_oauth_states` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `user_id` INT NOT NULL,
                `state_token` VARCHAR(128) NOT NULL UNIQUE,
                `code_verifier` VARCHAR(128) NULL,
                `redirect_url` VARCHAR(500) NULL,
                `expires_at` DATETIME NOT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_state_token` (`state_token`),
                INDEX `idx_tenant_expires` (`tenant_id`, `expires_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS `gmail_messages` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL,
                `gmail_account_id` INT NOT NULL,
                `message_id` VARCHAR(64) NOT NULL,
                `thread_id` VARCHAR(64) NOT NULL,
                `from_name` VARCHAR(255) NULL,
                `from_email` VARCHAR(255) NULL,
                `to_recipients` TEXT NULL,
                `cc_recipients` TEXT NULL,
                `bcc_recipients` TEXT NULL,
                `reply_to` VARCHAR(255) NULL,
                `subject` VARCHAR(500) NULL,
                `snippet` VARCHAR(1000) NULL,
                `body_plain` MEDIUMTEXT NULL,
                `body_html` MEDIUMTEXT NULL,
                `body_fetched` TINYINT(1) DEFAULT 0,
                `internal_date` BIGINT NULL,
                `date_sent` DATETIME NULL,
                `is_read` TINYINT(1) DEFAULT 0,
                `is_starred` TINYINT(1) DEFAULT 0,
                `is_draft` TINYINT(1) DEFAULT 0,
                `is_sent` TINYINT(1) DEFAULT 0,
                `is_trash` TINYINT(1) DEFAULT 0,
                `is_spam` TINYINT(1) DEFAULT 0,
                `is_important` TINYINT(1) DEFAULT 0,
                `labels_json` TEXT NULL,
                `has_attachments` TINYINT(1) DEFAULT 0,
                `attachments_json` TEXT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_tenant_message` (`tenant_id`, `message_id`),
                INDEX `idx_tenant_thread` (`tenant_id`, `thread_id`),
                INDEX `idx_tenant_folder` (`tenant_id`, `is_trash`, `is_spam`, `is_read`, `date_sent`)
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

    /**
     * Resolve BNI Automation Driver with deterministic loading and graceful error handling
     */
    private static function getBNIDriver(): BNIWebAutomationDriver {
        if (!class_exists(BNIWebAutomationDriver::class)) {
            $driverFile = __DIR__ . '/../services/automation/BNIWebAutomationDriver.php';
            if (file_exists($driverFile)) {
                require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
                require_once $driverFile;
            }
        }

        if (!class_exists(BNIWebAutomationDriver::class)) {
            Response::error('BNI Web Automation Driver is unavailable on this server.', 500);
        }

        return new BNIWebAutomationDriver();
    }

    /**
     * Resolve KVV Automation Driver with deterministic loading and graceful error handling
     */
    private static function getKVVDriver(): KVVWebAutomationDriver {
        if (!class_exists(KVVWebAutomationDriver::class)) {
            $driverFile = __DIR__ . '/../services/automation/KVVWebAutomationDriver.php';
            if (file_exists($driverFile)) {
                require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
                require_once $driverFile;
            }
        }

        if (!class_exists(KVVWebAutomationDriver::class)) {
            Response::error('KVV Web Automation Driver is unavailable on this server.', 500);
        }

        return new KVVWebAutomationDriver();
    }

    private static function resolveSourceKey(string $name, string $url): ?string {
        $n = strtolower($name);
        $u = strtolower($url);
        if (str_contains($n, 'eaf') || str_contains($u, 'eafconnect')) return 'eaf';
        if (str_contains($n, 'bni') || str_contains($u, 'bniconnect')) return 'bni';
        if (str_contains($n, 'kvv') || str_contains($u, 'kannadigara') || str_contains($u, 'kannadavyapaaravedike') || str_contains($n, 'kannada')) return 'kvv';
        if (str_contains($n, 'gmail') || str_contains($u, 'mail.google.com')) return 'gmail';
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
                $cStmt = $db->prepare("SELECT status, last_sync_at, last_error_message, sync_count,
                    (encrypted_credentials IS NOT NULL AND LENGTH(encrypted_credentials) > 0) AS has_cfg_creds
                    FROM lead_sources_config 
                    WHERE tenant_id = ? AND source_key = ? LIMIT 1");
                $cStmt->execute([$tenantId, $sourceKey]);
                $cfg = $cStmt->fetch(PDO::FETCH_ASSOC);

                $sessionStatus = $sess['session_status'] ?? 'disconnected';
                $hasStoredCreds = !empty($sess['has_creds']) || !empty($cfg['has_cfg_creds']);
                $cfgStatus = $cfg['status'] ?? null;
                $lastError = $cfg['last_error_message'] ?? null;

                // If lead_sources_config has valid encrypted credentials, ensure sessionStatus reflects active
                if ($cfgStatus === 'connected' && !empty($cfg['has_cfg_creds']) && $sessionStatus === 'disconnected') {
                    $sessionStatus = 'active';
                }

                // If no credentials or tokens are stored, session CANNOT be active
                if (!$hasStoredCreds && $sessionStatus === 'active') {
                    $sessionStatus = 'auth_required';
                }

                // Reconcile Authentication Status (strictly based on session and encrypted credential presence)
                if ($hasStoredCreds && $sessionStatus === 'active') {
                    $authStatus = 'connected';
                    $connectionStatus = 'connected';
                    $nextAction = 'Sync Leads Now';
                    $nextActionKey = 'sync_now';
                } elseif ($sessionStatus === 'captcha_required') {
                    $authStatus = 'captcha_required';
                    $connectionStatus = 'captcha_required';
                    $nextAction = 'Solve Security Challenge';
                    $nextActionKey = 'connect';
                } elseif ($sessionStatus === 'mfa_required') {
                    $authStatus = 'mfa_required';
                    $connectionStatus = 'mfa_required';
                    $nextAction = 'Complete MFA Verification';
                    $nextActionKey = 'connect';
                } elseif ($sessionStatus === 'expired') {
                    $authStatus = 'expired';
                    $connectionStatus = 'expired';
                    $nextAction = 'Reconnect Portal';
                    $nextActionKey = 'connect';
                } elseif ($hasStoredCreds) {
                    $authStatus = 'auth_required';
                    $connectionStatus = 'auth_required';
                    $nextAction = 'Reconnect Portal';
                    $nextActionKey = 'connect';
                } else {
                    $authStatus = ($cfgStatus === 'manual_csv_import' || ($app['connection_status'] ?? '') === 'disconnected') ? 'disconnected' : 'auth_required';
                    $connectionStatus = 'auth_required';
                    $nextAction = ($sourceKey === 'eaf') ? 'Connect Member Session' : 'Connect Portal';
                    $nextActionKey = 'connect';
                }

                // Self-heal: ensure connected_apps table in database matches the reconciled connection_status
                if (($app['connection_status'] ?? '') !== $connectionStatus) {
                    $db->prepare("UPDATE connected_apps SET connection_status = ?, updated_at = NOW() WHERE id = ?")
                        ->execute([$connectionStatus, $app['id']]);
                    $app['connection_status'] = $connectionStatus;
                }

                // Reconcile Sync Status (distinct from authentication status!)
                // A lead sync failure sets sync_status to sync_failed, but does NOT mark user unauthenticated.
                $lStmt = $db->prepare("SELECT status, leads_fetched, leads_created, leads_updated, leads_skipped, error_details, created_at 
                    FROM lead_sync_logs 
                    WHERE tenant_id = ? AND source_key = ? 
                    ORDER BY id DESC LIMIT 1");
                $lStmt->execute([$tenantId, $sourceKey]);
                $latestLog = $lStmt->fetch(PDO::FETCH_ASSOC);

                $syncStatus = 'sync_never_run';
                if ($latestLog) {
                    if ($latestLog['status'] === 'failed') {
                        $errDetails = strtolower($latestLog['error_details'] ?? '');
                        if (str_contains($errDetails, 'partner license') || str_contains($errDetails, 'access restricted') || str_contains($errDetails, 'restricted')) {
                            $syncStatus = 'referral_access_restricted';
                        } else {
                            $syncStatus = 'sync_failed';
                        }
                    } elseif ($latestLog['status'] === 'success' || $latestLog['status'] === 'partial') {
                        if ((int)($latestLog['leads_fetched'] ?? 0) > 0 || (int)($latestLog['leads_created'] ?? 0) > 0) {
                            $syncStatus = 'sync_successful';
                        } else {
                            $syncStatus = 'sync_successful_no_leads';
                        }
                    } else {
                        $syncStatus = 'sync_successful';
                    }
                } elseif (!empty($cfg['last_sync_at'])) {
                    $syncStatus = (!empty($lastError) && $authStatus !== 'connected') ? 'sync_failed' : 'sync_successful';
                } elseif (!empty($lastError)) {
                    $syncStatus = 'sync_failed';
                }

                if ($authStatus === 'connected' && !empty($lastError) && (!$latestLog || $latestLog['status'] === 'failed')) {
                    $syncStatus = 'sync_failed';
                }

                $app['auth_status'] = $authStatus;
                $app['connection_status'] = $connectionStatus;
                $app['session_status'] = $sessionStatus;
                $app['has_stored_credentials'] = $hasStoredCreds;
                $app['sync_status'] = $syncStatus;
                $app['last_synced_at'] = $cfg['last_sync_at'] ?? ($latestLog['created_at'] ?? null);
                $app['last_sync_display'] = !empty($app['last_synced_at']) ? $app['last_synced_at'] : 'Never';
                $app['last_error'] = $lastError;
                $app['sync_count'] = (int)($cfg['sync_count'] ?? 0);
                $app['latest_sync_log'] = $latestLog ? [
                    'leads_fetched' => (int)$latestLog['leads_fetched'],
                    'leads_created' => (int)$latestLog['leads_created'],
                    'leads_updated' => (int)$latestLog['leads_updated'],
                    'leads_skipped' => (int)$latestLog['leads_skipped'],
                    'status' => $latestLog['status'],
                    'created_at' => $latestLog['created_at']
                ] : null;
                $app['next_action'] = $nextAction;
                $app['next_action_key'] = $nextActionKey;

                if ($sourceKey === 'eaf') {
                    $app['integration_capability'] = 'Two-Way Web Automation';
                } elseif ($sourceKey === 'bni') {
                    $app['integration_capability'] = 'Two-Way Web Automation & REST API';
                } elseif ($sourceKey === 'kvv') {
                    $app['integration_capability'] = 'Direct Member API & Referral Sync';
                } elseif ($sourceKey === 'gmail') {
                    $app['integration_capability'] = 'Official Google OAuth 2.0 & Full Email Management';
                    $gmailAccount = $db->query("SELECT email_address, last_sync_at, sync_status FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    if ($gmailAccount) {
                        $app['connected_email'] = $gmailAccount['email_address'];
                        if (!empty($gmailAccount['last_sync_at'])) {
                            $app['last_synced_at'] = $gmailAccount['last_sync_at'];
                            $app['last_sync_display'] = $gmailAccount['last_sync_at'];
                        }
                    }
                }
            } else {
                $app['is_portal'] = false;
                $app['source_key'] = null;
                $app['has_stored_credentials'] = false;
                $app['auth_status'] = 'launcher_only';
                $app['integration_capability'] = 'Browser Shortcut';
                $app['sync_status'] = 'not_applicable';
                $app['last_sync_display'] = 'N/A';
                $app['last_error'] = null;
                $app['next_action'] = 'Launch Application';
                $app['next_action_key'] = 'launch';
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

        if ($sourceKey === 'gmail') {
            require_once __DIR__ . '/GmailController.php';
            require_once __DIR__ . '/../services/gmail/GmailOAuthService.php';
            $oauth = new \Cockpit\Services\Gmail\GmailOAuthService($db);
            $userId = (int)($currentUser['id'] ?? 1);
            $authRes = $oauth->generateAuthUrl($tenantId, $userId);
            if (!$authRes['success']) {
                Response::error($authRes['message'] ?? 'Google OAuth Client ID is not configured.', 400, [
                    'source_key' => 'gmail',
                    'redirect_uri' => \Cockpit\Services\Gmail\GmailOAuthService::getCanonicalRedirectUri(),
                    'scopes' => \Cockpit\Services\Gmail\GmailOAuthService::APPROVED_SCOPES
                ]);
            }
            Response::success($authRes, 'Google OAuth authorization initiated');
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
        } elseif ($sourceKey === 'bni') {
            $driver = self::getBNIDriver();
            $authResult = $driver->authenticateSession($username, $password);

            if (($authResult['status'] ?? '') === 'captcha_required') {
                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, last_validated_at)
                    VALUES (?, 'bni', 'captcha_required', NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'captcha_required', last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Security challenge or Cloudflare bot check detected on BNI Connect. Interactive challenge required in browser.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required',
                    'source_key' => 'bni'
                ]);
            }

            if (($authResult['status'] ?? '') !== 'active') {
                $errMsg = $authResult['message'] ?? 'Invalid BNI Connect username or password.';

                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                    ->execute([$errMsg, $tenantId]);

                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                    VALUES (?, 'bni', 'expired', NULL, NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'expired', encrypted_session_data = NULL, last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'auth_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Authentication failed: ' . $errMsg, 401, [
                    'session_status' => 'expired',
                    'connection_status' => 'auth_required',
                    'source_key' => 'bni',
                    'reason' => $authResult['reason'] ?? 'auth_failed',
                    'diagnostics' => $authResult['diagnostics'] ?? null
                ]);
            }

            // Live Authentication Succeeded for BNI Connect
            $sessionPayload = [
                'username' => $username,
                'email' => $username,
                'password' => $password,
                'access_token' => $authResult['access_token'] ?? null,
                'refresh_token' => $authResult['refresh_token'] ?? null,
                'expires_in' => $authResult['expires_in'] ?? null,
                'cookies' => $authResult['cookies'] ?? [],
                'cookie_jar' => $authResult['cookie_jar'] ?? '',
                'is_live' => true,
                'authenticated_at' => date('Y-m-d H:i:s')
            ];
            $encrypted = Encryption::encrypt(json_encode($sessionPayload));

            $sStmt = $db->prepare("INSERT INTO lead_platform_sessions 
                (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                VALUES (?, 'bni', 'active', ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    session_status = 'active',
                    encrypted_session_data = VALUES(encrypted_session_data),
                    last_validated_at = NOW()");
            $sStmt->execute([$tenantId, $encrypted]);

            $cStmt = $db->prepare("UPDATE lead_sources_config 
                SET encrypted_credentials = ?, status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW()
                WHERE tenant_id = ? AND source_key = 'bni'");
            $cStmt->execute([$encrypted, $tenantId]);

            $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::success([
                'id' => $id,
                'source_key' => 'bni',
                'session_status' => 'active',
                'connection_status' => 'connected',
                'has_stored_credentials' => true,
                'message' => 'Successfully authenticated with BNI Connect (https://www.bniconnectglobal.com). Active session verified and securely encrypted (AES-256-GCM).'
            ], 'BNI Connect authenticated successfully');
        } elseif ($sourceKey === 'kvv') {
            $driver = self::getKVVDriver();
            $authResult = $driver->authenticateSession($username, $password);

            if (($authResult['status'] ?? '') === 'captcha_required') {
                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, last_validated_at)
                    VALUES (?, 'kvv', 'captcha_required', NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'captcha_required', last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Security challenge detected on KVV Portal. Interactive verification required in browser.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required',
                    'source_key' => 'kvv'
                ]);
            }

            if (($authResult['status'] ?? '') !== 'active') {
                $errMsg = $authResult['message'] ?? 'Invalid KVV mobile number or password.';

                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                    ->execute([$errMsg, $tenantId]);

                $db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                    VALUES (?, 'kvv', 'expired', NULL, NOW())
                    ON DUPLICATE KEY UPDATE session_status = 'expired', encrypted_session_data = NULL, last_validated_at = NOW()")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'auth_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Authentication failed: ' . $errMsg, 401, [
                    'session_status' => 'expired',
                    'connection_status' => 'auth_required',
                    'source_key' => 'kvv',
                    'reason' => $authResult['reason'] ?? 'auth_failed',
                    'diagnostics' => $authResult['diagnostics'] ?? null
                ]);
            }

            // Live Authentication Succeeded for KVV Portal
            $sessionPayload = [
                'mobile_number' => $authResult['mobile_number'] ?? $username,
                'username' => $username,
                'password' => $password,
                'token' => $authResult['token'] ?? null,
                'user' => $authResult['user'] ?? [],
                'user_id' => $authResult['user_id'] ?? null,
                'is_live' => true,
                'authenticated_at' => date('Y-m-d H:i:s')
            ];
            $encrypted = Encryption::encrypt(json_encode($sessionPayload));

            $sStmt = $db->prepare("INSERT INTO lead_platform_sessions 
                (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
                VALUES (?, 'kvv', 'active', ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    session_status = 'active',
                    encrypted_session_data = VALUES(encrypted_session_data),
                    last_validated_at = NOW()");
            $sStmt->execute([$tenantId, $encrypted]);

            $cStmt = $db->prepare("UPDATE lead_sources_config 
                SET encrypted_credentials = ?, status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW()
                WHERE tenant_id = ? AND source_key = 'kvv'");
            $cStmt->execute([$encrypted, $tenantId]);

            $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::success([
                'id' => $id,
                'source_key' => 'kvv',
                'session_status' => 'active',
                'connection_status' => 'connected',
                'has_stored_credentials' => true,
                'message' => 'Successfully authenticated with KVV Portal (https://app.kannadigaravyaapaaravedike.com). Active member session verified and securely encrypted (AES-256-GCM).'
            ], 'KVV Portal authenticated successfully');
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
            if (!is_array($dec) || (empty($dec['email']) && empty($dec['cookie_jar']) && empty($dec['username']) && empty($dec['mobile_number']) && empty($dec['token']) && empty($dec['access_token']))) {
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

        if ($sourceKey === 'bni') {
            $driver = self::getBNIDriver();
            $validation = $driver->validateSession($tenantId, $dec);

            if (($validation['status'] ?? '') === 'active') {
                if (!empty($validation['session_updates'])) {
                    $dec = array_merge($dec, $validation['session_updates']);
                    $newEncrypted = Encryption::encrypt(json_encode($dec));
                    $db->prepare("UPDATE lead_platform_sessions SET encrypted_session_data = ?, session_status = 'active', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                        ->execute([$newEncrypted, $tenantId]);
                } else {
                    $db->prepare("UPDATE lead_platform_sessions SET last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                        ->execute([$tenantId]);
                }

                $db->prepare("UPDATE lead_sources_config SET status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::success([
                    'id' => $id,
                    'source_key' => 'bni',
                    'session_status' => 'active',
                    'connection_status' => 'connected',
                    'has_stored_credentials' => true,
                    'message' => 'BNI Connect session is active and verified.'
                ], 'BNI session active and verified');
            }

            if (($validation['status'] ?? '') === 'captcha_required') {
                $db->prepare("UPDATE lead_platform_sessions SET session_status = 'captcha_required', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = 'Security challenge required', last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Security challenge or Cloudflare verification required on BNI Connect.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required'
                ]);
            }

            $errMsg = $validation['message'] ?? 'BNI Connect session has expired or is invalid. Re-authentication required.';
            $db->prepare("UPDATE lead_platform_sessions SET session_status = 'expired', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                ->execute([$tenantId]);
            $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'bni'")
                ->execute([$errMsg, $tenantId]);
            $db->prepare("UPDATE connected_apps SET connection_status = 'expired', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::error($errMsg, 401, [
                'session_status' => 'expired',
                'connection_status' => 'expired',
                'message' => $errMsg
            ]);
        }

        if ($sourceKey === 'kvv') {
            $driver = self::getKVVDriver();
            $validation = $driver->validateSession($tenantId, $dec);

            if (($validation['status'] ?? '') === 'active') {
                if (!empty($validation['session_updates'])) {
                    $dec = array_merge($dec, $validation['session_updates']);
                    $newEncrypted = Encryption::encrypt(json_encode($dec));
                    $db->prepare("UPDATE lead_platform_sessions SET encrypted_session_data = ?, session_status = 'active', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                        ->execute([$newEncrypted, $tenantId]);
                } else {
                    $db->prepare("UPDATE lead_platform_sessions SET last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                        ->execute([$tenantId]);
                }

                $db->prepare("UPDATE lead_sources_config SET status = 'connected', last_error_message = NULL, last_error_at = NULL, updated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                    ->execute([$tenantId]);

                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::success([
                    'id' => $id,
                    'source_key' => 'kvv',
                    'session_status' => 'active',
                    'connection_status' => 'connected',
                    'has_stored_credentials' => true,
                    'message' => $validation['message'] ?? 'KVV Portal session is active and verified.'
                ], 'KVV session active and verified');
            }

            if (($validation['status'] ?? '') === 'captcha_required') {
                $db->prepare("UPDATE lead_platform_sessions SET session_status = 'captcha_required', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = 'Security challenge required', last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                    ->execute([$tenantId]);
                $db->prepare("UPDATE connected_apps SET connection_status = 'captcha_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Security challenge detected on KVV Portal. Please complete challenge in browser.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required'
                ]);
            }

            $errMsg = $validation['message'] ?? 'KVV Portal session has expired or is invalid. Re-authentication required.';
            $db->prepare("UPDATE lead_platform_sessions SET session_status = 'expired', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                ->execute([$tenantId]);
            $db->prepare("UPDATE lead_sources_config SET status = 'auth_required', last_error_message = ?, last_error_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND source_key = 'kvv'")
                ->execute([$errMsg, $tenantId]);
            $db->prepare("UPDATE connected_apps SET connection_status = 'expired', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::error($errMsg, 401, [
                'session_status' => 'expired',
                'connection_status' => 'expired',
                'message' => $errMsg
            ]);
        }

        if ($sourceKey === 'gmail') {
            require_once __DIR__ . '/../services/gmail/GmailOAuthService.php';
            require_once __DIR__ . '/../services/gmail/GmailApiService.php';
            $oauth = new \Cockpit\Services\Gmail\GmailOAuthService($db);
            $token = $oauth->getValidAccessToken($tenantId);

            if ($token) {
                $api = new \Cockpit\Services\Gmail\GmailApiService();
                $prof = $api->getProfile($token);
                if ($prof['success']) {
                    Response::success([
                        'id' => $id,
                        'source_key' => 'gmail',
                        'session_status' => 'active',
                        'connection_status' => 'connected',
                        'email' => $prof['data']['emailAddress'] ?? '',
                        'message' => 'Active Gmail session verified via Google OAuth 2.0.'
                    ], 'Gmail session verified');
                }
            }

            Response::error('No active Google OAuth session found for Gmail. Re-authentication required.', 401, [
                'session_status' => 'auth_required',
                'connection_status' => 'auth_required'
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

        if ($sourceKey === 'gmail') {
            $db->prepare("UPDATE gmail_accounts SET connection_status = 'disconnected', encrypted_tokens = NULL, updated_at = NOW() WHERE tenant_id = ?")
                ->execute([$tenantId]);
        }

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

        // BNI Connect: Run live sync via SyncEngine / BNIConnector
        if ($sourceKey === 'bni') {
            require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
            require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../services/automation/BNIWebAutomationDriver.php';
            require_once __DIR__ . '/../services/connectors/BNIConnector.php';
            require_once __DIR__ . '/../services/SyncEngine.php';

            $res = \Cockpit\Services\SyncEngine::syncSource($tenantId, 'bni', 'manual');

            if (!empty($res['success'])) {
                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                $syncStatus = ((int)($res['leads_fetched'] ?? 0) > 0 || (int)($res['leads_created'] ?? 0) > 0) ? 'sync_successful' : 'sync_successful_no_leads';

                Response::success([
                    'app_id' => $id,
                    'source_key' => 'bni',
                    'leads_fetched' => $res['leads_fetched'] ?? 0,
                    'leads_created' => $res['leads_created'] ?? 0,
                    'leads_updated' => $res['leads_updated'] ?? 0,
                    'leads_skipped' => $res['leads_skipped'] ?? 0,
                    'last_synced_at' => date('Y-m-d H:i:s'),
                    'sync_status' => $syncStatus,
                    'message' => $res['message'] ?? 'BNI Connect sync completed.'
                ], 'BNI Connect sync completed successfully');
            } else {
                Response::error($res['error'] ?? ($res['message'] ?? 'BNI Connect sync failed.'), 400, [
                    'source_key' => 'bni',
                    'sync_status' => 'sync_failed'
                ]);
            }
        }

        // KVV Portal: Run live sync via SyncEngine / KVVConnector
        if ($sourceKey === 'kvv') {
            require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
            require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../services/automation/KVVWebAutomationDriver.php';
            require_once __DIR__ . '/../services/connectors/KVVConnector.php';
            require_once __DIR__ . '/../services/SyncEngine.php';

            $res = \Cockpit\Services\SyncEngine::syncSource($tenantId, 'kvv', 'manual');

            if (!empty($res['success'])) {
                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                $syncStatus = ((int)($res['leads_fetched'] ?? 0) > 0 || (int)($res['leads_created'] ?? 0) > 0) ? 'sync_successful' : 'sync_successful_no_leads';

                Response::success([
                    'app_id' => $id,
                    'source_key' => 'kvv',
                    'leads_fetched' => $res['leads_fetched'] ?? 0,
                    'leads_created' => $res['leads_created'] ?? 0,
                    'leads_updated' => $res['leads_updated'] ?? 0,
                    'leads_skipped' => $res['leads_skipped'] ?? 0,
                    'last_synced_at' => date('Y-m-d H:i:s'),
                    'sync_status' => $syncStatus,
                    'message' => $res['message'] ?? 'KVV Portal sync completed.'
                ], 'KVV Portal sync completed successfully');
            } else {
                Response::error($res['error'] ?? ($res['message'] ?? 'KVV Portal sync failed.'), 400, [
                    'source_key' => 'kvv',
                    'sync_status' => 'sync_failed'
                ]);
            }
        }

        // EAF Connect: Run real live sync via SyncEngine / EAFConnector
        if ($sourceKey === 'eaf') {
            require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
            require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../services/automation/EAFWebAutomationDriver.php';
            require_once __DIR__ . '/../services/connectors/EAFConnector.php';
            require_once __DIR__ . '/../services/SyncEngine.php';

            $res = \Cockpit\Services\SyncEngine::syncSource($tenantId, 'eaf', 'manual');

            if (!empty($res['success'])) {
                // Update connected_apps status
                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                $syncStatus = ((int)($res['leads_fetched'] ?? 0) > 0 || (int)($res['leads_created'] ?? 0) > 0) ? 'sync_successful' : 'sync_successful_no_leads';

                Response::success([
                    'app_id' => $id,
                    'source_key' => 'eaf',
                    'leads_fetched' => $res['leads_fetched'] ?? 0,
                    'leads_created' => $res['leads_created'] ?? 0,
                    'leads_updated' => $res['leads_updated'] ?? 0,
                    'leads_skipped' => $res['leads_skipped'] ?? 0,
                    'last_synced_at' => date('Y-m-d H:i:s'),
                    'sync_status' => $syncStatus,
                    'execution_time_ms' => $res['execution_time_ms'] ?? 0
                ], "EAF Connect synchronized successfully! ({$res['leads_fetched']} referrals processed)");
            } else {
                Response::error($res['message'] ?? $res['error'] ?? 'EAF Connect synchronization failed', 400, [
                    'source_key' => 'eaf',
                    'sync_status' => 'sync_failed',
                    'details' => $res
                ]);
            }
        }

        // Gmail: Run live metadata sync via GmailController
        if ($sourceKey === 'gmail') {
            require_once __DIR__ . '/GmailController.php';
            $res = GmailController::syncInternal($tenantId);

            if (!empty($res['success'])) {
                $db->prepare("UPDATE connected_apps SET connection_status = 'connected', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::success([
                    'app_id' => $id,
                    'source_key' => 'gmail',
                    'messages_synced' => $res['messages_synced'] ?? 0,
                    'last_synced_at' => $res['last_sync_at'] ?? date('Y-m-d H:i:s'),
                    'sync_status' => 'sync_successful',
                    'message' => "Gmail synchronized successfully ({$res['messages_synced']} messages processed)."
                ], 'Gmail synchronized successfully');
            } else {
                Response::error($res['error'] ?? 'Gmail sync failed', 400, [
                    'source_key' => 'gmail',
                    'sync_status' => 'sync_failed'
                ]);
            }
        }

        Response::error("Portal synchronization not implemented for {$app['name']}.", 400);
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
