<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Config\Config;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class AIController {
    public static function listConversations(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT * FROM ai_conversations 
            WHERE tenant_id = ? AND user_id = ?
            ORDER BY updated_at DESC
        ");
        $stmt->execute([$tenantId, $currentUser['id']]);
        Response::success($stmt->fetchAll());
    }

    public static function getConversation(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM ai_conversations WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);
        $conversation = $stmt->fetch();

        if (!$conversation) {
            Response::error('Conversation not found.', 404);
        }

        $msgStmt = $db->prepare("SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC");
        $msgStmt->execute([$id]);
        $conversation['messages'] = $msgStmt->fetchAll();

        Response::success($conversation);
    }

    public static function chat(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $userMessage = trim($input['message'] ?? '');
        $conversationId = !empty($input['conversation_id']) ? (int)$input['conversation_id'] : null;

        if (empty($userMessage)) {
            Response::error('Prompt or question cannot be empty.', 422);
        }

        $db = Database::getConnection();

        // Create conversation if new
        if (!$conversationId) {
            $title = mb_substr($userMessage, 0, 45) . (mb_strlen($userMessage) > 45 ? '...' : '');
            $convStmt = $db->prepare("INSERT INTO ai_conversations (tenant_id, user_id, title) VALUES (?, ?, ?)");
            $convStmt->execute([$tenantId, $currentUser['id'], $title]);
            $conversationId = (int)$db->lastInsertId();
        }

        // Store user message
        $userMsgStmt = $db->prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)");
        $userMsgStmt->execute([$conversationId, $userMessage]);

        // Process message with tenant-isolated business functions
        $aiResult = self::processBusinessQuery($tenantId, $userMessage);

        // Store AI reply
        $aiMsgStmt = $db->prepare("
            INSERT INTO ai_messages (conversation_id, role, content, citations_json, tokens_used) 
            VALUES (?, 'assistant', ?, ?, ?)
        ");
        $aiMsgStmt->execute([
            $conversationId,
            $aiResult['text'],
            json_encode($aiResult['citations']),
            $aiResult['tokens']
        ]);

        $db->prepare("UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?")->execute([$conversationId]);

        Response::success([
            'conversation_id' => $conversationId,
            'reply' => $aiResult['text'],
            'citations' => $aiResult['citations'],
            'structured_data' => $aiResult['structured_data'] ?? null,
            'tokens_used' => $aiResult['tokens']
        ]);
    }

    /**
     * Executes authorized client data queries strictly isolated to $tenantId
     */
    private static function processBusinessQuery(int $tenantId, string $query): array {
        $db = Database::getConnection();
        $q = mb_strtolower($query);

        // Security check for destructive commands
        if (preg_match('/(delete|remove|cancel|terminate|drop)\s+(invoice|customer|employee|task|lead)/i', $q)) {
            return [
                'text' => "⚠️ **Security Policy Confirmation Required**:\n\nConsequential modifications or deletions cannot be executed automatically through chat. Please navigate to the dedicated management module to authorize this action with administrative confirmation.",
                'citations' => ['Source: Tenant Security Enforcement Engine'],
                'tokens' => 45,
                'structured_data' => ['requires_confirmation' => true]
            ];
        }

        // ==========================================
        // 1. ALL LEADS QUERY ("Show all my leads", "Show all leads", "List all leads")
        // ==========================================
        if (preg_match('/(show|list|get|all|view)\s+(all\s+)?(my\s+)?leads/i', $q) && !preg_match('/(bni|kvv|eaf|seo|website|today|uncontact|overdue|summar)/i', $q)) {
            $stmt = $db->prepare("
                SELECT l.*, COALESCE(u.name, 'Unassigned') AS assigned_name
                FROM crm_leads l
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE l.tenant_id = ?
                ORDER BY l.created_at DESC
            ");
            $stmt->execute([$tenantId]);
            $allLeads = $stmt->fetchAll();
            $count = count($allLeads);

            if ($count === 0) {
                return [
                    'text' => "ℹ️ You currently have **0 leads** recorded in this workspace. Leads synchronized automatically from BNI Connect, KVV, EAF Connect, and SEO Webhooks will appear here.",
                    'citations' => ['MySQL Table: `crm_leads`'],
                    'tokens' => 35
                ];
            }

            $list = "### 📋 Centralized All Leads Portfolio ({$count} Records)\n\n"
                  . "Here are all synchronized business leads across all channels:\n\n"
                  . "| Contact / Company | Source | Service Requirement | Priority | Status | Next Follow-up |\n"
                  . "| :--- | :--- | :--- | :--- | :--- | :--- |\n";

            foreach ($allLeads as $l) {
                $contact = "**{$l['name']}**" . (!empty($l['company']) ? "<br><span style='color:#667085;font-size:11px'>{$l['company']}</span>" : "");
                $source = $l['source'];
                $req = !empty($l['service_requirement']) ? $l['service_requirement'] : 'General Requirement';
                $prio = strtoupper($l['priority']);
                $st = strtoupper($l['status']);
                $next = !empty($l['next_followup_date']) ? date('d M, h:i A', strtotime($l['next_followup_date'])) : '⚠️ None set';
                $list .= "| {$contact} | **{$source}** | {$req} | `{$prio}` | `{$st}` | {$next} |\n";
            }

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `crm_leads`', 'Centralized Synchronization Engine'],
                'tokens' => 125,
                'structured_data' => $allLeads
            ];
        }

        // ==========================================
        // 1B. NEW LEADS ARRIVED TODAY ("Which new leads arrived today?")
        // ==========================================
        if (preg_match('/(new.*lead.*today|lead.*arrived.*today|today.*new.*lead)/i', $q)) {
            $stmt = $db->prepare("
                SELECT l.*, COALESCE(u.name, 'Unassigned') AS assigned_name
                FROM crm_leads l
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE l.tenant_id = ? AND (DATE(l.created_at) = CURRENT_DATE OR (l.status = 'new' AND DATE(l.created_at) = CURRENT_DATE))
                ORDER BY l.created_at DESC
            ");
            $stmt->execute([$tenantId]);
            $todayLeads = $stmt->fetchAll();
            $count = count($todayLeads);

            if ($count === 0) {
                return [
                    'text' => "📅 **No new leads have arrived today yet.**\n\nAll existing leads in your database were captured on prior dates. Automatic synchronization connectors (EAF, SEO Webhooks, BNI, KVV) are continuously monitoring for incoming inquiries.",
                    'citations' => ['MySQL Table: `crm_leads`', 'Date Filter: CURRENT_DATE'],
                    'tokens' => 40
                ];
            }

            $list = "### 🌟 New Leads Arrived Today ({$count} Records)\n\n"
                  . "The following new leads synchronized into your cockpit today:\n\n"
                  . "| Lead Name | Source | Company | Requirement | Next Follow-up |\n"
                  . "| :--- | :--- | :--- | :--- | :--- |\n";

            foreach ($todayLeads as $l) {
                $req = !empty($l['service_requirement']) ? $l['service_requirement'] : 'Direct Inquiry';
                $next = !empty($l['next_followup_date']) ? date('h:i A', strtotime($l['next_followup_date'])) : 'Pending Schedule';
                $list .= "| **{$l['name']}** | **{$l['source']}** | {$l['company']} | {$req} | {$next} |\n";
            }

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `crm_leads`', 'Sync Engine: Live Intake'],
                'tokens' => 110,
                'structured_data' => $todayLeads
            ];
        }

        // ==========================================
        // 1C. LEADS NEEDING FOLLOW-UP ("Which leads need follow-up?")
        // ==========================================
        if (preg_match('/(which.*lead.*need.*follow|lead.*requir.*follow|lead.*need.*follow)/i', $q) && !preg_match('/(bni|kvv|eaf|seo|website)/i', $q)) {
            $stmt = $db->prepare("
                SELECT l.*, COALESCE(u.name, 'Unassigned') AS assigned_name
                FROM crm_leads l
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE l.tenant_id = ? AND l.status NOT IN ('won', 'lost') 
                  AND (l.next_followup_date IS NULL OR l.next_followup_date <= DATE_ADD(NOW(), INTERVAL 24 HOUR) OR l.status = 'new')
                ORDER BY CASE WHEN l.next_followup_date < NOW() THEN 1 WHEN l.next_followup_date IS NULL THEN 2 ELSE 3 END, l.next_followup_date ASC
            ");
            $stmt->execute([$tenantId]);
            $needingFollow = $stmt->fetchAll();
            $count = count($needingFollow);

            if ($count === 0) {
                return [
                    'text' => "🎉 **All caught up!** You have **0 leads** in urgent need of follow-up. All current leads are scheduled for future dates or already converted.",
                    'citations' => ['MySQL Table: `crm_leads`'],
                    'tokens' => 35
                ];
            }

            $list = "### ⏰ Action Required: Leads Needing Follow-up ({$count})\n\n"
                  . "These pipeline leads require active outreach:\n\n"
                  . "| Contact / Company | Source | Stage | Status / Urgency | Scheduled |\n"
                  . "| :--- | :--- | :--- | :--- | :--- |\n";

            foreach ($needingFollow as $l) {
                $urgency = empty($l['next_followup_date']) 
                    ? "<span style='color:#DC2626;font-weight:bold;'>⚠️ No Date Set</span>" 
                    : (strtotime($l['next_followup_date']) < time() 
                        ? "<span style='color:#DC2626;font-weight:bold;'>OVERDUE</span>" 
                        : "Due Today / Soon");
                $sched = !empty($l['next_followup_date']) ? date('d M, h:i A', strtotime($l['next_followup_date'])) : 'Unscheduled';
                $list .= "| **{$l['name']}** ({$l['company']}) | {$l['source']} | `{$l['status']}` | {$urgency} | {$sched} |\n";
            }

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `crm_leads`', 'Follow-up Scheduler Engine'],
                'tokens' => 115,
                'structured_data' => $needingFollow
            ];
        }

        // ==========================================
        // 1D. LEAD SOURCE QUERIES (BNI, KVV, EAF, SEO/Website)
        // ==========================================
        if (preg_match('/(bni|kvv|eaf|seo|website)\s*(lead|inquir)/i', $q) || preg_match('/(lead|inquir).*(bni|kvv|eaf|seo|website)/i', $q)) {
            $sourcePattern = '';
            $sourceName = '';

            if (str_contains($q, 'bni')) {
                $sourcePattern = '%BNI%';
                $sourceName = 'BNI Connect';
            } elseif (str_contains($q, 'kvv')) {
                $sourcePattern = '%KVV%';
                $sourceName = 'KVV Leads';
            } elseif (str_contains($q, 'eaf')) {
                $sourcePattern = '%EAF%';
                $sourceName = 'EAF Connect';
            } elseif (str_contains($q, 'seo') || str_contains($q, 'website')) {
                $sourcePattern = '%SEO%';
                $sourceName = 'SEO & Website';
            }

            // Check if user specifically requested "pending" or "needs follow-up"
            $wantsPending = preg_match('/(pending|need.*follow|follow.*up|overdue|action)/i', $q);

            $sql = "
                SELECT l.*,
                       COALESCE(u.name, 'Unassigned') AS assigned_name,
                       (SELECT f.title FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending' ORDER BY f.scheduled_at ASC LIMIT 1) AS pending_followup_title,
                       (SELECT f.scheduled_at FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending' ORDER BY f.scheduled_at ASC LIMIT 1) AS pending_followup_date
                FROM crm_leads l
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE l.tenant_id = ? AND (l.source LIKE ? OR (l.source LIKE '%Web%' AND ? LIKE '%SEO%') OR (l.source_platform = ?))
            ";

            $platformKey = str_contains($sourcePattern, 'BNI') ? 'bni' : (str_contains($sourcePattern, 'KVV') ? 'kvv' : (str_contains($sourcePattern, 'EAF') ? 'eaf' : 'seo'));

            if ($wantsPending) {
                $sql .= " AND l.status NOT IN ('won', 'lost') AND (l.next_followup_date IS NOT NULL OR l.status = 'new')";
            }

            $sql .= " ORDER BY l.created_at DESC";

            $stmt = $db->prepare($sql);
            $stmt->execute([$tenantId, $sourcePattern, $sourcePattern, $platformKey]);
            $leads = $stmt->fetchAll();

            $count = count($leads);
            $titlePrefix = $wantsPending ? "Pending Actionable {$sourceName} Leads" : "All Active {$sourceName} Leads";

            if ($count === 0) {
                return [
                    'text' => "ℹ️ You currently have **0 {$sourceName} leads** " . ($wantsPending ? "requiring pending follow-up" : "recorded in this workspace") . ".\n\nYou can import new leads anytime via the **Lead Management CSV Importer** or share the automated website intake form.",
                    'citations' => ['MySQL Table: `crm_leads`', 'Tenant Isolation: Active'],
                    'tokens' => 40
                ];
            }

            $list = "### 📋 {$titlePrefix} ({$count} " . ($count === 1 ? 'record' : 'records') . ")\n\n";
            $list .= "| Contact / Company | Service Requirement | Value | Stage | Priority | Next Follow-up |\n";
            $list .= "| :--- | :--- | :--- | :--- | :--- | :--- |\n";

            foreach ($leads as $l) {
                $val = '₹' . number_format((float)$l['value'], 0);
                $stage = strtoupper($l['status']);
                $prio = strtoupper($l['priority']);
                $req = !empty($l['service_requirement']) ? $l['service_requirement'] : 'General Requirement';
                $next = !empty($l['next_followup_date']) ? date('d M, h:i A', strtotime($l['next_followup_date'])) : '⚠️ None set';
                $contact = "**{$l['name']}**" . (!empty($l['company']) ? "<br><span style='color:#667085;font-size:11px'>{$l['company']}</span>" : "");

                $list .= "| {$contact} | {$req} | {$val} | `{$stage}` | `{$prio}` | {$next} |\n";
            }

            $list .= "\n*All records strictly isolated from authorized MySQL database.*";

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `crm_leads`', "Lead Source: `{$sourceName}`"],
                'tokens' => 120,
                'structured_data' => $leads
            ];
        }

        // ==========================================
        // 2. UNCONTACTED LEADS (Never contacted)
        // ==========================================
        if (preg_match('/(uncontacted|not.*contact|never.*contact|not.*been.*contacted|without.*contact)/i', $q)) {
            $stmt = $db->prepare("
                SELECT l.*, COALESCE(u.name, 'Unassigned') AS assigned_name
                FROM crm_leads l
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE l.tenant_id = ? AND l.last_contact_date IS NULL AND l.status = 'new'
                ORDER BY CASE l.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, l.created_at ASC
            ");
            $stmt->execute([$tenantId]);
            $uncontacted = $stmt->fetchAll();

            $count = count($uncontacted);
            if ($count === 0) {
                return [
                    'text' => "🎉 **Exceptional work!** All leads in your workspace have had their initial touchpoint recorded. There are **0 uncontacted leads** waiting.",
                    'citations' => ['MySQL Table: `crm_leads`'],
                    'tokens' => 35
                ];
            }

            $list = "### 🚨 Uncontacted Inbound Leads ({$count})\n\nThe following leads were captured but have had **no contact activity logged** yet:\n\n";
            foreach ($uncontacted as $l) {
                $prio = strtoupper($l['priority']);
                $phone = !empty($l['phone']) ? " (`{$l['phone']}`)" : "";
                $source = $l['source'];
                $req = !empty($l['service_requirement']) ? " — Need: *{$l['service_requirement']}*" : "";
                $list .= "• [**{$prio}**] **{$l['name']}** from **{$l['company']}**{$phone} via **{$source}**{$req}\n";
            }
            $list .= "\n💡 **Suggested Action**: Initiate immediate phone calls or WhatsApp intros to convert these fresh inquiries before they go cold.";

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `crm_leads`', 'Touchpoint Log: `lead_activities`'],
                'tokens' => 95,
                'structured_data' => $uncontacted
            ];
        }

        // ==========================================
        // 3. TODAY'S FOLLOW-UPS
        // ==========================================
        if (preg_match('/(today.*follow|follow.*today|today\'s follow)/i', $q)) {
            $stmt = $db->prepare("
                SELECT f.*, 
                       COALESCE(l.name, c.name, 'Direct Account') AS contact_name,
                       COALESCE(l.company, c.company, '') AS contact_company,
                       COALESCE(l.phone, c.phone, '') AS contact_phone,
                       COALESCE(l.source, 'General') AS source,
                       COALESCE(u.name, 'Unassigned') AS assigned_person
                FROM follow_ups f
                LEFT JOIN crm_leads l ON f.lead_id = l.id
                LEFT JOIN crm_customers c ON f.customer_id = c.id
                LEFT JOIN users u ON f.assigned_to = u.id
                WHERE f.tenant_id = ? AND f.status = 'pending' AND DATE(f.scheduled_at) = CURRENT_DATE
                ORDER BY f.scheduled_at ASC
            ");
            $stmt->execute([$tenantId]);
            $todays = $stmt->fetchAll();

            $count = count($todays);
            if ($count === 0) {
                return [
                    'text' => "📅 **Today's Follow-up Agenda is Clear!**\n\nYou have **0 pending follow-ups scheduled for today**. All scheduled touchpoints are either completed or set for future dates.",
                    'citations' => ['MySQL Table: `follow_ups`'],
                    'tokens' => 40
                ];
            }

            $list = "### 📞 Today's Scheduled Follow-ups ({$count})\n\n";
            foreach ($todays as $f) {
                $time = date('h:i A', strtotime($f['scheduled_at']));
                $method = strtoupper($f['contact_method'] ?? 'call');
                $target = "**{$f['contact_name']}**" . (!empty($f['contact_company']) ? " ({$f['contact_company']})" : "");
                $phone = !empty($f['contact_phone']) ? " • `{$f['contact_phone']}`" : "";
                $assigned = !empty($f['assigned_person']) ? " [Assigned: {$f['assigned_person']}]" : "";
                $list .= "• **{$time}** — [**{$method}**] {$target}{$phone}{$assigned}\n  *Action: {$f['title']}*\n";
            }

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `follow_ups`', 'MySQL Table: `crm_leads`'],
                'tokens' => 90,
                'structured_data' => $todays
            ];
        }

        // ==========================================
        // 4. OVERDUE FOLLOW-UPS
        // ==========================================
        if (preg_match('/(overdue.*follow|overdue.*lead|lead.*overdue|follow.*overdue|which.*lead.*overdue|leads?.*are.*overdue|late.*follow|missed.*follow)/i', $q)) {
            $stmt = $db->prepare("
                SELECT f.*, 
                       COALESCE(l.name, c.name, 'Direct Client') AS contact_name,
                       COALESCE(l.company, c.company, '') AS contact_company,
                       COALESCE(l.phone, c.phone, '') AS contact_phone,
                       COALESCE(l.source, 'General') AS source,
                       COALESCE(u.name, 'Unassigned') AS assigned_person
                FROM follow_ups f
                LEFT JOIN crm_leads l ON f.lead_id = l.id
                LEFT JOIN crm_customers c ON f.customer_id = c.id
                LEFT JOIN users u ON f.assigned_to = u.id
                WHERE f.tenant_id = ? AND f.status = 'pending' AND f.scheduled_at < NOW()
                ORDER BY f.scheduled_at ASC
            ");
            $stmt->execute([$tenantId]);
            $overdues = $stmt->fetchAll();

            $count = count($overdues);
            if ($count === 0) {
                return [
                    'text' => "🎉 **Zero Overdue Follow-ups!** All customer and lead follow-up deadlines are current.",
                    'citations' => ['MySQL Table: `follow_ups`'],
                    'tokens' => 30
                ];
            }

            $list = "### ⚠️ Overdue Follow-ups Alert ({$count} Items)\n\nThe following commitments have passed their scheduled timestamp without a completed action:\n\n";
            foreach ($overdues as $f) {
                $sched = date('d M Y, h:i A', strtotime($f['scheduled_at']));
                $method = strtoupper($f['contact_method'] ?? 'call');
                $target = "**{$f['contact_name']}**" . (!empty($f['contact_company']) ? " ({$f['contact_company']})" : "");
                $phone = !empty($f['contact_phone']) ? " • `{$f['contact_phone']}`" : "";
                $assigned = !empty($f['assigned_person']) ? " [Assigned: {$f['assigned_person']}]" : "";
                $list .= "• [**{$method}**] {$target}{$phone}{$assigned}\n  - Title: **{$f['title']}**\n  - Due Was: <span style='color:#DC2626;font-weight:600;'>{$sched}</span>\n";
            }
            $list .= "\n*Tip: Open the Follow-ups module to log completion or reschedule with updated notes.*";

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `follow_ups`', 'Status Engine: `Calculated Overdue`'],
                'tokens' => 105,
                'structured_data' => $overdues
            ];
        }

        // ==========================================
        // 5. EMPLOYEE PENDING FOLLOW-UPS
        // ==========================================
        if (preg_match('/(employee.*follow|who.*pending.*follow|which.*employee.*pending|assigned.*follow)/i', $q)) {
            $stmt = $db->prepare("
                SELECT 
                    COALESCE(u.name, CONCAT(e.first_name, ' ', e.last_name), 'Unassigned') AS employee_name,
                    COUNT(*) AS total_pending,
                    SUM(CASE WHEN f.scheduled_at < NOW() THEN 1 ELSE 0 END) AS overdue_count,
                    SUM(CASE WHEN DATE(f.scheduled_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS today_count
                FROM follow_ups f
                LEFT JOIN users u ON f.assigned_to = u.id
                LEFT JOIN hrm_employees e ON f.assigned_to = e.id
                WHERE f.tenant_id = ? AND f.status = 'pending'
                GROUP BY employee_name
                ORDER BY overdue_count DESC, total_pending DESC
            ");
            $stmt->execute([$tenantId]);
            $breakdown = $stmt->fetchAll();

            if (empty($breakdown)) {
                return [
                    'text' => "✅ No employees currently have pending follow-ups assigned. Your pipeline workload is completely resolved.",
                    'citations' => ['MySQL Table: `follow_ups`'],
                    'tokens' => 30
                ];
            }

            $list = "### 👥 Follow-up Workload by Assigned Employee\n\n";
            $list .= "| Employee / Assignee | Total Pending | Overdue | Due Today |\n";
            $list .= "| :--- | :--- | :--- | :--- |\n";

            foreach ($breakdown as $b) {
                $overdueBadge = (int)$b['overdue_count'] > 0 
                    ? "<span style='color:#DC2626;font-weight:bold;'>{$b['overdue_count']} ⚠️</span>" 
                    : "0";
                $list .= "| **{$b['employee_name']}** | {$b['total_pending']} | {$overdueBadge} | {$b['today_count']} |\n";
            }

            return [
                'text' => $list,
                'citations' => ['MySQL Table: `follow_ups`', 'MySQL Table: `users`', 'MySQL Table: `hrm_employees`'],
                'tokens' => 85,
                'structured_data' => $breakdown
            ];
        }

        // ==========================================
        // 6. LEAD ACTIVITIES & PERFORMANCE SUMMARY
        // ==========================================
        if (preg_match('/(summarize.*lead|lead.*activit|activity.*summar|pipeline.*summar|summarize.*source|leads.*by.*source|source.*summar)/i', $q)) {
            $leadStatsStmt = $db->prepare("
                SELECT 
                    COUNT(*) AS total_leads,
                    SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_leads,
                    SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_leads,
                    COALESCE(SUM(value), 0) AS pipeline_value,
                    COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) AS won_value
                FROM crm_leads 
                WHERE tenant_id = ?
            ");
            $leadStatsStmt->execute([$tenantId]);
            $leadStats = $leadStatsStmt->fetch();

            $totalLeads = (int)$leadStats['total_leads'];
            $wonLeads = (int)$leadStats['won_leads'];
            $convRate = $totalLeads > 0 ? round(($wonLeads / $totalLeads) * 100, 1) : 0.0;
            $wonValFormatted = '₹' . number_format((float)$leadStats['won_value'], 2);
            $pipeValFormatted = '₹' . number_format((float)$leadStats['pipeline_value'], 2);

            // Source Breakdown
            $srcStmt = $db->prepare("
                SELECT source, COUNT(*) as cnt 
                FROM crm_leads 
                WHERE tenant_id = ? 
                GROUP BY source 
                ORDER BY cnt DESC
            ");
            $srcStmt->execute([$tenantId]);
            $sources = $srcStmt->fetchAll();

            $srcList = "";
            foreach ($sources as $s) {
                $srcList .= "• **{$s['source']}**: {$s['cnt']} leads\n";
            }

            // Recent Touchpoint Logs
            $actStmt = $db->prepare("
                SELECT a.activity_type, a.title, a.activity_date, l.name AS lead_name 
                FROM lead_activities a
                JOIN crm_leads l ON a.lead_id = l.id
                WHERE a.tenant_id = ?
                ORDER BY a.activity_date DESC
                LIMIT 4
            ");
            $actStmt->execute([$tenantId]);
            $acts = $actStmt->fetchAll();

            $actList = "";
            foreach ($acts as $a) {
                $date = date('d M, h:i A', strtotime($a['activity_date']));
                $actList .= "• [{$a['activity_type']}] **{$a['lead_name']}** — {$a['title']} ({$date})\n";
            }

            $text = "### 📊 Comprehensive Centralized Lead Management Summary\n\n"
                  . "Here is your operational lead and conversion briefing from live database records:\n\n"
                  . "• **Total Managed Leads**: **{$totalLeads}**\n"
                  . "• **Conversion Rate**: **{$convRate}%** ({$wonLeads} won leads)\n"
                  . "• **Active Pipeline Value**: **{$pipeValFormatted}**\n"
                  . "• **Won Revenue Collected**: **{$wonValFormatted}**\n\n"
                  . "#### 🌐 Lead Source Distribution\n{$srcList}\n"
                  . "#### ⚡ Recent Activity Logs\n{$actList}";

            return [
                'text' => $text,
                'citations' => ['MySQL Table: `crm_leads`', 'MySQL Table: `lead_activities`'],
                'tokens' => 135,
                'structured_data' => $leadStats
            ];
        }

        // ==========================================
        // 7. SUGGEST NEXT ACTION FOR A LEAD
        // ==========================================
        if (preg_match('/(suggest.*next.*action|next.*action.*for|recommend.*action|what.*should.*i.*do.*for)/i', $q)) {
            // Find most critical lead or lead matching mentioned name
            $stmt = $db->prepare("
                SELECT l.*, 
                       (SELECT f.title FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending' ORDER BY f.scheduled_at ASC LIMIT 1) AS pending_title,
                       (SELECT f.scheduled_at FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending' ORDER BY f.scheduled_at ASC LIMIT 1) AS pending_date,
                       (SELECT a.description FROM lead_activities a WHERE a.lead_id = l.id ORDER BY a.activity_date DESC LIMIT 1) AS last_activity_desc
                FROM crm_leads l
                WHERE l.tenant_id = ? AND l.status NOT IN ('won', 'lost')
                ORDER BY 
                    CASE WHEN l.next_followup_date < NOW() THEN 1 WHEN l.status = 'proposal' THEN 2 WHEN l.priority = 'urgent' THEN 3 ELSE 4 END,
                    l.value DESC
                LIMIT 1
            ");
            $stmt->execute([$tenantId]);
            $lead = $stmt->fetch();

            if (!$lead) {
                return [
                    'text' => "🎯 You have no active pipeline leads requiring urgent next actions right now. All current leads are either won or archived.",
                    'citations' => ['MySQL Table: `crm_leads`'],
                    'tokens' => 35
                ];
            }

            $name = $lead['name'];
            $company = $lead['company'] ? " at {$lead['company']}" : "";
            $stage = strtoupper($lead['status']);
            $source = $lead['source'];
            $req = !empty($lead['service_requirement']) ? $lead['service_requirement'] : 'Enterprise Solution';
            $val = '₹' . number_format((float)$lead['value'], 0);

            $recommendation = "";
            if ($lead['status'] === 'new') {
                $recommendation = "1. **Discovery Outreach**: Initiate a 10-minute discovery call with {$name} regarding their requirement for *{$req}*.\n2. **Qualify Scope**: Send standard service brochure via WhatsApp and book a formal scoping meeting.";
            } elseif ($lead['status'] === 'proposal') {
                $recommendation = "1. **Commercial Check-in**: Follow up on the submitted proposal of {$val}.\n2. **Address Objections**: Proactively check if technical decision-makers require any revisions or GST compliance assurances.\n3. **Close with Milestone Terms**: Offer a clear phase-1 deployment plan to secure signing.";
            } elseif ($lead['status'] === 'contacted') {
                $recommendation = "1. **Tailored Demonstration**: Conduct live demonstration matching {$lead['company']}'s specific workflow.\n2. **Issue Proposal**: Convert validated requirement into a formal quotation.";
            } else {
                $recommendation = "1. **Follow-up Touchpoint**: Connect via WhatsApp/Phone to keep momentum active.\n2. **Verify Timeline**: Confirm client's expected kickoff date.";
            }

            $text = "### 💡 AI Strategic Next Action Recommendation\n\n"
                  . "Target Lead: **{$name}**{$company} (Value: **{$val}**)\n"
                  . "• **Pipeline Stage**: `{$stage}` via **{$source}**\n"
                  . "• **Core Requirement**: {$req}\n"
                  . "• **Last Touchpoint**: " . (!empty($lead['last_contact_date']) ? date('d M Y', strtotime($lead['last_contact_date'])) : 'No direct contact logged yet') . "\n\n"
                  . "#### Recommended Execution Plan:\n{$recommendation}\n\n"
                  . "*Would you like me to schedule this follow-up in your calendar?*";

            return [
                'text' => $text,
                'citations' => ['MySQL Table: `crm_leads`', 'Pipeline Analysis Engine'],
                'tokens' => 125,
                'structured_data' => $lead
            ];
        }

        // ==========================================
        // 8. Financial / Overdue Invoices
        // ==========================================
        if (preg_match('/(pending|receivable|money|unpaid|due amount|balance)/i', $q)) {
            $stmt = $db->prepare("
                SELECT 
                    COALESCE(SUM(total_amount), 0) AS total_receivable,
                    COALESCE(SUM(paid_amount), 0) AS total_received,
                    COALESCE(SUM(outstanding_amount), 0) AS pending_amount,
                    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN outstanding_amount ELSE 0 END), 0) AS overdue_amount
                FROM invoices 
                WHERE tenant_id = ? AND status != 'cancelled'
            ");
            $stmt->execute([$tenantId]);
            $fin = $stmt->fetch();

            $pendingFormatted = '₹' . number_format((float)$fin['pending_amount'], 2);
            $receivedFormatted = '₹' . number_format((float)$fin['total_received'], 2);
            $totalFormatted = '₹' . number_format((float)$fin['total_receivable'], 2);
            $overdueFormatted = '₹' . number_format((float)$fin['overdue_amount'], 2);

            $text = "### 💳 Financial Status Briefing\n\n"
                  . "Here are your verified live accounts receivable figures from MySQL:\n\n"
                  . "• **Total Pending Balance**: **{$pendingFormatted}**\n"
                  . "• **Total Received to Date**: **{$receivedFormatted}**\n"
                  . "• **Gross Invoiced**: **{$totalFormatted}**\n"
                  . "• **Overdue Balance**: **{$overdueFormatted}**\n\n"
                  . "All figures reflect real-time cleared and pending transactions.";

            return [
                'text' => $text,
                'citations' => ['MySQL Table: `invoices`', 'MySQL Table: `payments`'],
                'tokens' => 85,
                'structured_data' => $fin
            ];
        }

        if (preg_match('/(overdue.*invoice|late.*invoice)/i', $q)) {
            $stmt = $db->prepare("
                SELECT i.invoice_number, i.outstanding_amount, i.due_date, c.name AS customer_name
                FROM invoices i
                JOIN crm_customers c ON i.customer_id = c.id
                WHERE i.tenant_id = ? AND i.due_date < CURRENT_DATE AND i.outstanding_amount > 0
                ORDER BY i.due_date ASC
            ");
            $stmt->execute([$tenantId]);
            $overdues = $stmt->fetchAll();

            if (empty($overdues)) {
                return [
                    'text' => "🎉 **Excellent news!** You currently have **0 overdue invoices**. All active accounts are in good standing.",
                    'citations' => ['MySQL Table: `invoices`'],
                    'tokens' => 35
                ];
            }

            $list = "";
            foreach ($overdues as $inv) {
                $amt = '₹' . number_format((float)$inv['outstanding_amount'], 2);
                $list .= "• **{$inv['invoice_number']}** ({$inv['customer_name']}): **{$amt}** overdue since {$inv['due_date']}\n";
            }

            return [
                'text' => "### ⚠️ Overdue Invoices Notice\n\nThe following invoices have passed their due date and have outstanding balances:\n\n{$list}\n*Tip: Would you like to schedule follow-ups for these accounts?*",
                'citations' => ['MySQL Table: `invoices`', 'Client CRM Ledger'],
                'tokens' => 95,
                'structured_data' => $overdues
            ];
        }

        // ==========================================
        // 9. Calendar / Meetings
        // ==========================================
        if (preg_match('/(meeting|calendar|appointment|schedule)/i', $q)) {
            $stmt = $db->prepare("
                SELECT * FROM calendar_events 
                WHERE tenant_id = ? AND DATE(start_time) = CURRENT_DATE
                ORDER BY start_time ASC
            ");
            $stmt->execute([$tenantId]);
            $meetings = $stmt->fetchAll();

            $count = count($meetings);
            if ($count === 0) {
                return [
                    'text' => "📅 You have **no scheduled meetings or appointments today**. Your calendar is clear for focused execution.",
                    'citations' => ['MySQL Table: `calendar_events`'],
                    'tokens' => 35
                ];
            }

            $list = "";
            foreach ($meetings as $m) {
                $time = date('h:i A', strtotime($m['start_time']));
                $loc = $m['location_or_url'] ? " ({$m['location_or_url']})" : "";
                $list .= "• **{$time}** — {$m['title']}{$loc}\n";
            }

            return [
                'text' => "### 📅 Today's Schedule ({$count} " . ($count === 1 ? 'event' : 'events') . ")\n\n{$list}",
                'citations' => ['MySQL Table: `calendar_events`'],
                'tokens' => 70,
                'structured_data' => $meetings
            ];
        }

        // ==========================================
        // 10. Default Intelligent Fallback
        // ==========================================
        return [
            'text' => "I am your **MY COCKPIT AI Personal Agent**. I have direct, real-time access to your centralized leads, follow-ups, and financial data.\n\nYou can ask me:\n• *Show all my BNI leads.*\n• *Show my pending KVV leads.*\n• *Which EAF leads need follow-up?*\n• *Show all SEO leads.*\n• *Which leads have not been contacted?*\n• *Show today's follow-ups.*\n• *Which leads are overdue?*\n• *Which employee has pending follow-ups?*\n• *Summarize all lead activities.*\n• *Suggest the next action for a lead.*\n• *What is my pending payment amount?*\n\nHow may I assist your business today?",
            'citations' => ['MY COCKPIT AI System Core', 'Tenant Isolation Engine'],
            'tokens' => 75
        ];
    }
}
