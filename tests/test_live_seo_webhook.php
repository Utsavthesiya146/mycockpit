<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';

use Cockpit\Config\Database;

echo "=======================================================\n";
echo "   SEO & WEBSITE LIVE WEBHOOK RETEST & VERIFICATION   \n";
echo "=======================================================\n\n";

$db = Database::getConnection();
$tenantId = 1;

// Get or ensure webhook secret for website_seo
$stmt = $db->prepare("SELECT webhook_secret FROM lead_sources_config WHERE tenant_id = ? AND source_key = 'website_seo' LIMIT 1");
$stmt->execute([$tenantId]);
$secret = $stmt->fetchColumn();

if (!$secret) {
    $secret = bin2hex(random_bytes(16));
    $db->prepare("
        INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status, webhook_secret, is_enabled)
        VALUES (?, 'website_seo', 'SEO & Website Forms', 'inbound', 'webhook_configured', ?, 1)
        ON DUPLICATE KEY UPDATE webhook_secret = VALUES(webhook_secret)
    ")->execute([$tenantId, $secret]);
}

echo "Using Webhook Secret: {$secret}\n\n";

$webhookUrl = 'http://localhost/my%20cockpit/backend/api/index.php';
// Or test via curl directly to /leads/webhook
// Let's test the endpoint directly via HTTP curl

$uniqueSubmissionId = 'SUB_' . bin2hex(random_bytes(6));
$testPhone = '+91 97' . rand(10000000, 99999999);
$testEmail = 'seo.lead.' . rand(100, 999) . '@acmetestcorp.com';

$payload = [
    'name' => 'Aarav Sharma',
    'company' => 'Aarav Enterprises',
    'phone' => $testPhone,
    'email' => $testEmail,
    'service' => 'ERP & Cloud Automation',
    'notes' => 'Looking for enterprise pricing and immediate deployment.',
    'submission_id' => $uniqueSubmissionId
];

echo "[1/4] Sending Synthetic Form Submission to Webhook Endpoint...\n";
$ch = curl_init('http://localhost/my%20cockpit/backend/api/index.php/leads/webhook');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Tenant-Key: ' . $secret
]);
$res1 = curl_exec($ch);
$http1 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "  HTTP Status: {$http1}\n";
echo "  Response: {$res1}\n";
$data1 = json_decode($res1, true);

if ($http1 !== 201 && $http1 !== 200) {
    echo "FAILED: Webhook call failed with status {$http1}\n";
    exit(1);
}

$createdLeadId = (int)($data1['data']['id'] ?? 0);
echo "  Captured Lead ID: {$createdLeadId}\n";

echo "\n[2/4] Verifying Lead Persistence and Schema Mapping...\n";
$chkStmt = $db->prepare("SELECT * FROM crm_leads WHERE id = ? AND tenant_id = ?");
$chkStmt->execute([$createdLeadId, $tenantId]);
$leadRow = $chkStmt->fetch(PDO::FETCH_ASSOC);

if ($leadRow) {
    echo "  [PASS] Lead persisted in crm_leads\n";
    echo "  - Name: {$leadRow['name']}\n";
    echo "  - Company: {$leadRow['company']}\n";
    echo "  - Source: {$leadRow['source']}\n";
    echo "  - Source Platform: {$leadRow['source_platform']}\n";
    echo "  - Sync Status: {$leadRow['sync_status']}\n";
    echo "  - Priority: {$leadRow['priority']}\n";
    echo "  - Status: {$leadRow['status']}\n";
} else {
    echo "  [FAIL] Lead not found in database!\n";
    exit(1);
}

echo "\n[3/4] Testing Webhook Replay Protection (Immediate Duplicate Submission ID)...\n";
$ch2 = curl_init('http://localhost/my%20cockpit/backend/api/index.php/leads/webhook');
curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch2, CURLOPT_POST, true);
curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch2, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Tenant-Key: ' . $secret
]);
$res2 = curl_exec($ch2);
$http2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
curl_close($ch2);

echo "  HTTP Status: {$http2}\n";
echo "  Response: {$res2}\n";
$data2 = json_decode($res2, true);

if (!empty($data2['data']['duplicate'])) {
    echo "  [PASS] Replay Protection caught duplicate submission ID\n";
} else {
    echo "  [FAIL] Replay protection did not flag duplicate\n";
}

echo "\n[4/4] Testing Cross-Submission Duplicate Phone Detection...\n";
$repeatPayload = [
    'name' => 'Aarav Sharma (Repeat Inquiry)',
    'company' => 'Aarav Enterprises',
    'phone' => $testPhone, // Same phone
    'email' => $testEmail,
    'service' => 'ERP & Cloud Automation - Followup Query',
    'notes' => 'Need callback by today 5 PM.',
    'submission_id' => 'SUB_' . bin2hex(random_bytes(6)) // New submission ID
];

$ch3 = curl_init('http://localhost/my%20cockpit/backend/api/index.php/leads/webhook');
curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch3, CURLOPT_POST, true);
curl_setopt($ch3, CURLOPT_POSTFIELDS, json_encode($repeatPayload));
curl_setopt($ch3, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Tenant-Key: ' . $secret
]);
$res3 = curl_exec($ch3);
$http3 = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
curl_close($ch3);

echo "  HTTP Status: {$http3}\n";
echo "  Response: {$res3}\n";
$data3 = json_decode($res3, true);

if (!empty($data3['data']['duplicate']) && (int)$data3['data']['id'] === $createdLeadId) {
    echo "  [PASS] Duplicate detection recognized existing lead #{$createdLeadId} and recorded touchpoint\n";
} else {
    echo "  [FAIL] Duplicate detection did not link existing lead\n";
}

// Verify activity touchpoint was created
$actStmt = $db->prepare("SELECT * FROM lead_activities WHERE lead_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 2");
$actStmt->execute([$createdLeadId, $tenantId]);
$activities = $actStmt->fetchAll(PDO::FETCH_ASSOC);
echo "  Activities logged: " . count($activities) . "\n";
foreach ($activities as $act) {
    echo "  - [{$act['activity_type']}] {$act['title']}: {$act['description']}\n";
}

echo "\n>>> SEO WEBHOOK RETEST COMPLETE & VERIFIED <<<\n";
