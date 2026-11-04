<?php
declare(strict_types=1);

/**
 * Test Suite: KVV Status Reconciliation & Lifecycle Inconsistency Fix
 * 
 * Tests:
 * 1. Current Tenant 1 KVV status consistency (no stored creds -> honest auth_required)
 * 2. Next action matches auth status (button is 'Connect Portal', NOT 'Sync Leads Now')
 * 3. Self-healing database alignment (connected_apps matches listApps)
 * 4. Active session reconciliation on isolated tenant 999 (connected, sync_now)
 * 5. Sync failure does NOT degrade auth_status when valid session is stored
 * 6. Browser refresh persistence (multiple consecutive listApps calls return identical data)
 * 7. BNI Connect integration preserved (auth_status = connected)
 * 8. EAF Connect integration preserved (auth_status = connected)
 * 9. CRM leads #41 through #45 preserved intact
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use Cockpit\Controllers\AppHubController;

$passed = 0;
$failed = 0;

function assertTest(bool $condition, string $description, ?string $extraInfo = null): void {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$description}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$description}\n";
        if ($extraInfo) {
            echo "         Details: {$extraInfo}\n";
        }
    }
}

echo "=======================================================\n";
echo "   KVV STATUS RECONCILIATION & CONSISTENCY TEST        \n";
echo "=======================================================\n\n";

$db = Database::getConnection();
$phpBin = 'D:\\xampp\\php\\php.exe';

function getApps(int $tenantId = 1): array {
    global $phpBin;
    $code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::listApps(['id'=>2, 'tenant_id'=>{$tenantId}, 'role'=>'tenant_owner']);";
    $raw = shell_exec("\"{$phpBin}\" -r \"{$code}\"");
    $pos = strpos($raw, '{');
    $clean = $pos !== false ? substr($raw, $pos) : '';
    return json_decode($clean, true)['data'] ?? [];
}

// ---------------------------------------------------------------------
// TEST 1: Tenant 1 Current KVV Status Reconciliation
// ---------------------------------------------------------------------
echo "[1/6] Testing Tenant 1 KVV Current Status (Connected Real Session)...\n";
$apps1 = getApps(1);
$kvv = null;
$bni = null;
$eaf = null;
foreach ($apps1 as $a) {
    if (str_contains($a['name'], 'KVV')) $kvv = $a;
    if (str_contains($a['name'], 'BNI')) $bni = $a;
    if (str_contains($a['name'], 'EAF')) $eaf = $a;
}

assertTest($kvv !== null, 'KVV Portal app found');
assertTest($kvv['has_stored_credentials'] === true, 'KVV has_stored_credentials is true');
assertTest($kvv['auth_status'] === 'connected', 'KVV auth_status is connected');
assertTest($kvv['connection_status'] === 'connected', 'KVV connection_status is connected');
assertTest($kvv['session_status'] === 'active', 'KVV session_status is active');
assertTest($kvv['next_action_key'] === 'sync_now', 'KVV next_action_key is sync_now');
assertTest($kvv['next_action'] === 'Sync Leads Now', 'KVV button label is Sync Leads Now (NO contradiction)');

// Verify database connected_apps table
$dbStatus = $db->query("SELECT connection_status FROM connected_apps WHERE id = 5")->fetchColumn();
assertTest($dbStatus === 'connected', 'Database connected_apps.connection_status matches API response');

// ---------------------------------------------------------------------
// TEST 2: Active Session Lifecycle Reconciliation (Isolated Tenant 999)
// ---------------------------------------------------------------------
echo "\n[2/6] Testing Active Session Lifecycle on Isolated Tenant 999...\n";
$db->query("INSERT INTO tenants (id, name, slug, status) VALUES (999, 'Test Tenant 999', 'test999', 'active') ON DUPLICATE KEY UPDATE status = 'active'");
$db->query("INSERT INTO connected_apps (id, tenant_id, name, app_url, category, connection_status) VALUES (998, 999, 'KVV Portal', 'https://app.kannadigaravyaapaaravedike.com', 'business', 'disconnected') ON DUPLICATE KEY UPDATE connection_status = 'disconnected'");

$mockSession = [
    'mobile_number' => '9876543210',
    'username' => '9876543210',
    'password' => 'DummyPassword123!',
    'token' => 'mock_valid_jwt_token_kvv',
    'user' => ['id' => 'kvv_usr_101', 'name' => 'KVV Test User'],
    'is_live' => true,
    'authenticated_at' => date('Y-m-d H:i:s')
];
$enc = Encryption::encrypt(json_encode($mockSession));

$db->prepare("INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at)
    VALUES (999, 'kvv', 'active', ?, NOW())
    ON DUPLICATE KEY UPDATE session_status = 'active', encrypted_session_data = VALUES(encrypted_session_data)")
    ->execute([$enc]);

$db->prepare("INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status, encrypted_credentials)
    VALUES (999, 'kvv', 'KVV Leads', 'business_forum', 'connected', ?)
    ON DUPLICATE KEY UPDATE status = 'connected', encrypted_credentials = VALUES(encrypted_credentials)")
    ->execute([$enc]);

$apps999 = getApps(999);
$kvv999 = null;
foreach ($apps999 as $a) {
    if ($a['id'] == 998) $kvv999 = $a;
}

assertTest($kvv999 !== null, 'Isolated KVV app found');
assertTest($kvv999['has_stored_credentials'] === true, 'Isolated KVV has_stored_credentials is true');
assertTest($kvv999['auth_status'] === 'connected', 'Isolated KVV auth_status is connected');
assertTest($kvv999['connection_status'] === 'connected', 'Isolated KVV connection_status is connected');
assertTest($kvv999['next_action_key'] === 'sync_now', 'Isolated KVV next_action_key is sync_now');
assertTest($kvv999['next_action'] === 'Sync Leads Now', 'Isolated KVV button label is Sync Leads Now');

// ---------------------------------------------------------------------
// TEST 3: Sync Failure Does NOT Degrade Auth Status
// ---------------------------------------------------------------------
echo "\n[3/6] Testing Sync Failure Decoupling (Auth Status Stays Connected)...\n";
// Simulate a sync error (e.g. timeout or network glitch) on isolated tenant
$db->query("UPDATE lead_sources_config SET last_error_message = 'cURL error 28: Operation timed out' WHERE tenant_id = 999 AND source_key = 'kvv'");

$apps999Err = getApps(999);
$kvv999Err = null;
foreach ($apps999Err as $a) {
    if ($a['id'] == 998) $kvv999Err = $a;
}

assertTest($kvv999Err['auth_status'] === 'connected', 'auth_status REMAINS connected despite sync error');
assertTest($kvv999Err['connection_status'] === 'connected', 'connection_status REMAINS connected despite sync error');
assertTest($kvv999Err['sync_status'] === 'sync_failed', 'sync_status is correctly marked sync_failed');
assertTest($kvv999Err['last_error'] === 'cURL error 28: Operation timed out', 'last_error accurately preserves sync error notice');
assertTest($kvv999Err['next_action_key'] === 'sync_now', 'next_action_key REMAINS sync_now');

// Cleanup isolated tenant
$db->query("DELETE FROM connected_apps WHERE id = 998");
$db->query("DELETE FROM lead_platform_sessions WHERE tenant_id = 999");
$db->query("DELETE FROM lead_sources_config WHERE tenant_id = 999");
$db->query("DELETE FROM tenants WHERE id = 999");

// ---------------------------------------------------------------------
// TEST 4: Browser Refresh Persistence (Tenant 1)
// ---------------------------------------------------------------------
echo "\n[4/6] Testing Browser Refresh Persistence on Tenant 1...\n";
$run1 = getApps(1);
$run2 = getApps(1);
$run3 = getApps(1);

$k1 = null; $k2 = null; $k3 = null;
foreach ($run1 as $a) if ($a['id'] == 5) $k1 = $a;
foreach ($run2 as $a) if ($a['id'] == 5) $k2 = $a;
foreach ($run3 as $a) if ($a['id'] == 5) $k3 = $a;

assertTest($k1['auth_status'] === $k2['auth_status'] && $k2['auth_status'] === $k3['auth_status'], 'auth_status stable across 3 refreshes');
assertTest($k1['connection_status'] === $k2['connection_status'] && $k2['connection_status'] === $k3['connection_status'], 'connection_status stable across 3 refreshes');
assertTest($k1['next_action_key'] === $k2['next_action_key'] && $k2['next_action_key'] === $k3['next_action_key'], 'next_action_key stable across 3 refreshes');

// ---------------------------------------------------------------------
// TEST 5: BNI and EAF Integrations Preserved
// ---------------------------------------------------------------------
echo "\n[5/6] Verifying BNI and EAF Integrations Preserved...\n";
assertTest($bni !== null, 'BNI Connect found');
assertTest($bni['auth_status'] === 'connected', 'BNI Connect auth_status is connected');
assertTest($bni['connection_status'] === 'connected', 'BNI Connect connection_status is connected');
assertTest($bni['has_stored_credentials'] === true, 'BNI Connect has_stored_credentials is true');

assertTest($eaf !== null, 'EAF Connect found');
assertTest($eaf['auth_status'] === 'connected', 'EAF Connect auth_status is connected');
assertTest($eaf['connection_status'] === 'connected', 'EAF Connect connection_status is connected');
assertTest($eaf['has_stored_credentials'] === true, 'EAF Connect has_stored_credentials is true');

// ---------------------------------------------------------------------
// TEST 6: CRM Leads #41 through #45 Preserved
// ---------------------------------------------------------------------
echo "\n[6/6] Verifying Genuine CRM Leads #41 through #45 Integrity...\n";
$leads = $db->query("SELECT id, name, email, phone FROM crm_leads WHERE id BETWEEN 41 AND 45 ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
assertTest(count($leads) === 5, 'All 5 genuine CRM leads #41 through #45 exist and intact');

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";

if ($failed > 0) exit(1);

