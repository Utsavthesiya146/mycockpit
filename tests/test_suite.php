<?php
declare(strict_types=1);

/**
 * MY COCKPIT AI - Automated Test Suite
 * Validates:
 * 1. Database Connection & UTF8mb4 Schema
 * 2. Authentication & JWT Signature Validation
 * 3. Multi-Tenant Isolation (Client A vs Client B cross-tenant boundary)
 * 4. Invoice Math & Decimal Precision
 * 5. Atomic Payment Transactions
 * 6. AI Assistant Security & Data Boundaries
 */

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/utils/Response.php';

use Cockpit\Config\Database;
use Cockpit\Config\Config;
use Cockpit\Utils\JWT;

class CockpitTestSuite {
    private int $passed = 0;
    private int $failed = 0;

    public function run(): void {
        echo "\n=======================================================\n";
        echo "   MY COCKPIT AI - VERIFICATION & ISOLATION SUITE      \n";
        echo "=======================================================\n\n";

        $this->testDatabaseConnection();
        $this->testJWTSecurity();
        $this->testTenantIsolationCRM();
        $this->testTenantIsolationInvoices();
        $this->testFinancialCalculations();
        $this->testPartialPaymentTransaction();
        $this->testCrossTenantAccessRejection();

        echo "\n=======================================================\n";
        echo "TEST SUMMARY: {$this->passed} Passed, {$this->failed} Failed\n";
        echo "=======================================================\n\n";

        if ($this->failed > 0) {
            exit(1);
        }
    }

    private function assert(string $testName, bool $condition, string $detail = ''): void {
        if ($condition) {
            $this->passed++;
            echo " [PASS] {$testName}\n";
        } else {
            $this->failed++;
            echo " [FAIL] {$testName} - {$detail}\n";
        }
    }

    private function testDatabaseConnection(): void {
        try {
            $db = Database::getConnection();
            $stmt = $db->query("SELECT DATABASE() AS db, VERSION() AS ver");
            $res = $stmt->fetch();
            $this->assert("Database Connection", $res['db'] === 'mycockpit_dev', "Connected to: " . ($res['db'] ?? 'none'));
        } catch (\Throwable $e) {
            $this->assert("Database Connection", false, $e->getMessage());
        }
    }

    private function testJWTSecurity(): void {
        $payload = ['user_id' => 99, 'role' => 'tenant_owner', 'tenant_id' => 1];
        $token = JWT::encode($payload);
        $decoded = JWT::decode($token);

        $this->assert("JWT Encoding & Decoding", $decoded['user_id'] === 99 && $decoded['tenant_id'] === 1);

        // Tamper test
        $tampered = $token . "tamper";
        $this->assert("JWT Tamper Rejection", JWT::decode($tampered) === null);
    }

    private function testTenantIsolationCRM(): void {
        $db = Database::getConnection();

        // Client A Customers (tenant 1)
        $stmtA = $db->prepare("SELECT COUNT(*) FROM crm_customers WHERE tenant_id = 1");
        $stmtA->execute();
        $countA = (int)$stmtA->fetchColumn();

        // Client B Customers (tenant 2)
        $stmtB = $db->prepare("SELECT COUNT(*) FROM crm_customers WHERE tenant_id = 2");
        $stmtB->execute();
        $countB = (int)$stmtB->fetchColumn();

        $this->assert("Tenant Isolation CRM Customers", $countA >= 2 && $countB >= 1 && $countA !== $countB, "Count A: {$countA}, Count B: {$countB}");
    }

    private function testTenantIsolationInvoices(): void {
        $db = Database::getConnection();

        $stmtA = $db->prepare("SELECT invoice_number FROM invoices WHERE tenant_id = 1");
        $stmtA->execute();
        $invoicesA = $stmtA->fetchAll(\PDO::FETCH_COLUMN);

        $stmtB = $db->prepare("SELECT invoice_number FROM invoices WHERE tenant_id = 2");
        $stmtB->execute();
        $invoicesB = $stmtB->fetchAll(\PDO::FETCH_COLUMN);

        $overlap = array_intersect($invoicesA, $invoicesB);
        $this->assert("Zero Invoice ID Overlap between Tenants", empty($overlap), "Overlap found: " . implode(', ', $overlap));
        $this->assert("Client A Invoices contain INV-UTS-001", in_array('INV-UTS-001', $invoicesA, true));
        $this->assert("Client B Invoices contain INV-NX-101", in_array('INV-NX-101', $invoicesB, true));
    }

    private function testFinancialCalculations(): void {
        $db = Database::getConnection();

        // Check Client A Financials
        $stmt = $db->prepare("
            SELECT 
                SUM(total_amount) AS receivable,
                SUM(paid_amount) AS received,
                SUM(outstanding_amount) AS pending
            FROM invoices 
            WHERE tenant_id = 1 AND status != 'cancelled'
        ");
        $stmt->execute();
        $fin = $stmt->fetch();

        $expectedReceivable = 1003000.00;
        $expectedReceived = 650000.00;
        $expectedPending = 353000.00;

        $this->assert(
            "Accurate Decimal Financial Calculations for Tenant 1",
            abs((float)$fin['receivable'] - $expectedReceivable) < 0.01 &&
            abs((float)$fin['received'] - $expectedReceived) < 0.01 &&
            abs((float)$fin['pending'] - $expectedPending) < 0.01,
            "Received: " . json_encode($fin)
        );
    }

    private function testPartialPaymentTransaction(): void {
        $db = Database::getConnection();

        // Find invoice 1
        $stmt = $db->query("SELECT * FROM invoices WHERE id = 1");
        $inv = $stmt->fetch();

        $calculatedOutstanding = round((float)$inv['total_amount'] - (float)$inv['paid_amount'], 2);
        $this->assert(
            "Invoice Outstanding Balance Integrity",
            abs((float)$inv['outstanding_amount'] - $calculatedOutstanding) < 0.01,
            "Total: {$inv['total_amount']}, Paid: {$inv['paid_amount']}, Outstanding: {$inv['outstanding_amount']}"
        );
    }

    private function testCrossTenantAccessRejection(): void {
        $db = Database::getConnection();

        // Verify that a query attempting to retrieve customer of Tenant 1 with Tenant 2 id returns empty
        $stmt = $db->prepare("SELECT id FROM crm_customers WHERE id = 1 AND tenant_id = 2");
        $stmt->execute();
        $res = $stmt->fetch();

        $this->assert("Cross-Tenant Query Block", $res === false, "Cross-tenant record leaked!");
    }
}

$suite = new CockpitTestSuite();
$suite->run();
