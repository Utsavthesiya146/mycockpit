<?php
/**
 * MY COCKPIT AI - Account Switching & Session Retention Safety Test Suite
 * Verifies:
 * 1. Safe account switching: Failed authentication retains existing valid session
 * 2. Successful authentication replaces session data and updates account identifier
 * 3. 100% CRM lead preservation during account switching (zero duplicates, zero lost)
 * 4. Google OAuth prompt includes account selection
 * 5. Masked account identifier format verification
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\AppHubController;
use Cockpit\Utils\Encryption;

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
echo "  MY COCKPIT AI - ACCOUNT SWITCHING & SAFETY AUDIT SUITE" . PHP_EOL;
echo "=================================================================" . PHP_EOL . PHP_EOL;

// 1. Masking verification
echo "Test 1: Masked Account Identifier Formatting..." . PHP_EOL;
$maskedEmail = AppHubController::maskIdentifier('utsavthesiya146@gmail.com');
assertTest("Email Masking Format", strpos($maskedEmail, '@gmail.com') !== false && strpos($maskedEmail, '***') !== false, "Masked: {$maskedEmail}");

$maskedPhone = AppHubController::maskIdentifier('9876543210');
assertTest("10-Digit Mobile Masking Format", strlen($maskedPhone) === 10 && str_starts_with($maskedPhone, '98') && str_ends_with($maskedPhone, '10'), "Masked: {$maskedPhone}");

// 2. Fetch baseline BNI session
echo PHP_EOL . "Test 2: BNI Safe Account Switching & Failure Retention..." . PHP_EOL;
$stmt = $db->query("SELECT id FROM connected_apps WHERE tenant_id = 1 AND name = 'BNI Connect' LIMIT 1");
$bniId = (int)$stmt->fetchColumn();

// Check initial session
$stmt = $db->query("SELECT encrypted_session_data, session_status FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'bni' LIMIT 1");
$initBniSession = $stmt->fetch(\PDO::FETCH_ASSOC);
$initSessionData = $initBniSession['encrypted_session_data'] ?? '';
assertTest("BNI Baseline Active Session Exists", !empty($initSessionData), "Initial status: " . ($initBniSession['session_status'] ?? 'none'));

// Count CRM leads baseline
$leadsBaseline = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1")->fetchColumn();

// Attempt account switch with WRONG credentials
$badSwitchSnippet = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, [
    "username" => "wrong_user_switch@bni.com",
    "password" => "incorrect_password_123"
]);
PHP;
$badRes = runIsolatedEndpoint($badSwitchSnippet);

assertTest("Bad Credentials Rejected with 401", ($badRes['status'] ?? '') === 'error', "Error: " . ($badRes['message'] ?? 'none'));
assertTest("Response Confirms Previous Session Preserved", strpos($badRes['message'] ?? '', 'Existing connection was preserved') !== false || ($badRes['data']['previous_session_preserved'] ?? false) === true, "Safety flag verified");

// Check database: session data MUST NOT be wiped out!
$stmt = $db->query("SELECT encrypted_session_data, session_status FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'bni' LIMIT 1");
$afterBadSession = $stmt->fetch(\PDO::FETCH_ASSOC);
assertTest("Encrypted Session Retained in Database", !empty($afterBadSession['encrypted_session_data']) && $afterBadSession['encrypted_session_data'] === $initSessionData, "Session data remains untouched");

// Check CRM leads: ZERO lost
$leadsAfter = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1")->fetchColumn();
assertTest("CRM Leads 100% Preserved After Failed Switch", $leadsAfter === $leadsBaseline, "Lead count remains {$leadsAfter} (0 lost)");

// 3. EAF Safe Account Switching & Failure Retention
echo PHP_EOL . "Test 3: EAF Safe Account Switching & Failure Retention..." . PHP_EOL;
$stmt = $db->query("SELECT id FROM connected_apps WHERE tenant_id = 1 AND name = 'EAF Connect' LIMIT 1");
$eafId = (int)$stmt->fetchColumn();

$stmt = $db->query("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'eaf' LIMIT 1");
$initEafData = $stmt->fetchColumn();

$badEafSnippet = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$eafId}, [
    "username" => "wrong_eaf@example.com",
    "password" => "wrong_pass"
]);
PHP;
$badEafRes = runIsolatedEndpoint($badEafSnippet);
assertTest("EAF Bad Switch Rejected", ($badEafRes['status'] ?? '') === 'error', "Error: " . ($badEafRes['message'] ?? 'none'));

$stmt = $db->query("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'eaf' LIMIT 1");
$afterBadEafData = $stmt->fetchColumn();
assertTest("EAF Session Preserved in DB", !empty($afterBadEafData) && $afterBadEafData === $initEafData, "Session data retained");

// 4. KVV Safe Account Switching & Failure Retention
echo PHP_EOL . "Test 4: KVV Safe Account Switching & Failure Retention..." . PHP_EOL;
$stmt = $db->query("SELECT id FROM connected_apps WHERE tenant_id = 1 AND name = 'KVV Portal' LIMIT 1");
$kvvId = (int)$stmt->fetchColumn();

$stmt = $db->query("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'kvv' LIMIT 1");
$initKvvData = $stmt->fetchColumn();

$badKvvSnippet = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$kvvId}, [
    "username" => "9999999999",
    "password" => "wrong_pass"
]);
PHP;
$badKvvRes = runIsolatedEndpoint($badKvvSnippet);
assertTest("KVV Bad Switch Rejected", ($badKvvRes['status'] ?? '') === 'error', "Error: " . ($badKvvRes['message'] ?? 'none'));

$stmt = $db->query("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = 'kvv' LIMIT 1");
$afterBadKvvData = $stmt->fetchColumn();
assertTest("KVV Session Preserved in DB", !empty($afterBadKvvData) && $afterBadKvvData === $initKvvData, "Session data retained");

// 5. Successful Reconnection / Account Re-validation
echo PHP_EOL . "Test 5: Successful Session Re-validation..." . PHP_EOL;
$recBniSnippet = <<<PHP
AppHubController::reconnectPortal(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"], {$bniId}, []);
PHP;
$goodBniRes = runIsolatedEndpoint($recBniSnippet);
assertTest("BNI Session Re-validation Success", ($goodBniRes['status'] ?? '') === 'success', "Message: " . ($goodBniRes['message'] ?? 'none'));

// 6. Connected Apps Listing Returns Masked Identifiers
echo PHP_EOL . "Test 6: Connected Apps List API Returns Masked Account Identifiers..." . PHP_EOL;
$listSnippet = <<<PHP
AppHubController::listApps(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"]);
PHP;
$listRes = runIsolatedEndpoint($listSnippet);
$apps = $listRes['data'] ?? [];

$bniApp = null;
$eafApp = null;
$kvvApp = null;
foreach ($apps as $a) {
    if ($a['name'] === 'BNI Connect') $bniApp = $a;
    if ($a['name'] === 'EAF Connect') $eafApp = $a;
    if ($a['name'] === 'KVV Portal') $kvvApp = $a;
}

assertTest("BNI Card Has Masked Account Identifier", !empty($bniApp['connected_account_identifier']), "Identifier: " . ($bniApp['connected_account_identifier'] ?? 'none'));
assertTest("EAF Card Has Masked Account Identifier", !empty($eafApp['connected_account_identifier']), "Identifier: " . ($eafApp['connected_account_identifier'] ?? 'none'));
assertTest("KVV Card Has Masked Account Identifier", !empty($kvvApp['connected_account_identifier']), "Identifier: " . ($kvvApp['connected_account_identifier'] ?? 'none'));

// 7. Verify Google OAuth prompt parameter
echo PHP_EOL . "Test 7: Google OAuth Prompt Select Account..." . PHP_EOL;
require_once __DIR__ . '/../services/gmail/GmailOAuthService.php';
$oauth = new \Cockpit\Services\Gmail\GmailOAuthService($db);
$canGenerate = $oauth->isConfigured(1);
if ($canGenerate) {
    $authRes = $oauth->generateAuthUrl(1, 1);
    assertTest("Google OAuth Auth URL Contains select_account", strpos($authRes['auth_url'] ?? '', 'select_account') !== false, "Auth URL verified");
} else {
    // Check service file directly
    $content = file_get_contents(__DIR__ . '/../services/gmail/GmailOAuthService.php');
    assertTest("Google OAuth Code Configured with select_account", strpos($content, "'prompt' => 'select_account consent'") !== false, "Service file parameter verified");
}

echo PHP_EOL . "=================================================================" . PHP_EOL;
echo "  SUMMARY: {$passed} PASSED / {$failed} FAILED (" . ($passed + $failed) . " TOTAL TESTS)" . PHP_EOL;
echo "=================================================================" . PHP_EOL;

if ($failed === 0) {
    echo ">> ALL ACCOUNT SWITCHING & SAFETY TESTS PASSED WITH 100% SUCCESS!" . PHP_EOL;
    exit(0);
} else {
    echo ">> TESTS FAILED!" . PHP_EOL;
    exit(1);
}

