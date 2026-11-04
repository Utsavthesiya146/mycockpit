<?php
/**
 * Test Suite: Live Portal Synchronization and Lifecycle Status Verification
 * Tests BNI Connect, KVV Portal, and EAF Connect endpoint lifecycles
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\AppHubController;
use Cockpit\Utils\JWT;

$db = Database::getConnection();
$passed = 0;
$failed = 0;

function assertTest(bool $condition, string $title, ?string $details = null): void {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$title}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$title}" . ($details ? " - {$details}" : "") . "\n";
    }
}

echo "=======================================================\n";
echo "   PORTAL CONNECTION STATUS AND SYNC LIFECYCLE TEST   \n";
echo "=======================================================\n\n";

$tenantUser = [
    'id' => 2,
    'tenant_id' => 1,
    'email' => 'utsav@acme.com',
    'role' => 'tenant_owner',
    'name' => 'Utsav Patel'
];

// Helper to simulate calling AppHubController
function apiGetApps(): array {
    $phpBin = 'D:\\xampp\\php\\php.exe';
    $code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::listApps(['id'=>2, 'tenant_id'=>1, 'role'=>'tenant_owner']);";
    $raw = shell_exec("\"{$phpBin}\" -r \"{$code}\"");
    $pos = strpos($raw, '{');
    $clean = $pos !== false ? substr($raw, $pos) : '';
    return json_decode($clean, true) ?: [];
}

function apiSyncApp(int $id): array {
    $phpBin = 'D:\\xampp\\php\\php.exe';
    $code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::syncPortalNow(['id'=>2, 'tenant_id'=>1, 'role'=>'tenant_owner'], {$id});";
    $raw = shell_exec("\"{$phpBin}\" -r \"{$code}\"");
    $pos = strpos($raw, '{');
    $clean = $pos !== false ? substr($raw, $pos) : '';
    return json_decode($clean, true) ?: [];
}

echo "[1/4] Inspecting Portal Lifecycle Metadata in GET /apps...\n";
$listRes = apiGetApps();
assertTest(($listRes['status'] ?? '') === 'success', 'GET /apps returns success');
$apps = $listRes['data'] ?? [];

$eafApp = null;
$bniApp = null;
$kvvApp = null;
foreach ($apps as $a) {
    if (str_contains($a['name'], 'EAF')) $eafApp = $a;
    if (str_contains($a['name'], 'BNI')) $bniApp = $a;
    if (str_contains($a['name'], 'KVV')) $kvvApp = $a;
}

assertTest($eafApp !== null, 'EAF Connect found in application roster');
assertTest($bniApp !== null, 'BNI Connect found in application roster');
assertTest($kvvApp !== null, 'KVV Portal found in application roster');

echo "\n[2/4] Verifying Portal Capabilities & Statuses...\n";
// EAF
echo "  EAF Connect:\n";
echo "    - Auth Status: {$eafApp['auth_status']}\n";
echo "    - Capability: {$eafApp['integration_capability']}\n";
echo "    - Sync Status: {$eafApp['sync_status']}\n";
echo "    - Next Action: {$eafApp['next_action']}\n";
assertTest($eafApp['auth_status'] === 'connected', 'EAF auth_status is connected');
assertTest($eafApp['integration_capability'] === 'Two-Way Web Automation', 'EAF capability is Two-Way Web Automation');
assertTest(in_array($eafApp['sync_status'], ['sync_successful', 'sync_never_run'], true), 'EAF sync_status is valid');

// BNI
echo "  BNI Connect:\n";
echo "    - Auth Status: {$bniApp['auth_status']}\n";
echo "    - Capability: {$bniApp['integration_capability']}\n";
echo "    - Sync Status: {$bniApp['sync_status']}\n";
echo "    - Next Action: {$bniApp['next_action']}\n";
assertTest(in_array($bniApp['auth_status'], ['auth_required', 'connected'], true), 'BNI auth_status is valid lifecycle state');
assertTest(str_contains($bniApp['integration_capability'], 'Web Automation') || str_contains($bniApp['integration_capability'], 'REST API'), 'BNI capability identifies Web Automation & REST API');
assertTest(in_array($bniApp['next_action'], ['Connect Portal', 'Sync Leads Now'], true), 'BNI next_action is valid');

// KVV
echo "  KVV Portal:\n";
echo "    - Auth Status: {$kvvApp['auth_status']}\n";
echo "    - Capability: {$kvvApp['integration_capability']}\n";
echo "    - Sync Status: {$kvvApp['sync_status']}\n";
echo "    - Next Action: {$kvvApp['next_action']}\n";
assertTest(in_array($kvvApp['auth_status'], ['auth_required', 'connected'], true), 'KVV auth_status is valid lifecycle state');
assertTest(str_contains($kvvApp['integration_capability'], 'Direct Member API') || str_contains($kvvApp['integration_capability'], 'Referral Sync'), 'KVV capability identifies Direct Member API & Referral Sync');
assertTest(in_array($kvvApp['next_action'], ['Connect Portal', 'Sync Leads Now'], true), 'KVV next_action is valid');

echo "\n[3/4] Testing BNI & KVV Honest Blocker Reporting on Sync Now (Without Active Session)...\n";
// Set up isolated tenant 999 unauthenticated mock apps
$db->query("INSERT INTO tenants (id, name, slug, status) VALUES (999, 'Test Tenant 999', 'test999', 'active') ON DUPLICATE KEY UPDATE status = 'active'");
$db->query("INSERT INTO connected_apps (id, tenant_id, name, app_url, category, connection_status) VALUES (997, 999, 'BNI Mock Test', 'https://www.bniconnectglobal.com', 'business', 'disconnected') ON DUPLICATE KEY UPDATE connection_status = 'disconnected'");
$db->query("INSERT INTO connected_apps (id, tenant_id, name, app_url, category, connection_status) VALUES (998, 999, 'KVV Mock Test', 'https://app.kannadigaravyaapaaravedike.com', 'business', 'disconnected') ON DUPLICATE KEY UPDATE connection_status = 'disconnected'");
$db->query("INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status) VALUES (999, 'bni', 'BNI Leads', 'business_forum', 'auth_required') ON DUPLICATE KEY UPDATE status = 'auth_required'");
$db->query("INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status) VALUES (999, 'kvv', 'KVV Leads', 'business_forum', 'auth_required') ON DUPLICATE KEY UPDATE status = 'auth_required'");

function apiSyncAppIsolated(int $tenantId, int $appId): array {
    $phpBin = 'D:\\xampp\\php\\php.exe';
    $code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::syncPortalNow(['id'=>999, 'tenant_id'=>{$tenantId}, 'role'=>'tenant_owner'], {$appId});";
    $raw = shell_exec("\"{$phpBin}\" -r \"{$code}\"");
    $pos = strpos($raw, '{');
    $clean = $pos !== false ? substr($raw, $pos) : '';
    return json_decode($clean, true) ?: [];
}

$bniSync = apiSyncAppIsolated(999, 997);
assertTest(($bniSync['status'] ?? '') === 'error', 'BNI sync-now safely rejects unauthenticated polling');
assertTest(str_contains($bniSync['message'] ?? '', 'BNI Connect') || str_contains($bniSync['message'] ?? '', 'credentials'), 'BNI error clearly explains authentication requirement');

$kvvSync = apiSyncAppIsolated(999, 998);
assertTest(($kvvSync['status'] ?? '') === 'error', 'KVV sync-now safely rejects unauthenticated polling');
assertTest(str_contains($kvvSync['message'] ?? '', 'KVV') || str_contains($kvvSync['message'] ?? '', 'credentials'), 'KVV error clearly explains member authentication requirement');

// Cleanup isolated mock apps
$db->query("DELETE FROM connected_apps WHERE id IN (997, 998)");
$db->query("DELETE FROM lead_sources_config WHERE tenant_id = 999");
$db->query("DELETE FROM tenants WHERE id = 999");

echo "\n[4/4] Testing Live EAF Synchronization via POST /apps/{id}/sync-now...\n";
$eafSync = apiSyncApp((int)$eafApp['id']);
echo "  EAF Sync Result: " . json_encode($eafSync) . "\n";
assertTest(($eafSync['status'] ?? '') === 'success', 'EAF sync-now executed successfully (HTTP 200)');
assertTest(($eafSync['data']['leads_fetched'] ?? 0) === 5, 'EAF fetched 5 genuine referrals');
assertTest(($eafSync['data']['leads_created'] ?? 0) === 0, 'Zero duplicates created on sync');
assertTest(($eafSync['data']['sync_status'] ?? '') === 'sync_successful', 'Sync status returned as sync_successful');
assertTest(!empty($eafSync['data']['last_synced_at']), 'last_synced_at returned and non-empty');

// Verify updated GET /apps reflects last_synced_at
$afterApps = apiGetApps();
$updatedEaf = null;
foreach ($afterApps['data'] ?? [] as $a) {
    if (str_contains($a['name'], 'EAF')) $updatedEaf = $a;
}
assertTest(!empty($updatedEaf['last_synced_at']), 'EAF last_synced_at persisted in connected_apps');
assertTest($updatedEaf['sync_status'] === 'sync_successful', 'EAF sync_status is now sync_successful in GET /apps');

// Verify genuine CRM leads #41-#45 are preserved
$leadCount = $db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1 AND source = 'EAF Connect'")->fetchColumn();
assertTest((int)$leadCount === 5, "Exactly 5 genuine EAF leads preserved (found {$leadCount})");

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";
if ($failed > 0) exit(1);
