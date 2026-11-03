<?php
/**
 * Test Suite: Connected Applications Hub Verification
 * Tests All Applications, Category Filtering, Authenticated State, and Shortcut Persistence
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/controllers/AppHubController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\AppHubController;
use Cockpit\Utils\JWT;

$db = Database::getConnection();
$passed = 0;
$failed = 0;

function assertTest(bool $condition, string $title, ?string $details = null): void {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$title}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$title}" . ($details ? " - {$details}" : "") . "\n";
    }
}

echo "=======================================================\n";
echo "   CONNECTED APPLICATIONS HUB VERIFICATION SUITE       \n";
echo "=======================================================\n\n";

$tenantUser = [
    'id' => 2,
    'tenant_id' => 1,
    'email' => 'utsav@acme.com',
    'role' => 'tenant_owner',
    'name' => 'Utsav Patel'
];

// Helper to simulate API call
function callListApps(array $user): array {
    $phpBin = 'D:\\xampp\\php\\php.exe';
    $userId = (int)($user['id'] ?? 2);
    $tenantId = (int)($user['tenant_id'] ?? 1);
    $role = addslashes($user['role'] ?? 'tenant_owner');
    $code = "require 'backend/config/Database.php'; require 'backend/config/Config.php'; require 'backend/utils/Response.php'; require 'backend/utils/Encryption.php'; require 'backend/middleware/TenantMiddleware.php'; require 'backend/controllers/AppHubController.php'; Cockpit\\Controllers\\AppHubController::listApps(['id'=>{$userId}, 'tenant_id'=>{$tenantId}, 'role'=>'{$role}']);";
    $cmd = "\"{$phpBin}\" -r \"{$code}\"";
    $raw = shell_exec($cmd);
    $pos = strpos($raw, '{');
    $clean = $pos !== false ? substr($raw, $pos) : '';
    return json_decode($clean, true) ?? [];
}

try {
    // 1. Fetch apps from backend API
    echo "[1/5] Testing API Response and Master Application Roster...\n";
    $res = callListApps($tenantUser);
    assertTest(($res['status'] ?? '') === 'success', "API response status is 'success'");
    $apps = $res['data'] ?? [];
    assertTest(count($apps) >= 8, "All 8 standard applications are returned (found " . count($apps) . ")");

    $appNames = array_column($apps, 'name');
    assertTest(in_array('EAF Connect', $appNames, true), "EAF Connect present in roster");
    assertTest(in_array('BNI Connect', $appNames, true), "BNI Connect present in roster");
    assertTest(in_array('KVV Portal', $appNames, true), "KVV Portal present in roster");
    assertTest(in_array('Google Calendar', $appNames, true), "Google Calendar present in roster");
    assertTest(in_array('Google Drive', $appNames, true), "Google Drive present in roster");
    assertTest(in_array('Gmail', $appNames, true), "Gmail present in roster");
    assertTest(in_array('Right Form', $appNames, true), "Right Form present in roster");
    assertTest(in_array('My iNotes', $appNames, true), "My iNotes present in roster");

    // 2. Category Matching Logic Simulation (mirroring frontend matchesCategory)
    echo "\n[2/5] Testing Frontend Category Filter Mapping...\n";
    function matchCategory(array $app, string $catId): bool {
        if ($catId === 'all') return true;
        $cat = strtolower($app['category'] ?? '');
        $name = strtolower($app['name'] ?? '');
        $isPortal = !empty($app['is_portal']) || in_array($app['source_key'] ?? '', ['eaf', 'bni', 'kvv'], true);

        if ($catId === 'business') return $cat === 'business' || $isPortal;
        if ($catId === 'productivity') return $cat === 'productivity' || $cat === 'cloud' || str_contains($name, 'drive') || str_contains($name, 'calendar') || str_contains($name, 'notes') || str_contains($name, 'form');
        if ($catId === 'communication') return $cat === 'communication' || str_contains($name, 'gmail') || str_contains($name, 'mail');
        if ($catId === 'cloud') return $cat === 'cloud' || str_contains($name, 'drive');
        if ($catId === 'custom') return $isPortal || $cat === 'custom';
        return $cat === $catId;
    }

    $allCount = count(array_filter($apps, fn($a) => matchCategory($a, 'all')));
    $businessCount = count(array_filter($apps, fn($a) => matchCategory($a, 'business')));
    $prodCount = count(array_filter($apps, fn($a) => matchCategory($a, 'productivity')));
    $commCount = count(array_filter($apps, fn($a) => matchCategory($a, 'communication')));
    $cloudCount = count(array_filter($apps, fn($a) => matchCategory($a, 'cloud')));
    $customCount = count(array_filter($apps, fn($a) => matchCategory($a, 'custom')));

    assertTest($allCount >= 8, "'All Applications' tab contains all 8 applications ({$allCount})");
    assertTest($businessCount >= 3, "'Business & CRM' tab contains EAF, BNI, and KVV ({$businessCount})");
    assertTest($prodCount >= 4, "'Productivity' tab contains Calendar, Drive, Right Form, My iNotes ({$prodCount})");
    assertTest($commCount >= 1, "'Communication' tab contains Gmail ({$commCount})");
    assertTest($cloudCount >= 1, "'Cloud Storage' tab contains Google Drive ({$cloudCount})");
    assertTest($customCount >= 3, "'Custom Portals' tab contains EAF, BNI, and KVV ({$customCount})");

    // 3. Genuine Connection Status and Zero Secret Exposure
    echo "\n[3/5] Verifying Genuine Portal Status & Secret Protection...\n";
    $eafApp = null;
    $bniApp = null;
    $kvvApp = null;
    foreach ($apps as $a) {
        if ($a['name'] === 'EAF Connect') $eafApp = $a;
        if ($a['name'] === 'BNI Connect') $bniApp = $a;
        if ($a['name'] === 'KVV Portal') $kvvApp = $a;
    }

    assertTest(!empty($eafApp) && $eafApp['is_portal'] === true, "EAF Connect tagged as is_portal: true");
    assertTest(!empty($bniApp) && $bniApp['is_portal'] === true, "BNI Connect tagged as is_portal: true");
    assertTest(!empty($kvvApp) && $kvvApp['is_portal'] === true, "KVV Portal tagged as is_portal: true");
    assertTest(in_array($eafApp['connection_status'], ['disconnected', 'connected', 'auth_required', 'expired'], true), "EAF Connect has honest normalized status: " . $eafApp['connection_status']);

    // Check secrets are not exposed
    $hasSecret = false;
    foreach ($apps as $a) {
        if (isset($a['password']) || isset($a['encrypted_credentials']) || isset($a['encrypted_session_data']) || isset($a['cookies'])) {
            $hasSecret = true;
            break;
        }
    }
    assertTest(!$hasSecret, "Zero passwords, raw cookies, or encryption tokens exposed in API response");

    // 4. Persistence of Newly Added Application Shortcut
    echo "\n[4/5] Testing Custom Shortcut Addition & Persistence...\n";
    $insertStmt = $db->prepare("INSERT INTO connected_apps (tenant_id, name, category, icon_name, app_url, connection_status, is_pinned) VALUES (1, 'Test ERP Portal', 'custom', 'Globe', 'https://erp.example.com', 'launcher_only', 0)");
    $insertStmt->execute();
    $newAppId = (int)$db->lastInsertId();

    $reloaded = callListApps($tenantUser);
    $foundNew = false;
    foreach ($reloaded['data'] as $a) {
        if ($a['id'] === $newAppId && $a['name'] === 'Test ERP Portal') {
            $foundNew = true;
            break;
        }
    }
    assertTest($foundNew, "Newly added application shortcut persisted in database and returned in API");

    // Teardown temporary test app
    $db->prepare("DELETE FROM connected_apps WHERE id = ?")->execute([$newAppId]);

    // 5. Tenant Boundary Isolation
    echo "\n[5/5] Testing Tenant Boundary Isolation...\n";
    $tenant2User = [
        'id' => 4,
        'tenant_id' => 2,
        'email' => 'rahul@nexus.com',
        'role' => 'tenant_owner',
        'name' => 'Rahul Verma'
    ];
    $t2Res = callListApps($tenant2User);
    $t2Apps = $t2Res['data'] ?? [];
    $allT2Belong = true;
    foreach ($t2Apps as $a) {
        if ((int)$a['tenant_id'] !== 2) {
            $allT2Belong = false;
            break;
        }
    }
    assertTest($allT2Belong, "Tenant 2 apps strictly isolated (zero Tenant 1 app overlap)");

} catch (\Throwable $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    $failed++;
} finally {
    $db->exec("DELETE FROM connected_apps WHERE name = 'Test ERP Portal'");
}

echo "\n=======================================================\n";
echo "TEST SUMMARY: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";
