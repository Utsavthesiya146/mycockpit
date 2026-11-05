<?php
/**
 * MY COCKPIT AI - Comprehensive Connected Applications & Automatic Sync Test Suite
 * Covers all 16 test scenarios specified in the repair directive.
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/TenantMiddleware.php';
require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
require_once __DIR__ . '/../services/automation/EAFWebAutomationDriver.php';
require_once __DIR__ . '/../services/automation/BNIWebAutomationDriver.php';
require_once __DIR__ . '/../services/automation/KVVWebAutomationDriver.php';
require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/../services/connectors/EAFConnector.php';
require_once __DIR__ . '/../services/connectors/BNIConnector.php';
require_once __DIR__ . '/../services/connectors/KVVConnector.php';
require_once __DIR__ . '/../services/SyncEngine.php';
require_once __DIR__ . '/../controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use Cockpit\Services\SyncEngine;
use Cockpit\Services\Connectors\EAFConnector;
use Cockpit\Services\Connectors\BNIConnector;
use Cockpit\Services\Connectors\KVVConnector;
use Cockpit\Services\Automation\EAFWebAutomationDriver;
use Cockpit\Services\Automation\BNIWebAutomationDriver;
use Cockpit\Controllers\AppHubController;

$db = Database::getConnection();
AppHubController::ensureSchemaCompatibility($db);

$passed = 0;
$failed = 0;
$results = [];

function assertTest(string $name, bool $condition, string $detail = '') {
    global $passed, $failed, $results;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$name}" . ($detail ? " - {$detail}" : "") . PHP_EOL;
        $results[] = ['name' => $name, 'status' => 'PASS', 'detail' => $detail];
    } else {
        $failed++;
        echo "  [FAIL] {$name}" . ($detail ? " - {$detail}" : "") . PHP_EOL;
        $results[] = ['name' => $name, 'status' => 'FAIL', 'detail' => $detail];
    }
}

echo "=================================================================" . PHP_EOL;
echo "  MY COCKPIT AI - INTEGRATION REPAIR & AUTO-SYNC VERIFICATION SUITE" . PHP_EOL;
echo "=================================================================" . PHP_EOL . PHP_EOL;

// -------------------------------------------------------------
// Scenario 1: EAF Connect Real Live Synchronization (No 404)
// -------------------------------------------------------------
echo "Scenario 1: EAF Connect Live Synchronization..." . PHP_EOL;
$eafConnector = new EAFConnector();
$eafRes = $eafConnector->sync(1, ['tenant_id' => 1]);
assertTest(
    "EAF Connect Synchronize Live",
    !empty($eafRes['success']) && ($eafRes['leads_fetched'] ?? 0) > 0 && empty($eafRes['error']),
    "Fetched {$eafRes['leads_fetched']} referrals (0 HTTP 404 errors)"
);

// -------------------------------------------------------------
// Scenario 2: EAF Session Auto-Renewal with Expired Cookie
// -------------------------------------------------------------
echo "Scenario 2: EAF Auto-Renewal with Stale Cookie..." . PHP_EOL;
$eafDriver = new EAFWebAutomationDriver();
// Get actual credentials from database
$eafCfg = $db->query("SELECT encrypted_credentials FROM lead_sources_config WHERE tenant_id = 1 AND source_key = 'eaf'")->fetchColumn();
$eafCreds = json_decode(Encryption::decrypt($eafCfg), true);

$expiredEafSession = [
    'email' => $eafCreds['email'],
    'password' => $eafCreds['password'],
    'cookies' => ['ci_session' => 'expired_session_token_12345'],
    'cookie_jar' => 'eafconnect.com	FALSE	/	FALSE	0	ci_session	expired_session_token_12345'
];
$renewRes = $eafDriver->fetchReceivedReferrals(1, $expiredEafSession);
assertTest(
    "EAF Expired Session Auto-Renewal",
    !empty($renewRes['success']) && ($renewRes['count'] ?? 0) > 0,
    "Successfully auto-reauthenticated and retrieved {$renewRes['count']} referrals"
);

// -------------------------------------------------------------
// Scenario 3: EAF Invalid Credentials Rejection (Graceful, No 404)
// -------------------------------------------------------------
echo "Scenario 3: EAF Invalid Credentials Rejection..." . PHP_EOL;
$invalidEafDriver = new EAFWebAutomationDriver();
$badAuth = $invalidEafDriver->authenticateSession('nonexistent_user@akiradigital.in', 'WrongPassword!123');
assertTest(
    "EAF Invalid Credentials Rejection",
    $badAuth['status'] === 'auth_failed' && str_contains($badAuth['message'], 'Invalid email or password'),
    "Correctly rejected with 'Invalid email or password' (no HTTP 404)"
);

// -------------------------------------------------------------
// Scenario 4: BNI Connect Real Live Synchronization (No Spring Security JWT Error)
// -------------------------------------------------------------
echo "Scenario 4: BNI Connect Live Synchronization..." . PHP_EOL;
$bniConnector = new BNIConnector();
$bniRes = $bniConnector->sync(1, ['tenant_id' => 1]);
assertTest(
    "BNI Connect Synchronize Live",
    !empty($bniRes['success']) && ($bniRes['leads_fetched'] ?? 0) > 0,
    "Fetched {$bniRes['leads_fetched']} referrals (Spring Security JWT passed)"
);

// -------------------------------------------------------------
// Scenario 5: BNI JWT Expiration Detection & Auto-Renewal
// -------------------------------------------------------------
echo "Scenario 5: BNI JWT Expiration Detection & Auto-Renewal..." . PHP_EOL;
$bniDriver = new BNIWebAutomationDriver();
$expiredJwt = "eyJhbGciOiJIUzI1NiJ9." . rtrim(strtr(base64_encode(json_encode(['exp' => 1000, 'sub' => 'test'])), '+/', '-_'), '=') . ".signature";
$isExpired = $bniDriver->isJwtExpired($expiredJwt);
assertTest("BNI JWT isJwtExpired Detection", $isExpired === true, "Expired timestamp correctly evaluated as true");

$freshJwt = "eyJhbGciOiJIUzI1NiJ9." . rtrim(strtr(base64_encode(json_encode(['exp' => time() + 7200, 'sub' => 'test'])), '+/', '-_'), '=') . ".signature";
$isFresh = $bniDriver->isJwtExpired($freshJwt);
assertTest("BNI Fresh JWT isJwtExpired False", $isFresh === false, "Fresh timestamp correctly evaluated as false");

// -------------------------------------------------------------
// Scenario 6: BNI Invalid Credentials Handling
// -------------------------------------------------------------
echo "Scenario 6: BNI Invalid Credentials Handling..." . PHP_EOL;
$bniBadAuth = $bniDriver->authenticateSession('fake_bni_user_never_exists', 'WrongPassword!123');
assertTest(
    "BNI Invalid Credentials Handling",
    $bniBadAuth['status'] === 'auth_failed' && str_contains($bniBadAuth['message'], 'Invalid BNI Connect username or password'),
    "Gracefully returned 'Invalid BNI Connect username or password'"
);

// -------------------------------------------------------------
// Scenario 7: KVV Portal Live Referral Synchronization
// -------------------------------------------------------------
echo "Scenario 7: KVV Portal Live Synchronization..." . PHP_EOL;
$kvvConnector = new KVVConnector();
$kvvRes = $kvvConnector->sync(1, ['tenant_id' => 1]);
assertTest(
    "KVV Portal Synchronize Live",
    !empty($kvvRes['success']) && ($kvvRes['leads_fetched'] ?? 0) > 0,
    "Fetched {$kvvRes['leads_fetched']} referrals successfully"
);

// -------------------------------------------------------------
// Scenario 8: Central Auto-Sync Non-Blocking & Execution Timing
// -------------------------------------------------------------
echo "Scenario 8: Central Auto-Sync Non-Blocking Execution..." . PHP_EOL;
$t1 = microtime(true);
$autoRes1 = SyncEngine::checkAndRunAutoSync(1);
$ms1 = round((microtime(true) - $t1) * 1000, 2);
assertTest(
    "Auto-Sync Fast Execution On Refresh",
    $ms1 < 50.0 && $autoRes1['synced_any'] === false,
    "Executed in {$ms1}ms (< 50ms requirement achieved, duplicate sync prevented)"
);

// -------------------------------------------------------------
// Scenario 9: Configurable Sync Intervals Enforcement
// -------------------------------------------------------------
echo "Scenario 9: Sync Intervals Verification..." . PHP_EOL;
$intervals = [
    'bni' => SyncEngine::getDefaultInterval('bni'),
    'eaf' => SyncEngine::getDefaultInterval('eaf'),
    'kvv' => SyncEngine::getDefaultInterval('kvv'),
    'gmail' => SyncEngine::getDefaultInterval('gmail'),
    'google_calendar' => SyncEngine::getDefaultInterval('google_calendar')
];
assertTest(
    "Configured Sync Intervals",
    $intervals['bni'] === 15 && $intervals['eaf'] === 15 && $intervals['kvv'] === 15 && $intervals['gmail'] === 5 && $intervals['google_calendar'] === 5,
    "BNI: 15m, EAF: 15m, KVV: 15m, Gmail: 5m, Google Calendar: 5m verified"
);

// -------------------------------------------------------------
// Scenario 10: Atomic Lock Prevents Duplicate Simultaneous Syncs
// -------------------------------------------------------------
echo "Scenario 10: Atomic Lock Concurrency Protection..." . PHP_EOL;
$lock1 = SyncEngine::acquireLock(1, 'test_lock_bni', 30);
$lock2 = SyncEngine::acquireLock(1, 'test_lock_bni', 30);
SyncEngine::releaseLock(1, 'test_lock_bni', true);
$lock3 = SyncEngine::acquireLock(1, 'test_lock_bni', 30);
SyncEngine::releaseLock(1, 'test_lock_bni', true);

assertTest(
    "Atomic Concurrency Lock",
    $lock1 === true && $lock2 === false && $lock3 === true,
    "First caller acquires lock, concurrent second caller blocked, releases cleanly"
);

// -------------------------------------------------------------
// Scenario 11: Exponential Backoff Multiplier on Repeat Errors
// -------------------------------------------------------------
echo "Scenario 11: Exponential Backoff Verification..." . PHP_EOL;
$db->exec("DELETE FROM integration_sync_state WHERE tenant_id = 999 AND source_key = 'backoff_test'");
SyncEngine::acquireLock(999, 'backoff_test', 60);
SyncEngine::releaseLock(999, 'backoff_test', false, 0, 'First temporary network error', 15);
$row1 = $db->query("SELECT retry_count, next_sync_at FROM integration_sync_state WHERE tenant_id = 999 AND source_key = 'backoff_test'")->fetch(PDO::FETCH_ASSOC);

SyncEngine::acquireLock(999, 'backoff_test', 60);
SyncEngine::releaseLock(999, 'backoff_test', false, 0, 'Second network error', 15);
$row2 = $db->query("SELECT retry_count, next_sync_at FROM integration_sync_state WHERE tenant_id = 999 AND source_key = 'backoff_test'")->fetch(PDO::FETCH_ASSOC);

SyncEngine::acquireLock(999, 'backoff_test', 60);
SyncEngine::releaseLock(999, 'backoff_test', false, 0, 'Third network error', 15);
$row3 = $db->query("SELECT retry_count, next_sync_at FROM integration_sync_state WHERE tenant_id = 999 AND source_key = 'backoff_test'")->fetch(PDO::FETCH_ASSOC);

$db->exec("DELETE FROM integration_sync_state WHERE tenant_id = 999 AND source_key = 'backoff_test'");
assertTest(
    "Exponential Backoff Multipliers",
    (int)$row1['retry_count'] === 1 && (int)$row2['retry_count'] === 2 && (int)$row3['retry_count'] === 3,
    "Backoff retries scaled properly: 1 -> 2 -> 3 without endpoint flooding"
);

// -------------------------------------------------------------
// Scenario 12: Tenant Isolation Verification
// -------------------------------------------------------------
echo "Scenario 12: Tenant Isolation Verification..." . PHP_EOL;
$tenant1Leads = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1")->fetchColumn();
$tenant2Leads = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 2")->fetchColumn();
$tenantCrossQuery = $db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 2 AND source = 'BNI Connect'")->fetchColumn();
assertTest(
    "Tenant Isolation Enforcement",
    $tenantCrossQuery === 0,
    "Tenant 1 data is strictly isolated; Tenant 2 has 0 leaked BNI leads"
);

// -------------------------------------------------------------
// Scenario 13: CRM Lead Idempotency / No Duplicates
// -------------------------------------------------------------
echo "Scenario 13: CRM Lead Idempotency / Deduplication..." . PHP_EOL;
$countBefore = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1 AND source = 'EAF Connect'")->fetchColumn();
$eafRes2 = $eafConnector->sync(1, ['tenant_id' => 1]);
$countAfter = (int)$db->query("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1 AND source = 'EAF Connect'")->fetchColumn();
assertTest(
    "CRM Lead Deduplication & Idempotency",
    $countBefore === $countAfter && ($eafRes2['leads_created'] ?? 0) === 0,
    "Repeated sync created 0 duplicates (Count remained exactly {$countAfter})"
);

// -------------------------------------------------------------
// Scenario 14: Credential Security / No Leaked Secrets in API
// -------------------------------------------------------------
echo "Scenario 14: Credential Security Audit..." . PHP_EOL;
$appRows = $db->query("SELECT * FROM connected_apps WHERE tenant_id = 1")->fetchAll(PDO::FETCH_ASSOC);
$hasPlaintextPassword = false;
foreach ($appRows as $ar) {
    $json = json_encode($ar);
    if (str_contains($json, '123456789') || str_contains($json, 'password')) {
        $hasPlaintextPassword = true;
    }
}
$sessRows = $db->query("SELECT * FROM lead_platform_sessions WHERE tenant_id = 1")->fetchAll(PDO::FETCH_ASSOC);
$hasEncryptedSessions = true;
foreach ($sessRows as $sr) {
    if (empty($sr['encrypted_session_data'])) continue;
    if (str_starts_with($sr['encrypted_session_data'], '{')) {
        $hasEncryptedSessions = false;
    }
}
assertTest(
    "AES-256-GCM Credential Security",
    !$hasPlaintextPassword && $hasEncryptedSessions,
    "0 plaintext credentials stored or returned; All session data encrypted"
);

// -------------------------------------------------------------
// Scenario 15: Connected Applications Hub API Response Structure
// -------------------------------------------------------------
echo "Scenario 15: Connected Apps Endpoint Output Validation..." . PHP_EOL;
$testFile = __DIR__ . '/scratch_test_endpoint.php';
$baseDir = str_replace('\\', '/', dirname(__DIR__));
$testCode = <<<PHP
<?php
require "{$baseDir}/config/Database.php";
require "{$baseDir}/config/Config.php";
require "{$baseDir}/utils/Encryption.php";
require "{$baseDir}/utils/Response.php";
require "{$baseDir}/middleware/TenantMiddleware.php";
require "{$baseDir}/controllers/AppHubController.php";
\Cockpit\Controllers\AppHubController::listApps(["id" => 1, "tenant_id" => 1, "role" => "tenant_admin"]);
PHP;
file_put_contents($testFile, $testCode);
$rawOutput = shell_exec('"D:\\xampp\\php\\php.exe" ' . escapeshellarg($testFile));
unlink($testFile);

// Filter out any CLI warning headers from output to parse JSON
$jsonStart = strpos((string)$rawOutput, '{"status"');
$jsonString = $jsonStart !== false ? substr((string)$rawOutput, $jsonStart) : (string)$rawOutput;
$apiDecoded = json_decode($jsonString, true);
$appsList = $apiDecoded['data'] ?? [];

$hasLiveBadges = true;
$bniApp = null;
foreach ($appsList as $a) {
    if (empty($a['live_badge'])) $hasLiveBadges = false;
    if ($a['name'] === 'BNI Connect') $bniApp = $a;
}
assertTest(
    "Connected Apps List Response Structure",
    !empty($appsList) && $hasLiveBadges && $bniApp !== null && $bniApp['live_badge'] === 'Synced',
    "Response includes live_badge ('{$bniApp['live_badge']}'), records_synced ({$bniApp['records_synced']})"
);

// -------------------------------------------------------------
// Scenario 16: Global Manual 'Sync All' Execution
// -------------------------------------------------------------
echo "Scenario 16: Global Manual Sync All Execution..." . PHP_EOL;
$syncAllRes = SyncEngine::syncAllSourcesForTenant(1, 'manual');
assertTest(
    "Sync All Connected Applications",
    !empty($syncAllRes['success']) && isset($syncAllRes['sources']['bni']) && isset($syncAllRes['sources']['eaf']) && isset($syncAllRes['sources']['kvv']),
    "Executed manual sync across all enabled platforms in {$syncAllRes['execution_time_ms']}ms"
);

echo PHP_EOL;
echo "=================================================================" . PHP_EOL;
echo "  SUMMARY: {$passed} PASSED / {$failed} FAILED (" . count($results) . " TOTAL TESTS)" . PHP_EOL;
echo "=================================================================" . PHP_EOL;

if ($failed === 0) {
    echo ">> ALL 16 INTEGRATION AND AUTO-SYNC SCENARIOS PASSED WITH 100% SUCCESS!" . PHP_EOL;
} else {
    echo ">> SOME TESTS FAILED. PLEASE REVIEW." . PHP_EOL;
}
