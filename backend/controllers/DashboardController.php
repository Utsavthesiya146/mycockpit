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

        // Lead & Followup Filters
        $filterSource = trim($_GET['source'] ?? '');
        $filterAssignedTo = !empty($_GET['assigned_to']) ? (int)$_GET['assigned_to'] : 0;
        $filterStatus = trim($_GET['lead_status'] ?? '');
        $filterDateRange = trim($_GET['date_range'] ?? 'all');
        $filterFollowupStatus = trim($_GET['followup_status'] ?? '');

        // Date filter builder
        $dateCondition = "";
        if ($filterDateRange === 'today') {
            $dateCondition = " AND DATE(created_at) = CURRENT_DATE";
        } elseif ($filterDateRange === 'this_week') {
            $dateCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } elseif ($filterDateRange === 'this_month') {
            $dateCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }

        // 1. Financial KPI
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

        // 2. Centralized Leads Telemetry (with dynamic filters)
        $leadFilterSql = " WHERE tenant_id = ?";
        $leadFilterParams = [$tenantId];

        if (!empty($filterSource) && $filterSource !== 'all') {
            $leadFilterSql .= " AND source = ?";
            $leadFilterParams[] = $filterSource;
        }
        if ($filterAssignedTo > 0) {
            $leadFilterSql .= " AND assigned_to = ?";
            $leadFilterParams[] = $filterAssignedTo;
        }
        if (!empty($filterStatus) && $filterStatus !== 'all') {
            $leadFilterSql .= " AND status = ?";
            $leadFilterParams[] = $filterStatus;
        }
        if (!empty($dateCondition)) {
            $leadFilterSql .= $dateCondition;
        }

        $leadCountsStmt = $db->prepare("
            SELECT 
                COUNT(*) AS total_leads,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_leads,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_leads,
                SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost_leads,
                SUM(CASE WHEN status NOT IN ('won', 'lost') AND next_followup_date IS NULL THEN 1 ELSE 0 END) AS leads_without_followup,
                COALESCE(SUM(value), 0) AS pipeline_value,
                COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) AS won_value
            FROM crm_leads
            {$leadFilterSql}
        ");
        $leadCountsStmt->execute($leadFilterParams);
        $leadStats = $leadCountsStmt->fetch();

        $totalLeads = (int)($leadStats['total_leads'] ?? 0);
        $wonLeads = (int)($leadStats['won_leads'] ?? 0);
        $conversionRate = $totalLeads > 0 ? round(($wonLeads / $totalLeads) * 100, 1) : 0.0;

        // Leads by Source Breakdown
        $sourceBreakdownStmt = $db->prepare("
            SELECT 
                COALESCE(source, 'Direct Referral') AS source,
                COUNT(*) AS count,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_count,
                COALESCE(SUM(value), 0) AS total_value
            FROM crm_leads
            WHERE tenant_id = ?
            GROUP BY source
            ORDER BY count DESC
        ");
        $sourceBreakdownStmt->execute([$tenantId]);
        $sourcesRaw = $sourceBreakdownStmt->fetchAll();

        $leadsBySource = [];
        foreach ($sourcesRaw as $s) {
            $cnt = (int)$s['count'];
            $pct = $totalLeads > 0 ? round(($cnt / $totalLeads) * 100, 1) : 0.0;
            $leadsBySource[] = [
                'source' => $s['source'],
                'count' => $cnt,
                'won_count' => (int)$s['won_count'],
                'total_value' => (float)$s['total_value'],
                'percentage' => $pct
            ];
        }

        // 3. Follow-up Tracking Telemetry
        $followFilterSql = " WHERE tenant_id = ?";
        $followFilterParams = [$tenantId];

        if ($filterAssignedTo > 0) {
            $followFilterSql .= " AND assigned_to = ?";
            $followFilterParams[] = $filterAssignedTo;
        }

        $followKpiStmt = $db->prepare("
            SELECT 
                SUM(CASE WHEN status = 'pending' AND scheduled_at > NOW() THEN 1 ELSE 0 END) AS pending_followups,
                SUM(CASE WHEN status = 'pending' AND DATE(scheduled_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS today_followups,
                SUM(CASE WHEN status = 'pending' AND scheduled_at < NOW() THEN 1 ELSE 0 END) AS overdue_followups,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_followups
            FROM follow_ups
            {$followFilterSql}
        ");
        $followKpiStmt->execute($followFilterParams);
        $followKpis = $followKpiStmt->fetch();

        // 4. Upcoming Actionable Follow-ups
        $upcomingStmt = $db->prepare("
            SELECT f.*, 
                   COALESCE(l.name, c.name, 'Direct Client') AS contact_name,
                   l.company AS contact_company,
                   COALESCE(l.phone, c.phone) AS contact_phone,
                   COALESCE(l.source, 'General') AS source,
                   l.priority AS lead_priority,
                   CASE 
                       WHEN f.status = 'pending' AND f.scheduled_at < NOW() THEN 'overdue'
                       WHEN f.status = 'pending' AND DATE(f.scheduled_at) = CURRENT_DATE THEN 'today'
                       ELSE f.status
                   END AS calculated_status
            FROM follow_ups f
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN crm_customers c ON f.customer_id = c.id
            WHERE f.tenant_id = ? AND f.status = 'pending'
            ORDER BY f.scheduled_at ASC
            LIMIT 6
        ");
        $upcomingStmt->execute([$tenantId]);
        $upcomingFollowups = $upcomingStmt->fetchAll();

        // 5. Recent Lead Activities
        $actStmt = $db->prepare("
            SELECT a.*, l.name AS lead_name, l.company AS lead_company, l.source AS lead_source,
                   COALESCE(u.name, 'Team Member') AS user_name
            FROM lead_activities a
            JOIN crm_leads l ON a.lead_id = l.id
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id = ?
            ORDER BY a.activity_date DESC
            LIMIT 6
        ");
        $actStmt->execute([$tenantId]);
        $recentActivities = $actStmt->fetchAll();

        // 6. HRM Stats
        $hrmStmt = $db->prepare("
            SELECT 
                (SELECT COUNT(*) FROM hrm_employees WHERE tenant_id = ? AND status = 'active') AS active_employees,
                (SELECT COUNT(*) FROM hrm_departments WHERE tenant_id = ?) AS department_count
        ");
        $hrmStmt->execute([$tenantId, $tenantId]);
        $hrm = $hrmStmt->fetch();

        // 7. Today's Meetings
        $meetStmt = $db->prepare("
            SELECT * FROM calendar_events
            WHERE tenant_id = ? AND DATE(start_time) = CURRENT_DATE
            ORDER BY start_time ASC
        ");
        $meetStmt->execute([$tenantId]);
        $todayMeetings = $meetStmt->fetchAll();

        // 8. Priority Tasks
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

        Response::success([
            'financial' => [
                'total_receivable' => (float)$financial['total_receivable'],
                'total_received' => (float)$financial['total_received'],
                'pending_amount' => (float)$financial['pending_amount'],
                'overdue_amount' => (float)$financial['overdue_amount']
            ],
            'crm' => [
                'customer_count' => (int)$db->query("SELECT COUNT(*) FROM crm_customers WHERE tenant_id = {$tenantId}")->fetchColumn(),
                'total_leads' => $totalLeads,
                'new_leads' => (int)($leadStats['new_leads'] ?? 0),
                'won_leads' => $wonLeads,
                'lost_leads' => (int)($leadStats['lost_leads'] ?? 0),
                'leads_without_followup' => (int)($leadStats['leads_without_followup'] ?? 0),
                'pipeline_value' => (float)($leadStats['pipeline_value'] ?? 0),
                'won_value' => (float)($leadStats['won_value'] ?? 0),
                'conversion_rate' => $conversionRate,
                'leads_by_source' => $leadsBySource
            ],
            'followups' => [
                'pending' => (int)($followKpis['pending_followups'] ?? 0),
                'today' => (int)($followKpis['today_followups'] ?? 0),
                'overdue' => (int)($followKpis['overdue_followups'] ?? 0),
                'completed' => (int)($followKpis['completed_followups'] ?? 0)
            ],
            'upcoming_followups' => $upcomingFollowups,
            'recent_activities' => $recentActivities,
            'hrm' => [
                'active_employees' => (int)$hrm['active_employees'],
                'department_count' => (int)$hrm['department_count']
            ],
            'today_meetings' => $todayMeetings,
            'priority_tasks' => $priorityTasks
        ]);
    }
}
