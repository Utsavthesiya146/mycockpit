-- ===================================================
-- Migration 007: Full Gmail Email Management Schema
-- ===================================================

CREATE TABLE IF NOT EXISTS `gmail_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` INT NOT NULL,
    `email_address` VARCHAR(255) NOT NULL,
    `account_name` VARCHAR(255) NULL,
    `connection_status` ENUM('connected', 'disconnected', 'expired', 'auth_required') DEFAULT 'auth_required',
    `encrypted_tokens` LONGTEXT NULL COMMENT 'AES-256-GCM encrypted tokens payload',
    `history_id` VARCHAR(64) NULL,
    `messages_total` INT DEFAULT 0,
    `threads_total` INT DEFAULT 0,
    `last_sync_at` DATETIME NULL,
    `sync_status` ENUM('sync_successful', 'sync_failed', 'syncing', 'not_synced') DEFAULT 'not_synced',
    `last_error` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_email` (`tenant_id`, `email_address`),
    INDEX `idx_tenant_status` (`tenant_id`, `connection_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gmail_oauth_states` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `state_token` VARCHAR(128) NOT NULL UNIQUE,
    `code_verifier` VARCHAR(128) NULL,
    `redirect_url` VARCHAR(500) NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_state_token` (`state_token`),
    INDEX `idx_tenant_expires` (`tenant_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gmail_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` INT NOT NULL,
    `gmail_account_id` INT NOT NULL,
    `message_id` VARCHAR(64) NOT NULL,
    `thread_id` VARCHAR(64) NOT NULL,
    `from_name` VARCHAR(255) NULL,
    `from_email` VARCHAR(255) NULL,
    `to_recipients` TEXT NULL,
    `cc_recipients` TEXT NULL,
    `bcc_recipients` TEXT NULL,
    `reply_to` VARCHAR(255) NULL,
    `subject` VARCHAR(500) NULL,
    `snippet` VARCHAR(1000) NULL,
    `body_plain` MEDIUMTEXT NULL,
    `body_html` MEDIUMTEXT NULL,
    `body_fetched` TINYINT(1) DEFAULT 0 COMMENT '0 = metadata only, 1 = body loaded on demand',
    `internal_date` BIGINT NULL,
    `date_sent` DATETIME NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `is_starred` TINYINT(1) DEFAULT 0,
    `is_draft` TINYINT(1) DEFAULT 0,
    `is_sent` TINYINT(1) DEFAULT 0,
    `is_trash` TINYINT(1) DEFAULT 0,
    `is_spam` TINYINT(1) DEFAULT 0,
    `is_important` TINYINT(1) DEFAULT 0,
    `labels_json` TEXT NULL,
    `has_attachments` TINYINT(1) DEFAULT 0,
    `attachments_json` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_message` (`tenant_id`, `message_id`),
    INDEX `idx_tenant_thread` (`tenant_id`, `thread_id`),
    INDEX `idx_tenant_folder` (`tenant_id`, `is_trash`, `is_spam`, `is_read`, `date_sent`),
    INDEX `idx_tenant_date` (`tenant_id`, `date_sent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

