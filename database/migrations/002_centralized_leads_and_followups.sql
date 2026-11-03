-- ===================================================
-- MY COCKPIT AI - Migration 002: Centralized Lead Management & Follow-ups
-- Safe & Idempotent Schema Upgrades for MySQL / MariaDB
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Extend crm_leads with Enterprise Tracking Fields
-- Service requirement, priority, assigned employee, source lead ID, contact dates
ALTER TABLE `crm_leads` 
    ADD COLUMN IF NOT EXISTS `service_requirement` VARCHAR(255) NULL AFTER `source`,
    ADD COLUMN IF NOT EXISTS `priority` ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' AFTER `status`,
    ADD COLUMN IF NOT EXISTS `assigned_to` INT NULL AFTER `service_requirement`,
    ADD COLUMN IF NOT EXISTS `source_lead_id` VARCHAR(100) NULL AFTER `assigned_to`,
    ADD COLUMN IF NOT EXISTS `last_contact_date` DATETIME NULL AFTER `source_lead_id`,
    ADD COLUMN IF NOT EXISTS `next_followup_date` DATETIME NULL AFTER `last_contact_date`;

-- Add indexes safely
CREATE INDEX `idx_crm_leads_source` ON `crm_leads` (`source`);
CREATE INDEX `idx_crm_leads_assigned` ON `crm_leads` (`assigned_to`);
CREATE INDEX `idx_crm_leads_priority` ON `crm_leads` (`priority`);
CREATE INDEX `idx_crm_leads_source_ext` ON `crm_leads` (`tenant_id`, `source`, `source_lead_id`);
CREATE INDEX `idx_crm_leads_next_follow` ON `crm_leads` (`tenant_id`, `next_followup_date`);

-- 2. Extend follow_ups with Contact Method, Assigned User, Outcome & Completion
ALTER TABLE `follow_ups`
    ADD COLUMN IF NOT EXISTS `contact_method` ENUM('call', 'email', 'meeting', 'whatsapp', 'other') DEFAULT 'call' AFTER `title`,
    ADD COLUMN IF NOT EXISTS `assigned_to` INT NULL AFTER `lead_id`,
    ADD COLUMN IF NOT EXISTS `outcome` VARCHAR(255) NULL AFTER `notes`,
    ADD COLUMN IF NOT EXISTS `completed_at` DATETIME NULL AFTER `status`;

CREATE INDEX `idx_followups_assigned` ON `follow_ups` (`assigned_to`);
CREATE INDEX `idx_followups_method` ON `follow_ups` (`contact_method`);

-- 3. Lead Sources Integration Configuration Table
CREATE TABLE IF NOT EXISTS `lead_sources_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` INT NOT NULL,
    `source_key` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) DEFAULT 'referral',
    `status` ENUM('connected', 'syncing', 'launcher_only', 'csv_import_available', 'configuration_required', 'unsupported') DEFAULT 'csv_import_available',
    `api_key` VARCHAR(150) NULL,
    `webhook_secret` VARCHAR(150) NULL,
    `settings_json` JSON NULL,
    `last_sync_at` DATETIME NULL,
    `sync_count` INT DEFAULT 0,
    `is_enabled` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_source` (`tenant_id`, `source_key`),
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
    INDEX `idx_lead_src_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Lead Activities History Table (Audit trail of calls, emails, WhatsApp, meetings, notes)
CREATE TABLE IF NOT EXISTS `lead_activities` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` INT NOT NULL,
    `lead_id` INT NOT NULL,
    `user_id` INT NULL,
    `activity_type` ENUM('call', 'email', 'meeting', 'whatsapp', 'note', 'status_change', 'import', 'system') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `activity_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `metadata` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lead_id`) REFERENCES `crm_leads`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_lead_act_tenant` (`tenant_id`),
    INDEX `idx_lead_act_lead` (`lead_id`),
    INDEX `idx_lead_act_date` (`activity_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
