<?php
/**
 * Test Suite: Bidirectional Browser Automation & External Write-back Engine
 * Tests EAF, BNI, and KVV drivers, verification read-backs, conflict detection,
 * session encryption, CAPTCHA/MFA handling, and multi-tenant isolation.
 */
require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/services/automation/PlatformAutomationDriverInterface.php';
require_once __DIR__ . '/../backend/services/automation/EAFWebAutomationDriver.php';
require_once __DIR__ . '/../backend/services/automation/BNIWebAutomationDriver.php';
require_once __DIR__ . '/../backend/services/automation/KVVWebAutomationDriver.php';
require_once __DIR__ . '/../backend/services/automation/BidirectionalSyncManager.php';
require_once __DIR__ . '/../backend/services/automation/HostingEvaluator.php';

use Cockpit\Config\Database;
use Cockpit\Services\Automation\BidirectionalSyncManager;
use Cockpit\Services\Automation\HostingEvaluator;
use Cockpit\Services\Automation\EAFWebAutomationDriver;
use Cockpit\Services\Automation\BNIWebAutomationDriver;
use Cockpit\Services\Automation\KVVWebAutomationDriver;

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
echo "   BIDIRECTIONAL AUTOMATION & WRITEBACK TEST SUITE     \n";
echo "=======================================================\n\n";

$tenantIdA = 1;
$tenantIdB = 2;

// [1/7] Hosting Environment Evaluation
echo "[1/7] Testing Hosting Environment Evaluator & Shared Hosting Heuristics...\n";
$hosting = HostingEvaluator::evaluate();
assertTest(isset($hosting['environment']['php_version']), "PHP environment version identified: " . $hosting['environment']['php_version']);
assertTest(isset($hosting['shared_hosting_feasibility']['headless_chromium_support']), "Shared hosting headless Chromium feasibility evaluated");
assertTest(isset($hosting['recommended_production_topology']['mode_a']), "Decoupled Session-Driven HTTP Worker topology recommended for shared hosting");
assertTest(isset($hosting['recommended_production_topology']['mode_b']), "Decoupled Playwright Worker companion recommended for BNI/CAPTCHA");

// [2/7] Platform Capability Matrix
echo "\n[2/7] Testing Verified Platform Capability Matrix...\n";
$syncMgr = new BidirectionalSyncManager($db);
$matrix = $syncMgr->getCapabilityMatrix();
assertTest(count($matrix) === 3, "All 3 platform drivers registered in capability matrix");
assertTest($matrix['eaf']['capabilities']['update_status'] === 'Supported', "EAF Connect supports status updates via normal member UI");
assertTest($matrix['eaf']['capabilities']['update_contact'] === 'Supported', "EAF Connect supports contact/business updates via member UI");
assertTest($matrix['bni']['capabilities']['update_status'] === 'Supported', "BNI Connect supports status updates via Referral Tracking");
assertTest($matrix['bni']['capabilities']['update_contact'] === 'Unsupported', "BNI Connect immutability rule: Contact details cannot be edited");
assertTest($matrix['bni']['capabilities']['writeback_verified'] === 'CAPTCHA/MFA Required', "BNI Connect honestly flags CAPTCHA/MFA requirement");
assertTest($matrix['kvv']['capabilities']['writeback_verified'] === 'Unsupported', "KVV portal honestly flags external write-back as Unsupported");

// [3/7] Session Encryption & Health Validation
echo "\n[3/7] Testing Session Encryption & CAPTCHA/MFA Detection...\n";
// Save session with AES-256-GCM encryption
$eafSession = [
    'email' => 'harri@jobhunterr.com',
    'password' => 'Member@123',
    'cookie_jar' => 'ci_session=testsession123'
];
$saved = $syncMgr->savePlatformSession($tenantIdA, 'eaf', $eafSession);
assertTest($saved === true, "EAF platform session encrypted and persisted for Tenant 1");

$retrievedSession = $syncMgr->getPlatformSession($tenantIdA, 'eaf');
assertTest($retrievedSession['status'] === 'active', "EAF session decrypted and validated as active");

// Test BNI with CAPTCHA/MFA requirement
$bniSession = [
    'cookie_jar' => 'bni_session=expired123',
    'last_validated_at' => date('Y-m-d H:i:s', time() - 3600), // Expired > 30m
    'captcha_flag' => true
];
$syncMgr->savePlatformSession($tenantIdA, 'bni', $bniSession);
$bniValidation = $syncMgr->getPlatformSession($tenantIdA, 'bni');
assertTest($bniValidation['status'] === 'expired' || $bniValidation['status'] === 'captcha_required', "BNI session correctly triggers expired or CAPTCHA/MFA pause");

// [4/7] EAF Bidirectional Write-back & Read-back Verification
echo "\n[4/7] Testing EAF Write-back Workflow (Pending Confirmation -> Write -> Verified Read-back)...\n";
// Create a test lead in crm_leads linked to EAF slip
$db->prepare("DELETE FROM `crm_leads` WHERE `source_lead_id` = 'TEST-EAF-AUTO-01' AND `tenant_id` = ?")->execute([$tenantIdA]);
$insStmt = $db->prepare("INSERT INTO `crm_leads` 
    (`tenant_id`, `name`, `company`, `phone`, `email`, `source`, `source_platform`, `source_lead_id`, `status`, `priority`, `service_requirement`, `external_sync_status`, `external_snapshot_json`)
    VALUES (?, 'Arun Automation', 'Arun Tech Solutions', '9988776655', 'arun@aruntech.com', 'EAF Connect', 'eaf', 'TEST-EAF-AUTO-01', 'new', 'medium', 'Cloud ERP Migration', 'synced', ?)");
$baselineSnapshot = [
    'referral_code' => 'TEST-EAF-AUTO-01',
    'status' => 'Open For Discussion',
    'contact_number' => '9988776655',
    'business' => 'Cloud ERP Migration',
    'temperature' => 'Warm',
    'description' => 'Initial inquiry'
];
$insStmt->execute([$tenantIdA, json_encode($baselineSnapshot)]);
$testLeadId = (int)$db->lastInsertId();

// Ensure test record exists in local EAF database table if accessible
try {
    $db->prepare("REPLACE INTO `u594406910_eafv2`.`referrals` 
        (`referral_id`, `referral_code`, `status`, `contact_number`, `business`, `temperature`, `description`, `created_at`)
        VALUES (99991, 'TEST-EAF-AUTO-01', 'Open For Discussion', '9988776655', 'Cloud ERP Migration', 'Warm', 'Initial inquiry', NOW())")->execute();
} catch (\Throwable $e) {}

// Step 1: Queue writeback with user confirmation requirement
$queueRes = $syncMgr->queueWriteback($tenantIdA, $testLeadId, [
    'status' => 'contacted',
    'notes' => 'Contacted via phone. Discussed scope.'
], false);
assertTest($queueRes['success'] === true, "Change successfully queued for external synchronization");
assertTest($queueRes['status'] === 'pending_confirmation', "Status set to pending_confirmation (enforces explicit user confirmation)");
$queueId = $queueRes['queue_id'];

// Check crm_leads external_sync_status
$statusCheck = $db->query("SELECT external_sync_status FROM `crm_leads` WHERE id = {$testLeadId}")->fetchColumn();
assertTest($statusCheck === 'pending_writeback', "Lead marked as pending_writeback in Cockpit");

// Step 2: Execute writeback (User confirms)
$execRes = $syncMgr->executeWriteback($tenantIdA, $queueId);
assertTest($execRes['success'] === true, "Write-back successfully applied to external EAF member interface");
assertTest($execRes['status'] === 'synced', "Verification read-back confirmed remote state and marked synced");

// Check crm_leads external_sync_status after execution
$statusCheckAfter = $db->query("SELECT external_sync_status FROM `crm_leads` WHERE id = {$testLeadId}")->fetchColumn();
assertTest($statusCheckAfter === 'synced', "Lead marked as externally synced after successful read-back verification");

// [5/7] Conflict Detection & Resolution Handling
echo "\n[5/7] Testing Conflict Detection & Resolution (Detecting Remote Drift)...\n";
// Simulate external modification directly on EAF platform
try {
    $db->prepare("UPDATE `u594406910_eafv2`.`referrals` SET `status` = 'Cancelled', `updated_at` = NOW() WHERE `referral_code` = 'TEST-EAF-AUTO-01'")->execute();
} catch (\Throwable $e) {}

// User in Cockpit tries to mark it as 'won'
$conflictRes = $syncMgr->queueWriteback($tenantIdA, $testLeadId, [
    'status' => 'won'
], false);

assertTest($conflictRes['success'] === false, "Refused blind overwrite when external record changed");
assertTest($conflictRes['status'] === 'conflict_detected', "Conflict correctly detected! Remote changed to 'Cancelled' while Cockpit proposed 'won'");
assertTest(isset($conflictRes['conflict']['differences']['status']), "Difference breakdown preserved in conflict payload");

$conflictQueueId = $conflictRes['queue_id'];

// Test Conflict Resolution: Keep Cockpit
$resKeepCockpit = $syncMgr->resolveConflict($tenantIdA, $conflictQueueId, 'keep_cockpit');
assertTest($resKeepCockpit['success'] === true, "Conflict resolved with user choice 'keep_cockpit'");
assertTest($resKeepCockpit['status'] === 'synced', "External platform updated to match Cockpit value after resolution");

// [6/7] BNI & KVV Platform Constraint Verification
echo "\n[6/7] Testing BNI & KVV Safety Guardrails...\n";
// BNI Lead testing immutable field rejection
$insBni = $db->prepare("INSERT INTO `crm_leads` 
    (`tenant_id`, `name`, `company`, `phone`, `email`, `source`, `source_platform`, `source_lead_id`, `status`, `external_sync_status`)
    VALUES (?, 'BNI Slip Test', 'Apex Logistics', '9123456789', 'apex@logistics.com', 'BNI Connect', 'bni', 'BNI-SLIP-TEST-01', 'new', 'synced')");
$insBni->execute([$tenantIdA]);
$bniLeadId = (int)$db->lastInsertId();

$bniDriver = new BNIWebAutomationDriver();
$bniWriteAttempt = $bniDriver->writeBackLead($tenantIdA, 'BNI-SLIP-TEST-01', [
    'phone' => '9999999999' // Illegal modification in BNI
], ['cookie_jar' => 'valid_session', 'last_validated_at' => date('Y-m-d H:i:s')]);
assertTest($bniWriteAttempt['success'] === false, "BNI Driver rejected editing immutable contact phone number");
assertTest(in_array('phone', $bniWriteAttempt['blocked_fields'] ?? []), "Blocked field 'phone' explicitly reported");

// KVV Lead testing read-only portal constraint
$insKvv = $db->prepare("INSERT INTO `crm_leads` 
    (`tenant_id`, `name`, `company`, `phone`, `email`, `source`, `source_platform`, `source_lead_id`, `status`, `external_sync_status`)
    VALUES (?, 'KVV Member Test', 'Prasad Traders', '9845012345', 'prasad@kvv.in', 'KVV Leads', 'kvv', 'KVV-REF-TEST-01', 'new', 'synced')");
$insKvv->execute([$tenantIdA]);
$kvvLeadId = (int)$db->lastInsertId();

$kvvQueue = $syncMgr->queueWriteback($tenantIdA, $kvvLeadId, ['status' => 'contacted'], false);
assertTest($kvvQueue['success'] === false, "KVV write-back correctly prevented on read-only portal");
assertTest($kvvQueue['status'] === 'manual_required', "Honest status 'manual_required' returned for KVV lead");

// [7/7] Multi-Tenant Boundary Isolation
echo "\n[7/7] Testing Multi-Tenant Isolation for Automation Queues & Sessions...\n";
// Tenant B attempts to execute Tenant A's writeback queue
$unauthorizedExec = $syncMgr->executeWriteback($tenantIdB, $queueId);
assertTest($unauthorizedExec['success'] === false, "Tenant 2 blocked from executing Tenant 1 writeback queue");

// Tenant B attempts to read Tenant A's platform session
$unauthorizedSession = $syncMgr->getPlatformSession($tenantIdB, 'eaf');
assertTest($unauthorizedSession['status'] === 'disconnected', "Tenant 2 cannot read or access Tenant 1 encrypted credentials/sessions");

// Cleanup test records
$db->prepare("DELETE FROM `crm_leads` WHERE `id` IN (?, ?, ?)")->execute([$testLeadId, $bniLeadId, $kvvLeadId]);
$db->prepare("DELETE FROM `lead_writeback_queue` WHERE `source_lead_id` IN ('TEST-EAF-AUTO-01', 'BNI-SLIP-TEST-01', 'KVV-REF-TEST-01')")->execute();
try {
    $db->prepare("DELETE FROM `u594406910_eafv2`.`referrals` WHERE `referral_code` = 'TEST-EAF-AUTO-01'")->execute();
} catch (\Throwable $e) {}

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";

if ($failed > 0) {
    exit(1);
}
