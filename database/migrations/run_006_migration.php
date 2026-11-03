<?php
declare(strict_types=1);

/**
 * Migration 006: Widen ENUM Status Columns to VARCHAR(50)
 * Resolves MySQL 1265 Data Truncation warning on Render / strict SQL environments.
 */

require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Running migration 006: Converting rigid status ENUMs to robust VARCHAR(50)...\n";

    // 1. Alter connected_apps columns
    $db->exec("ALTER TABLE `connected_apps` 
        MODIFY COLUMN `connection_status` VARCHAR(50) DEFAULT 'launcher_only',
        MODIFY COLUMN `auth_type` VARCHAR(50) DEFAULT 'direct_link',
        MODIFY COLUMN `category` VARCHAR(50) DEFAULT 'business'");
    echo "  [OK] `connected_apps` columns converted to VARCHAR(50)\n";

    // 2. Alter lead_platform_sessions session_status
    try {
        $db->exec("ALTER TABLE `lead_platform_sessions` 
            MODIFY COLUMN `session_status` VARCHAR(50) DEFAULT 'disconnected'");
        echo "  [OK] `lead_platform_sessions.session_status` converted to VARCHAR(50)\n";
    } catch (\Throwable $e) {
        echo "  [SKIP] `lead_platform_sessions`: " . $e->getMessage() . "\n";
    }

    // 3. Alter lead_sources_config status
    try {
        $db->exec("ALTER TABLE `lead_sources_config` 
            MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'manual_csv_import'");
        echo "  [OK] `lead_sources_config.status` converted to VARCHAR(50)\n";
    } catch (\Throwable $e) {
        echo "  [SKIP] `lead_sources_config`: " . $e->getMessage() . "\n";
    }

    echo "Migration 006 complete!\n";
} catch (\Throwable $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
    exit(1);
}
