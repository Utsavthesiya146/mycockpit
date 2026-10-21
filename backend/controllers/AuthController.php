<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Config\Config;
use Cockpit\Utils\JWT;
use Cockpit\Utils\Response;
use PDO;

class AuthController {
    public static function login(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');

        if (empty($email) || empty($password)) {
            Response::error('Email and password are required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT u.*, t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            WHERE u.email = ?
        ");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('Invalid email or password.', 401);
        }

        if ($user['status'] !== 'active') {
            Response::error('Your account has been deactivated. Please contact support.', 403);
        }

        if ($user['role'] !== 'super_admin' && $user['tenant_status'] !== 'active') {
            Response::error('Your organization workspace is suspended or inactive.', 403);
        }

        $tokenPayload = [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'tenant_id' => $user['tenant_id'],
            'tenant_slug' => $user['tenant_slug']
        ];

        $token = JWT::encode($tokenPayload);

        // Record audit log
        $auditStmt = $db->prepare("INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, 'login', 'user', ?, ?)");
        $auditStmt->execute([$user['tenant_id'], $user['id'], $user['id'], $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

        Response::success([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'tenant_id' => $user['tenant_id'] ? (int)$user['tenant_id'] : null,
                'tenant_slug' => $user['tenant_slug'],
                'tenant_name' => $user['tenant_name'],
                'phone' => $user['phone']
            ]
        ], 'Login successful');
    }

    public static function register(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $name = trim($input['name'] ?? '');
        $companyName = trim($input['company_name'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9_-]/', '', $input['slug'] ?? '')));

        if (empty($name) || empty($companyName) || empty($email) || empty($password) || empty($slug)) {
            Response::error('All fields (name, company name, email, password, slug) are required.', 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email format.', 422);
        }

        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters.', 422);
        }

        // Check reserved routes
        $reserved = Config::get('reserved_routes', []);
        if (in_array($slug, $reserved, true)) {
            Response::error("The client slug '{$slug}' is a reserved system path. Please choose another.", 422);
        }

        $db = Database::getConnection();
        
        // Check email uniqueness
        $emailCheck = $db->prepare("SELECT id FROM users WHERE email = ?");
        $emailCheck->execute([$email]);
        if ($emailCheck->fetch()) {
            Response::error('An account with this email address already exists.', 409);
        }

        // Check slug uniqueness
        $slugCheck = $db->prepare("SELECT id FROM tenants WHERE slug = ?");
        $slugCheck->execute([$slug]);
        if ($slugCheck->fetch()) {
            Response::error("The workspace URL '{$slug}' is already taken. Please choose another.", 409);
        }

        $db->beginTransaction();
        try {
            // 1. Create Tenant
            $tenantStmt = $db->prepare("
                INSERT INTO tenants (slug, name, status, plan, created_at)
                VALUES (?, ?, 'active', 'pro', NOW())
            ");
            $tenantStmt->execute([$slug, $companyName]);
            $tenantId = (int)$db->lastInsertId();

            // 2. Create Tenant Owner User
            $passwordHash = password_hash($password, PASSWORD_BCRYPT);
            $userStmt = $db->prepare("
                INSERT INTO users (tenant_id, name, email, password_hash, role, status, created_at)
                VALUES (?, ?, ?, ?, 'tenant_owner', 'active', NOW())
            ");
            $userStmt->execute([$tenantId, $name, $email, $passwordHash]);
            $userId = (int)$db->lastInsertId();

            // 3. Create default department
            $deptStmt = $db->prepare("INSERT INTO hrm_departments (tenant_id, name, description) VALUES (?, 'General', 'Primary Department')");
            $deptStmt->execute([$tenantId]);

            // 4. Create default connected apps shortcuts
            $appStmt = $db->prepare("
                INSERT INTO connected_apps (tenant_id, name, category, icon_name, app_url, connection_status, auth_type, is_pinned)
                VALUES 
                (?, 'Google Calendar', 'productivity', 'Calendar', 'https://calendar.google.com', 'launcher_only', 'direct_link', 1),
                (?, 'Gmail', 'communication', 'Mail', 'https://mail.google.com', 'launcher_only', 'direct_link', 1),
                (?, 'Google Drive', 'cloud', 'HardDrive', 'https://drive.google.com', 'launcher_only', 'direct_link', 1),
                (?, 'BNI Connect', 'business', 'Users', 'https://www.bniconnectglobal.com', 'launcher_only', 'direct_link', 1)
            ");
            $appStmt->execute([$tenantId, $tenantId, $tenantId, $tenantId]);

            $db->commit();

            $token = JWT::encode([
                'user_id' => $userId,
                'email' => $email,
                'role' => 'tenant_owner',
                'tenant_id' => $tenantId,
                'tenant_slug' => $slug
            ]);

            Response::success([
                'token' => $token,
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'email' => $email,
                    'role' => 'tenant_owner',
                    'tenant_id' => $tenantId,
                    'tenant_slug' => $slug,
                    'tenant_name' => $companyName
                ]
            ], 'Workspace registered successfully', 201);
        } catch (\Exception $e) {
            $db->rollBack();
            Response::error('Failed to create workspace: ' . $e->getMessage(), 500);
        }
    }

    public static function me(array $currentUser): void {
        Response::success([
            'user' => $currentUser
        ]);
    }
}
