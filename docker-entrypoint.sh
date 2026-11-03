#!/bin/bash
set -e

# Run safe pre-flight database schema initialization before starting Apache
php -r "
require_once '/var/www/html/backend/config/Database.php';
require_once '/var/www/html/backend/controllers/AppHubController.php';
try {
    Cockpit\Controllers\AppHubController::ensureSchemaCompatibility();
    echo 'Pre-flight database schema initialization completed successfully.' . PHP_EOL;
} catch (Throwable \$e) {
    echo 'Pre-flight notice: ' . \$e->getMessage() . PHP_EOL;
}
" || true

# Execute passed command (typically apache2-foreground)
exec "$@"
