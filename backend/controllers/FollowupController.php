<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class FollowupController {
    public static function listFollowups(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT f.*, 
                   c.name AS customer_name,
                   l.name AS lead_name,
                   CASE 
                       WHEN f.status = 'pending' AND f.scheduled_at < NOW() THEN 'overdue'
                       ELSE f.status
                   END AS calculated_status
            FROM follow_ups f
            LEFT JOIN crm_customers c ON f.customer_id = c.id
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            WHERE f.tenant_id = ?
            ORDER BY f.scheduled_at ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createFollowup(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = trim($input['title'] ?? '');
        $scheduledAt = $input['scheduled_at'] ?? '';

        if (empty($title) || empty($scheduledAt)) {
            Response::error('Follow-up title and scheduled date/time are required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO follow_ups (tenant_id, customer_id, lead_id, title, notes, scheduled_at, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        ");
        $stmt->execute([
            $tenantId,
            !empty($input['customer_id']) ? (int)$input['customer_id'] : null,
            !empty($input['lead_id']) ? (int)$input['lead_id'] : null,
            $title,
            trim($input['notes'] ?? ''),
            $scheduledAt,
            $currentUser['id']
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Follow-up created successfully', 201);
    }

    public static function toggleStatus(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? 'completed';

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE follow_ups SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$status, $id, $tenantId]);

        Response::success(null, 'Follow-up updated');
    }
}
