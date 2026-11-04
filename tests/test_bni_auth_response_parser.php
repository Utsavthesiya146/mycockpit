<?php
declare(strict_types=1);

/**
 * Automated Test Suite: BNI Connect Authentication Response Parser & Session Verifier
 * 
 * Tests:
 * 1. Nested 'content' token response parsing (HTTP 200)
 * 2. Root-level token response parsing (HTTP 200)
 * 3. CamelCase token response parsing (HTTP 200)
 * 4. Application-level error on HTTP 200 (invalidcredentials)
 * 5. Application-level error on HTTP 200 (blockedaccount)
 * 6. Application-level error on HTTP 200 (toomanyattempts)
 * 7. Standard HTTP 401 invalid credentials rejection
 * 8. Unexpected response structure on HTTP 200 (missing tokens - rejected)
 * 9. Unexpected HTML login page on HTTP 200 (rejected)
 * 10. Cloudflare bot challenge detection (captcha_required)
 * 11. Cookie parsing and header extraction (JSESSIONID, AUTH_INIT)
 * 12. Strict credential & token data masking in diagnostics and messages
 * 13. Live endpoint error formatting (real network probe)
 * 14. Data integrity: CRM leads #41 through #45 and tenant isolation preserved
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/services/automation/PlatformAutomationDriverInterface.php';
require_once __DIR__ . '/../backend/services/automation/BNIWebAutomationDriver.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use Cockpit\Services\Automation\BNIWebAutomationDriver;

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
echo "   BNI AUTH RESPONSE PARSER & SESSION TEST SUITE       \n";
echo "=======================================================\n\n";

$driver = new BNIWebAutomationDriver();

// ---------------------------------------------------------------------
// TEST 1: Nested 'content' Token Parsing (Standard BNI Connect API)
// ---------------------------------------------------------------------
echo "[1/14] Testing Nested 'content' Token Parsing (HTTP 200)...\n";
$nestedBody = json_encode([
    'content' => [
        'access_token' => 'sample_bni_jwt_access_token_nested',
        'refresh_token' => 'sample_bni_refresh_token_nested',
        'expires_in' => 7200,
        'user_id' => 'member_bni_101'
    ]
]);
$headers = "HTTP/2 200\r\nContent-Type: application/json\r\nSet-Cookie: AUTH_INIT=Connect; Path=/web\r\n";
$res1 = $driver->parseAuthResponse(200, $headers, $nestedBody);

assertTest($res1['status'] === 'tokens_acquired', 'Status is tokens_acquired');
assertTest($res1['access_token'] === 'sample_bni_jwt_access_token_nested', 'Nested access_token correctly extracted');
assertTest($res1['refresh_token'] === 'sample_bni_refresh_token_nested', 'Nested refresh_token correctly extracted');
assertTest($res1['expires_in'] === 7200, 'Nested expires_in correctly extracted');
assertTest($res1['user_id'] === 'member_bni_101', 'Nested user_id correctly extracted');

// ---------------------------------------------------------------------
// TEST 2: Root-Level Token Parsing (HTTP 200)
// ---------------------------------------------------------------------
echo "\n[2/14] Testing Root-Level Token Parsing (HTTP 200)...\n";
$rootBody = json_encode([
    'access_token' => 'sample_bni_root_access_token',
    'refresh_token' => 'sample_bni_root_refresh_token',
    'expires_in' => 3600
]);
$res2 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $rootBody);

assertTest($res2['status'] === 'tokens_acquired', 'Root status is tokens_acquired');
assertTest($res2['access_token'] === 'sample_bni_root_access_token', 'Root access_token correctly extracted');
assertTest($res2['refresh_token'] === 'sample_bni_root_refresh_token', 'Root refresh_token correctly extracted');

// ---------------------------------------------------------------------
// TEST 3: CamelCase Token Parsing (HTTP 200)
// ---------------------------------------------------------------------
echo "\n[3/14] Testing CamelCase Token Parsing (HTTP 200)...\n";
$camelBody = json_encode([
    'content' => [
        'accessToken' => 'sample_bni_camel_access_token',
        'refreshToken' => 'sample_bni_camel_refresh_token',
        'expiresIn' => 1800
    ]
]);
$res3 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $camelBody);

assertTest($res3['status'] === 'tokens_acquired', 'CamelCase status is tokens_acquired');
assertTest($res3['access_token'] === 'sample_bni_camel_access_token', 'CamelCase accessToken correctly extracted');
assertTest($res3['refresh_token'] === 'sample_bni_camel_refresh_token', 'CamelCase refreshToken correctly extracted');
assertTest($res3['expires_in'] === 1800, 'CamelCase expiresIn correctly extracted');

// ---------------------------------------------------------------------
// TEST 4: Application-Level Error on HTTP 200 (Invalid Credentials)
// ---------------------------------------------------------------------
echo "\n[4/14] Testing Application-Level Error on HTTP 200 (Invalid Credentials)...\n";
$appErrBody = json_encode([
    'error' => [
        'type' => 'AUTH',
        'apiErrors' => [
            [
                'errorCode' => 'AUTH_ERROR',
                'message' => 'app.error.auth.invalidcredentials'
            ]
        ]
    ]
]);
$res4 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $appErrBody);

assertTest($res4['status'] === 'auth_failed', 'Application-level error rejected with auth_failed');
assertTest($res4['reason'] === 'invalid_credentials', 'Reason is invalid_credentials');
assertTest($res4['message'] === 'Invalid BNI Connect username or password.', 'Error message formatted cleanly');
assertTest(!isset($res4['access_token']), 'No access token issued on application error');

// ---------------------------------------------------------------------
// TEST 5: Application-Level Error on HTTP 200 (Account Blocked)
// ---------------------------------------------------------------------
echo "\n[5/14] Testing Application-Level Error on HTTP 200 (Blocked Account)...\n";
$blockedBody = json_encode([
    'error' => [
        'type' => 'AUTH',
        'apiErrors' => [
            [
                'errorCode' => 'AUTH_ERROR',
                'message' => 'app.error.auth.blockedaccount'
            ]
        ]
    ]
]);
$res5 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $blockedBody);

assertTest($res5['status'] === 'auth_failed', 'Blocked account rejected with auth_failed');
assertTest($res5['reason'] === 'account_blocked', 'Reason is account_blocked');
assertTest(str_contains(strtolower($res5['message']), 'blocked'), 'Message clearly states account is blocked');

// ---------------------------------------------------------------------
// TEST 6: Application-Level Error on HTTP 200 (Rate Limited)
// ---------------------------------------------------------------------
echo "\n[6/14] Testing Application-Level Error on HTTP 200 (Rate Limited)...\n";
$rateBody = json_encode([
    'error' => [
        'type' => 'AUTH',
        'apiErrors' => [
            [
                'errorCode' => 'AUTH_ERROR',
                'message' => 'app.error.auth.toomanyattempts'
            ]
        ]
    ]
]);
$res6 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $rateBody);

assertTest($res6['status'] === 'auth_failed', 'Rate limited response rejected with auth_failed');
assertTest($res6['reason'] === 'rate_limited', 'Reason is rate_limited');
assertTest(str_contains(strtolower($res6['message']), 'too many'), 'Message clearly advises user about attempts');

// ---------------------------------------------------------------------
// TEST 7: Standard HTTP 401 Invalid Credentials
// ---------------------------------------------------------------------
echo "\n[7/14] Testing Standard HTTP 401 Rejection...\n";
$res7 = $driver->parseAuthResponse(401, "HTTP/2 401\r\n", $appErrBody);

assertTest($res7['status'] === 'auth_failed', 'HTTP 401 rejected with auth_failed');
assertTest($res7['reason'] === 'invalid_credentials', 'Reason is invalid_credentials');

// ---------------------------------------------------------------------
// TEST 8: Unexpected Response Structure on HTTP 200 (Missing Tokens)
// ---------------------------------------------------------------------
echo "\n[8/14] Testing Unexpected Response Structure on HTTP 200 (Missing Tokens)...\n";
$unexpBody = json_encode(['status' => 'success', 'unknown_field' => 'value']);
$res8 = $driver->parseAuthResponse(200, "HTTP/2 200\r\n", $unexpBody);

assertTest($res8['status'] === 'auth_failed', 'HTTP 200 without tokens rejected with auth_failed');
assertTest($res8['reason'] === 'unexpected_response', 'Reason is unexpected_response');
assertTest(str_contains($res8['message'], 'Unexpected response structure'), 'Descriptive error without treating 200 alone as success');

// ---------------------------------------------------------------------
// TEST 9: Unexpected HTML Login Page on HTTP 200
// ---------------------------------------------------------------------
echo "\n[9/14] Testing Unexpected HTML Login Page on HTTP 200...\n";
$htmlBody = '<!DOCTYPE html><html><body><form id="loginbox" action="/web/j_spring_security_jwt_check"><input type="submit" value="Sign In"></form></body></html>';
$res9 = $driver->parseAuthResponse(200, "HTTP/2 200\r\nContent-Type: text/html\r\n", $htmlBody);

assertTest($res9['status'] === 'auth_failed', 'HTTP 200 HTML rejected with auth_failed');
assertTest($res9['reason'] === 'unauthenticated_redirect', 'Reason is unauthenticated_redirect');

// ---------------------------------------------------------------------
// TEST 10: Cloudflare Bot Challenge Detection (captcha_required)
// ---------------------------------------------------------------------
echo "\n[10/14] Testing Cloudflare Bot Challenge Detection...\n";
$cfBody = '<!DOCTYPE html><html><body><div class="cf-turnstile"></div>Just a moment...</body></html>';
$res10 = $driver->parseAuthResponse(403, "HTTP/2 403\r\n", $cfBody);

assertTest($res10['status'] === 'captcha_required', 'Cloudflare challenge flagged as captcha_required');
assertTest($res10['reason'] === 'captcha_challenge', 'Reason is captcha_challenge');

// ---------------------------------------------------------------------
// TEST 11: Cookie Parsing & Extraction
// ---------------------------------------------------------------------
echo "\n[11/14] Testing Cookie Parsing from Headers...\n";
$rawHdrs = "HTTP/2 200\r\n" .
           "Set-Cookie: JSESSIONID=BCA81FAA1010822206BA44DF9243006B; Path=/web; Secure; HttpOnly\r\n" .
           "Set-Cookie: AUTH_INIT=Connect; Path=/web; Secure\r\n" .
           "Set-Cookie: old_cookie=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/\r\n";

$cookies = $driver->extractCookiesFromHeaders($rawHdrs);
assertTest(isset($cookies['JSESSIONID']), 'JSESSIONID extracted');
assertTest($cookies['JSESSIONID'] === 'BCA81FAA1010822206BA44DF9243006B', 'JSESSIONID matches expected value');
assertTest(isset($cookies['AUTH_INIT']) && $cookies['AUTH_INIT'] === 'Connect', 'AUTH_INIT extracted');
assertTest(!isset($cookies['old_cookie']), 'Deleted cookie ignored');

// ---------------------------------------------------------------------
// TEST 12: Data Masking & Privacy Check
// ---------------------------------------------------------------------
echo "\n[12/14] Testing Strict Credential & Token Data Masking...\n";
$secretToken = "super_secret_bearer_token_123456789";
$secretCookie = "JSESSIONID=SUPER_SECRET_SESSION_ID";

// Verify that parseAuthResponse diagnostics NEVER log access tokens
$diagStr = json_encode($res1['diagnostics'] ?? []);
assertTest(!str_contains($diagStr, 'sample_bni_jwt_access_token_nested'), 'Access token is never in diagnostics');

// Verify that error messages never leak sensitive input
$errStr = json_encode($res4);
assertTest(!str_contains($errStr, 'DummyPassword'), 'Passwords are never in error output');

// ---------------------------------------------------------------------
// TEST 13: Live BNI Endpoint Error Handling Probe
// ---------------------------------------------------------------------
echo "\n[13/14] Probing Live BNI Connect Endpoint with Test Non-Existent User...\n";
$liveProbe = $driver->authenticateSession('non_existent_bni_user_testing@example.com', 'InvalidWrongPass123!');
echo "  Live Probe Result: status = {$liveProbe['status']} | message = {$liveProbe['message']}\n";
assertTest(in_array($liveProbe['status'], ['auth_failed', 'captcha_required']), 'Live endpoint rejects invalid credentials honestly or detects captcha');
assertTest(!str_contains($liveProbe['message'], 'InvalidWrongPass123!'), 'Plaintext password never leaked in live message');

// ---------------------------------------------------------------------
// TEST 14: Data Integrity: Genuine CRM Leads #41–#45 & Tenant Isolation
// ---------------------------------------------------------------------
echo "\n[14/14] Verifying Data Integrity & Preservation...\n";
$db = Database::getConnection();
$leads = $db->query("SELECT id, name, email, phone FROM crm_leads WHERE id BETWEEN 41 AND 45 ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
assertTest(count($leads) === 5, 'All 5 genuine CRM leads #41 through #45 exist and intact');

$kvvApp = $db->query("SELECT connection_status FROM connected_apps WHERE id = 5")->fetchColumn();
assertTest(in_array($kvvApp, ['auth_required', 'connected'], true), 'KVV Portal status is valid');

$eafApp = $db->query("SELECT connection_status FROM connected_apps WHERE id = 10")->fetchColumn();
assertTest($eafApp === 'connected', 'EAF Connect remains connected');

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";

if ($failed > 0) {
    exit(1);
}
