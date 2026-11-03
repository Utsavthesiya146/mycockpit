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

        // 1. Ensure all 3 Master CRM Portals exist for this tenant
        $masterPortals = [
            [
                'name' => 'EAF Connect',
                'url' => 'https://eafconnect.com',
                'category' => 'business',
                'icon' => 'Users',
                'check' => '%eafconnect%'
            ],
            [
                'name' => 'BNI Connect',
                'url' => 'https://www.bniconnectglobal.com',
                'category' => 'business',
                'icon' => 'Briefcase',
                'check' => '%bniconnect%'
            ],
            [
                'name' => 'KVV Portal',
                'url' => 'https://app.kannadigaravyaapaaravedike.com',
                'category' => 'business',
                'icon' => 'Briefcase',
                'check' => '%kannadigara%'
            ]
        ];

        foreach ($masterPortals as $p) {
            $check = $db->prepare("SELECT id FROM connected_apps WHERE tenant_id = ? AND (app_url LIKE ? OR name LIKE ?) LIMIT 1");
            $check->execute([$tenantId, $p['check'], '%' . $p['name'] . '%']);
            if (!$check->fetchColumn()) {
                $ins = $db->prepare("INSERT INTO connected_apps 
                    (tenant_id, name, category, icon_name, app_url, connection_status, auth_type, is_pinned)
                    VALUES (?, ?, ?, ?, ?, 'launcher_only', 'direct_link', 1)");
                $ins->execute([$tenantId, $p['name'], $p['category'], $p['icon'], $p['url']]);
            }
        }

        // 2. Ensure KVV Portal URL is updated to the active portal domain
        $fixKvv = $db->prepare("UPDATE connected_apps SET app_url = 'https://app.kannadigaravyaapaaravedike.com' WHERE tenant_id = ? AND app_url LIKE '%kvv.gov.in%'");
        $fixKvv->execute([$tenantId]);

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
                $cStmt = $db->prepare("SELECT last_sync_at, last_error_message, sync_count 
                    FROM lead_sources_config 
                    WHERE tenant_id = ? AND source_key = ? LIMIT 1");
                $cStmt->execute([$tenantId, $sourceKey]);
                $cfg = $cStmt->fetch(PDO::FETCH_ASSOC);

                $sessionStatus = $sess['session_status'] ?? 'disconnected';
                $hasStoredCreds = !empty($sess['has_creds']);

                // Determine honest UI connection_status
                if ($sessionStatus === 'active') {
                    $app['connection_status'] = 'connected';
                } elseif ($sessionStatus === 'expired') {
                    $app['connection_status'] = 'expired';
                } elseif ($sessionStatus === 'captcha_required') {
                    $app['connection_status'] = 'captcha_required';
                } elseif ($sessionStatus === 'auth_required' || $hasStoredCreds) {
                    $app['connection_status'] = 'auth_required';
                } else {
                    $app['connection_status'] = 'disconnected';
                }

                $app['session_status'] = $sessionStatus;
                $app['has_stored_credentials'] = $hasStoredCreds;
                $app['last_synced_at'] = $cfg['last_sync_at'] ?? null;
                $app['last_error'] = $cfg['last_error_message'] ?? null;
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

                $db->prepare("UPDATE connected_apps SET connection_status = 'config_required', updated_at = NOW() WHERE id = ?")
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

                $db->prepare("UPDATE connected_apps SET connection_status = 'config_required', updated_at = NOW() WHERE id = ?")
                    ->execute([$id]);

                Response::error('Authentication failed: ' . $errMsg, 401, [
                    'session_status' => 'expired',
                    'connection_status' => 'auth_required',
                    'source_key' => 'eaf',
                    'reason' => $authResult['reason'] ?? 'auth_failed'
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
        $db->prepare("UPDATE connected_apps SET connection_status = 'config_required', updated_at = NOW() WHERE id = ?")
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
                Response::error('CAPTCHA / Security challenge detected on EAF Connect. Please complete challenge in browser.', 403, [
                    'session_status' => 'captcha_required',
                    'connection_status' => 'captcha_required'
                ]);
            }

            $db->prepare("UPDATE lead_platform_sessions SET session_status = 'expired', last_validated_at = NOW() WHERE tenant_id = ? AND source_key = 'eaf'")
                ->execute([$tenantId]);
            $db->prepare("UPDATE connected_apps SET connection_status = 'config_required', updated_at = NOW() WHERE id = ?")
                ->execute([$id]);

            Response::error('EAF Connect session has expired or is invalid. Re-authentication required.', 401, [
                'session_status' => 'expired',
                'connection_status' => 'expired',
                'message' => $validation['message'] ?? 'Session expired'
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

        $db->prepare("UPDATE connected_apps SET connection_status = 'launcher_only', updated_at = NOW() WHERE id = ?")
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

        $validStatuses = ['connected', 'launcher_only', 'config_required', 'unsupported'];
        $status = in_array($input['connection_status'] ?? '', $validStatuses, true) 
            ? $input['connection_status'] 
            : 'launcher_only';

        $db = Database::getConnection();
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
        $stmt = $db->prepare("DELETE FROM connected_apps WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application deleted');
    }

    public static function togglePin(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE connected_apps SET is_pinned = 1 - is_pinned WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application pin toggled');
    }
}
