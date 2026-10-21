<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class InvoiceController {
    public static function listInvoices(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT i.*, 
                   c.name AS customer_name,
                   c.company AS customer_company,
                   c.email AS customer_email,
                   (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items_count,
                   (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id) AS payments_count
            FROM invoices i
            JOIN crm_customers c ON i.customer_id = c.id
            WHERE i.tenant_id = ?
            ORDER BY i.created_at DESC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function getInvoice(array $currentUser, int $id): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT i.*, 
                   c.name AS customer_name,
                   c.company AS customer_company,
                   c.email AS customer_email,
                   c.phone AS customer_phone,
                   c.address AS customer_address,
                   c.tax_id AS customer_tax_id,
                   t.name AS tenant_name,
                   t.slug AS tenant_slug
            FROM invoices i
            JOIN crm_customers c ON i.customer_id = c.id
            JOIN tenants t ON i.tenant_id = t.id
            WHERE i.id = ? AND i.tenant_id = ?
        ");
        $stmt->execute([$id, $tenantId]);
        $invoice = $stmt->fetch();

        if (!$invoice) {
            Response::error('Invoice not found.', 404);
        }

        // Fetch items
        $itemsStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
        $itemsStmt->execute([$id]);
        $invoice['items'] = $itemsStmt->fetchAll();

        // Fetch payment history
        $paymentsStmt = $db->prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC");
        $paymentsStmt->execute([$id]);
        $invoice['payments'] = $paymentsStmt->fetchAll();

        Response::success($invoice);
    }

    public static function createInvoice(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin', 'employee']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $customerId = (int)($input['customer_id'] ?? 0);
        $invoiceNumber = trim($input['invoice_number'] ?? ('INV-' . strtoupper(substr(uniqid(), -6))));
        $invoiceDate = $input['invoice_date'] ?? date('Y-m-d');
        $dueDate = $input['due_date'] ?? date('Y-m-d', strtotime('+15 days'));
        $taxRate = (float)($input['tax_rate'] ?? 18.00);
        $discountType = $input['discount_type'] ?? 'fixed';
        $discountValue = (float)($input['discount_value'] ?? 0.00);
        $items = $input['items'] ?? [];

        if ($customerId <= 0) {
            Response::error('Valid customer selection is required.', 422);
        }

        if (empty($items) || !is_array($items)) {
            Response::error('Invoice must contain at least one line item.', 422);
        }

        $db = Database::getConnection();

        // Ensure customer belongs to this tenant
        $custStmt = $db->prepare("SELECT id FROM crm_customers WHERE id = ? AND tenant_id = ?");
        $custStmt->execute([$customerId, $tenantId]);
        if (!$custStmt->fetch()) {
            Response::error('Selected customer does not exist in your organization.', 404);
        }

        // Accurate decimal arithmetic
        $subtotal = 0.00;
        $calculatedItems = [];

        foreach ($items as $item) {
            $desc = trim($item['description'] ?? 'Item');
            $qty = max(0.01, (float)($item['quantity'] ?? 1));
            $unitPrice = max(0.00, (float)($item['unit_price'] ?? 0));
            $lineSubtotal = round($qty * $unitPrice, 2);
            $subtotal += $lineSubtotal;

            $calculatedItems[] = [
                'description' => $desc,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'tax_rate' => $taxRate,
                'total' => $lineSubtotal
            ];
        }

        $discountAmount = 0.00;
        if ($discountType === 'percentage') {
            $discountAmount = round(($subtotal * $discountValue) / 100, 2);
        } else {
            $discountAmount = min($subtotal, round($discountValue, 2));
        }

        $taxableAmount = max(0.00, $subtotal - $discountAmount);
        $taxAmount = round(($taxableAmount * $taxRate) / 100, 2);
        $totalAmount = round($taxableAmount + $taxAmount, 2);
        $paidAmount = 0.00;
        $outstandingAmount = $totalAmount;

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("
                INSERT INTO invoices (
                    tenant_id, customer_id, invoice_number, invoice_date, due_date,
                    subtotal, discount_type, discount_value, discount_amount,
                    tax_rate, tax_amount, total_amount, paid_amount, outstanding_amount,
                    status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
            ");
            $stmt->execute([
                $tenantId, $customerId, $invoiceNumber, $invoiceDate, $dueDate,
                $subtotal, $discountType, $discountValue, $discountAmount,
                $taxRate, $taxAmount, $totalAmount, $paidAmount, $outstandingAmount,
                trim($input['notes'] ?? '')
            ]);
            $invoiceId = (int)$db->lastInsertId();

            $itemStmt = $db->prepare("
                INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_rate, total)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($calculatedItems as $ci) {
                $itemStmt->execute([
                    $invoiceId, $ci['description'], $ci['quantity'], $ci['unit_price'], $ci['tax_rate'], $ci['total']
                ]);
            }

            $db->commit();
            Response::success(['id' => $invoiceId, 'invoice_number' => $invoiceNumber], 'Invoice created successfully', 201);
        } catch (\Exception $e) {
            $db->rollBack();
            Response::error('Failed to create invoice: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Record payment (Full or Partial) with atomic MySQL transactions
     */
    public static function recordPayment(array $currentUser, int $invoiceId): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $paymentAmount = (float)($input['amount'] ?? 0);
        $paymentDate = $input['payment_date'] ?? date('Y-m-d');
        $paymentMethod = $input['payment_method'] ?? 'upi';
        $ref = trim($input['transaction_reference'] ?? '');

        if ($paymentAmount <= 0) {
            Response::error('Payment amount must be greater than zero.', 422);
        }

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // Lock invoice record for update
            $stmt = $db->prepare("SELECT * FROM invoices WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$invoiceId, $tenantId]);
            $invoice = $stmt->fetch();

            if (!$invoice) {
                $db->rollBack();
                Response::error('Invoice not found.', 404);
            }

            $currentOutstanding = (float)$invoice['outstanding_amount'];
            if ($paymentAmount > $currentOutstanding + 0.01) {
                $db->rollBack();
                Response::error("Payment amount (₹{$paymentAmount}) exceeds outstanding balance (₹{$currentOutstanding}).", 422);
            }

            // Insert payment record
            $payStmt = $db->prepare("
                INSERT INTO payments (tenant_id, invoice_id, amount, payment_date, payment_method, transaction_reference, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $payStmt->execute([
                $tenantId, $invoiceId, $paymentAmount, $paymentDate, $paymentMethod, $ref,
                trim($input['notes'] ?? ''), $currentUser['id']
            ]);

            // Recalculate paid and outstanding
            $newPaid = round((float)$invoice['paid_amount'] + $paymentAmount, 2);
            $newOutstanding = max(0.00, round((float)$invoice['total_amount'] - $newPaid, 2));

            $newStatus = 'partially_paid';
            if ($newOutstanding <= 0.001) {
                $newStatus = 'paid';
            }

            // Update invoice
            $updateStmt = $db->prepare("
                UPDATE invoices 
                SET paid_amount = ?, outstanding_amount = ?, status = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $updateStmt->execute([$newPaid, $newOutstanding, $newStatus, $invoiceId]);

            $db->commit();
            Response::success([
                'invoice_id' => $invoiceId,
                'paid_amount' => $newPaid,
                'outstanding_amount' => $newOutstanding,
                'status' => $newStatus
            ], 'Payment recorded successfully');
        } catch (\Exception $e) {
            $db->rollBack();
            Response::error('Transaction failed: ' . $e->getMessage(), 500);
        }
    }
}
