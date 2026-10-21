<?php
declare(strict_types=1);

namespace Cockpit\Middleware;

use Cockpit\Utils\Response;

class TenantMiddleware {
    /**
     * Resolves and enforces the tenant ID strictly based on server-verified session.
     * Never trusts frontend tenant IDs for non-super-admins!
     */
    public static function resolveTenantId(array $user, ?int $requestedTenantId = null): int {
        if ($user['role'] === 'super_admin') {
            if ($requestedTenantId !== null && $requestedTenantId > 0) {
                return (int)$requestedTenantId;
            }
            // If super admin didn't specify, default to first active tenant or 1
            return 1;
        }

        if (empty($user['tenant_id'])) {
            Response::error('User is not associated with any tenant organization.', 403);
        }

        // Strictly enforce tenant isolation: ignore any client-requested tenant_id
        return (int)$user['tenant_id'];
    }

    /**
     * Role-Based Access Control validator
     */
    public static function requireRole(array $user, array $allowedRoles): void {
        if (!in_array($user['role'], $allowedRoles, true)) {
            Response::error('Forbidden: You do not have permission to perform this action.', 403);
        }
    }
}
