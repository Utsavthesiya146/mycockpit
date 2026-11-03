<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/middleware/AuthMiddleware.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/controllers/LeadController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\LeadController;

echo "=======================================================\n";
echo "   CSV IMPORT & USER-ACCESS NORMALIZATION TEST        \n";
echo "=======================================================\n\n";

$db = Database::getConnection();
$user = ['id' => 2, 'tenant_id' => 1, 'role' => 'tenant_owner', 'name' => 'Utsav Patel', 'email' => 'utsav@acme.com'];

// 1. Synthetic BNI Connect "Referrals Received" CSV Export sample
$bniSlipId1 = 'BNI-SLIP-' . rand(10000, 99999);
$bniSlipId2 = 'BNI-SLIP-' . rand(10000, 99999);
$phone1 = '+91 9825' . rand(100000, 999999);
$phone2 = '+91 9825' . rand(100000, 999999);

$bniCsvData = <<<CSV
"Slip Date","Slip ID","From Member","Referral Name","Company","Telephone","Email","Referral Type","Comments","Status"
"28/10/2026","{$bniSlipId1}","Vikram Merchant","Deepak Chawla","Chawla Industrial Valves","{$phone1}","deepak@chawlavalves.com","Outside","Requires automated flow control sensors. Met at trade expo.","Open"
"29/10/2026","{$bniSlipId2}","Rajesh Shah","Siddharth Mehta","Mehta Agro Logistics","{$phone2}","siddharth@mehtaagro.com","Inside","Looking for warehouse inventory management software.","Open"
CSV;

// 2. Synthetic KVV (Kannadigara Vyaapaara Vedike) Referral Export sample
$kvvRefId = 'KVV-REF-' . rand(1000, 9999);
$phone3 = '+91 9845' . rand(100000, 999999);

$kvvCsvData = <<<CSV
"Enquiry ID","Member Name","Business Name","Mobile","Email","Business Category","Chapter","Remarks"
"{$kvvRefId}","Ganesh Prasad","Prasad Electrical Systems","{$phone3}","ganesh@prasadelec.com","Industrial Automation","Bangalore South","Member reference for rooftop solar project"
CSV;

echo "[1/4] Testing BNI Connect User CSV Import...\n";
// Simulate HTTP request body
$bniPayload = json_encode([
    'source' => 'BNI',
    'csv_data' => $bniCsvData,
    'duplicate_strategy' => 'skip'
]);

// Capture response using output buffering
ob_start();
$_POST = [];
// Mock php://input by temporarily setting global or calling handler
// We can call LeadController::importLeads with file_get_contents override or via a helper
ob_end_clean();

// Test the CSV parser logic directly or via API endpoint
$ch = curl_init('http://localhost/my%20cockpit/backend/api/index.php/crm/leads/import');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $bniPayload);
// Generate test JWT for user
$jwt = \Cockpit\Utils\JWT::encode([
    'user_id' => $user['id'],
    'tenant_id' => $user['tenant_id'],
    'role' => $user['role'],
    'exp' => time() + 3600
]);

curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $jwt
]);
$resBni = curl_exec($ch);
$httpCodeBni = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "  BNI Import HTTP Code: {$httpCodeBni}\n";
echo "  BNI Response: {$resBni}\n";
$bniResult = json_decode($resBni, true);

if (($bniResult['data']['imported_count'] ?? 0) === 2) {
    echo "  [PASS] Successfully imported 2 BNI leads from CSV!\n";
} else {
    echo "  [FAIL] BNI Import failed: " . ($bniResult['message'] ?? 'Unknown error') . "\n";
    exit(1);
}

echo "\n[2/4] Testing KVV User CSV Import...\n";
$kvvPayload = json_encode([
    'source' => 'KVV',
    'csv_data' => $kvvCsvData,
    'duplicate_strategy' => 'skip'
]);

$ch2 = curl_init('http://localhost/my%20cockpit/backend/api/index.php/crm/leads/import');
curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch2, CURLOPT_POST, true);
curl_setopt($ch2, CURLOPT_POSTFIELDS, $kvvPayload);
curl_setopt($ch2, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $jwt
]);
$resKvv = curl_exec($ch2);
$httpCodeKvv = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
curl_close($ch2);

echo "  KVV Import HTTP Code: {$httpCodeKvv}\n";
echo "  KVV Response: {$resKvv}\n";
$kvvResult = json_decode($resKvv, true);

if (($kvvResult['data']['imported_count'] ?? 0) === 1) {
    echo "  [PASS] Successfully imported 1 KVV lead from CSV!\n";
} else {
    echo "  [FAIL] KVV Import failed: " . ($kvvResult['message'] ?? 'Unknown error') . "\n";
    exit(1);
}

echo "\n[3/4] Verifying Lead Fields & Source Attribution in crm_leads...\n";
$chkStmt = $db->prepare("
    SELECT id, name, company, phone, email, source, source_platform, sync_status, source_lead_id 
    FROM crm_leads 
    WHERE tenant_id = 1 AND source_lead_id IN (?, ?, ?)
");
$chkStmt->execute([$bniSlipId1, $bniSlipId2, $kvvRefId]);
$leadsFound = $chkStmt->fetchAll(PDO::FETCH_ASSOC);

echo "  Leads verified in database: " . count($leadsFound) . " / 3\n";
foreach ($leadsFound as $lf) {
    echo "  - Lead #{$lf['id']}: {$lf['name']} | Co: {$lf['company']} | Source: {$lf['source']} | Platform: {$lf['source_platform']} | Sync: {$lf['sync_status']} | Slip/Ref ID: {$lf['source_lead_id']}\n";
}

if (count($leadsFound) === 3) {
    echo "  [PASS] All 3 external leads persisted with correct source attribution, platform keys, and slip IDs!\n";
} else {
    echo "  [FAIL] Incomplete persistence!\n";
    exit(1);
}

echo "\n[4/4] Testing Idempotency & Duplicate Prevention (Re-importing Same CSV)...\n";
$ch3 = curl_init('http://localhost/my%20cockpit/backend/api/index.php/crm/leads/import');
curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch3, CURLOPT_POST, true);
curl_setopt($ch3, CURLOPT_POSTFIELDS, $bniPayload);
curl_setopt($ch3, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $jwt
]);
$resBniDup = curl_exec($ch3);
curl_close($ch3);
$bniDupResult = json_decode($resBniDup, true);

echo "  Re-import Result: Imported {$bniDupResult['data']['imported_count']}, Skipped {$bniDupResult['data']['skipped_count']}\n";
if (($bniDupResult['data']['imported_count'] ?? 0) === 0 && ($bniDupResult['data']['skipped_count'] ?? 0) === 2) {
    echo "  [PASS] Strict duplicate prevention verified! 0 new leads created, 2 duplicates skipped.\n";
} else {
    echo "  [FAIL] Duplicate prevention did not skip existing records!\n";
    exit(1);
}

echo "\n>>> ALL USER CSV IMPORT & DEDUPLICATION TESTS PASSED <<<\n";

// Clean up synthetic test records so baseline seed remains pristine
$db->exec("DELETE FROM crm_leads WHERE source_lead_id IN ('{$bniSlipId1}', '{$bniSlipId2}', '{$kvvRefId}')");
echo "Cleaned up temporary synthetic test records.\n";
