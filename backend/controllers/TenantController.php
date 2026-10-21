<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class TenantController {
    /**
     * Public lookup by slug for personal client URL routing (e.g. /utsav, /rahul)
     */
    public static function getBySlug(string $slug): void {
        $cleanSlug = strtolower(trim(preg_replace('/[^a-zA-Z0-9_-]/', '', $slug)));
        
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT id, slug, name, status, plan, branding_config, created_at
            FROM tenants
            WHERE slug = ?
        ");
        $stmt->execute([$cleanSlug]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            Response::error('Tenant workspace not found.', 404);
        }

        if ($tenant['status'] !== 'active') {
            Response::error('This organization workspace is currently inactive or suspended.', 403);
        }

        Response::success($tenant, 'Tenant details retrieved');
    }

    /**
     * Super Admin: List all tenants with business stats
     */
    public static function listTenants(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin']);

        $db = Database::getConnection();
        $query = "
            SELECT t.*,
                   (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
                   (SELECT COUNT(*) FROM crm_customers c WHERE c.tenant_id = t.id) AS customer_count,
                   (SELECT COALESCE(SUM(total_amount), 0) FROM invoices i WHERE i.tenant_id = t.id) AS total_invoiced,
                   (SELECT COALESCE(SUM(paid_amount), 0) FROM invoices i WHERE i.tenant_id = t.id) AS total_collected
            FROM tenants t
            ORDER BY t.created_at DESC
        ";
        $stmt = $db->query($query);
        $tenants = $stmt->fetchAll();

        Response::success($tenants);
    }

    /**
     * Super Admin: Update tenant status (activate / deactivate / suspend)
     */
    public static function updateStatus(array $currentUser, int $tenantId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin']);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? '';

        if (!in_array($status, ['active', 'inactive', 'suspended'], true)) {
            Response::error('Invalid status value. Choose active, inactive, or suspended.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE tenants SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$status, $tenantId]);

        Response::success(null, "Tenant status updated to {$status}");
    }

    /**
     * Tenant Team Management: List users inside the active tenant
     */
    public static function listTeamMembers(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT id, name, email, role, status, phone, created_at
            FROM users
            WHERE tenant_id = ?
            ORDER BY created_at ASC
        ");
        $stmt->execute([$tenantId]);
        $members = $stmt->fetchAll();

        Response::success($members);
    }

    /**
     * Add new user/employee to tenant
     */
    public static function addTeamMember(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = (string)($input['password'] ?? 'TempPass123!');
        $role = $input['role'] ?? 'employee';

        if (empty($name) || empty($email)) {
            Response::error('Name and email are required.', 422);
        }

        if (!in_array($role, ['tenant_admin', 'employee', 'read_only'], true)) {
            Response::error('Invalid tenant role selected.', 422);
        }

        $db = Database::getConnection();
        
        $check = $db->prepare("SELECT id FROM users WHERE email = ?");
        $check->execute([$email]);
        if ($check->fetch()) {
            Response::error('A user with this email address already exists.', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare("
            INSERT INTO users (tenant_id, name, email, password_hash, role, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'active', NOW())
        ");
        $stmt->execute([$tenantId, $name, $email, $passwordHash, $role]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Team member added successfully', 201);
    }
}
