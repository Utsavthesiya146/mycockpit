<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use Cockpit\Utils\Encryption;
use Cockpit\Services\SyncEngine;
use Cockpit\Services\Automation\BidirectionalSyncManager;
use Cockpit\Services\Automation\HostingEvaluator;
use PDO;

class LeadController {

    /**
     * List leads with filtering, search, and calculated follow-up status
     */
    public static function listLeads(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $source = $_GET['source'] ?? '';
        $status = $_GET['status'] ?? '';
        $assignedTo = isset($_GET['assigned_to']) && $_GET['assigned_to'] !== '' ? (int)$_GET['assigned_to'] : null;
        $priority = $_GET['priority'] ?? '';
        $followupView = $_GET['view'] ?? ''; // all, new, pending, today, overdue, completed, no_followup, won, lost
        $search = trim($_GET['search'] ?? '');

        $sql = "
            SELECT 
                l.*,
                u.name AS assigned_user_name,
                u.email AS assigned_user_email,
                (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id AND f.tenant_id = l.tenant_id AND f.status = 'pending') AS pending_followups_count,
                (SELECT COUNT(*) FROM lead_activities a WHERE a.lead_id = l.id AND a.tenant_id = l.tenant_id) AS activities_count,
                (
                    SELECT f.scheduled_at 
                    FROM follow_ups f 
                    WHERE f.lead_id = l.id AND f.tenant_id = l.tenant_id AND f.status = 'pending' 
                    ORDER BY f.scheduled_at ASC 
                    LIMIT 1
                ) AS next_scheduled_followup,
                CASE
                    WHEN l.status = 'won' THEN 'won'
                    WHEN l.status = 'lost' THEN 'lost'
                    WHEN l.next_followup_date IS NULL THEN 'no_followup'
                    WHEN l.next_followup_date < NOW() THEN 'overdue'
                    WHEN DATE(l.next_followup_date) = CURRENT_DATE() THEN 'today'
                    ELSE 'pending'
                END AS calculated_followup_status
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.tenant_id = ?
        ";

        $params = [$tenantId];

        if (!empty($source)) {
            $sql .= " AND l.source = ?";
            $params[] = $source;
        }

        if (!empty($status)) {
            $sql .= " AND l.status = ?";
            $params[] = $status;
        }

        if ($assignedTo !== null) {
            $sql .= " AND l.assigned_to = ?";
            $params[] = $assignedTo;
        }

        if (!empty($priority)) {
            $sql .= " AND l.priority = ?";
            $params[] = $priority;
        }

        if (!empty($search)) {
            $sql .= " AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.service_requirement LIKE ?)";
            $searchTerm = "%{$search}%";
            $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm]);
        }

        // Apply View filters
        switch ($followupView) {
            case 'new':
                $sql .= " AND l.status = 'new'";
                break;
            case 'pending':
                $sql .= " AND l.next_followup_date >= NOW() AND l.status NOT IN ('won', 'lost')";
                break;
            case 'today':
                $sql .= " AND DATE(l.next_followup_date) = CURRENT_DATE() AND l.status NOT IN ('won', 'lost')";
                break;
            case 'overdue':
                $sql .= " AND l.next_followup_date < NOW() AND l.status NOT IN ('won', 'lost')";
                break;
            case 'completed':
                $sql .= " AND EXISTS (SELECT 1 FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'completed')";
                break;
            case 'no_followup':
                $sql .= " AND l.next_followup_date IS NULL AND l.status NOT IN ('won', 'lost')";
                break;
            case 'won':
                $sql .= " AND l.status = 'won'";
                break;
            case 'lost':
                $sql .= " AND l.status = 'lost'";
                break;
        }

        $sql .= " ORDER BY l.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $leads = $stmt->fetchAll();

        Response::success($leads);
    }

    /**
     * Get single lead details with activities and follow-ups history
     */
    public static function getLead(array $currentUser, int $leadId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT l.*,
                   u.name AS assigned_user_name,
                   u.email AS assigned_user_email
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.id = ? AND l.tenant_id = ?
        ");
        $stmt->execute([$leadId, $tenantId]);
        $lead = $stmt->fetch();

        if (!$lead) {
            Response::error('Lead not found.', 404);
        }

        // Fetch follow-ups
        $fStmt = $db->prepare("
            SELECT f.*, u.name AS assigned_user_name
            FROM follow_ups f
            LEFT JOIN users u ON f.assigned_to = u.id
            WHERE f.lead_id = ? AND f.tenant_id = ?
            ORDER BY f.scheduled_at DESC
        ");
        $fStmt->execute([$leadId, $tenantId]);
        $lead['follow_ups'] = $fStmt->fetchAll();

        // Fetch activities
        $aStmt = $db->prepare("
            SELECT a.*, u.name AS user_name
            FROM lead_activities a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.lead_id = ? AND a.tenant_id = ?
            ORDER BY a.activity_date DESC
        ");
        $aStmt->execute([$leadId, $tenantId]);
        $lead['activities'] = $aStmt->fetchAll();

        Response::success($lead);
    }

    /**
     * Create a lead with duplicate detection, activity logging, and optional initial follow-up
     */
    public static function createLead(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $company = trim($input['company'] ?? '');
        $source = trim($input['source'] ?? 'Manually Added');
        $serviceRequirement = trim($input['service_requirement'] ?? '');
        $value = (float)($input['value'] ?? 0);
        $priority = in_array($input['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $input['priority'] : 'medium';
        $status = in_array($input['status'] ?? '', ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'], true) ? $input['status'] : 'new';
        $assignedTo = !empty($input['assigned_to']) ? (int)$input['assigned_to'] : null;
        $sourceLeadId = trim($input['source_lead_id'] ?? '');
        $notes = trim($input['notes'] ?? '');
        $nextFollowupDate = !empty($input['next_followup_date']) ? $input['next_followup_date'] : null;
        $contactMethod = in_array($input['contact_method'] ?? '', ['call', 'email', 'meeting', 'whatsapp', 'other'], true) ? $input['contact_method'] : 'call';
        $forceDuplicate = !empty($input['force_duplicate']);

        if (empty($name)) {
            Response::error('Lead contact name is required.', 422);
        }

        $db = Database::getConnection();

        // Duplicate Check
        if (!$forceDuplicate) {
            $dupParams = [$tenantId];
            $dupConditions = [];

            if (!empty($phone)) {
                $dupConditions[] = "phone = ?";
                $dupParams[] = $phone;
            }
            if (!empty($email)) {
                $dupConditions[] = "email = ?";
                $dupParams[] = $email;
            }
            if (!empty($sourceLeadId) && !empty($source)) {
                $dupConditions[] = "(source = ? AND source_lead_id = ?)";
                $dupParams[] = $source;
                $dupParams[] = $sourceLeadId;
            }

            if (!empty($dupConditions)) {
                $dupSql = "SELECT id, name, company, email, phone, source FROM crm_leads WHERE tenant_id = ? AND (" . implode(' OR ', $dupConditions) . ") LIMIT 1";
                $dupStmt = $db->prepare($dupSql);
                $dupStmt->execute($dupParams);
                $existing = $dupStmt->fetch();

                if ($existing) {
                    Response::error('Duplicate lead detected: Matching record exists #' . $existing['id'] . ' (' . $existing['name'] . ')', 409, [
                        'duplicate' => true,
                        'existing_lead' => $existing
                    ]);
                }
            }
        }

        $stmt = $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, source,
                service_requirement, priority, assigned_to, source_lead_id, next_followup_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            $company,
            $email,
            $phone,
            $value,
            $status,
            $source,
            $serviceRequirement,
            $priority,
            $assignedTo,
            $sourceLeadId,
            $nextFollowupDate,
            $notes
        ]);

        $leadId = (int)$db->lastInsertId();

        // Log creation activity
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, 'system', 'Lead Created', ?)
        ");
        $actStmt->execute([
            $tenantId,
            $leadId,
            $currentUser['id'],
            "Lead registered from {$source}" . (!empty($serviceRequirement) ? " for: {$serviceRequirement}" : "")
        ]);

        // Auto-create initial follow-up if date specified
        if ($nextFollowupDate) {
            $fStmt = $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, assigned_to, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ");
            $fStmt->execute([
                $tenantId,
                $leadId,
                "Initial Follow-up: " . $name,
                $notes ?: "First follow-up touchpoint for requirement: " . ($serviceRequirement ?: 'General inquiries'),
                $nextFollowupDate,
                $contactMethod,
                $assignedTo,
                $currentUser['id']
            ]);
        }

        Response::success(['id' => $leadId], 'Lead created successfully', 201);
    }

    /**
     * Update lead details
     */
    public static function updateLead(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db = Database::getConnection();

        // Check exists
        $checkStmt = $db->prepare("SELECT * FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $checkStmt->execute([$leadId, $tenantId]);
        $existing = $checkStmt->fetch();

        if (!$existing) {
            Response::error('Lead not found.', 404);
        }

        $name = trim($input['name'] ?? $existing['name']);
        $company = trim($input['company'] ?? ($existing['company'] ?? ''));
        $email = trim($input['email'] ?? ($existing['email'] ?? ''));
        $phone = trim($input['phone'] ?? ($existing['phone'] ?? ''));
        $source = trim($input['source'] ?? ($existing['source'] ?? ''));
        $serviceRequirement = trim($input['service_requirement'] ?? ($existing['service_requirement'] ?? ''));
        $value = isset($input['value']) ? (float)$input['value'] : (float)$existing['value'];
        $priority = in_array($input['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $input['priority'] : $existing['priority'];
        $status = in_array($input['status'] ?? '', ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'], true) ? $input['status'] : $existing['status'];
        $assignedTo = array_key_exists('assigned_to', $input) ? (!empty($input['assigned_to']) ? (int)$input['assigned_to'] : null) : $existing['assigned_to'];
        $notes = trim($input['notes'] ?? ($existing['notes'] ?? ''));
        $nextFollowupDate = array_key_exists('next_followup_date', $input) ? (!empty($input['next_followup_date']) ? $input['next_followup_date'] : null) : $existing['next_followup_date'];

        $stmt = $db->prepare("
            UPDATE crm_leads SET
                name = ?, company = ?, email = ?, phone = ?, source = ?,
                service_requirement = ?, value = ?, priority = ?, status = ?,
                assigned_to = ?, notes = ?, next_followup_date = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $name, $company, $email, $phone, $source,
            $serviceRequirement, $value, $priority, $status,
            $assignedTo, $notes, $nextFollowupDate,
            $leadId, $tenantId
        ]);

        // Log update activity
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, 'note', 'Lead Updated', 'Lead information was modified.')
        ");
        $actStmt->execute([$tenantId, $leadId, $currentUser['id']]);

        // External write-back handling
        $syncExternal = !empty($input['sync_external']);
        $syncResult = null;
        if ($syncExternal && !empty($existing['source_platform']) && !empty($existing['source_lead_id'])) {
            $syncMgr = new BidirectionalSyncManager($db);
            $syncResult = $syncMgr->queueWriteback($tenantId, $leadId, [
                'name' => $name,
                'phone' => $phone,
                'status' => $status,
                'priority' => $priority,
                'service_requirement' => $serviceRequirement,
                'notes' => $notes
            ], !empty($input['auto_confirm']));
        }

        Response::success([
            'id' => $leadId,
            'sync_result' => $syncResult
        ], 'Lead updated successfully');
    }

    /**
     * Update lead pipeline status
     */
    public static function updateLeadStatus(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? '';

        $validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
        if (!in_array($status, $validStatuses, true)) {
            Response::error('Invalid lead pipeline status.', 422);
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("
            UPDATE crm_leads 
            SET status = ?, 
                last_contact_date = CASE WHEN ? = 'contacted' AND last_contact_date IS NULL THEN NOW() ELSE last_contact_date END,
                updated_at = NOW() 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$status, $status, $leadId, $tenantId]);

        // Log status change
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, 'status_change', 'Status Changed to ' || ?, ?)
        ");
        $actStmt->execute([
            $tenantId,
            $leadId,
            $currentUser['id'],
            ucfirst($status),
            trim($input['notes'] ?? "Pipeline stage transitioned to {$status}")
        ]);

        // External write-back handling
        $syncExternal = !empty($input['sync_external']);
        $syncResult = null;
        $stmtLead = $db->prepare("SELECT source_platform, source_lead_id FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $stmtLead->execute([$leadId, $tenantId]);
        $leadMeta = $stmtLead->fetch();

        if ($syncExternal && !empty($leadMeta['source_platform']) && !empty($leadMeta['source_lead_id'])) {
            $syncMgr = new BidirectionalSyncManager($db);
            $syncResult = $syncMgr->queueWriteback($tenantId, $leadId, ['status' => $status], !empty($input['auto_confirm']));
        }

        Response::success([
            'id' => $leadId,
            'status' => $status,
            'sync_result' => $syncResult
        ], "Lead status updated to {$status}");
    }

    /**
     * Assign lead to an employee
     */
    public static function assignLead(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $assignedTo = !empty($input['assigned_to']) ? (int)$input['assigned_to'] : null;

        $db = Database::getConnection();

        $assignedName = 'Unassigned';
        if ($assignedTo) {
            $uStmt = $db->prepare("SELECT name FROM users WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)");
            $uStmt->execute([$assignedTo, $tenantId]);
            $u = $uStmt->fetch();
            if ($u) {
                $assignedName = $u['name'];
            }
        }

        $stmt = $db->prepare("UPDATE crm_leads SET assigned_to = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$assignedTo, $leadId, $tenantId]);

        // Log assignment
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, 'system', 'Lead Assignment', ?)
        ");
        $actStmt->execute([
            $tenantId,
            $leadId,
            $currentUser['id'],
            "Lead assigned to {$assignedName}"
        ]);

        Response::success(['assigned_to' => $assignedTo, 'assigned_name' => $assignedName], 'Lead assigned successfully');
    }

    /**
     * Log a follow-up activity (Call, WhatsApp, Email, Meeting, Note) and schedule next action
     */
    public static function logActivity(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $type = in_array($input['activity_type'] ?? '', ['call', 'email', 'meeting', 'whatsapp', 'note', 'status_change'], true) ? $input['activity_type'] : 'call';
        $title = trim($input['title'] ?? ucfirst($type) . ' Follow-up');
        $description = trim($input['description'] ?? '');
        $outcome = trim($input['outcome'] ?? '');
        $nextFollowupDate = !empty($input['next_followup_date']) ? $input['next_followup_date'] : null;
        $nextMethod = in_array($input['next_contact_method'] ?? '', ['call', 'email', 'meeting', 'whatsapp', 'other'], true) ? $input['next_contact_method'] : 'call';
        $completeActiveFollowupId = !empty($input['complete_followup_id']) ? (int)$input['complete_followup_id'] : null;

        $db = Database::getConnection();

        // 1. Insert activity log
        $descWithOutcome = $description;
        if (!empty($outcome)) {
            $descWithOutcome .= ($descWithOutcome ? "\n\n" : "") . "Outcome: " . $outcome;
        }

        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $actStmt->execute([
            $tenantId,
            $leadId,
            $currentUser['id'],
            $type,
            $title,
            $descWithOutcome
        ]);

        // 2. Update lead's last_contact_date and next_followup_date
        $updLeadStmt = $db->prepare("
            UPDATE crm_leads 
            SET last_contact_date = NOW(),
                next_followup_date = ?,
                status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
                updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $updLeadStmt->execute([$nextFollowupDate, $leadId, $tenantId]);

        // 3. Complete pending follow-up if specified
        if ($completeActiveFollowupId) {
            $compStmt = $db->prepare("
                UPDATE follow_ups 
                SET status = 'completed', outcome = ?, completed_at = NOW(), updated_at = NOW() 
                WHERE id = ? AND tenant_id = ?
            ");
            $compStmt->execute([$outcome ?: 'Completed via follow-up activity logger', $completeActiveFollowupId, $tenantId]);
        }

        // 4. Create new follow-up if next follow-up date requested
        if ($nextFollowupDate) {
            $leadInfoStmt = $db->prepare("SELECT name, assigned_to FROM crm_leads WHERE id = ? AND tenant_id = ?");
            $leadInfoStmt->execute([$leadId, $tenantId]);
            $leadInfo = $leadInfoStmt->fetch();

            $newFStmt = $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, assigned_to, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ");
            $newFStmt->execute([
                $tenantId,
                $leadId,
                "Follow-up with " . ($leadInfo['name'] ?? 'Lead'),
                "Next touchpoint: " . ($outcome ? "Follow-up on {$outcome}" : "Next planned interaction"),
                $nextFollowupDate,
                $nextMethod,
                $leadInfo['assigned_to'] ?? $currentUser['id'],
                $currentUser['id']
            ]);
        }

        Response::success(null, 'Activity logged and lead timeline updated successfully');
    }

    /**
     * Batch import leads (from CSV / Excel payload) with deduplication strategy
     */
    public static function importLeads(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $leads = $input['leads'] ?? [];
        $sourceKey = trim($input['source_key'] ?? ($input['source'] ?? 'bni'));
        $duplicateStrategy = $input['duplicate_strategy'] ?? 'skip'; // 'skip' or 'update'

        // Parse raw CSV text if provided via csv_data
        if (empty($leads) && !empty($input['csv_data'])) {
            $lines = preg_split('/\r\n|\r|\n/', trim($input['csv_data']));
            if (!empty($lines)) {
                $headerLine = array_shift($lines);
                $headers = str_getcsv($headerLine);
                $headers = array_map(fn($h) => trim((string)$h, " \t\n\r\0\x0B\"'"), $headers);

                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) continue;
                    $rowValues = str_getcsv($line);
                    if (empty($rowValues) || (count($rowValues) === 1 && $rowValues[0] === null)) continue;

                    $row = [];
                    foreach ($headers as $idx => $headerName) {
                        $row[$headerName] = $rowValues[$idx] ?? '';
                    }
                    $leads[] = $row;
                }
            }
        }

        if (!is_array($leads) || empty($leads)) {
            Response::error('No lead rows provided for import.', 422);
        }

        $sourceMap = [
            'bni' => ['name' => 'BNI Connect', 'platform' => 'bni'],
            'bni_connect' => ['name' => 'BNI Connect', 'platform' => 'bni'],
            'BNI' => ['name' => 'BNI Connect', 'platform' => 'bni'],
            'kvv' => ['name' => 'KVV Leads', 'platform' => 'kvv'],
            'kvv_connect' => ['name' => 'KVV Leads', 'platform' => 'kvv'],
            'KVV' => ['name' => 'KVV Leads', 'platform' => 'kvv'],
            'eaf' => ['name' => 'EAF Connect', 'platform' => 'eaf'],
            'eaf_connect' => ['name' => 'EAF Connect', 'platform' => 'eaf'],
            'EAF Connect' => ['name' => 'EAF Connect', 'platform' => 'eaf'],
            'website_seo' => ['name' => 'SEO & Website Forms', 'platform' => 'seo'],
            'SEO / Website' => ['name' => 'SEO & Website Forms', 'platform' => 'seo'],
            'manual' => ['name' => 'Manually Added', 'platform' => 'manual'],
            'Manual Added' => ['name' => 'Manually Added', 'platform' => 'manual'],
        ];

        $sourceInfo = $sourceMap[$sourceKey] ?? ['name' => ($input['source_name'] ?? 'External Import'), 'platform' => 'manual'];
        $sourceName = $sourceInfo['name'];
        $sourcePlatform = $sourceInfo['platform'];

        $db = Database::getConnection();

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $insertStmt = $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, source,
                source_platform, sync_status, service_requirement, priority,
                source_lead_id, next_followup_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, 'manual', ?, ?, ?, ?, ?)
        ");

        $updateStmt = $db->prepare("
            UPDATE crm_leads SET
                name = COALESCE(NULLIF(?, ''), name),
                company = COALESCE(NULLIF(?, ''), company),
                service_requirement = COALESCE(NULLIF(?, ''), service_requirement),
                value = CASE WHEN ? > 0 THEN ? ELSE value END,
                notes = CONCAT(COALESCE(notes, ''), '\n[Import Update]: ', ?),
                updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");

        $logActStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description)
            VALUES (?, ?, ?, 'import', 'Imported from ' || ?, ?)
        ");

        foreach ($leads as $index => $row) {
            $name = trim($row['name'] ?? $row['Full Name'] ?? $row['Referral Name'] ?? $row['Member Name'] ?? $row['Contact Name'] ?? $row['Contact'] ?? '');
            if (empty($name)) {
                $skipped++;
                $errors[] = "Row #" . ($index + 1) . ": Skipped because contact name was missing.";
                continue;
            }

            $email = trim($row['email'] ?? $row['Email Address'] ?? $row['Email ID'] ?? $row['Email'] ?? '');
            $phone = trim($row['phone'] ?? $row['Phone Number'] ?? $row['Telephone'] ?? $row['Mobile'] ?? $row['Contact No'] ?? $row['Contact Number'] ?? $row['Phone'] ?? '');
            $company = trim($row['company'] ?? $row['Company Name'] ?? $row['Business Name'] ?? $row['Business'] ?? $row['Firm Name'] ?? $row['Company'] ?? '');
            $service = trim($row['service_requirement'] ?? $row['Service'] ?? $row['Requirement'] ?? $row['Business Category'] ?? $row['Category'] ?? $row['Referral Type'] ?? '');
            $value = (float)($row['value'] ?? $row['Value'] ?? $row['Amount'] ?? $row['Referral Value'] ?? 0);
            $rawPrio = strtolower(trim($row['priority'] ?? $row['Priority'] ?? $row['temperature'] ?? $row['Temperature'] ?? ''));
            $priority = ($rawPrio === 'hot' || $rawPrio === 'urgent') ? 'urgent' : (($rawPrio === 'warm' || $rawPrio === 'high') ? 'high' : 'medium');
            $sourceLeadId = trim($row['source_lead_id'] ?? $row['Lead ID'] ?? $row['Slip ID'] ?? $row['Slip No'] ?? $row['Ref ID'] ?? $row['Enquiry ID'] ?? $row['Reference'] ?? $row['Ref No'] ?? '');
            $notes = trim($row['notes'] ?? $row['Notes'] ?? $row['Comments'] ?? $row['Remarks'] ?? $row['Chapter'] ?? '');
            $nextFollowup = !empty($row['next_followup_date']) ? $row['next_followup_date'] : date('Y-m-d H:i:s', strtotime('+2 days'));

            // Duplicate Check
            $existingId = null;
            if (!empty($sourceLeadId)) {
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND source = ? AND source_lead_id = ? LIMIT 1");
                $chk->execute([$tenantId, $sourceName, $sourceLeadId]);
                $existingId = $chk->fetchColumn();
            }
            if (!$existingId && !empty($phone)) {
                $cleanPhone = preg_replace('/[^\d+]/', '', $phone);
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND (phone = ? OR REPLACE(REPLACE(phone, ' ', ''), '-', '') = ?) LIMIT 1");
                $chk->execute([$tenantId, $phone, $cleanPhone]);
                $existingId = $chk->fetchColumn();
            }
            if (!$existingId && !empty($email)) {
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND email = ? LIMIT 1");
                $chk->execute([$tenantId, $email]);
                $existingId = $chk->fetchColumn();
            }

            if ($existingId) {
                if ($duplicateStrategy === 'update') {
                    $updateStmt->execute([
                        $name, $company, $service, $value, $value, $notes,
                        $existingId, $tenantId
                    ]);
                    $updated++;
                } else {
                    $skipped++;
                }
                continue;
            }

            // Insert new lead
            $insertStmt->execute([
                $tenantId,
                $name,
                $company,
                $email,
                $phone,
                $value,
                $sourceName,
                $sourcePlatform,
                $service,
                $priority,
                $sourceLeadId,
                $nextFollowup,
                $notes
            ]);
            $newLeadId = (int)$db->lastInsertId();

            $logActStmt->execute([
                $tenantId,
                $newLeadId,
                $currentUser['id'],
                $sourceName,
                "Batch import from {$sourceName}. Service: {$service}"
            ]);

            $imported++;
        }

        // Update sync count in lead_sources_config
        $db->prepare("
            UPDATE lead_sources_config 
            SET last_sync_at = NOW(), sync_count = sync_count + ?, updated_at = NOW()
            WHERE tenant_id = ? AND (source_key = ? OR source_key = ?)
        ")->execute([$imported + $updated, $tenantId, $sourceKey, strtolower($sourcePlatform) . '_connect']);

        Response::success([
            'imported_count' => $imported,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'total_processed' => count($leads),
            'errors' => $errors
        ], "Import completed: {$imported} new leads added, {$updated} updated, {$skipped} skipped.");
    }

    /**
     * List lead source configurations and sync status with masked credentials
     */
    public static function listSources(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        // Ensure schema compatibility including sync_mode column
        try {
            AppHubController::ensureSchemaCompatibility($db);
        } catch (\Throwable $e) {}

        // Auto-seed standard lead sources if missing for this tenant
        try {
            $stdSources = [
                ['key' => 'bni', 'name' => 'BNI Connect', 'category' => 'referral', 'status' => 'api_access_required', 'sync_mode' => 'api_pull'],
                ['key' => 'kvv', 'name' => 'KVV Leads', 'category' => 'business_forum', 'status' => 'manual_import_only', 'sync_mode' => 'webhook_push'],
                ['key' => 'eaf', 'name' => 'EAF Connect', 'category' => 'association', 'status' => 'auth_required', 'sync_mode' => 'api_pull'],
                ['key' => 'website_seo', 'name' => 'SEO & Website Forms', 'category' => 'inbound', 'status' => 'webhook_configured', 'sync_mode' => 'webhook_push'],
                ['key' => 'manual', 'name' => 'Manually Added', 'category' => 'direct', 'status' => 'connected', 'sync_mode' => 'manual_import'],
                ['key' => 'custom', 'name' => 'Custom Lead Source', 'category' => 'custom', 'status' => 'manual_import_only', 'sync_mode' => 'manual_import']
            ];

            $existingKeysStmt = $db->prepare("SELECT source_key FROM lead_sources_config WHERE tenant_id = ?");
            $existingKeysStmt->execute([$tenantId]);
            $existingKeys = $existingKeysStmt->fetchAll(PDO::FETCH_COLUMN);

            $insertStmt = $db->prepare("
                INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status, sync_mode, webhook_secret, is_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ");

            foreach ($stdSources as $src) {
                $hasKey = in_array($src['key'], $existingKeys, true) || in_array($src['key'] . '_connect', $existingKeys, true);
                if (!$hasKey) {
                    $sec = bin2hex(random_bytes(16));
                    $insertStmt->execute([$tenantId, $src['key'], $src['name'], $src['category'], $src['status'], $src['sync_mode'], $sec]);
                }
            }
        } catch (\Throwable $e) {
            error_log('Lead sources seeding notice: ' . $e->getMessage());
        }

        $stmt = $db->prepare("
            SELECT s.*,
                   u.name AS auto_assign_user_name,
                   (
                       SELECT COUNT(*) 
                       FROM crm_leads l 
                       WHERE l.tenant_id = s.tenant_id 
                         AND (
                             l.source = s.name 
                             OR (s.source_key = 'bni_connect' AND (l.source LIKE '%BNI%' OR l.source_platform = 'bni'))
                             OR (s.source_key = 'kvv_connect' AND (l.source LIKE '%KVV%' OR l.source_platform = 'kvv'))
                             OR (s.source_key = 'eaf_connect' AND (l.source LIKE '%EAF%' OR l.source_platform = 'eaf'))
                             OR (s.source_key = 'website_seo' AND (l.source LIKE '%SEO%' OR l.source LIKE '%Website%' OR l.source_platform = 'seo'))
                             OR (s.source_key = 'manual' AND l.source LIKE '%Manual%')
                         )
                   ) AS total_leads_count,
                   (
                       SELECT COUNT(*) 
                       FROM crm_leads l 
                       WHERE l.tenant_id = s.tenant_id 
                         AND l.status = 'won'
                         AND (
                             l.source = s.name 
                             OR (s.source_key = 'bni_connect' AND (l.source LIKE '%BNI%' OR l.source_platform = 'bni'))
                             OR (s.source_key = 'kvv_connect' AND (l.source LIKE '%KVV%' OR l.source_platform = 'kvv'))
                             OR (s.source_key = 'eaf_connect' AND (l.source LIKE '%EAF%' OR l.source_platform = 'eaf'))
                             OR (s.source_key = 'website_seo' AND (l.source LIKE '%SEO%' OR l.source LIKE '%Website%' OR l.source_platform = 'seo'))
                             OR (s.source_key = 'manual' AND l.source LIKE '%Manual%')
                         )
                   ) AS converted_leads_count
            FROM lead_sources_config s
            LEFT JOIN users u ON s.auto_assign_user_id = u.id
            WHERE s.tenant_id = ?
            ORDER BY s.id ASC
        ");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Sanitize and mask sensitive credentials
        $sanitized = array_map(function($row) {
            $hasCreds = !empty($row['encrypted_credentials']);
            $masked = [];
            if ($hasCreds) {
                $decrypted = Encryption::decrypt($row['encrypted_credentials']);
                if ($decrypted) {
                    $arr = json_decode($decrypted, true) ?: [];
                    foreach ($arr as $k => $v) {
                        if (is_string($v) && !empty($v)) {
                            if (str_contains($k, 'url') || str_contains($k, 'endpoint')) {
                                $masked[$k] = $v;
                            } else {
                                $masked[$k] = Encryption::maskValue($v);
                            }
                        }
                    }
                }
            }
            unset($row['encrypted_credentials']); // Never leak encrypted blob to frontend
            $row['has_credentials'] = $hasCreds;
            $row['masked_credentials'] = $masked;
            return $row;
        }, $rows);

        Response::success($sanitized);
    }

    /**
     * Update source status or toggle state
     */
    public static function updateSourceStatus(array $currentUser, int $sourceId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? null;
        $isEnabled = isset($input['is_enabled']) ? (int)$input['is_enabled'] : null;

        $db = Database::getConnection();

        if ($status !== null) {
            $validStatuses = [
                'live_api_sync', 'connected_syncing', 'connected',
                'user_export_available', 'email_integration_available',
                'manual_csv_import', 'manual_import_only',
                'webhook_configured', 'auth_required',
                'api_access_required', 'blocked', 'unsupported'
            ];
            if (!in_array($status, $validStatuses, true)) {
                Response::error('Invalid source integration status.', 422);
            }
            $stmt = $db->prepare("UPDATE lead_sources_config SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$status, $sourceId, $tenantId]);
        }

        if ($isEnabled !== null) {
            $stmt = $db->prepare("UPDATE lead_sources_config SET is_enabled = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$isEnabled, $sourceId, $tenantId]);
        }

        Response::success(null, 'Source status updated');
    }

    /**
     * Configure source credentials, auto-assignment, and sync interval
     */
    public static function configureSource(array $currentUser, int $sourceId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$sourceId, $tenantId]);
        $source = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$source) {
            Response::error('Source configuration not found.', 404);
        }

        $credentials = $input['credentials'] ?? [];
        $encryptedBlob = $source['encrypted_credentials'];

        if (!empty($credentials) && is_array($credentials)) {
            // Merge with existing decrypted credentials if partial update
            if (!empty($source['encrypted_credentials'])) {
                $existingJson = Encryption::decrypt($source['encrypted_credentials']);
                $existing = $existingJson ? json_decode($existingJson, true) : [];
                $credentials = array_merge($existing ?: [], array_filter($credentials, fn($v) => $v !== '' && $v !== null));
            }
            $encryptedBlob = Encryption::encrypt(json_encode($credentials));
        }

        $syncInterval = isset($input['sync_interval_minutes']) ? max(5, (int)$input['sync_interval_minutes']) : (int)($source['sync_interval_minutes'] ?? 15);
        $autoAssignUser = isset($input['auto_assign_user_id']) && $input['auto_assign_user_id'] !== '' ? (int)$input['auto_assign_user_id'] : null;
        $webhookSecret = !empty($input['webhook_secret']) ? trim($input['webhook_secret']) : $source['webhook_secret'];
        $isEnabled = isset($input['is_enabled']) ? (int)$input['is_enabled'] : (int)$source['is_enabled'];

        $upStmt = $db->prepare("
            UPDATE lead_sources_config 
            SET encrypted_credentials = ?,
                sync_interval_minutes = ?,
                auto_assign_user_id = ?,
                webhook_secret = ?,
                is_enabled = ?,
                updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $upStmt->execute([
            $encryptedBlob,
            $syncInterval,
            $autoAssignUser,
            $webhookSecret,
            $isEnabled,
            $sourceId,
            $tenantId
        ]);

        // Auto-run connection test if credentials updated
        $testResult = null;
        if (!empty($credentials)) {
            $testResult = SyncEngine::testConnection($tenantId, $source['source_key']);
        }

        Response::success([
            'configured' => true,
            'test_result' => $testResult
        ], 'Source integration configured successfully');
    }

    /**
     * Live test connection for a specific lead source
     */
    public static function testSourceConnection(array $currentUser, int $sourceId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$sourceId, $tenantId]);
        $source = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$source) {
            Response::error('Source configuration not found.', 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $overrideCreds = !empty($input['credentials']) ? $input['credentials'] : null;

        $result = SyncEngine::testConnection($tenantId, $source['source_key'], $overrideCreds);

        if ($result['success']) {
            Response::success($result, $result['message']);
        } else {
            Response::error($result['message'], 400, $result['details'] ?? null);
        }
    }

    /**
     * Trigger immediate synchronization for a specific lead source
     */
    public static function syncSourceNow(array $currentUser, int $sourceId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM lead_sources_config WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$sourceId, $tenantId]);
        $source = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$source) {
            Response::error('Source configuration not found.', 404);
        }

        $result = SyncEngine::syncSource($tenantId, $source['source_key'], 'manual');

        if ($result['success']) {
            $msg = "Synchronization complete! {$result['leads_created']} new leads added, {$result['leads_updated']} updated, {$result['leads_skipped']} skipped.";
            Response::success($result, $msg);
        } else {
            Response::error($result['error'] ?? 'Synchronization failed', 400, $result);
        }
    }

    /**
     * Get recent synchronization audit logs
     */
    public static function getSyncLogs(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $sourceKey = $_GET['source_key'] ?? '';
        $sql = "
            SELECT l.*, s.name AS source_name 
            FROM lead_sync_logs l
            LEFT JOIN lead_sources_config s ON l.tenant_id = s.tenant_id AND l.source_key = s.source_key
            WHERE l.tenant_id = ?
        ";
        $params = [$tenantId];

        if (!empty($sourceKey)) {
            $sql .= " AND l.source_key = ?";
            $params[] = $sourceKey;
        }

        $sql .= " ORDER BY l.created_at DESC LIMIT 50";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Centralized Follow-Up & Lead Dashboard Statistics
     */
    public static function getDashboardStats(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $sourceFilter = $_GET['source'] ?? '';
        $assignedFilter = isset($_GET['assigned_to']) && $_GET['assigned_to'] !== '' ? (int)$_GET['assigned_to'] : null;

        $leadParams = [$tenantId];
        $leadFilterSql = "";
        if (!empty($sourceFilter)) {
            $leadFilterSql .= " AND source = ?";
            $leadParams[] = $sourceFilter;
        }
        if ($assignedFilter !== null) {
            $leadFilterSql .= " AND assigned_to = ?";
            $leadParams[] = $assignedFilter;
        }

        // 1. Overall Lead Counts
        $cntStmt = $db->prepare("
            SELECT 
                COUNT(*) AS total_leads,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_leads,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS converted_leads,
                SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost_leads,
                SUM(CASE WHEN next_followup_date < NOW() AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS overdue_leads,
                SUM(CASE WHEN DATE(next_followup_date) = CURRENT_DATE() AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS today_leads,
                SUM(CASE WHEN next_followup_date >= NOW() AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS pending_leads,
                SUM(CASE WHEN next_followup_date IS NULL AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS no_followup_leads,
                COALESCE(SUM(value), 0) AS total_pipeline_value,
                COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) AS won_pipeline_value
            FROM crm_leads 
            WHERE tenant_id = ? {$leadFilterSql}
        ");
        $cntStmt->execute($leadParams);
        $counts = $cntStmt->fetch();

        $totalLeads = (int)$counts['total_leads'];
        $convertedLeads = (int)$counts['converted_leads'];
        $conversionRate = $totalLeads > 0 ? round(($convertedLeads / $totalLeads) * 100, 1) : 0;

        // 2. Leads by Source
        $srcStmt = $db->prepare("
            SELECT 
                COALESCE(source, 'Unspecified') AS source_name,
                COUNT(*) AS count,
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_count,
                COALESCE(SUM(value), 0) AS total_value
            FROM crm_leads 
            WHERE tenant_id = ?
            GROUP BY source
            ORDER BY count DESC
        ");
        $srcStmt->execute([$tenantId]);
        $bySource = $srcStmt->fetchAll();

        // 3. Leads by Status
        $stStmt = $db->prepare("
            SELECT 
                status,
                COUNT(*) AS count,
                COALESCE(SUM(value), 0) AS total_value
            FROM crm_leads 
            WHERE tenant_id = ?
            GROUP BY status
        ");
        $stStmt->execute([$tenantId]);
        $byStatus = $stStmt->fetchAll();

        // 4. Follow-up Activity Metrics
        $fStmt = $db->prepare("
            SELECT 
                COUNT(*) AS total_followups,
                SUM(CASE WHEN status = 'pending' AND scheduled_at >= NOW() THEN 1 ELSE 0 END) AS pending_followups,
                SUM(CASE WHEN status = 'pending' AND scheduled_at < NOW() THEN 1 ELSE 0 END) AS overdue_followups,
                SUM(CASE WHEN status = 'pending' AND DATE(scheduled_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS today_followups,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_followups
            FROM follow_ups
            WHERE tenant_id = ?
        ");
        $fStmt->execute([$tenantId]);
        $followStats = $fStmt->fetch();

        // 5. Urgent / Overdue Leads needing immediate follow-up
        $urgentStmt = $db->prepare("
            SELECT l.id, l.name, l.company, l.phone, l.source, l.priority, l.next_followup_date, l.status,
                   u.name AS assigned_user_name
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.tenant_id = ? AND l.next_followup_date < NOW() AND l.status NOT IN ('won', 'lost')
            ORDER BY l.next_followup_date ASC
            LIMIT 5
        ");
        $urgentStmt->execute([$tenantId]);
        $overdueLeadsList = $urgentStmt->fetchAll();

        // 6. Today's Scheduled Follow-ups
        $todayStmt = $db->prepare("
            SELECT l.id, l.name, l.company, l.phone, l.source, l.priority, l.next_followup_date, l.status,
                   u.name AS assigned_user_name
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.tenant_id = ? AND DATE(l.next_followup_date) = CURRENT_DATE() AND l.status NOT IN ('won', 'lost')
            ORDER BY l.next_followup_date ASC
            LIMIT 5
        ");
        $todayStmt->execute([$tenantId]);
        $todayLeadsList = $todayStmt->fetchAll();

        Response::success([
            'summary' => [
                'total_leads' => $totalLeads,
                'new_leads' => (int)$counts['new_leads'],
                'converted_leads' => $convertedLeads,
                'lost_leads' => (int)$counts['lost_leads'],
                'overdue_leads' => (int)$counts['overdue_leads'],
                'today_leads' => (int)$counts['today_leads'],
                'pending_leads' => (int)$counts['pending_leads'],
                'no_followup_leads' => (int)$counts['no_followup_leads'],
                'conversion_rate' => $conversionRate,
                'total_pipeline_value' => (float)$counts['total_pipeline_value'],
                'won_pipeline_value' => (float)$counts['won_pipeline_value']
            ],
            'followups' => [
                'total_followups' => (int)$followStats['total_followups'],
                'pending_followups' => (int)$followStats['pending_followups'],
                'overdue_followups' => (int)$followStats['overdue_followups'],
                'today_followups' => (int)$followStats['today_followups'],
                'completed_followups' => (int)$followStats['completed_followups']
            ],
            'by_source' => $bySource,
            'by_status' => $byStatus,
            'overdue_leads_list' => $overdueLeadsList,
            'today_leads_list' => $todayLeadsList
        ]);
    }

    /**
     * Webhook lead intake for SEO & Website forms (WordPress, Elementor, Webflow, Landing Pages)
     * Authenticated via header 'X-Tenant-Key' or 'webhook_secret' parameter
     */
    public static function webhookIntake(): void {
        $headers = getallheaders();
        $apiKey = $headers['X-Tenant-Key'] ?? ($headers['x-tenant-key'] ?? ($_GET['key'] ?? ''));

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        if (empty($apiKey) && !empty($input['webhook_secret'])) {
            $apiKey = $input['webhook_secret'];
        }

        if (empty($apiKey)) {
            Response::error('Missing authorized X-Tenant-Key.', 401);
        }

        // Security Rate Limiting: max 60 requests per minute per IP
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $rateKey = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mc_rate_' . md5($clientIp . '_' . date('YmdHi'));
        $hits = (int)@file_get_contents($rateKey);
        if ($hits > 60) {
            Response::error('Rate limit exceeded. Too many webhook submissions.', 429);
        }
        @file_put_contents($rateKey, (string)($hits + 1), LOCK_EX);

        $db = Database::getConnection();

        // Find tenant by webhook secret in lead_sources_config
        $srcStmt = $db->prepare("SELECT tenant_id, source_key, name FROM lead_sources_config WHERE webhook_secret = ? LIMIT 1");
        $srcStmt->execute([$apiKey]);
        $sourceConfig = $srcStmt->fetch();

        if (!$sourceConfig) {
            Response::error('Invalid tenant webhook credentials.', 403);
        }

        $tenantId = (int)$sourceConfig['tenant_id'];
        $sourceName = $sourceConfig['name'] ?: 'SEO & Website';

        $name = trim($input['name'] ?? $input['full_name'] ?? $input['your-name'] ?? '');
        $email = trim($input['email'] ?? $input['your-email'] ?? '');
        $phone = trim($input['phone'] ?? $input['your-phone'] ?? $input['mobile'] ?? '');
        $company = trim($input['company'] ?? $input['company_name'] ?? '');
        $service = trim($input['service'] ?? $input['service_requirement'] ?? $input['subject'] ?? 'Website Inquiry');
        $notes = trim($input['message'] ?? $input['notes'] ?? $input['your-message'] ?? '');
        $sourceLeadId = trim($input['form_id'] ?? $input['submission_id'] ?? '');

        if (empty($name)) {
            Response::error('Lead contact name is required.', 422);
        }

        // Replay Protection against duplicate webhook events (submission_id within last 5 minutes)
        if (!empty($sourceLeadId)) {
            $replayStmt = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND source_lead_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) LIMIT 1");
            $replayStmt->execute([$tenantId, $sourceLeadId]);
            $replayId = $replayStmt->fetchColumn();
            if ($replayId) {
                Response::success(['id' => (int)$replayId, 'duplicate' => true], 'Duplicate submission event acknowledged (Replay Protection).');
                return;
            }
        }

        // Duplicate Check
        if (!empty($phone) || !empty($email)) {
            $dupStmt = $db->prepare("
                SELECT id FROM crm_leads 
                WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) 
                LIMIT 1
            ");
            $dupStmt->execute([$tenantId, $phone, $email]);
            $existingId = $dupStmt->fetchColumn();

            if ($existingId) {
                // Log duplicate activity touchpoint instead of dropping
                $db->prepare("
                    INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description)
                    VALUES (?, ?, 'email', 'Repeat Website Form Submission', ?)
                ")->execute([
                    $tenantId,
                    $existingId,
                    "Repeat inquiry from {$sourceName}. Message: {$notes}"
                ]);

                // Update next follow-up to today if expired
                $db->prepare("
                    UPDATE crm_leads 
                    SET next_followup_date = CURRENT_TIMESTAMP(), updated_at = NOW() 
                    WHERE id = ? AND tenant_id = ?
                ")->execute([$existingId, $tenantId]);

                Response::success(['id' => (int)$existingId, 'duplicate' => true], 'Repeat lead noted and prioritized.');
                return;
            }
        }

        $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));

        $stmt = $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, source,
                source_platform, sync_status, service_requirement, priority,
                source_lead_id, next_followup_date, notes
            ) VALUES (?, ?, ?, ?, ?, 0.00, 'new', ?, 'seo', 'webhook', ?, 'high', ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            $company,
            $email,
            $phone,
            $sourceName,
            $service,
            $sourceLeadId,
            $nextFollowup,
            $notes
        ]);

        $leadId = (int)$db->lastInsertId();

        // Create initial follow-up reminder
        $db->prepare("
            INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, status)
            VALUES (?, ?, ?, ?, ?, 'call', 'pending')
        ")->execute([
            $tenantId,
            $leadId,
            "Urgent: New Website Lead - " . $name,
            "New incoming website inquiry for '{$service}'. Contact lead promptly.",
            $nextFollowup
        ]);

        // Log activity
        $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description)
            VALUES (?, ?, 'import', 'Website Form Captured', ?)
        ")->execute([
            $tenantId,
            $leadId,
            "Captured live via {$sourceName} webhook. Service: {$service}"
        ]);

        // Update sync count
        $db->prepare("
            UPDATE lead_sources_config 
            SET last_sync_at = NOW(), sync_count = sync_count + 1, updated_at = NOW() 
            WHERE tenant_id = ? AND webhook_secret = ?
        ")->execute([$tenantId, $apiKey]);

        Response::success(['id' => $leadId], 'Website lead captured successfully', 201);
    }

    /**
     * Get HTML embed code & webhook details for website lead capture
     */
    public static function getEmbedCode(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT webhook_secret FROM lead_sources_config WHERE tenant_id = ? AND source_key = 'website_seo' LIMIT 1");
        $stmt->execute([$tenantId]);
        $key = $stmt->fetchColumn();

        if (!$key) {
            $key = bin2hex(random_bytes(16));
            $db->prepare("
                INSERT INTO lead_sources_config (tenant_id, source_key, name, category, status, webhook_secret, is_enabled)
                VALUES (?, 'website_seo', 'SEO & Website Forms', 'inbound', 'connected', ?, 1)
                ON DUPLICATE KEY UPDATE webhook_secret = VALUES(webhook_secret)
            ")->execute([$tenantId, $key]);
        }

        $apiUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "/api/leads/webhook";

        $htmlSnippet = <<<HTML
<!-- MY COCKPIT AI - Real-time Lead Intake Form -->
<form id="cockpit-lead-form" onsubmit="submitCockpitLead(event)">
  <input type="text" name="name" placeholder="Full Name *" required />
  <input type="text" name="company" placeholder="Company Name" />
  <input type="tel" name="phone" placeholder="Phone Number *" required />
  <input type="email" name="email" placeholder="Email Address" />
  <input type="text" name="service" placeholder="Service / Requirement" />
  <textarea name="notes" placeholder="Requirement details..."></textarea>
  <button type="submit" style="background:#D62839;color:#fff;padding:10px 20px;border-radius:8px;border:none;font-weight:bold;cursor:pointer;">
    Submit Requirement
  </button>
  <div id="cockpit-lead-status" style="margin-top:10px;font-size:13px;"></div>
</form>

<script>
function submitCockpitLead(e) {
  e.preventDefault();
  const form = e.target;
  const statusDiv = document.getElementById('cockpit-lead-status');
  statusDiv.innerText = 'Submitting your request...';

  const payload = {
    name: form.name.value,
    company: form.company.value,
    phone: form.phone.value,
    email: form.email.value,
    service: form.service.value,
    notes: form.notes.value
  };

  fetch('{$apiUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': '{$key}'
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      statusDiv.innerHTML = '<span style="color:#059669;font-weight:bold;">Thank you! We will get in touch with you shortly.</span>';
      form.reset();
    } else {
      statusDiv.innerHTML = '<span style="color:#D62839;">' + (data.message || 'Submission error') + '</span>';
    }
  })
  .catch(err => {
    statusDiv.innerHTML = '<span style="color:#D62839;">Network connection error. Please try again.</span>';
  });
}
</script>
HTML;

        Response::success([
            'webhook_url' => $apiUrl,
            'webhook_key' => $key,
            'html_snippet' => $htmlSnippet
        ]);
    }

    /**
     * Get automation capability matrix & hosting environment evaluation
     */
    public static function getPlatformCapabilityMatrix(array $currentUser): void {
        $syncMgr = new BidirectionalSyncManager();
        $capabilities = $syncMgr->getCapabilityMatrix();
        $hosting = HostingEvaluator::evaluate();

        Response::success([
            'matrix' => $capabilities,
            'hosting_evaluation' => $hosting
        ]);
    }

    /**
     * Save/update encrypted platform session
     */
    public static function savePlatformSession(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $platform = strtolower(trim($input['platform'] ?? ''));
        $sessionData = $input['session_data'] ?? [];

        if (empty($platform)) {
            Response::error('Platform key is required.', 422);
        }

        $syncMgr = new BidirectionalSyncManager();
        $saved = $syncMgr->savePlatformSession($tenantId, $platform, $sessionData);

        if (!$saved) {
            Response::error('Failed to save platform session.', 500);
        }

        $sessionInfo = $syncMgr->getPlatformSession($tenantId, $platform);
        Response::success($sessionInfo, 'Platform session updated successfully');
    }

    /**
     * Get platform session validation status
     */
    public static function getPlatformSession(array $currentUser, string $platform): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $syncMgr = new BidirectionalSyncManager();
        $sessionInfo = $syncMgr->getPlatformSession($tenantId, strtolower($platform));
        Response::success($sessionInfo);
    }

    /**
     * Queue a lead change for external platform synchronization
     */
    public static function queueLeadWriteback(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $proposedChanges = $input['changes'] ?? $input;
        $autoConfirm = !empty($input['auto_confirm']);

        $syncMgr = new BidirectionalSyncManager();
        $result = $syncMgr->queueWriteback($tenantId, $leadId, $proposedChanges, $autoConfirm);

        if (!$result['success']) {
            Response::error($result['message'], 400, $result);
        }

        Response::success($result, $result['message']);
    }

    /**
     * Execute queued writeback after user confirmation
     */
    public static function executeLeadWriteback(array $currentUser, int $queueId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $syncMgr = new BidirectionalSyncManager();
        $result = $syncMgr->executeWriteback($tenantId, $queueId);

        if (!$result['success']) {
            Response::error($result['message'], 400, $result);
        }

        Response::success($result, $result['message']);
    }

    /**
     * Resolve conflict between Cockpit and remote platform
     */
    public static function resolveLeadConflict(array $currentUser, int $queueId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $resolution = trim($input['resolution'] ?? ''); // 'keep_cockpit' or 'keep_external'

        $syncMgr = new BidirectionalSyncManager();
        $result = $syncMgr->resolveConflict($tenantId, $queueId, $resolution);

        if (!$result['success']) {
            Response::error($result['message'], 400, $result);
        }

        Response::success($result, $result['message']);
    }

    /**
     * Get writeback history and external status for a lead
     */
    public static function getLeadWritebackStatus(array $currentUser, int $leadId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $leadStmt = $db->prepare("SELECT id, source_platform, source_lead_id, external_sync_status, last_external_sync_at, external_snapshot_json FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $leadStmt->execute([$leadId, $tenantId]);
        $lead = $leadStmt->fetch();

        if (!$lead) {
            Response::error('Lead not found.', 404);
        }

        $qStmt = $db->prepare("SELECT * FROM lead_writeback_queue WHERE lead_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 10");
        $qStmt->execute([$leadId, $tenantId]);
        $queueItems = $qStmt->fetchAll();

        Response::success([
            'lead' => $lead,
            'writeback_queue' => $queueItems
        ]);
    }
}

