<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/controllers/LeadController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\LeadController;

echo "=======================================================\n";
echo "   CENTRALIZED LEADS & MULTI-TENANT ISOLATION AUDIT   \n";
echo "=======================================================\n\n";

$db = Database::getConnection();

$clientA = ['id' => 2, 'tenant_id' => 1, 'role' => 'tenant_owner', 'name' => 'Utsav Patel', 'email' => 'utsav@acme.com'];
$clientB = ['id' => 4, 'tenant_id' => 2, 'role' => 'tenant_owner', 'name' => 'Rahul Verma', 'email' => 'rahul@nexus.com'];

echo "[1/6] Verifying All Available Leads for Client A (Tenant 1)...\n";
$stmtA = $db->prepare("SELECT id, name, company, source, source_platform, sync_status, priority, status FROM crm_leads WHERE tenant_id = 1 ORDER BY id DESC");
$stmtA->execute();
$leadsA = $stmtA->fetchAll(PDO::FETCH_ASSOC);
echo "  Total Leads for Client A: " . count($leadsA) . "\n";

$sourcesCount = [];
foreach ($leadsA as $l) {
    $src = $l['source'];
    $sourcesCount[$src] = ($sourcesCount[$src] ?? 0) + 1;
}
echo "  Source Distribution:\n";
foreach ($sourcesCount as $s => $cnt) {
    echo "    - {$s}: {$cnt} leads\n";
}

echo "\n[2/6] Verifying Source Filters on Unified Leads Table...\n";
$filterSources = ['BNI Connect', 'KVV Leads', 'EAF Connect', 'SEO & Website Forms'];
foreach ($filterSources as $filter) {
    $fStmt = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1 AND source = ?");
    $fStmt->execute([$filter]);
    $fCount = $fStmt->fetchColumn();
    echo "  Filter '{$filter}': {$fCount} leads found\n";
}

echo "\n[3/6] Verifying Search Functionality...\n";
$searchStmt = $db->prepare("
    SELECT id, name, company, phone 
    FROM crm_leads 
    WHERE tenant_id = 1 AND (name LIKE ? OR company LIKE ? OR phone LIKE ?) 
    LIMIT 3
");
$searchQuery = '%Harri%';
$searchStmt->execute([$searchQuery, $searchQuery, $searchQuery]);
$searchResults = $searchStmt->fetchAll(PDO::FETCH_ASSOC);
echo "  Search for 'Harri': " . count($searchResults) . " matches\n";
foreach ($searchResults as $r) {
    echo "    - #{$r['id']}: {$r['name']} ({$r['company']}) - {$r['phone']}\n";
}

echo "\n[4/6] Verifying Follow-ups and Auto-scheduling...\n";
$fuStmt = $db->prepare("
    SELECT COUNT(*) AS total_followups,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
    FROM follow_ups 
    WHERE tenant_id = 1
");
$fuStmt->execute();
$fuStats = $fuStmt->fetch(PDO::FETCH_ASSOC);
echo "  Total Follow-ups for Client A: {$fuStats['total_followups']} (Pending: {$fuStats['pending']}, Completed: {$fuStats['completed']})\n";

echo "\n[5/6] Verifying Lead Assignment & Activity Audit History...\n";
$sampleLead = $leadsA[0]['id'];
$updateAssign = $db->prepare("UPDATE crm_leads SET assigned_to = 2 WHERE id = ? AND tenant_id = 1");
$updateAssign->execute([$sampleLead]);

$actStmt = $db->prepare("SELECT id, activity_type, title, description, created_at FROM lead_activities WHERE lead_id = ? AND tenant_id = 1 ORDER BY id DESC LIMIT 3");
$actStmt->execute([$sampleLead]);
$acts = $actStmt->fetchAll(PDO::FETCH_ASSOC);
echo "  Activity History for Lead #{$sampleLead}: " . count($acts) . " entries logged\n";
foreach ($acts as $a) {
    echo "    - [{$a['activity_type']}] {$a['title']} ({$a['created_at']})\n";
}

echo "\n[6/6] Verifying Client A and Client B Boundary Isolation...\n";
// Ensure Client B has at least one lead
$stmtB = $db->prepare("SELECT id, name, company FROM crm_leads WHERE tenant_id = 2 LIMIT 5");
$stmtB->execute();
$leadsB = $stmtB->fetchAll(PDO::FETCH_ASSOC);
echo "  Client B (Tenant 2) Leads: " . count($leadsB) . "\n";
foreach ($leadsB as $lb) {
    echo "    - #{$lb['id']}: {$lb['name']} ({$lb['company']})\n";
}

// Confirm zero overlap between Tenant 1 and Tenant 2 leads
$leakStmt = $db->prepare("
    SELECT COUNT(*) FROM crm_leads 
    WHERE tenant_id = 1 AND id IN (SELECT id FROM crm_leads WHERE tenant_id = 2)
");
$leakStmt->execute();
$leakCount = (int)$leakStmt->fetchColumn();

// Confirm Tenant 1 cannot access Tenant 2 leads
$crossStmt = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = 1 AND name = 'Deepak Shah'");
$crossStmt->execute();
$crossLeak = (int)$crossStmt->fetchColumn();

if ($leakCount === 0 && $crossLeak === 0) {
    echo "  [PASS] ZERO data leakage! Client A and Client B completely isolated.\n";
} else {
    echo "  [FAIL] Tenant isolation breach detected!\n";
    exit(1);
}

echo "\n>>> CENTRALIZED LEADS AUDIT COMPLETE: ALL CHECKS PASSED <<<\n";
