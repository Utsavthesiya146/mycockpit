<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class AppHubController {
    public static function listApps(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT * FROM connected_apps
            WHERE tenant_id = ?
            ORDER BY is_pinned DESC, name ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function addApp(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $appUrl = trim($input['app_url'] ?? '');

        if (empty($name) || empty($appUrl)) {
            Response::error('Application name and valid URL are required.', 422);
        }

        if (!filter_var($appUrl, FILTER_VALIDATE_URL)) {
            Response::error('Invalid URL format. Include http:// or https://', 422);
        }

        $validStatuses = ['connected', 'launcher_only', 'config_required', 'unsupported'];
        $status = in_array($input['connection_status'] ?? '', $validStatuses, true) 
            ? $input['connection_status'] 
            : 'launcher_only';

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO connected_apps (tenant_id, name, category, icon_name, app_url, connection_status, auth_type, is_pinned, settings_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            $input['category'] ?? 'business',
            $input['icon_name'] ?? 'Globe',
            $appUrl,
            $status,
            $input['auth_type'] ?? 'direct_link',
            !empty($input['is_pinned']) ? 1 : 0,
            !empty($input['settings_json']) ? json_encode($input['settings_json']) : null
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Application shortcut added', 201);
    }

    public static function updateApp(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $appUrl = trim($input['app_url'] ?? '');

        if (empty($name) || empty($appUrl)) {
            Response::error('Application name and URL are required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            UPDATE connected_apps 
            SET name = ?, category = ?, icon_name = ?, app_url = ?, connection_status = ?, is_pinned = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $name,
            $input['category'] ?? 'business',
            $input['icon_name'] ?? 'Globe',
            $appUrl,
            $input['connection_status'] ?? 'launcher_only',
            !empty($input['is_pinned']) ? 1 : 0,
            $id,
            $tenantId
        ]);

        Response::success(null, 'Application updated');
    }

    public static function deleteApp(array $currentUser, int $id): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM connected_apps WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application deleted');
    }

    public static function togglePin(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE connected_apps SET is_pinned = 1 - is_pinned WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        Response::success(null, 'Application pin toggled');
    }
}
