<?php
/**
 * Helper: Inspect Genuine User Login State After Manual Browser Submission
 * Strictly obeys data masking: Never reveals raw passwords, JWTs, or cookie secrets.
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;

$db = Database::getConnection();

function maskString(string $str, int $visibleStart = 2, int $visibleEnd = 2): string {
    $len = strlen($str);
    if ($len <= ($visibleStart + $visibleEnd)) {
        return str_repeat('*', $len);
    }
    return substr($str, 0, $visibleStart) . str_repeat('*', max(3, $len - $visibleStart - $visibleEnd)) . substr($str, -$visibleEnd);
}

function maskEmail(string $email): string {
    $parts = explode('@', $email);
    if (count($parts) !== 2) return maskString($email);
    return maskString($parts[0], 2, 1) . '@' . $parts[1];
}

echo "=======================================================\n";
echo "   MANUAL LOGIN VERIFICATION INSPECTOR                \n";
echo "=======================================================\n\n";

$sources = ['bni', 'kvv', 'eaf'];

foreach ($sources as $source) {
    echo "--- Platform: " . strtoupper($source) . " ---\n";
    $sessStmt = $db->prepare("SELECT session_status, encrypted_session_data, last_validated_at FROM lead_platform_sessions WHERE tenant_id = 1 AND source_key = ? LIMIT 1");
    $sessStmt->execute([$source]);
    $sess = $sessStmt->fetch(PDO::FETCH_ASSOC);

    $appStmt = $db->prepare("SELECT id, name, connection_status, app_url FROM connected_apps WHERE tenant_id = 1 AND (app_url LIKE ? OR name LIKE ?) LIMIT 1");
    $appStmt->execute(["%{$source}%", "%{$source}%"]);
    $app = $appStmt->fetch(PDO::FETCH_ASSOC);

    $cfgStmt = $db->prepare("SELECT status, last_sync_at, sync_count, last_error_message FROM lead_sources_config WHERE tenant_id = 1 AND source_key = ? LIMIT 1");
    $cfgStmt->execute([$source]);
    $cfg = $cfgStmt->fetch(PDO::FETCH_ASSOC);

    $status = $sess['session_status'] ?? 'disconnected';
    $appStatus = $app['connection_status'] ?? 'unknown';
    $hasCreds = !empty($sess['encrypted_session_data']);

    echo "  Session Status      : {$status}\n";
    echo "  App Status          : {$appStatus}\n";
    echo "  Credentials Stored  : " . ($hasCreds ? "YES (AEAD AES-256-GCM Encrypted)" : "NO") . "\n";
    echo "  Last Validated At   : " . ($sess['last_validated_at'] ?? 'Never') . "\n";
    echo "  Last Error          : " . ($cfg['last_error_message'] ?? 'None') . "\n";

    if ($hasCreds) {
        $decrypted = json_decode((string)Encryption::decrypt($sess['encrypted_session_data']), true);
        if (is_array($decrypted)) {
            $userIdentifier = $decrypted['email'] ?? ($decrypted['username'] ?? ($decrypted['mobile_number'] ?? 'Unknown'));
            $maskedId = str_contains($userIdentifier, '@') ? maskEmail($userIdentifier) : maskString($userIdentifier, 2, 2);
            echo "  Authenticated User  : {$maskedId}\n";
            echo "  Token Present       : " . (!empty($decrypted['token']) || !empty($decrypted['access_token']) ? "YES (Secured)" : "NO") . "\n";
            echo "  Cookies Present     : " . (!empty($decrypted['cookies']) || !empty($decrypted['cookie_jar']) ? "YES (Secured)" : "NO") . "\n";
        }
    }
    echo "\n";
}

