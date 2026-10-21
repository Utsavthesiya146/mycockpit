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

        // Check for consequential action requests that require confirmation
        if (preg_match('/(delete|remove|cancel|terminate|drop)\s+(invoice|customer|employee|task)/i', $q)) {
            return [
                'text' => "⚠️ **Security Policy Confirmation Required**:\n\nConsequential modifications or deletions cannot be executed automatically through chat. Please navigate to the dedicated management module to authorize this action with administrative confirmation.",
                'citations' => ['Source: Tenant Security Enforcement Engine'],
                'tokens' => 45,
                'structured_data' => ['requires_confirmation' => true]
            ];
        }

        // 1. Pending Payments / Receivable / Overdue Invoices
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

        // 2. Overdue Invoices
        if (preg_match('/(overdue|late)/i', $q)) {
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

        // 3. Meetings / Calendar
        if (preg_match('/(meeting|calendar|appointment|schedule|today)/i', $q)) {
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

        // 4. Follow-ups
        if (preg_match('/(follow.*up|contact customer|pending lead)/i', $q)) {
            $stmt = $db->prepare("
                SELECT f.*, c.name AS customer_name, c.phone AS customer_phone
                FROM follow_ups f
                LEFT JOIN crm_customers c ON f.customer_id = c.id
                WHERE f.tenant_id = ? AND f.status = 'pending'
                ORDER BY f.scheduled_at ASC
            ");
            $stmt->execute([$tenantId]);
            $followups = $stmt->fetchAll();

            if (empty($followups)) {
                return [
                    'text' => "✅ No pending follow-ups right now. All customer interactions are currently up to date.",
                    'citations' => ['MySQL Table: `follow_ups`'],
                    'tokens' => 30
                ];
            }

            $list = "";
            foreach ($followups as $f) {
                $target = $f['customer_name'] ?? 'General Contact';
                $phone = !empty($f['customer_phone']) ? " ({$f['customer_phone']})" : "";
                $list .= "• **{$f['title']}** for **{$target}**{$phone} — Scheduled: {$f['scheduled_at']}\n";
            }

            return [
                'text' => "### 📞 Customers Requiring Follow-up\n\n{$list}",
                'citations' => ['MySQL Table: `follow_ups`', 'MySQL Table: `crm_customers`'],
                'tokens' => 80,
                'structured_data' => $followups
            ];
        }

        // 5. Priority Tasks
        if (preg_match('/(task|priority|urgent|to.*do)/i', $q)) {
            $stmt = $db->prepare("
                SELECT * FROM tasks 
                WHERE tenant_id = ? AND status IN ('pending', 'in_progress')
                ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, due_date ASC
                LIMIT 5
            ");
            $stmt->execute([$tenantId]);
            $tasks = $stmt->fetchAll();

            if (empty($tasks)) {
                return [
                    'text' => "🎯 You have no pending tasks! Great job staying ahead of deadlines.",
                    'citations' => ['MySQL Table: `tasks`'],
                    'tokens' => 30
                ];
            }

            $list = "";
            foreach ($tasks as $t) {
                $priorityBadge = strtoupper($t['priority']);
                $due = $t['due_date'] ? " (Due: {$t['due_date']})" : "";
                $list .= "• [**{$priorityBadge}**] {$t['title']}{$due}\n";
            }

            return [
                'text' => "### 🎯 Priority Action Items\n\n{$list}",
                'citations' => ['MySQL Table: `tasks`'],
                'tokens' => 75,
                'structured_data' => $tasks
            ];
        }

        // 6. Comprehensive Business Summary
        if (preg_match('/(summar|overview|report|status|cockpit|dashboard)/i', $q)) {
            $finStmt = $db->prepare("
                SELECT 
                    COALESCE(SUM(total_amount), 0) AS total_receivable,
                    COALESCE(SUM(paid_amount), 0) AS total_received,
                    COALESCE(SUM(outstanding_amount), 0) AS pending_amount
                FROM invoices WHERE tenant_id = ? AND status != 'cancelled'
            ");
            $finStmt->execute([$tenantId]);
            $fin = $finStmt->fetch();

            $custCount = (int)$db->query("SELECT COUNT(*) FROM crm_customers WHERE tenant_id = {$tenantId}")->fetchColumn();
            $taskCount = (int)$db->query("SELECT COUNT(*) FROM tasks WHERE tenant_id = {$tenantId} AND status = 'pending'")->fetchColumn();
            $meetCount = (int)$db->query("SELECT COUNT(*) FROM calendar_events WHERE tenant_id = {$tenantId} AND DATE(start_time) = CURRENT_DATE")->fetchColumn();

            $pendingFormatted = '₹' . number_format((float)$fin['pending_amount'], 2);
            $receivedFormatted = '₹' . number_format((float)$fin['total_received'], 2);

            $text = "### 🚀 Executive Business Intelligence Summary\n\n"
                  . "Here is your high-level overview:\n\n"
                  . "• **Financial Performance**: Total collected is **{$receivedFormatted}**, with **{$pendingFormatted}** pending collection.\n"
                  . "• **Active Accounts**: **{$custCount}** client organizations managed.\n"
                  . "• **Calendar Execution**: **{$meetCount}** meetings scheduled for today.\n"
                  . "• **Operational Workload**: **{$taskCount}** active pending tasks requiring action.\n\n"
                  . "Feel free to ask for detailed breakdowns of invoices, follow-ups, or client records!";

            return [
                'text' => $text,
                'citations' => ['Financial Engine', 'CRM Repository', 'Operations Calendar'],
                'tokens' => 110
            ];
        }

        // Default Intelligent Fallback
        return [
            'text' => "I am your **MY COCKPIT AI Personal Assistant**. I have direct, tenant-isolated access to your business records.\n\nYou can ask me:\n• *What is my pending payment amount?*\n• *How many meetings do I have today?*\n• *Which customers need follow-up?*\n• *Show my overdue invoices.*\n• *Summarize my business activities.*\n• *What are today's priority tasks?*\n\nHow may I assist your business today?",
            'citations' => ['MY COCKPIT AI System Core'],
            'tokens' => 60
        ];
    }
}
