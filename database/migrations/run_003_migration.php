<?php
declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Running migration 003: Universal Automatic Lead Synchronization Engine...\n";

    // 1. Check and add columns to lead_sources_config
    $sourceCols = $db->query("SHOW COLUMNS FROM lead_sources_config")->fetchAll(PDO::FETCH_COLUMN);

    // Update status column enum values
    try {
        $db->exec("ALTER TABLE `lead_sources_config` MODIFY COLUMN `status` ENUM('connected_syncing', 'connected', 'auth_required', 'api_access_required', 'webhook_configured', 'manual_import_only', 'unsupported') DEFAULT 'manual_import_only'");
        echo " - Updated `status` enum on `lead_sources_config`\n";
    } catch (\PDOException $e) {
        echo " - Notice on status enum: " . $e->getMessage() . "\n";
    }

    $sourceColsToAdd = [
        'sync_mode' => "ENUM('api_pull', 'webhook_push', 'manual_import', 'unsupported') DEFAULT 'manual_import' AFTER `category`",
        'encrypted_credentials' => "TEXT NULL AFTER `settings_json`",
        'sync_checkpoint' => "VARCHAR(255) NULL AFTER `last_sync_at`",
        'sync_interval_minutes' => "INT DEFAULT 15 AFTER `sync_checkpoint`",
        'last_error_message' => "TEXT NULL AFTER `sync_interval_minutes`",
        'last_error_at' => "DATETIME NULL AFTER `last_error_message`",
        'retry_count' => "INT DEFAULT 0 AFTER `last_error_at`",
        'auto_assign_user_id' => "INT NULL AFTER `retry_count`"
    ];

    foreach ($sourceColsToAdd as $col => $definition) {
        if (!in_array($col, $sourceCols, true)) {
            $db->exec("ALTER TABLE `lead_sources_config` ADD COLUMN `{$col}` {$definition}");
            echo " - Added column `{$col}` to `lead_sources_config`\n";
        } else {
            echo " - Column `{$col}` already exists in `lead_sources_config`\n";
        }
    }

    // 2. Check and add columns to crm_leads
    $leadCols = $db->query("SHOW COLUMNS FROM crm_leads")->fetchAll(PDO::FETCH_COLUMN);
    $leadColsToAdd = [
        'sync_status' => "ENUM('synced', 'manual', 'webhook', 'pending_retry', 'error') DEFAULT 'manual' AFTER `source_lead_id`",
        'source_platform' => "VARCHAR(50) NULL AFTER `sync_status`"
    ];

    foreach ($leadColsToAdd as $col => $definition) {
        if (!in_array($col, $leadCols, true)) {
            $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `{$col}` {$definition}");
            echo " - Added column `{$col}` to `crm_leads`\n";
        } else {
            echo " - Column `{$col}` already exists in `crm_leads`\n";
        }
    }

    // 3. Create lead_sync_logs table
    $db->exec("
        CREATE TABLE IF NOT EXISTS `lead_sync_logs` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `tenant_id` INT NOT NULL,
            `source_key` VARCHAR(50) NOT NULL,
            `sync_type` ENUM('cron', 'manual', 'webhook', 'test') NOT NULL,
            `status` ENUM('success', 'failed', 'partial') NOT NULL,
            `leads_fetched` INT DEFAULT 0,
            `leads_created` INT DEFAULT 0,
            `leads_updated` INT DEFAULT 0,
            `leads_skipped` INT DEFAULT 0,
            `checkpoint_before` VARCHAR(255) NULL,
            `checkpoint_after` VARCHAR(255) NULL,
            `error_details` TEXT NULL,
            `execution_time_ms` INT DEFAULT 0,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
            INDEX `idx_sync_logs_tenant` (`tenant_id`, `source_key`),
            INDEX `idx_sync_logs_date` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo " - Ensured table `lead_sync_logs` exists\n";

    // 4. Update default records in lead_sources_config with honest statuses & sync modes
    $db->exec("
        UPDATE `lead_sources_config` 
        SET 
            `status` = 'api_access_required',
            `sync_mode` = 'api_pull'
        WHERE `source_key` = 'bni_connect' AND (`status` IS NULL OR `status` = 'csv_import_available' OR `status` = 'launcher_only');
    ");

    $db->exec("
        UPDATE `lead_sources_config` 
        SET 
            `status` = 'manual_import_only',
            `sync_mode` = 'webhook_push'
        WHERE `source_key` = 'kvv_connect' AND (`status` IS NULL OR `status` = 'csv_import_available' OR `status` = 'launcher_only');
    ");

    $db->exec("
        UPDATE `lead_sources_config` 
        SET 
            `status` = 'auth_required',
            `sync_mode` = 'api_pull'
        WHERE `source_key` = 'eaf_connect' AND (`status` IS NULL OR `status` = 'csv_import_available' OR `status` = 'launcher_only');
    ");

    $db->exec("
        UPDATE `lead_sources_config` 
        SET 
            `status` = 'webhook_configured',
            `sync_mode` = 'webhook_push'
        WHERE `source_key` = 'website_seo' AND (`status` IS NULL OR `status` = 'connected' OR `status` = 'csv_import_available');
    ");

    echo "Migration 003 completed successfully!\n";
} catch (\Throwable $e) {
    echo "Error during migration: " . $e->getMessage() . "\n";
    exit(1);
}
