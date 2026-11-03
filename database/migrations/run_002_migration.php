<?php
declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Running migration 002: Centralized Lead Management & Follow-ups...\n";

    // 1. Check and add columns to crm_leads
    $leadCols = $db->query("SHOW COLUMNS FROM crm_leads")->fetchAll(PDO::FETCH_COLUMN);

    $leadColsToAdd = [
        'service_requirement' => "VARCHAR(255) NULL AFTER `source`",
        'priority' => "ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' AFTER `status`",
        'assigned_to' => "INT NULL AFTER `service_requirement`",
        'source_lead_id' => "VARCHAR(100) NULL AFTER `assigned_to`",
        'last_contact_date' => "DATETIME NULL AFTER `source_lead_id`",
        'next_followup_date' => "DATETIME NULL AFTER `last_contact_date`"
    ];

    foreach ($leadColsToAdd as $col => $definition) {
        if (!in_array($col, $leadCols, true)) {
            $db->exec("ALTER TABLE `crm_leads` ADD COLUMN `{$col}` {$definition}");
            echo " - Added column `{$col}` to `crm_leads`\n";
        } else {
            echo " - Column `{$col}` already exists in `crm_leads`\n";
        }
    }

    // 2. Check and add columns to follow_ups
    $followCols = $db->query("SHOW COLUMNS FROM follow_ups")->fetchAll(PDO::FETCH_COLUMN);
    $followColsToAdd = [
        'contact_method' => "ENUM('call', 'email', 'meeting', 'whatsapp', 'other') DEFAULT 'call' AFTER `title`",
        'assigned_to' => "INT NULL AFTER `lead_id`",
        'outcome' => "VARCHAR(255) NULL AFTER `notes`",
        'completed_at' => "DATETIME NULL AFTER `status`"
    ];

    foreach ($followColsToAdd as $col => $definition) {
        if (!in_array($col, $followCols, true)) {
            $db->exec("ALTER TABLE `follow_ups` ADD COLUMN `{$col}` {$definition}");
            echo " - Added column `{$col}` to `follow_ups`\n";
        } else {
            echo " - Column `{$col}` already exists in `follow_ups`\n";
        }
    }

    // 3. Create lead_sources_config table
    $db->exec("
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
    ");
    echo " - Table `lead_sources_config` checked/created\n";

    // 4. Create lead_activities table
    $db->exec("
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
    ");
    echo " - Table `lead_activities` checked/created\n";

    // 5. Seed default Lead Source Configurations for existing tenants
    $tenants = $db->query("SELECT id FROM tenants")->fetchAll(PDO::FETCH_COLUMN);
    $defaultSources = [
        ['key' => 'bni', 'name' => 'BNI Connect', 'category' => 'referral', 'status' => 'csv_import_available'],
        ['key' => 'kvv', 'name' => 'KVV Leads', 'category' => 'business_forum', 'status' => 'csv_import_available'],
        ['key' => 'eaf', 'name' => 'EAF Connect', 'category' => 'association', 'status' => 'csv_import_available'],
        ['key' => 'website_seo', 'name' => 'SEO & Website Forms', 'category' => 'inbound', 'status' => 'connected'],
        ['key' => 'manual', 'name' => 'Manually Added', 'category' => 'direct', 'status' => 'connected'],
        ['key' => 'custom', 'name' => 'Custom Lead Source', 'category' => 'custom', 'status' => 'csv_import_available']
    ];

    $insertSrc = $db->prepare("
        INSERT IGNORE INTO lead_sources_config (tenant_id, source_key, name, category, status, webhook_secret, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ");

    foreach ($tenants as $tId) {
        foreach ($defaultSources as $src) {
            $webhookSecret = bin2hex(random_bytes(16));
            $insertSrc->execute([$tId, $src['key'], $src['name'], $src['category'], $src['status'], $webhookSecret]);
        }
    }
    echo " - Lead sources seeded for all active tenants\n";

    echo "Migration 002 completed successfully!\n";
} catch (\Throwable $e) {
    echo "Migration Error: " . $e->getMessage() . "\n";
    exit(1);
}
