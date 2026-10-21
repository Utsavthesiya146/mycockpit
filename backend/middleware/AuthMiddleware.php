<?php
declare(strict_types=1);

namespace Cockpit\Middleware;

use Cockpit\Config\Database;
use Cockpit\Utils\JWT;
use Cockpit\Utils\Response;
use PDO;

class AuthMiddleware {
    public static function authenticate(): array {
        $token = self::getBearerToken();
        if (!$token) {
            Response::error('Authentication required. Missing authorization token.', 401);
        }

        $payload = JWT::decode($token);
        if (!$payload || !isset($payload['user_id'])) {
            Response::error('Invalid or expired authentication token.', 401);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.status, u.phone,
                   t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            WHERE u.id = ? AND u.status = 'active'
        ");
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Account inactive or not found.', 401);
        }

        // If user belongs to a tenant, ensure the tenant is active
        if ($user['role'] !== 'super_admin' && $user['tenant_status'] !== 'active') {
            Response::error('Tenant workspace is suspended or inactive.', 403);
        }

        return $user;
    }

    private static function getBearerToken(): ?string {
        $headers = [];
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
        }
        
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        
        if (!$authHeader && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }

        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }
}
