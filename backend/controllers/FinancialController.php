<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class FinancialController {
    public static function getSummary(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        // 1. Core Financial Aggregates directly from MySQL records
        $stmt = $db->prepare("
            SELECT 
                COALESCE(SUM(total_amount), 0) AS total_receivable,
                COALESCE(SUM(paid_amount), 0) AS total_received,
                COALESCE(SUM(outstanding_amount), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN outstanding_amount ELSE 0 END), 0) AS overdue_amount,
                COUNT(id) AS total_invoices_count,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_invoices_count,
                COUNT(CASE WHEN status = 'partially_paid' THEN 1 END) AS partially_paid_count,
                COUNT(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN 1 END) AS overdue_invoices_count
            FROM invoices
            WHERE tenant_id = ? AND status != 'cancelled'
        ");
        $stmt->execute([$tenantId]);
        $summary = $stmt->fetch();

        // Cast to proper floats
        $summary['total_receivable'] = (float)$summary['total_receivable'];
        $summary['total_received'] = (float)$summary['total_received'];
        $summary['pending_amount'] = (float)$summary['pending_amount'];
        $summary['overdue_amount'] = (float)$summary['overdue_amount'];

        // 2. Recent Payments
        $payStmt = $db->prepare("
            SELECT p.*, i.invoice_number, c.name AS customer_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN crm_customers c ON i.customer_id = c.id
            WHERE p.tenant_id = ?
            ORDER BY p.payment_date DESC, p.created_at DESC
            LIMIT 10
        ");
        $payStmt->execute([$tenantId]);
        $summary['recent_payments'] = $payStmt->fetchAll();

        // 3. Monthly Revenue Trend (Last 6 Months)
        $monthStmt = $db->prepare("
            SELECT 
                DATE_FORMAT(payment_date, '%Y-%m') AS month_label,
                SUM(amount) AS monthly_total
            FROM payments
            WHERE tenant_id = ? AND payment_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
            ORDER BY month_label ASC
        ");
        $monthStmt->execute([$tenantId]);
        $summary['monthly_revenue'] = $monthStmt->fetchAll();

        Response::success($summary);
    }
}
