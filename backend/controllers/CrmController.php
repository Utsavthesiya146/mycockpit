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

    // ================= LEADS =================
    public static function listLeads(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM crm_leads WHERE tenant_id = ? ORDER BY created_at DESC");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createLead(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($input['name'] ?? '');
        $value = (float)($input['value'] ?? 0);

        if (empty($name)) {
            Response::error('Lead title/contact name is required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO crm_leads (tenant_id, name, company, email, phone, value, status, source, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $name,
            trim($input['company'] ?? ''),
            trim($input['email'] ?? ''),
            trim($input['phone'] ?? ''),
            $value,
            $input['status'] ?? 'new',
            trim($input['source'] ?? ''),
            trim($input['notes'] ?? '')
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Lead created successfully', 201);
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
        $stmt = $db->prepare("UPDATE crm_leads SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$status, $leadId, $tenantId]);

        Response::success(null, 'Lead status updated');
    }
}
