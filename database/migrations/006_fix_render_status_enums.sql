-- Migration 006: Fix Render Database Schema Mismatch (Status ENUMs to VARCHAR)
-- Ensures full compatibility for all valid connection statuses without MySQL warning 1265 data truncation.

ALTER TABLE `connected_apps` 
    MODIFY COLUMN `connection_status` VARCHAR(50) DEFAULT 'launcher_only',
    MODIFY COLUMN `auth_type` VARCHAR(50) DEFAULT 'direct_link',
    MODIFY COLUMN `category` VARCHAR(50) DEFAULT 'business';

ALTER TABLE `lead_platform_sessions` 
    MODIFY COLUMN `session_status` VARCHAR(50) DEFAULT 'disconnected';

ALTER TABLE `lead_sources_config` 
    MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'manual_csv_import';
