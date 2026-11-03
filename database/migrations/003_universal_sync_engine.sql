-- ===================================================
-- MY COCKPIT AI - Migration 003: Universal Automatic Lead Synchronization Engine
-- Safe & Idempotent Schema Upgrades for MySQL / MariaDB
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Upgrade lead_sources_config for Sync Engine
ALTER TABLE `lead_sources_config` 
    MODIFY COLUMN `status` ENUM('connected_syncing', 'connected', 'auth_required', 'api_access_required', 'webhook_configured', 'manual_import_only', 'unsupported') DEFAULT 'manual_import_only',
    ADD COLUMN IF NOT EXISTS `sync_mode` ENUM('api_pull', 'webhook_push', 'manual_import', 'unsupported') DEFAULT 'manual_import' AFTER `category`,
    ADD COLUMN IF NOT EXISTS `encrypted_credentials` TEXT NULL AFTER `settings_json`,
    ADD COLUMN IF NOT EXISTS `sync_checkpoint` VARCHAR(255) NULL AFTER `last_sync_at`,
    ADD COLUMN IF NOT EXISTS `sync_interval_minutes` INT DEFAULT 15 AFTER `sync_checkpoint`,
    ADD COLUMN IF NOT EXISTS `last_error_message` TEXT NULL AFTER `sync_interval_minutes`,
    ADD COLUMN IF NOT EXISTS `last_error_at` DATETIME NULL AFTER `last_error_message`,
    ADD COLUMN IF NOT EXISTS `retry_count` INT DEFAULT 0 AFTER `last_error_at`,
    ADD COLUMN IF NOT EXISTS `auto_assign_user_id` INT NULL AFTER `retry_count`;

-- 2. Upgrade crm_leads with sync tracking
ALTER TABLE `crm_leads`
    ADD COLUMN IF NOT EXISTS `sync_status` ENUM('synced', 'manual', 'webhook', 'pending_retry', 'error') DEFAULT 'manual' AFTER `source_lead_id`,
    ADD COLUMN IF NOT EXISTS `source_platform` VARCHAR(50) NULL AFTER `sync_status`;

CREATE INDEX `idx_crm_leads_sync_status` ON `crm_leads` (`tenant_id`, `sync_status`);

-- 3. Lead Sync Audit Logs Table
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

SET FOREIGN_KEY_CHECKS = 1;
