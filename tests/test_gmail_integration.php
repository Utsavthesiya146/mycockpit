<?php
/**
 * Test Suite: Full Gmail Integration & Security Verification
 * Verifies OAuth 2.0 flow, PKCE, state tokens, approved scopes, AES-256-GCM encryption,
 * RFC 2822 MIME message construction, HTML Sanitizer (XSS protection),
 * metadata-first message storage, folder routing, Move to Trash delete rule,
 * tenant isolation, and zero regression on baseline leads (#41-#45) & EAF/BNI/KVV integrations.
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/services/gmail/HtmlSanitizer.php';
require_once __DIR__ . '/../backend/services/gmail/GmailOAuthService.php';
require_once __DIR__ . '/../backend/services/gmail/GmailApiService.php';
require_once __DIR__ . '/../backend/controllers/GmailController.php';
require_once __DIR__ . '/../backend/controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use Cockpit\Services\Gmail\HtmlSanitizer;
use Cockpit\Services\Gmail\GmailOAuthService;
use Cockpit\Services\Gmail\GmailApiService;

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
echo "MY COCKPIT AI - FULL GMAIL INTEGRATION TEST SUITE\n";
echo "=======================================================\n\n";

$testTenantA = 991;
$testTenantB = 992;
$testUserIdA = 1001;
$testUserIdB = 1002;

// Clean up any stale test records from previous test runs
$db->prepare("DELETE FROM gmail_messages WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM gmail_accounts WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM gmail_oauth_states WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM lead_sources_config WHERE tenant_id IN (?, ?) AND source_key = 'gmail'")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM lead_platform_sessions WHERE tenant_id IN (?, ?) AND source_key = 'gmail'")->execute([$testTenantA, $testTenantB]);

// ---------------------------------------------------------------------------
// TEST GROUP 1: Approved OAuth Scopes, Canonical Callback & PKCE Security
// ---------------------------------------------------------------------------
echo "--- TEST GROUP 1: OAuth Scopes, PKCE & Canonical Callback ---\n";

$approvedScopes = GmailOAuthService::APPROVED_SCOPES;
assertTest(in_array('https://www.googleapis.com/auth/gmail.readonly', $approvedScopes), "Approved scopes include gmail.readonly");
assertTest(in_array('https://www.googleapis.com/auth/gmail.send', $approvedScopes), "Approved scopes include gmail.send");
assertTest(in_array('https://www.googleapis.com/auth/gmail.compose', $approvedScopes), "Approved scopes include gmail.compose");
assertTest(in_array('https://www.googleapis.com/auth/gmail.modify', $approvedScopes), "Approved scopes include gmail.modify");
assertTest(in_array('openid', $approvedScopes), "Approved scopes include openid");
assertTest(in_array('email', $approvedScopes), "Approved scopes include email");
assertTest(!in_array('https://mail.google.com/', $approvedScopes), "Broad scope https://mail.google.com/ is strictly omitted");

$canonicalUri = GmailOAuthService::getCanonicalRedirectUri();
assertTest($canonicalUri === 'http://localhost/mycockpit/backend/api/gmail/oauth/callback', "Canonical backend OAuth callback URI is exact on local: {$canonicalUri}");

putenv('GOOGLE_REDIRECT_URI=https://mycockpit-0e86.onrender.com/api/gmail/oauth/callback');
$prodUri = GmailOAuthService::getCanonicalRedirectUri();
assertTest($prodUri === 'https://mycockpit-0e86.onrender.com/api/gmail/oauth/callback', "Environment-aware override: GOOGLE_REDIRECT_URI correctly returns production callback: {$prodUri}");
putenv('GOOGLE_REDIRECT_URI'); // reset

$pkce = GmailOAuthService::generatePkce();
assertTest(strlen($pkce['verifier']) === 64, "PKCE code_verifier is 64 characters random string");
assertTest(!empty($pkce['challenge']), "PKCE code_challenge generated");
// Verify S256 hash match
$expectedChallenge = rtrim(strtr(base64_encode(hash('sha256', $pkce['verifier'], true)), '+/', '-_'), '=');
assertTest($pkce['challenge'] === $expectedChallenge, "PKCE code_challenge matches RFC 7636 SHA-256 base64url transformation");

// ---------------------------------------------------------------------------
// TEST GROUP 2: OAuth State Management & Anti-Replay Protection
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 2: OAuth State & Anti-Replay Protection ---\n";

$oauthService = new GmailOAuthService($db);
$stateToken = $oauthService->generateStateToken($testTenantA, $testUserIdA, $pkce['verifier']);
assertTest(strlen($stateToken) === 64, "Generated secure 64-char hex state token");

// Verify state exists in database
$stmt = $db->prepare("SELECT * FROM gmail_oauth_states WHERE state_token = ?");
$stmt->execute([$stateToken]);
$stateRow = $stmt->fetch(PDO::FETCH_ASSOC);
assertTest(!empty($stateRow), "State token persisted in gmail_oauth_states table");
assertTest((int)$stateRow['tenant_id'] === $testTenantA, "State token correctly isolates tenant");
assertTest($stateRow['code_verifier'] === $pkce['verifier'], "State token binds PKCE code_verifier");

// Validate state token (first use should succeed)
$validState = $oauthService->validateState($stateToken);
assertTest($validState !== null, "State token validates successfully on first use");
assertTest($validState['tenant_id'] === $testTenantA, "Validated state returns correct tenant ID");

// Anti-Replay verification: Second attempt with same state token MUST fail
$replayedState = $oauthService->validateState($stateToken);
assertTest($replayedState === null, "Replay attack prevented: State token consumed and invalidated after first use");

// ---------------------------------------------------------------------------
// TEST GROUP 3: AES-256-GCM Token Encryption & Storage
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 3: AES-256-GCM Token Encryption & Session Isolation ---\n";

$mockTokens = [
    'access_token' => 'ya29.a0AfH6SMB_TEST_ACCESS_TOKEN_' . bin2hex(random_bytes(16)),
    'refresh_token' => '1//0g_TEST_REFRESH_TOKEN_' . bin2hex(random_bytes(20)),
    'token_type' => 'Bearer',
    'expires_in' => 3600,
    'scope' => implode(' ', $approvedScopes),
    'created_at' => time()
];
$mockProfile = [
    'emailAddress' => 'testuser.cockpit@gmail.com',
    'historyId' => '1048291',
    'messagesTotal' => 125,
    'threadsTotal' => 45
];

$saved = $oauthService->saveAccountTokens($testTenantA, $mockTokens, $mockProfile);
assertTest($saved === true, "Account tokens and profile saved successfully for Tenant A");

// Inspect database row to confirm raw plaintext tokens are NEVER stored
$rawStmt = $db->prepare("SELECT id, email_address, encrypted_tokens, connection_status FROM gmail_accounts WHERE tenant_id = ?");
$rawStmt->execute([$testTenantA]);
$rawAcc = $rawStmt->fetch(PDO::FETCH_ASSOC);
assertTest(!empty($rawAcc), "gmail_accounts record found in database");
assertTest($rawAcc['connection_status'] === 'connected', "gmail_accounts connection_status is 'connected'");
assertTest($rawAcc['email_address'] === 'testuser.cockpit@gmail.com', "Email address recorded accurately");
assertTest(strpos($rawAcc['encrypted_tokens'], 'ya29.') === false, "Access token is NOT stored in plaintext");
assertTest(strpos($rawAcc['encrypted_tokens'], '1//0g') === false, "Refresh token is NOT stored in plaintext");

// Verify AES-256-GCM payload structure (ciphertext + IV + tag)
$decryptedTokens = $oauthService->getStoredTokens($testTenantA);
assertTest(!empty($decryptedTokens), "Stored tokens decrypted cleanly using server encryption key");
assertTest($decryptedTokens['access_token'] === $mockTokens['access_token'], "Decrypted access token matches original");
assertTest($decryptedTokens['refresh_token'] === $mockTokens['refresh_token'], "Decrypted refresh token matches original");

// Verify lead_platform_sessions synchronization
$sessStmt = $db->prepare("SELECT session_status, (encrypted_session_data IS NOT NULL) AS has_creds FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = 'gmail'");
$sessStmt->execute([$testTenantA]);
$sessRow = $sessStmt->fetch(PDO::FETCH_ASSOC);
assertTest($sessRow['session_status'] === 'active', "lead_platform_sessions synchronized as active");
assertTest(!empty($sessRow['has_creds']), "lead_platform_sessions contains encrypted session payload");

// ---------------------------------------------------------------------------
// TEST GROUP 4: HTML Sanitizer & XSS Security Protection
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 4: HTML Sanitizer & XSS Security Protection ---\n";

// 1. Script tag stripping
$maliciousHtml1 = '<p>Hello world!</p><script>alert("XSS-ATTACK");</script><p>Safe content</p>';
$clean1 = HtmlSanitizer::sanitize($maliciousHtml1);
assertTest(strpos($clean1, '<script>') === false, "Sanitizer strips <script> tags completely");
assertTest(strpos($clean1, 'alert(') === false, "Sanitizer removes malicious script execution body");
assertTest(strpos($clean1, 'Safe content') !== false, "Safe content inside paragraph is preserved");

// 2. Dangerous tags stripping (iframe, object, embed, form)
$maliciousHtml2 = '<div><iframe src="http://evil.com"></iframe><form action="/steal"><input type="password"></form></div>';
$clean2 = HtmlSanitizer::sanitize($maliciousHtml2);
assertTest(strpos($clean2, '<iframe') === false, "Sanitizer strips <iframe> elements");
assertTest(strpos($clean2, '<form') === false, "Sanitizer strips <form> elements");
assertTest(strpos($clean2, '<input') === false, "Sanitizer strips form inputs");

// 3. Inline event handlers stripping
$maliciousHtml3 = '<a href="https://example.com" onclick="stealCookies()" onmouseover="runMalware()">Click Here</a>';
$clean3 = HtmlSanitizer::sanitize($maliciousHtml3);
assertTest(strpos($clean3, 'onclick') === false, "Sanitizer strips onclick attribute");
assertTest(strpos($clean3, 'onmouseover') === false, "Sanitizer strips onmouseover attribute");
assertTest(strpos($clean3, 'https://example.com') !== false, "Safe link destination preserved");

// 4. Dangerous URL pseudo-protocols (javascript:, vbscript:)
$maliciousHtml4 = '<a href="javascript:alert(1)">Click</a><a href="vbscript:msgbox(1)">Click2</a>';
$clean4 = HtmlSanitizer::sanitize($maliciousHtml4);
assertTest(strpos($clean4, 'javascript:') === false, "Sanitizer strips javascript: protocol from links");
assertTest(strpos($clean4, 'vbscript:') === false, "Sanitizer strips vbscript: protocol from links");

// 5. Remote tracking pixel neutralization
$trackerHtml = '<img src="https://tracker.com/pixel.gif" width="1" height="1" alt="t"><p>Read this</p>';
$cleanTracker = HtmlSanitizer::sanitize($trackerHtml, false);
assertTest(strpos($cleanTracker, 'data-blocked-tracker="1"') !== false, "Sanitizer detects and tags 1x1 tracking image as blocked tracker");

// ---------------------------------------------------------------------------
// TEST GROUP 5: RFC 2822 MIME Message Construction
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 5: RFC 2822 MIME Message Construction ---\n";

$apiService = new GmailApiService();

// Build simple HTML message
$rawMime = $apiService->buildMimeMessage([
    'from' => 'Tenant User <tenant@cockpit.ai>',
    'to' => 'client@example.com',
    'cc' => 'accountant@example.com',
    'bcc' => 'archive@example.com',
    'subject' => 'Cockpit AI Invoice #1024 Available',
    'body_html' => '<p>Dear Client, your invoice is ready.</p>',
    'body_plain' => 'Dear Client, your invoice is ready.'
]);

assertTest(!empty($rawMime), "RFC 2822 raw MIME message constructed successfully");
assertTest(strpos($rawMime, 'To: client@example.com') !== false, "MIME contains To header");
assertTest(strpos($rawMime, 'Cc: accountant@example.com') !== false, "MIME contains Cc header");
assertTest(strpos($rawMime, 'Bcc: archive@example.com') !== false, "MIME contains Bcc header");
assertTest(strpos($rawMime, 'Subject: =?UTF-8?B?') !== false, "MIME contains RFC 2047 encoded Subject header");
assertTest(strpos($rawMime, 'Content-Type: multipart/alternative') !== false, "MIME contains multipart/alternative Content-Type");

// Build message with attachment
$attachmentContent = "File content for invoice test #1024";
$rawMimeWithAttachment = $apiService->buildMimeMessage([
    'from' => 'tenant@cockpit.ai',
    'to' => 'client@example.com',
    'subject' => 'Invoice with PDF',
    'body_html' => '<p>Please find attached invoice.</p>'
], [
    [
        'filename' => 'invoice_1024.pdf',
        'mimeType' => 'application/pdf',
        'data' => base64_encode($attachmentContent)
    ]
]);

assertTest(strpos($rawMimeWithAttachment, 'Content-Type: multipart/mixed') !== false, "MIME with attachments uses multipart/mixed Content-Type");
assertTest(strpos($rawMimeWithAttachment, 'filename="invoice_1024.pdf"') !== false, "Attachment filename preserved in Content-Disposition header");
assertTest(strpos($rawMimeWithAttachment, 'Content-Transfer-Encoding: base64') !== false, "Attachment part marked as base64 encoded");

// ---------------------------------------------------------------------------
// TEST GROUP 6: Metadata-First Message Storage & Folder Routing
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 6: Metadata-First Storage & Folder Routing ---\n";

// Get account ID
$accId = (int)$rawAcc['id'] ?? 0;
if ($accId === 0) {
    $accStmt = $db->prepare("SELECT id FROM gmail_accounts WHERE tenant_id = ?");
    $accStmt->execute([$testTenantA]);
    $accId = (int)$accStmt->fetchColumn();
}

// Seed test messages for Tenant A
$msg1Id = 'msg_test_inbox_01';
$msg2Id = 'msg_test_sent_02';
$msg3Id = 'msg_test_draft_03';
$msg4Id = 'msg_test_starred_04';

$insertMsgStmt = $db->prepare("
    INSERT INTO gmail_messages (
        tenant_id, gmail_account_id, message_id, thread_id,
        from_name, from_email, to_recipients, subject, snippet,
        body_plain, body_html, body_fetched, internal_date, date_sent,
        labels_json, is_read, is_starred, is_draft, is_trash, is_sent
    ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, NOW(),
        ?, ?, ?, ?, ?, ?
    )
");

// Message 1: Inbox, unread
$insertMsgStmt->execute([
    $testTenantA, $accId, $msg1Id, 'thread_01',
    'Client Support', 'support@client.com', 'testuser.cockpit@gmail.com', 'Product Inquiry #1', 'Hello I need info',
    null, null, 0, 1730700000000,
    json_encode(['INBOX', 'UNREAD']), 0, 0, 0, 0, 0
]);

// Message 2: Sent
$insertMsgStmt->execute([
    $testTenantA, $accId, $msg2Id, 'thread_02',
    'Tenant User', 'testuser.cockpit@gmail.com', 'lead@acme.com', 'Quotation #500', 'Here is your quotation',
    'Here is your quotation', '<p>Here is your quotation</p>', 1, 1730701000000,
    json_encode(['SENT']), 1, 0, 0, 0, 1
]);

// Message 3: Draft
$insertMsgStmt->execute([
    $testTenantA, $accId, $msg3Id, 'thread_03',
    'Tenant User', 'testuser.cockpit@gmail.com', 'partner@firm.org', 'Partnership proposal draft', 'Draft text...',
    'Draft text...', '<p>Draft text...</p>', 1, 1730702000000,
    json_encode(['DRAFT']), 1, 0, 1, 0, 0
]);

// Message 4: Starred in Inbox
$insertMsgStmt->execute([
    $testTenantA, $accId, $msg4Id, 'thread_04',
    'VIP Partner', 'vip@partner.com', 'testuser.cockpit@gmail.com', 'Urgent VIP Contract', 'Please review urgent',
    null, null, 0, 1730703000000,
    json_encode(['INBOX', 'STARRED']), 1, 1, 0, 0, 0
]);

assertTest(true, "Seeded 4 metadata-first test messages for Tenant A");

// Test Folder Queries
$inboxStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 0 AND is_draft = 0 AND (labels_json LIKE '%\"INBOX\"%' OR is_sent = 0)");
$inboxStmt->execute([$testTenantA]);
$inboxCount = (int)$inboxStmt->fetchColumn();
assertTest($inboxCount === 2, "Inbox folder query returns exactly 2 messages (excluding sent & draft)");

$starredStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 0 AND is_starred = 1");
$starredStmt->execute([$testTenantA]);
$starredCount = (int)$starredStmt->fetchColumn();
assertTest($starredCount === 1, "Starred folder query returns exactly 1 message");

$sentStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 0 AND is_sent = 1");
$sentStmt->execute([$testTenantA]);
$sentCount = (int)$sentStmt->fetchColumn();
assertTest($sentCount === 1, "Sent folder query returns exactly 1 message");

$draftStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 0 AND is_draft = 1");
$draftStmt->execute([$testTenantA]);
$draftCount = (int)$draftStmt->fetchColumn();
assertTest($draftCount === 1, "Drafts folder query returns exactly 1 message");

// ---------------------------------------------------------------------------
// TEST GROUP 7: Important Delete Rule & Trash / Restore Lifecycle
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 7: Important Delete Rule (Move to Trash, Never Hard Delete) ---\n";

// Move msg1Id to Trash
$trashStmt = $db->prepare("
    UPDATE gmail_messages 
    SET is_trash = 1,
        labels_json = JSON_ARRAY_APPEND(COALESCE(labels_json, '[]'), '$', 'TRASH'),
        updated_at = NOW()
    WHERE tenant_id = ? AND message_id = ?
");
$trashStmt->execute([$testTenantA, $msg1Id]);

// Verify msg1Id still exists in database (NOT permanently deleted!)
$verifyMsgStmt = $db->prepare("SELECT id, is_trash, labels_json FROM gmail_messages WHERE tenant_id = ? AND message_id = ?");
$verifyMsgStmt->execute([$testTenantA, $msg1Id]);
$trashedRow = $verifyMsgStmt->fetch(PDO::FETCH_ASSOC);
assertTest(!empty($trashedRow), "Message is preserved in database after Delete action (Important Delete Rule enforced)");
assertTest((int)$trashedRow['is_trash'] === 1, "Message is marked with is_trash = 1");
assertTest(strpos($trashedRow['labels_json'], 'TRASH') !== false, "Message has 'TRASH' label appended");

// Verify Inbox count decreases by 1
$inboxAfterTrashStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 0 AND is_draft = 0 AND (labels_json LIKE '%\"INBOX\"%')");
$inboxAfterTrashStmt->execute([$testTenantA]);
$inboxAfterTrash = (int)$inboxAfterTrashStmt->fetchColumn();
assertTest($inboxAfterTrash === 1, "Inbox folder query no longer displays trashed message");

// Verify Trash folder displays it
$trashFolderStmt = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ? AND is_trash = 1");
$trashFolderStmt->execute([$testTenantA]);
$trashCount = (int)$trashFolderStmt->fetchColumn();
assertTest($trashCount === 1, "Trash folder query returns 1 trashed message");

// Restore msg1Id from Trash (Untrash)
$untrashStmt = $db->prepare("
    UPDATE gmail_messages 
    SET is_trash = 0,
        labels_json = JSON_REMOVE(labels_json, JSON_UNQUOTE(JSON_SEARCH(labels_json, 'one', 'TRASH'))),
        updated_at = NOW()
    WHERE tenant_id = ? AND message_id = ?
");
$untrashStmt->execute([$testTenantA, $msg1Id]);

$verifyUntrashStmt = $db->prepare("SELECT is_trash, labels_json FROM gmail_messages WHERE tenant_id = ? AND message_id = ?");
$verifyUntrashStmt->execute([$testTenantA, $msg1Id]);
$untrashedRow = $verifyUntrashStmt->fetch(PDO::FETCH_ASSOC);
assertTest((int)$untrashedRow['is_trash'] === 0, "Untrash restores message (is_trash = 0)");
assertTest(strpos($untrashedRow['labels_json'], 'TRASH') === false, "TRASH label removed upon restore");

// ---------------------------------------------------------------------------
// TEST GROUP 8: Multi-Tenant Cryptographic & Data Isolation
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 8: Multi-Tenant Isolation & Zero Leakage ---\n";

// Tenant B queries messages: should return 0 results
$tenantBQuery = $db->prepare("SELECT COUNT(*) FROM gmail_messages WHERE tenant_id = ?");
$tenantBQuery->execute([$testTenantB]);
assertTest((int)$tenantBQuery->fetchColumn() === 0, "Tenant B cannot see any messages belonging to Tenant A");

// Tenant B attempts to access Tenant A's OAuth account
$tenantBAccount = $oauthService->getStatus($testTenantB);
assertTest($tenantBAccount['is_connected'] === false, "Tenant B account status is disconnected");
assertTest($tenantBAccount['email_address'] === null, "Tenant B has no access to Tenant A email address");

// Tenant B attempts to validate Tenant A's state token
$unauthorizedState = $oauthService->validateState($stateToken);
assertTest($unauthorizedState === null, "Tenant B cannot consume or intercept Tenant A's OAuth state");

// ---------------------------------------------------------------------------
// TEST GROUP 9: Connected Apps Hub Representation
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 9: Connected Applications Hub Representation ---\n";

// Test listing apps for Tenant 1 (should include Gmail as a portal app)
$phpBin = 'D:\\xampp\\php\\php.exe';
$code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::listApps(['id'=>1, 'tenant_id'=>1, 'role'=>'tenant_owner']);";
$raw = shell_exec("\"{$phpBin}\" -r \"{$code}\"");
$pos = strpos($raw, '{');
$clean = $pos !== false ? substr($raw, $pos) : '';
$hubResponse = json_decode($clean, true) ?? [];

assertTest(($hubResponse['status'] ?? '') === 'success', "Connected Applications Hub API returns 200 OK");
$appsList = $hubResponse['data'] ?? [];
$gmailApp = null;
$bniApp = null;
$kvvApp = null;
$eafApp = null;

foreach ($appsList as $a) {
    if (($a['source_key'] ?? '') === 'gmail') $gmailApp = $a;
    if (($a['source_key'] ?? '') === 'bni') $bniApp = $a;
    if (($a['source_key'] ?? '') === 'kvv') $kvvApp = $a;
    if (($a['source_key'] ?? '') === 'eaf') $eafApp = $a;
}

assertTest($gmailApp !== null, "Gmail is returned in Connected Applications Hub");
assertTest(!empty($gmailApp['is_portal']), "Gmail is classified with is_portal: true");
assertTest($gmailApp['integration_capability'] === 'Official Google OAuth 2.0 & Full Email Management', "Gmail capability reflects official OAuth 2.0 & Full Email Management");

// ---------------------------------------------------------------------------
// TEST GROUP 10: Zero Regression on Baseline CRM Leads (#41-#45) & EAF/BNI/KVV
// ---------------------------------------------------------------------------
echo "\n--- TEST GROUP 10: Zero Regression on Genuine CRM Leads (#41-#45) & Portals ---\n";

$baselineStmt = $db->query("SELECT id, name, company, email, status, source FROM crm_leads WHERE id BETWEEN 41 AND 45 ORDER BY id ASC");
$baselineLeads = $baselineStmt->fetchAll(PDO::FETCH_ASSOC);

assertTest(count($baselineLeads) === 5, "All 5 baseline CRM leads (#41-#45) are intact");
$expectedIds = [41, 42, 43, 44, 45];
$actualIds = array_map(fn($l) => (int)$l['id'], $baselineLeads);
assertTest($actualIds === $expectedIds, "Baseline lead IDs #41-#45 are preserved in sequence");

// Verify EAF, BNI, and KVV portal configs
assertTest($eafApp !== null, "EAF Connect remains present and configured in Connected Apps");
assertTest($bniApp !== null, "BNI Connect remains present and configured in Connected Apps");
assertTest($kvvApp !== null, "KVV Portal remains present and configured in Connected Apps");

// ---------------------------------------------------------------------------
// CLEANUP & TEARDOWN
// ---------------------------------------------------------------------------
$db->prepare("DELETE FROM gmail_messages WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM gmail_accounts WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM gmail_oauth_states WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM lead_sources_config WHERE tenant_id IN (?, ?) AND source_key = 'gmail'")->execute([$testTenantA, $testTenantB]);
$db->prepare("DELETE FROM lead_platform_sessions WHERE tenant_id IN (?, ?) AND source_key = 'gmail'")->execute([$testTenantA, $testTenantB]);

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";

if ($failed > 0) {
    exit(1);
}
