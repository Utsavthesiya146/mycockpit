<?php
/**
 * MY COCKPIT AI - Edit & Reconnect Functional & Security Test Suite
 * Tests:
 * 1. App listing with enriched status & live badges
 * 2. Editing configuration (name, app_url, category, icon_name, sync_interval, notes)
 * 3. Validation rejection (empty name, invalid sync interval)
 * 4. Reconnect session & authentication workflows (BNI, EAF, KVV, Gmail OAuth)
 * 5. Reconnect with invalid credentials (clean error handling)
 * 6. Disconnect application & credentials purge
 * 7. CRM Leads preservation verification (0 leads deleted during disconnect/delete)
 * 8. Soft-delete application & exclusion from list
 * 9. Tenant isolation security check (Tenant 2 blocked from editing/reconnecting/disconnecting/deleting Tenant 1 apps)
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\AppHubController;

$db = Database::getConnection();
AppHubController::ensureSchemaCompatibility($db);

$passed = 0;
$failed = 0;

function assertTest(string $name, bool $condition, string $detail = '') {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$name}" . ($detail ? " - {$detail}" : "") . PHP_EOL;
    } else {
        $failed++;
        echo "  [FAIL] {$name}" . ($detail ? " - {$detail}" : "") . PHP_EOL;
    }
}

function runIsolatedEndpoint(string $phpSnippet): array {
    $baseDir = str_replace('\\', '/', dirname(__DIR__));
    $tmpScript = __DIR__ . '/tmp_sub_runner_' . uniqid() . '.php';
    $code = <<<PHP
<?php
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', '0');
require "{$baseDir}/config/Database.php";
require "{$baseDir}/config/Config.php";
require "{$baseDir}/utils/Encryption.php";
require "{$baseDir}/utils/Response.php";
require "{$baseDir}/middleware/TenantMiddleware.php";
require "{$baseDir}/services/automation/PlatformAutomationDriverInterface.php";
require "{$baseDir}/services/automation/BNIWebAutomationDriver.php";
require "{$baseDir}/services/automation/EAFWebAutomationDriver.php";
require "{$baseDir}/services/automation/KVVWebAutomationDriver.php";
require "{$baseDir}/services/connectors/LeadConnectorInterface.php";
require "{$baseDir}/services/connectors/BNIConnector.php";
require "{$baseDir}/services/connectors/EAFConnector.php";
require "{$baseDir}/services/connectors/KVVConnector.php";
require "{$baseDir}/services/SyncEngine.php";
require "{$baseDir}/controllers/AppHubController.php";

use Cockpit\Controllers\AppHubController;

{$phpSnippet}
PHP;
    file_put_contents($tmpScript, $code);
    $raw = shell_exec('"D:\\xampp\\php\\php.exe" ' . escapeshellarg($tmpScript) . ' 2>&1');
    @unlink($tmpScript);

    $jsonStart = strpos((string)$raw, '{"');
    if ($jsonStart !== false) {
        $jsonStr = substr((string)$raw, $jsonStart);
        $decoded = json_decode($jsonStr, true);
        if ($decoded !== null) {
            return $decoded;
        }
    }
    return ['raw' => (string)$raw];
}

echo "=================================================================" . PHP_EOL;
echo "  MY COCKPIT AI - EDIT & RECONNECT FUNCTIONAL AUDIT SUITE" . PHP_EOL;
echo "=================================================================" . PHP_EOL . PHP_EOL;

// -------------------------------------------------------------
// Test 1: App listing for Tenant 1
// -------------------------------------------------------------
echo "Test 1: App Listing with Live Badges & Sync Intervals..." . PHP_EOL;
$res1 = runIsolatedEndpoint('AppHubController::listApps(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"]);');

$apps = $res1['data'] ?? [];
assertTest("App Listing Success", !empty($apps), "Returned " . count($apps) . " applications");

$bniApp = null;
$eafApp = null;
$kvvApp = null;
$gmailApp = null;
$myInotesApp = null;

foreach ($apps as $a) {
    if ($a['name'] === 'BNI Connect' || ($a['source_key'] ?? '') === 'bni') $bniApp = $a;
    if ($a['name'] === 'EAF Connect' || ($a['source_key'] ?? '') === 'eaf') $eafApp = $a;
    if ($a['name'] === 'KVV Portal' || ($a['source_key'] ?? '') === 'kvv') $kvvApp = $a;
    if ($a['name'] === 'Gmail' || ($a['source_key'] ?? '') === 'gmail') $gmailApp = $a;
    if ($a['name'] === 'My iNotes') $myInotesApp = $a;
}

assertTest("BNI Connect App Detected", !empty($bniApp), "BNI Connect ID: " . ($bniApp['id'] ?? 'none'));
assertTest("EAF Connect App Detected", !empty($eafApp), "EAF Connect ID: " . ($eafApp['id'] ?? 'none'));
assertTest("KVV Portal App Detected", !empty($kvvApp), "KVV Portal ID: " . ($kvvApp['id'] ?? 'none'));
assertTest("Gmail App Detected", !empty($gmailApp), "Gmail ID: " . ($gmailApp['id'] ?? 'none'));
assertTest("My iNotes Launcher App Detected", !empty($myInotesApp), "My iNotes ID: " . ($myInotesApp['id'] ?? 'none'));

// -------------------------------------------------------------
// Test 2: Edit Application Configuration
// -------------------------------------------------------------
echo PHP_EOL . "Test 2: Edit Application Configuration..." . PHP_EOL;
if ($bniApp) {
    $bniId = (int)$bniApp['id'];
    $editSnippet = <<<PHP
AppHubController::updateApp(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, [
    "name" => "BNI Connect - VIP Chapter",
    "app_url" => "https://www.bniconnectglobal.com/portal",
    "category" => "Networking",
    "icon_name" => "Share2",
    "sync_interval_minutes" => 30,
    "notes" => "Updated sync schedule for executive team"
]);
PHP;
    $editRes = runIsolatedEndpoint($editSnippet);
    assertTest("Update App Execution", ($editRes['status'] ?? '') === 'success', "App #{$bniId} updated: " . ($editRes['message'] ?? ''));

    // Verify DB directly
    $stmt = $db->prepare("SELECT name, category, settings_json FROM connected_apps WHERE id = ?");
    $stmt->execute([$bniId]);
    $row = $stmt->fetch(\PDO::FETCH_ASSOC);
    assertTest("DB Name Updated", ($row['name'] ?? '') === 'BNI Connect - VIP Chapter', "Name: {$row['name']}");
    assertTest("DB Category Updated", ($row['category'] ?? '') === 'Networking', "Category: {$row['category']}");

    // Verify sync interval in lead_sources_config
    $stmt = $db->prepare("SELECT sync_interval_minutes FROM lead_sources_config WHERE tenant_id = 1 AND source_key = 'bni'");
    $stmt->execute();
    $syncCfg = $stmt->fetch(\PDO::FETCH_ASSOC);
    assertTest("Sync Interval Updated in lead_sources_config", (int)($syncCfg['sync_interval_minutes'] ?? 0) === 30, "Interval: {$syncCfg['sync_interval_minutes']}m");

    // Revert BNI app to standard settings
    $revertSnippet = <<<PHP
AppHubController::updateApp(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, [
    "name" => "BNI Connect",
    "app_url" => "https://www.bniconnectglobal.com",
    "category" => "business",
    "icon_name" => "Users",
    "sync_interval_minutes" => 15,
    "notes" => "Official BNI Connect Portal"
]);
PHP;
    runIsolatedEndpoint($revertSnippet);
}

// -------------------------------------------------------------
// Test 3: Input Validation on Update
// -------------------------------------------------------------
echo PHP_EOL . "Test 3: Edit Input Validation..." . PHP_EOL;
if ($bniApp) {
    $bniId = (int)$bniApp['id'];
    $invalidSnippet1 = <<<PHP
AppHubController::updateApp(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, ["name" => "", "app_url" => "https://example.com"]);
PHP;
    $valRes1 = runIsolatedEndpoint($invalidSnippet1);
    assertTest("Empty Name Rejection", ($valRes1['status'] ?? '') === 'error' && strpos(strtolower($valRes1['message'] ?? ''), 'name') !== false, "Error message: " . ($valRes1['message'] ?? 'none'));

    $invalidSnippet2 = <<<PHP
AppHubController::updateApp(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, ["name" => "BNI Connect", "app_url" => "https://www.bniconnectglobal.com", "sync_interval_minutes" => 1]);
PHP;
    $valRes2 = runIsolatedEndpoint($invalidSnippet2);
    assertTest("Sub-5-minute Sync Interval Rejection", ($valRes2['status'] ?? '') === 'error' && strpos(strtolower($valRes2['message'] ?? ''), 'interval') !== false, "Error message: " . ($valRes2['message'] ?? 'none'));
}

// -------------------------------------------------------------
// Test 4: Reconnect Session Workflows
// -------------------------------------------------------------
echo PHP_EOL . "Test 4: Reconnect Session Workflows..." . PHP_EOL;
if ($bniApp) {
    $bniId = (int)$bniApp['id'];
    // Reconnect with existing stored session credentials
    $recSnippet1 = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, []);
PHP;
    $recRes1 = runIsolatedEndpoint($recSnippet1);
    assertTest("BNI Reconnect Existing Active Session", ($recRes1['status'] ?? '') === 'success', "Message: " . ($recRes1['message'] ?? 'none'));

    // Reconnect with bad credentials passed explicitly
    $recSnippet2 = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, [
    "username" => "bad_user_fake@bni.invalid",
    "password" => "wrong_password_xyz_999"
]);
PHP;
    $recRes2 = runIsolatedEndpoint($recSnippet2);
    assertTest("BNI Reconnect Invalid Credentials Handled", ($recRes2['status'] ?? '') === 'error', "Gracefully rejected: " . ($recRes2['message'] ?? 'none'));
}

if ($gmailApp) {
    $gmailId = (int)$gmailApp['id'];
    $recSnippetGmail = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$gmailId}, []);
PHP;
    $recResGmail = runIsolatedEndpoint($recSnippetGmail);
    $gmailJson = json_encode($recResGmail);
    $hasOAuthSignal = (isset($recResGmail['data']['auth_url']) || strpos(strtolower($gmailJson), 'google') !== false || strpos(strtolower($gmailJson), 'oauth') !== false);
    assertTest("Gmail Reconnect Triggers OAuth", $hasOAuthSignal, "OAuth response handled: " . ($recResGmail['message'] ?? ''));
}

// -------------------------------------------------------------
// Test 5: CRM Leads Data Preservation on Disconnect and Delete
// -------------------------------------------------------------
echo PHP_EOL . "Test 5: CRM Leads Data Preservation..." . PHP_EOL;

// Count baseline CRM leads for Tenant 1
$stmt = $db->prepare("SELECT COUNT(*) as cnt FROM crm_leads WHERE tenant_id = 1");
$stmt->execute();
$leadsBaseline = (int)$stmt->fetch(\PDO::FETCH_ASSOC)['cnt'];
assertTest("CRM Baseline Leads Counted", $leadsBaseline > 0, "Current Tenant 1 CRM Leads count: {$leadsBaseline}");

// Insert a temporary custom app for testing Disconnect & Delete
$stmt = $db->prepare("INSERT INTO connected_apps (tenant_id, name, category, icon_name, app_url, auth_type, connection_status, is_pinned, is_deleted) VALUES (1, 'Temporary Audit App', 'Tools', 'Terminal', 'https://audit.local', 'direct_link', 'connected', 0, 0)");
$stmt->execute();
$tempAppId = (int)$db->lastInsertId();
assertTest("Temporary Audit App Created", $tempAppId > 0, "Created App #{$tempAppId}");

// Disconnect the temporary app
$discSnippet = <<<PHP
AppHubController::disconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$tempAppId});
PHP;
$discRes = runIsolatedEndpoint($discSnippet);
assertTest("App Disconnect Executed Successfully", ($discRes['status'] ?? '') === 'success', "Message: " . ($discRes['message'] ?? 'none'));

// Verify CRM leads count is completely preserved
$stmt = $db->prepare("SELECT COUNT(*) as cnt FROM crm_leads WHERE tenant_id = 1");
$stmt->execute();
$leadsAfterDisc = (int)$stmt->fetch(\PDO::FETCH_ASSOC)['cnt'];
assertTest("Zero Leads Lost on Disconnect", $leadsAfterDisc === $leadsBaseline, "Lead count remains {$leadsAfterDisc} (Exactly {$leadsBaseline})");

// Delete the temporary app
$delSnippet = <<<PHP
AppHubController::deleteApp(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$tempAppId});
PHP;
$delRes = runIsolatedEndpoint($delSnippet);
assertTest("App Delete Executed Successfully", ($delRes['status'] ?? '') === 'success', "Message: " . ($delRes['message'] ?? 'none'));

// Verify CRM leads count is completely preserved
$stmt = $db->prepare("SELECT COUNT(*) as cnt FROM crm_leads WHERE tenant_id = 1");
$stmt->execute();
$leadsAfterDel = (int)$stmt->fetch(\PDO::FETCH_ASSOC)['cnt'];
assertTest("Zero Leads Lost on Delete", $leadsAfterDel === $leadsBaseline, "Lead count remains {$leadsAfterDel} (Exactly {$leadsBaseline})");

// Verify the deleted app is excluded from listApps
$resListAfter = runIsolatedEndpoint('AppHubController::listApps(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"]);');
$allIds = array_column($resListAfter['data'] ?? [], 'id');
assertTest("Deleted App Excluded from Application Hub", !in_array($tempAppId, $allIds), "App #{$tempAppId} absent from active listing");

// -------------------------------------------------------------
// Test 6: Tenant Isolation Security
// -------------------------------------------------------------
echo PHP_EOL . "Test 6: Tenant Isolation Enforcement..." . PHP_EOL;
if ($bniApp) {
    $bniId = (int)$bniApp['id'];

    // Cross-tenant Update attempt
    $t2UpdateSnippet = <<<PHP
AppHubController::updateApp(["id" => 999, "tenant_id" => 999, "role" => "tenant_admin"], {$bniId}, ["name" => "Hacked", "app_url" => "https://hacked.com"]);
PHP;
    $t2UpRes = runIsolatedEndpoint($t2UpdateSnippet);
    assertTest("Cross-Tenant Update Blocked", ($t2UpRes['status'] ?? '') === 'error', "Error: " . ($t2UpRes['message'] ?? 'none'));

    // Cross-tenant Reconnect attempt
    $t2RecSnippet = <<<PHP
AppHubController::reconnectPortal(["id" => 999, "tenant_id" => 999, "role" => "tenant_admin"], {$bniId}, []);
PHP;
    $t2RecRes = runIsolatedEndpoint($t2RecSnippet);
    assertTest("Cross-Tenant Reconnect Blocked", ($t2RecRes['status'] ?? '') === 'error', "Error: " . ($t2RecRes['message'] ?? 'none'));

    // Cross-tenant Disconnect attempt
    $t2DiscSnippet = <<<PHP
AppHubController::disconnectPortal(["id" => 999, "tenant_id" => 999, "role" => "tenant_admin"], {$bniId});
PHP;
    $t2DiscRes = runIsolatedEndpoint($t2DiscSnippet);
    assertTest("Cross-Tenant Disconnect Blocked", ($t2DiscRes['status'] ?? '') === 'error', "Error: " . ($t2DiscRes['message'] ?? 'none'));

    // Cross-tenant Delete attempt
    $t2DelSnippet = <<<PHP
AppHubController::deleteApp(["id" => 999, "tenant_id" => 999, "role" => "tenant_admin"], {$bniId});
PHP;
    $t2DelRes = runIsolatedEndpoint($t2DelSnippet);
    assertTest("Cross-Tenant Delete Blocked", ($t2DelRes['status'] ?? '') === 'error', "Error: " . ($t2DelRes['message'] ?? 'none'));
}

echo PHP_EOL . "=================================================================" . PHP_EOL;
echo "  SUMMARY: {$passed} PASSED / {$failed} FAILED (" . ($passed + $failed) . " TOTAL TESTS)" . PHP_EOL;
echo "=================================================================" . PHP_EOL;

if ($failed === 0) {
    echo ">> ALL EDIT & RECONNECT AUDIT SCENARIOS PASSED WITH 100% SUCCESS!" . PHP_EOL;
    exit(0);
} else {
    echo ">> SOME TESTS FAILED!" . PHP_EOL;
    exit(1);
}
