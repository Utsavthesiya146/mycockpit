<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class DashboardController {
    public static function getStats(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        // Financial
        $finStmt = $db->prepare("
            SELECT 
                COALESCE(SUM(total_amount), 0) AS total_receivable,
                COALESCE(SUM(paid_amount), 0) AS total_received,
                COALESCE(SUM(outstanding_amount), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN outstanding_amount ELSE 0 END), 0) AS overdue_amount
            FROM invoices
            WHERE tenant_id = ? AND status != 'cancelled'
        ");
        $finStmt->execute([$tenantId]);
        $financial = $finStmt->fetch();

        // CRM Stats
        $crmStmt = $db->prepare("
            SELECT 
                (SELECT COUNT(*) FROM crm_customers WHERE tenant_id = ?) AS customer_count,
                (SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ?) AS lead_count,
                (SELECT COALESCE(SUM(value), 0) FROM crm_leads WHERE tenant_id = ? AND status IN ('new', 'contacted', 'qualified', 'proposal')) AS pipeline_value
        ");
        $crmStmt->execute([$tenantId, $tenantId, $tenantId]);
        $crm = $crmStmt->fetch();

        // HRM Stats
        $hrmStmt = $db->prepare("
            SELECT 
                (SELECT COUNT(*) FROM hrm_employees WHERE tenant_id = ? AND status = 'active') AS active_employees,
                (SELECT COUNT(*) FROM hrm_departments WHERE tenant_id = ?) AS department_count
        ");
        $hrmStmt->execute([$tenantId, $tenantId]);
        $hrm = $hrmStmt->fetch();

        // Today's Meetings
        $meetStmt = $db->prepare("
            SELECT * FROM calendar_events
            WHERE tenant_id = ? AND DATE(start_time) = CURRENT_DATE
            ORDER BY start_time ASC
        ");
        $meetStmt->execute([$tenantId]);
        $todayMeetings = $meetStmt->fetchAll();

        // Priority Tasks
        $taskStmt = $db->prepare("
            SELECT * FROM tasks
            WHERE tenant_id = ? AND status IN ('pending', 'in_progress')
            ORDER BY 
                CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                due_date ASC
            LIMIT 5
        ");
        $taskStmt->execute([$tenantId]);
        $priorityTasks = $taskStmt->fetchAll();

        // Follow-ups
        $followStmt = $db->prepare("
            SELECT f.*, c.name AS customer_name 
            FROM follow_ups f
            LEFT JOIN crm_customers c ON f.customer_id = c.id
            WHERE f.tenant_id = ? AND f.status = 'pending'
            ORDER BY f.scheduled_at ASC
            LIMIT 5
        ");
        $followStmt->execute([$tenantId]);
        $pendingFollowups = $followStmt->fetchAll();

        Response::success([
            'financial' => [
                'total_receivable' => (float)$financial['total_receivable'],
                'total_received' => (float)$financial['total_received'],
                'pending_amount' => (float)$financial['pending_amount'],
                'overdue_amount' => (float)$financial['overdue_amount']
            ],
            'crm' => [
                'customer_count' => (int)$crm['customer_count'],
                'lead_count' => (int)$crm['lead_count'],
                'pipeline_value' => (float)$crm['pipeline_value']
            ],
            'hrm' => [
                'active_employees' => (int)$hrm['active_employees'],
                'department_count' => (int)$hrm['department_count']
            ],
            'today_meetings' => $todayMeetings,
            'priority_tasks' => $priorityTasks,
            'pending_followups' => $pendingFollowups
        ]);
    }
}
