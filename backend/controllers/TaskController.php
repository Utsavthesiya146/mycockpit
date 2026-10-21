<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class TaskController {
    public static function listTasks(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT t.*, u.name AS assigned_user_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.tenant_id = ?
            ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                t.due_date ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createTask(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = trim($input['title'] ?? '');
        if (empty($title)) {
            Response::error('Task title is required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO tasks (tenant_id, title, description, assigned_to, priority, status, due_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $title,
            trim($input['description'] ?? ''),
            !empty($input['assigned_to']) ? (int)$input['assigned_to'] : null,
            $input['priority'] ?? 'medium',
            $input['status'] ?? 'pending',
            $input['due_date'] ?? null,
            $currentUser['id']
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Task created successfully', 201);
    }

    public static function updateStatus(array $currentUser, int $taskId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? 'pending';

        $valid = ['pending', 'in_progress', 'completed', 'cancelled'];
        if (!in_array($status, $valid, true)) {
            Response::error('Invalid task status.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$status, $taskId, $tenantId]);

        Response::success(null, 'Task status updated');
    }
}
