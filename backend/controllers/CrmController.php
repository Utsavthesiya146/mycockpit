<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class CrmController {
    // ================= CUSTOMERS =================
    public static function listCustomers(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT c.*,
                   (SELECT COUNT(*) FROM crm_contacts cc WHERE cc.customer_id = c.id) AS contacts_count,
                   (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i WHERE i.customer_id = c.id) AS total_invoiced,
                   (SELECT COALESCE(SUM(i.outstanding_amount), 0) FROM invoices i WHERE i.customer_id = c.id) AS outstanding_balance
            FROM crm_customers c
            WHERE c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createCustomer(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');

        if (empty($name)) {
            Response::error('Customer name is required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO crm_customers (tenant_id, name, company, email, phone, address, city, country, tax_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            trim($input['company'] ?? ''),
            trim($input['email'] ?? ''),
            trim($input['phone'] ?? ''),
            trim($input['address'] ?? ''),
            trim($input['city'] ?? ''),
            trim($input['country'] ?? 'India'),
            trim($input['tax_id'] ?? ''),
            $input['status'] ?? 'active'
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Customer created successfully', 201);
    }

    // ================= CENTRALIZED LEADS =================
    public static function listLeads(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $source = trim($_GET['source'] ?? '');
        $status = trim($_GET['status'] ?? '');
        $followupStatus = trim($_GET['followup_status'] ?? '');
        $assignedTo = !empty($_GET['assigned_to']) ? (int)$_GET['assigned_to'] : 0;
        $priority = trim($_GET['priority'] ?? '');
        $search = trim($_GET['search'] ?? '');

        $sql = "
            SELECT l.*,
                   COALESCE(u.name, CONCAT(e.first_name, ' ', e.last_name), 'Unassigned') AS assigned_employee_name,
                   u.email AS assigned_employee_email,
                   (
                       SELECT f.title 
                       FROM follow_ups f 
                       WHERE f.lead_id = l.id 
                       ORDER BY f.scheduled_at DESC 
                       LIMIT 1
                   ) AS last_followup_title,
                   (
                       SELECT f.status 
                       FROM follow_ups f 
                       WHERE f.lead_id = l.id 
                       ORDER BY f.scheduled_at DESC 
                       LIMIT 1
                   ) AS last_followup_status,
                   (
                       SELECT f.contact_method 
                       FROM follow_ups f 
                       WHERE f.lead_id = l.id 
                       ORDER BY f.scheduled_at DESC 
                       LIMIT 1
                   ) AS last_contact_method,
                   (
                       SELECT COUNT(*) 
                       FROM follow_ups f 
                       WHERE f.lead_id = l.id
                   ) AS total_followups_count,
                   (
                       SELECT COUNT(*) 
                       FROM lead_activities la 
                       WHERE la.lead_id = l.id
                   ) AS total_activities_count,
                   CASE 
                       WHEN l.status = 'won' THEN 'won'
                       WHEN l.status = 'lost' THEN 'lost'
                       WHEN l.next_followup_date IS NULL AND (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id) = 0 THEN 'no_followup'
                       WHEN l.next_followup_date IS NOT NULL AND l.next_followup_date < NOW() THEN 'overdue'
                       WHEN l.next_followup_date IS NOT NULL AND DATE(l.next_followup_date) = CURRENT_DATE THEN 'today'
                       WHEN l.next_followup_date IS NOT NULL AND l.next_followup_date > NOW() THEN 'pending'
                       WHEN (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'completed') > 0 THEN 'completed'
                       ELSE 'no_followup'
                   END AS calculated_followup_status
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            LEFT JOIN hrm_employees e ON l.assigned_to = e.id
            WHERE l.tenant_id = ?
        ";

        $params = [$tenantId];

        if (!empty($source) && $source !== 'all') {
            $sql .= " AND (l.source = ? OR l.source_platform = ? OR l.source LIKE ?)";
            $params[] = $source;
            $params[] = strtolower($source);
            $params[] = "%{$source}%";
        }

        $platform = trim($_GET['source_platform'] ?? ($_GET['platform'] ?? ''));
        if (!empty($platform) && $platform !== 'all') {
            $sql .= " AND (l.source_platform = ? OR l.source LIKE ?)";
            $params[] = strtolower($platform);
            $params[] = "%{$platform}%";
        }

        if (!empty($status) && $status !== 'all') {
            $sql .= " AND l.status = ?";
            $params[] = $status;
        }

        if ($assignedTo > 0) {
            $sql .= " AND l.assigned_to = ?";
            $params[] = $assignedTo;
        }

        if (!empty($priority) && $priority !== 'all') {
            $sql .= " AND l.priority = ?";
            $params[] = $priority;
        }

        if (!empty($search)) {
            $sql .= " AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.service_requirement LIKE ? OR l.notes LIKE ?)";
            $term = "%{$search}%";
            array_push($params, $term, $term, $term, $term, $term, $term);
        }

        $sql .= " ORDER BY l.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $leads = $stmt->fetchAll();

        // Apply in-memory follow-up status filtering if specified (since calculated_followup_status is derived)
        if (!empty($followupStatus) && $followupStatus !== 'all') {
            $leads = array_values(array_filter($leads, function($item) use ($followupStatus) {
                if ($followupStatus === 'new') {
                    return $item['status'] === 'new';
                }
                return $item['calculated_followup_status'] === $followupStatus;
            }));
        }

        Response::success($leads);
    }

    public static function getLead(array $currentUser, int $leadId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT l.*,
                   COALESCE(u.name, CONCAT(e.first_name, ' ', e.last_name), 'Unassigned') AS assigned_employee_name,
                   u.email AS assigned_employee_email,
                   u.phone AS assigned_employee_phone
            FROM crm_leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            LEFT JOIN hrm_employees e ON l.assigned_to = e.id
            WHERE l.id = ? AND l.tenant_id = ?
        ");
        $stmt->execute([$leadId, $tenantId]);
        $lead = $stmt->fetch();

        if (!$lead) {
            Response::error('Lead not found or access denied.', 404);
        }

        // Fetch Follow-up History
        $fStmt = $db->prepare("
            SELECT f.*,
                   COALESCE(u.name, 'Admin') AS scheduled_by_name
            FROM follow_ups f
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.lead_id = ? AND f.tenant_id = ?
            ORDER BY f.scheduled_at DESC
        ");
        $fStmt->execute([$leadId, $tenantId]);
        $lead['follow_ups'] = $fStmt->fetchAll();

        // Fetch Activities Timeline
        $aStmt = $db->prepare("
            SELECT a.*,
                   COALESCE(u.name, 'Team Member') AS user_name
            FROM lead_activities a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.lead_id = ? AND a.tenant_id = ?
            ORDER BY a.activity_date DESC
        ");
        $aStmt->execute([$leadId, $tenantId]);
        $lead['activities'] = $aStmt->fetchAll();

        Response::success($lead);
    }

    public static function createLead(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $company = trim($input['company'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $value = (float)($input['value'] ?? 0);
        $status = $input['status'] ?? 'new';
        $priority = $input['priority'] ?? 'medium';
        $source = trim($input['source'] ?? 'Manual');
        $serviceRequirement = trim($input['service_requirement'] ?? '');
        $assignedTo = !empty($input['assigned_to']) ? (int)$input['assigned_to'] : null;
        $sourceLeadId = trim($input['source_lead_id'] ?? '');
        $notes = trim($input['notes'] ?? '');
        $nextFollowupDate = !empty($input['next_followup_date']) ? $input['next_followup_date'] : null;
        $followupTitle = trim($input['followup_title'] ?? '');
        $contactMethod = $input['contact_method'] ?? 'call';
        $forceCreate = !empty($input['force_create']);

        if (empty($name)) {
            Response::error('Lead title / contact name is required.', 422);
        }

        $db = Database::getConnection();

        // Duplicate Detection Check (Tenant Isolated)
        if (!$forceCreate) {
            $dupConditions = [];
            $dupParams = [$tenantId];

            if (!empty($email)) {
                $dupConditions[] = "email = ?";
                $dupParams[] = $email;
            }
            if (!empty($phone)) {
                $dupConditions[] = "phone = ?";
                $dupParams[] = $phone;
            }
            if (!empty($sourceLeadId)) {
                $dupConditions[] = "(source = ? AND source_lead_id = ?)";
                $dupParams[] = $source;
                $dupParams[] = $sourceLeadId;
            }

            if (!empty($dupConditions)) {
                $checkSql = "SELECT id, name, company, email, phone, source FROM crm_leads WHERE tenant_id = ? AND (" . implode(" OR ", $dupConditions) . ") LIMIT 1";
                $checkStmt = $db->prepare($checkSql);
                $checkStmt->execute($dupParams);
                $existing = $checkStmt->fetch();

                if ($existing) {
                    Response::error(
                        "Duplicate Lead Detected: An existing lead with matching contact details already exists ({$existing['name']} at {$existing['company']}, Source: {$existing['source']}).",
                        409,
                        ['existing_lead' => $existing]
                    );
                }
            }
        }

        // Insert Lead
        $stmt = $db->prepare("
            INSERT INTO crm_leads 
            (tenant_id, name, company, email, phone, value, status, priority, source, service_requirement, assigned_to, source_lead_id, last_contact_date, next_followup_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            $company,
            $email,
            $phone,
            $value,
            $status,
            $priority,
            $source,
            $serviceRequirement,
            $assignedTo,
            $sourceLeadId,
            $nextFollowupDate,
            $notes
        ]);

        $leadId = (int)$db->lastInsertId();

        // Automatic Follow-up creation if scheduled date provided
        if (!empty($nextFollowupDate)) {
            $fTitle = !empty($followupTitle) ? $followupTitle : "Initial Follow-up: {$name} ({$source})";
            $fStmt = $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, assigned_to, title, contact_method, notes, scheduled_at, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ");
            $fStmt->execute([
                $tenantId,
                $leadId,
                $assignedTo,
                $fTitle,
                $contactMethod,
                $notes,
                $nextFollowupDate,
                $currentUser['id']
            ]);
        }

        // Record Activity Entry
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
            VALUES (?, ?, ?, 'system', 'Lead Captured & Registered', ?, NOW())
        ");
        $actDesc = "Lead added to system from {$source}." . (!empty($serviceRequirement) ? " Requirement: {$serviceRequirement}" : "");
        $actStmt->execute([$tenantId, $leadId, $currentUser['id'], $actDesc]);

        Response::success(['id' => $leadId], 'Lead created successfully', 201);
    }

    public static function updateLead(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db = Database::getConnection();

        // Verify lead belongs to tenant
        $checkStmt = $db->prepare("SELECT * FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $checkStmt->execute([$leadId, $tenantId]);
        $existing = $checkStmt->fetch();

        if (!$existing) {
            Response::error('Lead not found or access denied.', 404);
        }

        $name = trim($input['name'] ?? $existing['name']);
        $company = trim($input['company'] ?? $existing['company']);
        $email = trim($input['email'] ?? $existing['email']);
        $phone = trim($input['phone'] ?? $existing['phone']);
        $value = isset($input['value']) ? (float)$input['value'] : (float)$existing['value'];
        $status = $input['status'] ?? $existing['status'];
        $priority = $input['priority'] ?? $existing['priority'];
        $source = trim($input['source'] ?? $existing['source']);
        $serviceRequirement = trim($input['service_requirement'] ?? $existing['service_requirement']);
        $assignedTo = array_key_exists('assigned_to', $input) 
            ? (!empty($input['assigned_to']) ? (int)$input['assigned_to'] : null) 
            : $existing['assigned_to'];
        $notes = trim($input['notes'] ?? $existing['notes']);
        $nextFollowupDate = array_key_exists('next_followup_date', $input) 
            ? (!empty($input['next_followup_date']) ? $input['next_followup_date'] : null)
            : $existing['next_followup_date'];

        $stmt = $db->prepare("
            UPDATE crm_leads 
            SET name = ?, company = ?, email = ?, phone = ?, value = ?, status = ?, 
                priority = ?, source = ?, service_requirement = ?, assigned_to = ?, 
                next_followup_date = ?, notes = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $name, $company, $email, $phone, $value, $status,
            $priority, $source, $serviceRequirement, $assignedTo,
            $nextFollowupDate, $notes, $leadId, $tenantId
        ]);

        // If status changed, record activity
        if ($existing['status'] !== $status) {
            $actStmt = $db->prepare("
                INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
                VALUES (?, ?, ?, 'status_change', 'Lead Status Changed', ?, NOW())
            ");
            $desc = "Pipeline status updated from " . strtoupper($existing['status']) . " to " . strtoupper($status);
            $actStmt->execute([$tenantId, $leadId, $currentUser['id'], $desc]);
        }

        Response::success(null, 'Lead updated successfully');
    }

    public static function updateLeadStatus(array $currentUser, int $leadId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? '';

        $validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
        if (!in_array($status, $validStatuses, true)) {
            Response::error('Invalid lead pipeline status.', 422);
        }

        $db = Database::getConnection();

        // Get old status
        $oldStmt = $db->prepare("SELECT status FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $oldStmt->execute([$leadId, $tenantId]);
        $old = $oldStmt->fetchColumn();

        if ($old === false) {
            Response::error('Lead not found.', 404);
        }

        $stmt = $db->prepare("UPDATE crm_leads SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$status, $leadId, $tenantId]);

        // Record Activity
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
            VALUES (?, ?, ?, 'status_change', 'Lead Status Updated', ?, NOW())
        ");
        $actStmt->execute([
            $tenantId,
            $leadId,
            $currentUser['id'],
            "Status changed from " . strtoupper((string)$old) . " to " . strtoupper($status)
        ]);

        Response::success(null, 'Lead status updated');
    }

    public static function logActivity(array $currentUser, int $leadId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $activityType = $input['activity_type'] ?? 'note';
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $outcome = trim($input['outcome'] ?? '');
        $nextFollowupDate = !empty($input['next_followup_date']) ? $input['next_followup_date'] : null;
        $nextFollowupTitle = trim($input['next_followup_title'] ?? '');
        $nextContactMethod = $input['next_contact_method'] ?? 'call';

        $validTypes = ['call', 'email', 'meeting', 'whatsapp', 'note', 'status_change', 'import', 'system'];
        if (!in_array($activityType, $validTypes, true)) {
            Response::error('Invalid activity type.', 422);
        }

        if (empty($title)) {
            $typeNames = [
                'call' => 'Phone Call Logged',
                'email' => 'Email Interaction Logged',
                'meeting' => 'Meeting Conducted',
                'whatsapp' => 'WhatsApp Discussion Logged',
                'note' => 'Internal Note Added'
            ];
            $title = $typeNames[$activityType] ?? 'Touchpoint Recorded';
        }

        $db = Database::getConnection();

        // Verify lead belongs to tenant
        $lStmt = $db->prepare("SELECT id, name, company FROM crm_leads WHERE id = ? AND tenant_id = ?");
        $lStmt->execute([$leadId, $tenantId]);
        $lead = $lStmt->fetch();

        if (!$lead) {
            Response::error('Lead not found or access denied.', 404);
        }

        // 1. Insert into lead_activities
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $fullDesc = $description . (!empty($outcome) ? "\nOutcome: {$outcome}" : "");
        $actStmt->execute([$tenantId, $leadId, $currentUser['id'], $activityType, $title, $fullDesc]);

        // 2. Update lead's last_contact_date
        $upSql = "UPDATE crm_leads SET last_contact_date = NOW()";
        $upParams = [];

        // If next follow-up is scheduled
        if (!empty($nextFollowupDate)) {
            $upSql .= ", next_followup_date = ?";
            $upParams[] = $nextFollowupDate;

            // Also create a pending follow-up in follow_ups
            $fTitle = !empty($nextFollowupTitle) ? $nextFollowupTitle : "Follow-up with {$lead['name']}";
            $fStmt = $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, assigned_to, title, contact_method, notes, scheduled_at, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ");
            $fStmt->execute([
                $tenantId,
                $leadId,
                $currentUser['id'],
                $fTitle,
                $nextContactMethod,
                $description,
                $nextFollowupDate,
                $currentUser['id']
            ]);
        }

        $upSql .= ", updated_at = NOW() WHERE id = ? AND tenant_id = ?";
        $upParams[] = $leadId;
        $upParams[] = $tenantId;

        $db->prepare($upSql)->execute($upParams);

        Response::success(null, 'Touchpoint logged successfully');
    }

    public static function importLeads(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $leads = $input['leads'] ?? [];
        $defaultSource = trim($input['source'] ?? 'Manual');
        $duplicateStrategy = $input['duplicate_strategy'] ?? 'skip'; // 'skip', 'update', 'allow'

        if (!is_array($leads) || empty($leads)) {
            Response::error('No lead records provided for import.', 422);
        }

        $db = Database::getConnection();

        $imported = 0;
        $skipped = 0;
        $updated = 0;
        $errors = [];

        $insertStmt = $db->prepare("
            INSERT INTO crm_leads 
            (tenant_id, name, company, email, phone, value, status, priority, source, service_requirement, assigned_to, source_lead_id, last_contact_date, next_followup_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ");

        $updateStmt = $db->prepare("
            UPDATE crm_leads 
            SET name = ?, company = ?, value = ?, status = ?, priority = ?, 
                service_requirement = ?, notes = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");

        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
            VALUES (?, ?, ?, 'import', 'Lead Imported into System', ?, NOW())
        ");

        foreach ($leads as $idx => $row) {
            $name = trim($row['name'] ?? $row['Full Name'] ?? $row['Contact Name'] ?? '');
            if (empty($name)) {
                $errors[] = "Row #" . ($idx + 1) . ": Name is missing.";
                continue;
            }

            $company = trim($row['company'] ?? $row['Company Name'] ?? $row['Organization'] ?? '');
            $email = trim($row['email'] ?? $row['Email Address'] ?? '');
            $phone = trim($row['phone'] ?? $row['Phone Number'] ?? $row['Mobile'] ?? '');
            $value = (float)($row['value'] ?? $row['Budget'] ?? $row['Estimated Value'] ?? 0);
            $status = trim($row['status'] ?? 'new');
            if (!in_array($status, ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'])) {
                $status = 'new';
            }
            $priority = trim($row['priority'] ?? 'medium');
            if (!in_array($priority, ['low', 'medium', 'high', 'urgent'])) {
                $priority = 'medium';
            }
            $source = trim($row['source'] ?? $defaultSource);
            $serviceRequirement = trim($row['service_requirement'] ?? $row['Requirement'] ?? $row['Service Needed'] ?? '');
            $sourceLeadId = trim((string)($row['source_lead_id'] ?? $row['Lead ID'] ?? $row['External ID'] ?? ''));
            $notes = trim($row['notes'] ?? $row['Comments'] ?? '');
            $nextFollowupDate = !empty($row['next_followup_date']) ? $row['next_followup_date'] : null;

            // Duplicate detection within tenant
            $existingId = null;
            if (!empty($sourceLeadId)) {
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND source = ? AND source_lead_id = ? LIMIT 1");
                $chk->execute([$tenantId, $source, $sourceLeadId]);
                $existingId = $chk->fetchColumn();
            }
            if (!$existingId && !empty($email)) {
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND email = ? LIMIT 1");
                $chk->execute([$tenantId, $email]);
                $existingId = $chk->fetchColumn();
            }
            if (!$existingId && !empty($phone)) {
                $chk = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND phone = ? LIMIT 1");
                $chk->execute([$tenantId, $phone]);
                $existingId = $chk->fetchColumn();
            }

            if ($existingId) {
                if ($duplicateStrategy === 'skip') {
                    $skipped++;
                    continue;
                } elseif ($duplicateStrategy === 'update') {
                    $updateStmt->execute([
                        $name, $company, $value, $status, $priority,
                        $serviceRequirement, $notes, (int)$existingId, $tenantId
                    ]);
                    $updated++;
                    continue;
                }
            }

            // Insert new lead
            $insertStmt->execute([
                $tenantId,
                $name,
                $company,
                $email,
                $phone,
                $value,
                $status,
                $priority,
                $source,
                $serviceRequirement,
                $currentUser['id'],
                $sourceLeadId,
                $nextFollowupDate,
                $notes
            ]);

            $newLeadId = (int)$db->lastInsertId();
            $imported++;

            $actStmt->execute([
                $tenantId,
                $newLeadId,
                $currentUser['id'],
                "Imported via batch sync for source: {$source}"
            ]);
        }

        // Update Lead Source sync counter if matching source_key exists
        $sourceKeyMap = [
            'BNI Connect' => 'bni',
            'KVV Leads' => 'kvv',
            'EAF Connect' => 'eaf',
            'SEO / Website' => 'website_seo',
            'Manual' => 'manual',
            'Custom' => 'custom'
        ];
        $key = $sourceKeyMap[$defaultSource] ?? 'custom';

        $syncUpdate = $db->prepare("
            UPDATE lead_sources_config 
            SET sync_count = sync_count + ?, last_sync_at = NOW() 
            WHERE tenant_id = ? AND source_key = ?
        ");
        $syncUpdate->execute([$imported, $tenantId, $key]);

        Response::success([
            'total_processed' => count($leads),
            'imported' => $imported,
            'skipped_duplicates' => $skipped,
            'updated' => $updated,
            'errors' => $errors
        ], "Processed {$imported} new leads, {$skipped} duplicates skipped, {$updated} records updated.");
    }

    public static function getLeadSources(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT s.*,
                   (
                       SELECT COUNT(*) 
                       FROM crm_leads l 
                       WHERE l.tenant_id = s.tenant_id 
                         AND (
                             l.source = s.name 
                             OR (s.source_key = 'bni' AND l.source LIKE '%BNI%')
                             OR (s.source_key = 'kvv' AND l.source LIKE '%KVV%')
                             OR (s.source_key = 'eaf' AND l.source LIKE '%EAF%')
                             OR (s.source_key = 'website_seo' AND (l.source LIKE '%SEO%' OR l.source LIKE '%Web%'))
                             OR (s.source_key = 'manual' AND l.source = 'Manual')
                         )
                   ) AS total_leads,
                   (
                       SELECT COUNT(*) 
                       FROM crm_leads l 
                       WHERE l.tenant_id = s.tenant_id 
                         AND l.status = 'won'
                         AND (
                             l.source = s.name 
                             OR (s.source_key = 'bni' AND l.source LIKE '%BNI%')
                             OR (s.source_key = 'kvv' AND l.source LIKE '%KVV%')
                             OR (s.source_key = 'eaf' AND l.source LIKE '%EAF%')
                             OR (s.source_key = 'website_seo' AND (l.source LIKE '%SEO%' OR l.source LIKE '%Web%'))
                         )
                   ) AS won_leads,
                   (
                       SELECT COUNT(*) 
                       FROM crm_leads l 
                       JOIN follow_ups f ON f.lead_id = l.id
                       WHERE l.tenant_id = s.tenant_id 
                         AND f.status = 'pending'
                         AND (
                             l.source = s.name 
                             OR (s.source_key = 'bni' AND l.source LIKE '%BNI%')
                             OR (s.source_key = 'kvv' AND l.source LIKE '%KVV%')
                             OR (s.source_key = 'eaf' AND l.source LIKE '%EAF%')
                             OR (s.source_key = 'website_seo' AND (l.source LIKE '%SEO%' OR l.source LIKE '%Web%'))
                         )
                   ) AS pending_followups
            FROM lead_sources_config s
            WHERE s.tenant_id = ?
            ORDER BY s.id ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function updateLeadSource(array $currentUser, string $sourceKey): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $db = Database::getConnection();

        $status = $input['status'] ?? null;
        $isEnabled = isset($input['is_enabled']) ? (int)$input['is_enabled'] : 1;
        $apiKey = $input['api_key'] ?? null;
        $webhookSecret = $input['webhook_secret'] ?? null;

        $stmt = $db->prepare("
            UPDATE lead_sources_config 
            SET status = COALESCE(?, status),
                is_enabled = ?,
                api_key = COALESCE(?, api_key),
                webhook_secret = COALESCE(?, webhook_secret),
                updated_at = NOW()
            WHERE tenant_id = ? AND source_key = ?
        ");
        $stmt->execute([$status, $isEnabled, $apiKey, $webhookSecret, $tenantId, $sourceKey]);

        Response::success(null, 'Lead source integration configuration saved');
    }

    /**
     * Public intake webhook for authorized website and landing page forms
     */
    public static function handlePublicWebhook(): void {
        // Authenticate via Webhook Secret / Token in Header or GET param
        $token = $_SERVER['HTTP_X_WEBHOOK_TOKEN'] ?? ($_GET['token'] ?? '');
        $token = trim($token);

        if (empty($token)) {
            Response::error('Unauthorized: Missing X-Webhook-Token or token query parameter.', 401);
        }

        $db = Database::getConnection();
        $srcStmt = $db->prepare("
            SELECT tenant_id, source_key, name 
            FROM lead_sources_config 
            WHERE webhook_secret = ? AND is_enabled = 1
            LIMIT 1
        ");
        $srcStmt->execute([$token]);
        $config = $srcStmt->fetch();

        if (!$config) {
            Response::error('Invalid or deactivated webhook token.', 403);
        }

        $tenantId = (int)$config['tenant_id'];

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $name = trim($data['name'] ?? $data['full_name'] ?? $data['your-name'] ?? '');
        if (empty($name)) {
            Response::error('Lead name is required.', 422);
        }

        $company = trim($data['company'] ?? $data['company_name'] ?? '');
        $email = trim($data['email'] ?? $data['your-email'] ?? '');
        $phone = trim($data['phone'] ?? $data['your-phone'] ?? $data['mobile'] ?? '');
        $serviceRequirement = trim($data['service_requirement'] ?? $data['service'] ?? $data['requirement'] ?? $data['subject'] ?? '');
        $notes = trim($data['notes'] ?? $data['message'] ?? $data['your-message'] ?? '');
        $source = !empty($data['source']) ? trim($data['source']) : 'SEO / Website';

        // Duplicate Check
        if (!empty($email) || !empty($phone)) {
            $chkStmt = $db->prepare("
                SELECT id FROM crm_leads 
                WHERE tenant_id = ? AND ((email != '' AND email = ?) OR (phone != '' AND phone = ?))
                LIMIT 1
            ");
            $chkStmt->execute([$tenantId, $email, $phone]);
            $existingId = $chkStmt->fetchColumn();

            if ($existingId) {
                // Log duplicate webhook attempt in activities
                $act = $db->prepare("
                    INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description, activity_date)
                    VALUES (?, ?, 'system', 'Repeated Webhook Submission', ?, NOW())
                ");
                $act->execute([
                    $tenantId,
                    (int)$existingId,
                    "Inbound website form submission received again from {$name} ({$email}). Contact already in system."
                ]);

                Response::success(['id' => (int)$existingId, 'duplicate' => true], 'Submission received. Lead already in queue.');
            }
        }

        // Insert new lead
        $insert = $db->prepare("
            INSERT INTO crm_leads 
            (tenant_id, name, company, email, phone, value, status, priority, source, service_requirement, last_contact_date, next_followup_date, notes)
            VALUES (?, ?, ?, ?, ?, 0.00, 'new', 'high', ?, ?, NULL, DATE_ADD(NOW(), INTERVAL 2 HOUR), ?)
        ");
        $insert->execute([
            $tenantId,
            $name,
            $company,
            $email,
            $phone,
            $source,
            $serviceRequirement,
            $notes
        ]);

        $newId = (int)$db->lastInsertId();

        // Create high-priority initial follow-up reminder
        $fStmt = $db->prepare("
            INSERT INTO follow_ups 
            (tenant_id, lead_id, title, contact_method, notes, scheduled_at, status, reminder_time)
            VALUES (?, ?, ?, 'call', ?, DATE_ADD(NOW(), INTERVAL 2 HOUR), 'pending', NOW())
        ");
        $fStmt->execute([
            $tenantId,
            $newId,
            "Urgent: Contact Inbound Web Lead {$name}",
            "Inbound website inquiry. Requirement: {$serviceRequirement}\nMessage: {$notes}"
        ]);

        // Record activity
        $actStmt = $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description, activity_date)
            VALUES (?, ?, 'import', 'New Inbound Website Lead Captured', ?, NOW())
        ");
        $actStmt->execute([
            $tenantId,
            $newId,
            "Captured live via authorized webhook intake from {$source}."
        ]);

        // Update sync count
        $db->prepare("UPDATE lead_sources_config SET sync_count = sync_count + 1, last_sync_at = NOW() WHERE tenant_id = ? AND source_key = 'website_seo'")
           ->execute([$tenantId]);

        Response::success(['id' => $newId, 'status' => 'created'], 'Lead captured successfully', 201);
    }
}
