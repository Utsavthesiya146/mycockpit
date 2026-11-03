<?php
declare(strict_types=1);

// ===================================================
// MY COCKPIT AI - Universal Lead Synchronization Background Cron Runner
// Designed for Hostinger Shared/Cloud/VPS PHP 8.2+ Hosting
// Runs without persistent Node.js background process
// Features: Non-blocking advisory file locking (anti-overlap),
//           checkpoint progression, retry backoff, tenant isolation
// ===================================================

if (php_sapi_name() !== 'cli' && (!isset($_GET['cron_key']) || $_GET['cron_key'] !== 'mycockpit_cron_secret_2026')) {
    http_response_code(403);
    echo "Access denied: CLI or authorized web cron invocation required.\n";
    exit(1);
}

// 1. Process Mutex / Advisory File Lock against overlapping cron jobs
$lockFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mycockpit_lead_sync.lock';
$lockFp = fopen($lockFile, 'c+');

if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    $ts = date('Y-m-d H:i:s');
    echo "[{$ts}] [NOTICE] Previous lead synchronization job is still active. Skipping concurrent run to prevent race conditions and duplicate API calls.\n";
    if ($lockFp) {
        fclose($lockFp);
    }
    exit(0);
}

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/../services/connectors/EAFConnector.php';
require_once __DIR__ . '/../services/connectors/BNIConnector.php';
require_once __DIR__ . '/../services/connectors/KVVConnector.php';
require_once __DIR__ . '/../services/connectors/SEOConnector.php';
require_once __DIR__ . '/../services/SyncEngine.php';

use Cockpit\Services\SyncEngine;

// Check for tenant-specific execution flag (CLI: --tenant=1 or GET: tenant_id=1)
$targetTenantId = null;
if (php_sapi_name() === 'cli' && isset($argv)) {
    foreach ($argv as $arg) {
        if (str_starts_with($arg, '--tenant=')) {
            $targetTenantId = (int)substr($arg, 9);
        }
    }
} else if (!empty($_GET['tenant_id'])) {
    $targetTenantId = (int)$_GET['tenant_id'];
}

$start = microtime(true);
$timestamp = date('Y-m-d H:i:s');
if ($targetTenantId !== null) {
    echo "[{$timestamp}] Starting Tenant-Specific Lead Synchronization Cycle (Tenant ID: {$targetTenantId})...\n";
} else {
    echo "[{$timestamp}] Starting Global Universal Lead Synchronization Cycle (All Active Tenants)...\n";
}

try {
    if ($targetTenantId !== null) {
        $sourceStats = SyncEngine::syncAllSourcesForTenant($targetTenantId, 'cron');
        $duration = round((microtime(true) - $start), 2);
        echo "[{$timestamp}] Completed Tenant {$targetTenantId} Synchronization in {$duration}s.\n";
        foreach ($sourceStats as $source => $stat) {
            $status = ($stat['success'] ?? false) ? 'OK' : 'FAILED';
            $fetched = $stat['leads_fetched'] ?? 0;
            $created = $stat['leads_created'] ?? 0;
            $skipped = $stat['leads_skipped'] ?? 0;
            $err = !empty($stat['error']) ? " [{$stat['error']}]" : "";
            echo "  * {$source}: {$status} (Fetched: {$fetched}, Created: {$created}, Skipped: {$skipped}){$err}\n";
        }
    } else {
        $results = SyncEngine::runGlobalCronSync();
        $duration = round((microtime(true) - $start), 2);

        echo "[{$timestamp}] Completed Lead Synchronization in {$duration}s.\n";
        echo "Tenants Processed: " . ($results['tenants_processed'] ?? 0) . "\n";

        if (!empty($results['details'])) {
            foreach ($results['details'] as $tenantName => $sources) {
                echo " - Tenant '{$tenantName}':\n";
                foreach ($sources as $source => $stat) {
                    $status = ($stat['success'] ?? false) ? 'OK' : 'FAILED';
                    $fetched = $stat['leads_fetched'] ?? 0;
                    $created = $stat['leads_created'] ?? 0;
                    $skipped = $stat['leads_skipped'] ?? 0;
                    $err = !empty($stat['error']) ? " [{$stat['error']}]" : "";
                    echo "    * {$source}: {$status} (Fetched: {$fetched}, Created: {$created}, Skipped: {$skipped}){$err}\n";
                }
            }
        }
    }
    echo "===================================================\n";
} catch (\Throwable $e) {
    echo "[ERROR] Cron execution failed: " . $e->getMessage() . "\n";
} finally {
    // Release advisory file lock cleanly
    if ($lockFp) {
        flock($lockFp, LOCK_UN);
        fclose($lockFp);
    }
}
