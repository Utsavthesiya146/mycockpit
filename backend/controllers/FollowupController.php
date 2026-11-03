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

        $leadId = !empty($_GET['lead_id']) ? (int)$_GET['lead_id'] : 0;
        $status = trim($_GET['status'] ?? '');
        $assignedTo = !empty($_GET['assigned_to']) ? (int)$_GET['assigned_to'] : 0;
        $method = trim($_GET['contact_method'] ?? '');

        $sql = "
            SELECT f.*, 
                   c.name AS customer_name,
                   c.phone AS customer_phone,
                   l.name AS lead_name,
                   l.company AS lead_company,
                   l.phone AS lead_phone,
                   l.email AS lead_email,
                   l.source AS lead_source,
                   l.priority AS lead_priority,
                   COALESCE(u.name, CONCAT(e.first_name, ' ', e.last_name), 'Unassigned') AS assigned_user_name,
                   CASE 
                       WHEN f.status = 'completed' THEN 'completed'
                       WHEN f.status = 'pending' AND f.scheduled_at < NOW() THEN 'overdue'
                       WHEN f.status = 'pending' AND DATE(f.scheduled_at) = CURRENT_DATE THEN 'today'
                       ELSE f.status
                   END AS calculated_status
            FROM follow_ups f
            LEFT JOIN crm_customers c ON f.customer_id = c.id
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN users u ON f.assigned_to = u.id
            LEFT JOIN hrm_employees e ON f.assigned_to = e.id
            WHERE f.tenant_id = ?
        ";

        $params = [$tenantId];

        if ($leadId > 0) {
            $sql .= " AND f.lead_id = ?";
            $params[] = $leadId;
        }

        if (!empty($status) && $status !== 'all') {
            if ($status === 'overdue') {
                $sql .= " AND f.status = 'pending' AND f.scheduled_at < NOW()";
            } elseif ($status === 'today') {
                $sql .= " AND f.status = 'pending' AND DATE(f.scheduled_at) = CURRENT_DATE";
            } else {
                $sql .= " AND f.status = ?";
                $params[] = $status;
            }
        }

        if ($assignedTo > 0) {
            $sql .= " AND f.assigned_to = ?";
            $params[] = $assignedTo;
        }

        if (!empty($method) && $method !== 'all') {
            $sql .= " AND f.contact_method = ?";
            $params[] = $method;
        }

        $sql .= " ORDER BY f.scheduled_at ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public static function createFollowup(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = trim($input['title'] ?? '');
        $scheduledAt = $input['scheduled_at'] ?? '';
        $leadId = !empty($input['lead_id']) ? (int)$input['lead_id'] : null;
        $customerId = !empty($input['customer_id']) ? (int)$input['customer_id'] : null;
        $contactMethod = $input['contact_method'] ?? 'call';
        $assignedTo = !empty($input['assigned_to']) ? (int)$input['assigned_to'] : $currentUser['id'];
        $notes = trim($input['notes'] ?? '');
        $reminderTime = !empty($input['reminder_time']) ? $input['reminder_time'] : null;

        if (empty($title) || empty($scheduledAt)) {
            Response::error('Follow-up title and scheduled date/time are required.', 422);
        }

        $validMethods = ['call', 'email', 'meeting', 'whatsapp', 'other'];
        if (!in_array($contactMethod, $validMethods, true)) {
            $contactMethod = 'call';
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO follow_ups (tenant_id, customer_id, lead_id, assigned_to, title, contact_method, notes, scheduled_at, status, reminder_time, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $customerId,
            $leadId,
            $assignedTo,
            $title,
            $contactMethod,
            $notes,
            $scheduledAt,
            $reminderTime,
            $currentUser['id']
        ]);

        $newId = (int)$db->lastInsertId();

        // If associated with lead, update lead's next_followup_date
        if ($leadId) {
            $upStmt = $db->prepare("UPDATE crm_leads SET next_followup_date = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
            $upStmt->execute([$scheduledAt, $leadId, $tenantId]);

            // Log activity
            $actStmt = $db->prepare("
                INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
                VALUES (?, ?, ?, 'system', 'Follow-up Scheduled', ?, NOW())
            ");
            $actStmt->execute([
                $tenantId,
                $leadId,
                $currentUser['id'],
                "Scheduled [{$contactMethod}] '{$title}' for " . date('d M Y, h:i A', strtotime($scheduledAt))
            ]);
        }

        Response::success(['id' => $newId], 'Follow-up scheduled successfully', 201);
    }

    public static function completeFollowup(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $outcome = trim($input['outcome'] ?? 'Completed follow-up action');
        $notes = trim($input['notes'] ?? '');
        $nextScheduledAt = !empty($input['next_scheduled_at']) ? $input['next_scheduled_at'] : null;
        $nextTitle = trim($input['next_title'] ?? '');
        $nextMethod = $input['next_method'] ?? 'call';

        $db = Database::getConnection();

        // Fetch follow-up
        $stmt = $db->prepare("SELECT * FROM follow_ups WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);
        $f = $stmt->fetch();

        if (!$f) {
            Response::error('Follow-up record not found.', 404);
        }

        // Mark as completed
        $upStmt = $db->prepare("
            UPDATE follow_ups 
            SET status = 'completed', outcome = ?, completed_at = NOW(), updated_at = NOW() 
            WHERE id = ? AND tenant_id = ?
        ");
        $upStmt->execute([$outcome, $id, $tenantId]);

        // If linked to lead, update last_contact_date
        if (!empty($f['lead_id'])) {
            $leadId = (int)$f['lead_id'];
            $db->prepare("UPDATE crm_leads SET last_contact_date = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?")
               ->execute([$leadId, $tenantId]);

            // Log activity in timeline
            $actStmt = $db->prepare("
                INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            ");
            $type = in_array($f['contact_method'], ['call', 'email', 'meeting', 'whatsapp']) ? $f['contact_method'] : 'note';
            $actStmt->execute([
                $tenantId,
                $leadId,
                $currentUser['id'],
                $type,
                "Follow-up Completed: {$f['title']}",
                "Outcome: {$outcome}" . (!empty($notes) ? "\nNotes: {$notes}" : "")
            ]);

            // If user scheduled a next follow-up immediately
            if (!empty($nextScheduledAt)) {
                $fTitle = !empty($nextTitle) ? $nextTitle : "Next Step after {$f['title']}";
                $newFStmt = $db->prepare("
                    INSERT INTO follow_ups (tenant_id, lead_id, assigned_to, title, contact_method, notes, scheduled_at, status, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                ");
                $newFStmt->execute([
                    $tenantId,
                    $leadId,
                    $currentUser['id'],
                    $fTitle,
                    $nextMethod,
                    $notes,
                    $nextScheduledAt,
                    $currentUser['id']
                ]);

                $db->prepare("UPDATE crm_leads SET next_followup_date = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                   ->execute([$nextScheduledAt, $leadId, $tenantId]);
            } else {
                // Clear next_followup_date if no more pending followups exist
                $chkNext = $db->prepare("SELECT scheduled_at FROM follow_ups WHERE lead_id = ? AND status = 'pending' ORDER BY scheduled_at ASC LIMIT 1");
                $chkNext->execute([$leadId]);
                $nextPending = $chkNext->fetchColumn();

                $db->prepare("UPDATE crm_leads SET next_followup_date = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                   ->execute([$nextPending ?: null, $leadId, $tenantId]);
            }
        }

        Response::success(null, 'Follow-up marked as completed');
    }

    public static function toggleStatus(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? 'completed';

        $db = Database::getConnection();
        $stmt = $db->prepare("
            UPDATE follow_ups 
            SET status = ?, 
                completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END, 
                updated_at = NOW() 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$status, $status, $id, $tenantId]);

        Response::success(null, 'Follow-up updated');
    }
}
