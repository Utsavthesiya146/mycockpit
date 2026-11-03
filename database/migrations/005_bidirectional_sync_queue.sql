-- ===================================================
-- MY COCKPIT AI - Migration 005: Bidirectional Sync Queue & Browser Automation Sessions
-- Safe & Idempotent Schema Upgrades for MySQL / MariaDB
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Extend crm_leads with Bidirectional External Sync Tracking
ALTER TABLE `crm_leads`
    ADD COLUMN IF NOT EXISTS `external_sync_status` ENUM('synced', 'pending_writeback', 'conflict', 'failed', 'manual_required', 'not_applicable') DEFAULT 'not_applicable' AFTER `source_platform`,
    ADD COLUMN IF NOT EXISTS `last_external_sync_at` DATETIME NULL AFTER `external_sync_status`,
    ADD COLUMN IF NOT EXISTS `external_snapshot_json` JSON NULL AFTER `last_external_sync_at`;

CREATE INDEX IF NOT EXISTS `idx_crm_leads_ext_sync` ON `crm_leads` (`tenant_id`, `external_sync_status`);

-- 2. Bidirectional Writeback Sync Queue
CREATE TABLE IF NOT EXISTS `lead_writeback_queue` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Isolated Platform Automation Sessions (Tenant-isolated, AES-256-GCM encrypted state)
CREATE TABLE IF NOT EXISTS `lead_platform_sessions` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
