<?php
require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Executing Migration 007: Full Gmail Email Management Schema...\n";

    $sql = file_get_contents(__DIR__ . '/007_gmail_integration.sql');
    $queries = array_filter(array_map('trim', explode(';', $sql)));

    foreach ($queries as $query) {
        if (!empty($query)) {
            $db->exec($query);
        }
    }

    echo "Migration 007 completed successfully.\n";

    // Verify tables exist
    $tables = $db->query("SHOW TABLES LIKE 'gmail_%'")->fetchAll(PDO::FETCH_COLUMN);
    echo "Created/Verified Gmail Tables:\n";
    foreach ($tables as $t) {
        echo "  - $t\n";
    }

} catch (\Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

