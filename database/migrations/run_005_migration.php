<?php
/**
 * Run Migration 005: Bidirectional Sync Queue & Automation Sessions
 */
require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Connected to database.\n";

    // 1. Extend crm_leads
    try {
        $db->exec("ALTER TABLE `crm_leads`
            ADD COLUMN `external_sync_status` ENUM('synced', 'pending_writeback', 'conflict', 'failed', 'manual_required', 'not_applicable') DEFAULT 'not_applicable' AFTER `source_platform`,
            ADD COLUMN `last_external_sync_at` DATETIME NULL AFTER `external_sync_status`,
            ADD COLUMN `external_snapshot_json` JSON NULL AFTER `last_external_sync_at`");
        echo "Updated crm_leads columns successfully.\n";
    } catch (\PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "Columns already exist on crm_leads.\n";
        } else {
            echo "crm_leads notice: " . $e->getMessage() . "\n";
        }
    }

    // 2. Create lead_writeback_queue
    $db->exec("CREATE TABLE IF NOT EXISTS `lead_writeback_queue` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `tenant_id` INT NOT NULL,
        `lead_id` INT NOT NULL,
        `source_platform` VARCHAR(50) NOT NULL,
        `source_lead_id` VARCHAR(100) NOT NULL,
        `action_type` ENUM('update_status', 'edit_details', 'add_note', 'full_sync') NOT NULL,
        `proposed_payload` JSON NOT NULL,
        `original_snapshot` JSON NULL,
        `status` ENUM('pending_confirmation', 'queued', 'in_progress', 'synced', 'conflict_detected', 'failed', 'manual_action_required') DEFAULT 'pending_confirmation',
        `conflict_details` JSON NULL,
        `error_message` TEXT NULL,
        `retry_count` INT DEFAULT 0,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`lead_id`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE,
        INDEX `idx_wb_queue_tenant_status` (`tenant_id`, `status`),
        INDEX `idx_wb_queue_lead` (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "Created or verified table `lead_writeback_queue`.\n";

    // 3. Create lead_platform_sessions
    $db->exec("CREATE TABLE IF NOT EXISTS `lead_platform_sessions` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `tenant_id` INT NOT NULL,
        `source_key` VARCHAR(50) NOT NULL,
        `session_status` ENUM('active', 'expired', 'captcha_required', 'mfa_required', 'disconnected') DEFAULT 'disconnected',
        `encrypted_session_data` TEXT NULL,
        `last_validated_at` DATETIME NULL,
        `session_expires_at` DATETIME NULL,
        `rate_limit_reset_at` DATETIME NULL,
        `notes` TEXT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uk_tenant_platform_session` (`tenant_id`, `source_key`),
        FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
        INDEX `idx_session_tenant_source` (`tenant_id`, `source_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "Created or verified table `lead_platform_sessions`.\n";

    echo "Migration 005 completed successfully.\n";
} catch (\Exception $e) {
    echo "Migration 005 failed: " . $e->getMessage() . "\n";
    exit(1);
}
