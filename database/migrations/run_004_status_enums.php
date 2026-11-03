<?php
declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Running migration 004: Expand Lead Sources Status Enum for Honest User Access Reporting...\n";

    $enumSql = "ALTER TABLE `lead_sources_config` MODIFY COLUMN `status` ENUM(
        'live_api_sync',
        'connected_syncing',
        'connected',
        'user_export_available',
        'email_integration_available',
        'manual_csv_import',
        'manual_import_only',
        'webhook_configured',
        'auth_required',
        'api_access_required',
        'blocked',
        'unsupported'
    ) DEFAULT 'manual_csv_import'";

    $db->exec($enumSql);
    echo " - Successfully updated `status` enum on `lead_sources_config`\n";

    // Set honest status defaults for existing sources:
    // BNI -> api_access_required
    // KVV -> webhook_configured
    // EAF -> auth_required (or connected_syncing on staging)
    // Website -> webhook_configured

    $db->exec("UPDATE lead_sources_config SET status = 'api_access_required' WHERE source_key = 'bni_connect'");
    $db->exec("UPDATE lead_sources_config SET status = 'webhook_configured' WHERE source_key = 'kvv_connect'");

    echo "Migration 004 complete!\n";
} catch (\Throwable $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}
