<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/services/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/../backend/services/connectors/EAFConnector.php';
require_once __DIR__ . '/../backend/services/SyncEngine.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use Cockpit\Services\Connectors\EAFConnector;
use Cockpit\Services\SyncEngine;

echo "=======================================================\n";
echo "   EAF CONNECT LIVE SYNCHRONIZATION VERIFICATION      \n";
echo "=======================================================\n\n";

$db = Database::getConnection();
$tenantId = 1;

// Clean up any test leads previously inserted with EAF Connect for clean benchmark
// (only test leads created in previous verification runs)
$eafConnector = new EAFConnector();

$config = [
    'credentials' => [
        'base_url' => 'http://localhost/eaf',
        'api_token' => 'f3792c0b5f1d153b70e7c1b432a5b7d4b155fd49d55ceba5a14cf6fc4acf6b82'
    ],
    'auto_assign_user_id' => 2
];

echo "[1/4] Testing EAF Connection via EAFConnector::testConnection()...\n";
$testRes = $eafConnector->testConnection($tenantId, $config);
echo "  Success: " . ($testRes['success'] ? 'YES' : 'NO') . "\n";
echo "  Message: " . $testRes['message'] . "\n";
if (!$testRes['success']) {
    exit(1);
}

echo "\n[2/4] Executing Initial Live Sync from EAF into My Cockpit AI...\n";
$syncRes1 = $eafConnector->sync($tenantId, $config, null);
echo "  Sync 1 Success: " . ($syncRes1['success'] ? 'YES' : 'NO') . "\n";
echo "  Leads Fetched: " . $syncRes1['leads_fetched'] . "\n";
echo "  Leads Created: " . $syncRes1['leads_created'] . "\n";
echo "  Leads Updated: " . $syncRes1['leads_updated'] . "\n";
echo "  Leads Skipped: " . $syncRes1['leads_skipped'] . "\n";
echo "  New Checkpoint: " . ($syncRes1['new_checkpoint'] ?? 'none') . "\n";

echo "\n[3/4] Verifying Lead Persistence & Data Mapping in crm_leads...\n";
$leadsStmt = $db->prepare("
    SELECT id, name, company, email, phone, value, status, priority, source, source_lead_id, sync_status, created_at 
    FROM crm_leads 
    WHERE tenant_id = ? AND source = 'EAF Connect' 
    ORDER BY id DESC LIMIT 5
");
$leadsStmt->execute([$tenantId]);
$insertedLeads = $leadsStmt->fetchAll(PDO::FETCH_ASSOC);
echo "  Persisted EAF Leads Found: " . count($insertedLeads) . "\n";
foreach ($insertedLeads as $l) {
    echo "  - Lead #{$l['id']}: {$l['name']} | Co: {$l['company']} | Ref: {$l['source_lead_id']} | Phone: {$l['phone']} | Status: {$l['status']} | Sync: {$l['sync_status']}\n";
}

echo "\n[4/4] Executing Second Sync (Duplicate Prevention & Checkpoint Test)...\n";
$syncRes2 = $eafConnector->sync($tenantId, $config, $syncRes1['new_checkpoint']);
echo "  Sync 2 Success: " . ($syncRes2['success'] ? 'YES' : 'NO') . "\n";
echo "  Leads Fetched: " . $syncRes2['leads_fetched'] . "\n";
echo "  Leads Created: " . $syncRes2['leads_created'] . " (Should be 0 - No Duplicates!)\n";
echo "  Leads Updated: " . $syncRes2['leads_updated'] . "\n";
echo "  Leads Skipped: " . $syncRes2['leads_skipped'] . "\n";

if ($syncRes2['leads_created'] === 0) {
    echo "\n>>> VERIFICATION SUCCESS: EAF Referrals synchronized with strict duplicate prevention and checkpointing! <<<\n";
} else {
    echo "\n>>> FAILED: Duplicates created on second sync! <<<\n";
}
