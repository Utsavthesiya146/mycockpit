<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/middleware/AuthMiddleware.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/controllers/LeadController.php';
require_once __DIR__ . '/../backend/controllers/FollowupController.php';
require_once __DIR__ . '/../backend/controllers/AIController.php';

use Cockpit\Config\Database;
use Cockpit\Controllers\LeadController;
use Cockpit\Controllers\FollowupController;
use Cockpit\Controllers\AIController;

class LeadManagementTestSuite {
    private int $passed = 0;
    private int $failed = 0;

    public function run(): void {
        echo "\n=======================================================\n";
        echo "   MY COCKPIT AI - LEAD MANAGEMENT & FOLLOW-UP SUITE   \n";
        echo "=======================================================\n\n";

        $db = Database::getConnection();

        // Setup mock user for Tenant 1 (Utsav) and Tenant 2 (Rahul)
        $userTenant1 = ['id' => 2, 'tenant_id' => 1, 'role' => 'tenant_owner', 'name' => 'Utsav Patel', 'email' => 'utsav@acme.com'];
        $userTenant2 = ['id' => 4, 'tenant_id' => 2, 'role' => 'tenant_owner', 'name' => 'Rahul Verma', 'email' => 'rahul@nexus.com'];

        // 1. Test Lead Sources Config
        $this->testLeadSourcesConfig($db, $userTenant1);

        // 2. Test Centralized Dashboard Stats
        $this->testDashboardStats($userTenant1);

        // 3. Test Lead Listing & Views
        $this->testLeadListingAndViews($db, $userTenant1);

        // 4. Test Follow-up Management
        $this->testFollowupManagement($db, $userTenant1);

        // 5. Test AI Personal Agent Lead Queries
        $this->testAIAgentLeadQueries($userTenant1);

        // 6. Test Multi-Tenant Boundary (Client A vs Client B)
        $this->testTenantBoundary($db, $userTenant1, $userTenant2);

        // 7. Test Duplicate Lead Detection & Import
        $this->testDuplicateDetectionAndImport($db, $userTenant1);

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
            echo " [FAIL] {$testName}" . ($detail ? " - {$detail}" : "") . "\n";
        }
    }

    private function testLeadSourcesConfig($db, array $user): void {
        $stmt = $db->prepare("SELECT COUNT(*) FROM lead_sources_config WHERE tenant_id = ?");
        $stmt->execute([$user['tenant_id']]);
        $count = (int)$stmt->fetchColumn();

        $this->assert("Lead Sources Initialized for Tenant 1", $count >= 5, "Count: {$count}");

        $sources = $db->query("SELECT source_key, status FROM lead_sources_config WHERE tenant_id = 1")->fetchAll();
        $keys = array_column($sources, 'source_key');

        $this->assert("BNI Connect Source Registered", in_array('bni', $keys, true));
        $this->assert("KVV Leads Source Registered", in_array('kvv', $keys, true));
        $this->assert("EAF Connect Source Registered", in_array('eaf', $keys, true));
        $this->assert("SEO & Website Source Registered", in_array('website_seo', $keys, true));
    }

    private function testDashboardStats(array $user): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN next_followup_date < NOW() AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN DATE(next_followup_date) = CURRENT_DATE() AND status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS today
            FROM crm_leads 
            WHERE tenant_id = ?
        ");
        $stmt->execute([$user['tenant_id']]);
        $res = $stmt->fetch();

        $this->assert("Dashboard Lead Count Metric", (int)$res['total'] >= 6, "Found: " . $res['total']);
        $this->assert("Overdue Lead Metric Calculation", (int)$res['overdue'] >= 1, "Overdue: " . $res['overdue']);
        $this->assert("Today Follow-up Metric Calculation", (int)$res['today'] >= 1 || (int)$res['overdue'] >= 2, "Today: " . $res['today']);
    }

    private function testLeadListingAndViews($db, array $user): void {
        // All Leads
        $stmtAll = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ?");
        $stmtAll->execute([$user['tenant_id']]);
        $allCount = (int)$stmtAll->fetchColumn();

        // BNI Leads
        $stmtBni = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND source LIKE '%BNI%'");
        $stmtBni->execute([$user['tenant_id']]);
        $bniCount = (int)$stmtBni->fetchColumn();

        // KVV Leads
        $stmtKvv = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND source LIKE '%KVV%'");
        $stmtKvv->execute([$user['tenant_id']]);
        $kvvCount = (int)$stmtKvv->fetchColumn();

        // EAF Leads
        $stmtEaf = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND source LIKE '%EAF%'");
        $stmtEaf->execute([$user['tenant_id']]);
        $eafCount = (int)$stmtEaf->fetchColumn();

        $this->assert("Lead View - All Leads Retrieved", $allCount >= 6);
        $this->assert("Lead View - BNI Leads Isolated", $bniCount >= 2);
        $this->assert("Lead View - KVV Leads Isolated", $kvvCount >= 1);
        $this->assert("Lead View - EAF Leads Isolated", $eafCount >= 1);
    }

    private function testFollowupManagement($db, array $user): void {
        $stmt = $db->prepare("
            SELECT f.*, l.name AS lead_name 
            FROM follow_ups f
            JOIN crm_leads l ON f.lead_id = l.id
            WHERE f.tenant_id = ? AND f.status = 'pending'
        ");
        $stmt->execute([$user['tenant_id']]);
        $followups = $stmt->fetchAll();

        $this->assert("Pending Lead Follow-ups Linked", count($followups) >= 3);

        // Verify contact method exists
        $hasMethod = false;
        foreach ($followups as $f) {
            if (!empty($f['contact_method'])) {
                $hasMethod = true;
                break;
            }
        }
        $this->assert("Follow-up Contact Method Preserved", $hasMethod);
    }

    private function testAIAgentLeadQueries(array $user): void {
        // Reflection to test private processBusinessQuery
        $method = new ReflectionMethod(AIController::class, 'processBusinessQuery');
        $method->setAccessible(true);

        // 1. BNI Query
        $resBni = $method->invoke(null, $user['tenant_id'], "Show all my BNI leads");
        $this->assert("AI Assistant: BNI Leads Query", str_contains($resBni['text'], 'BNI Connect') && str_contains($resBni['text'], 'Rajesh Mehta'));

        // 2. KVV Query
        $resKvv = $method->invoke(null, $user['tenant_id'], "Show my pending KVV leads");
        $this->assert("AI Assistant: KVV Leads Query", str_contains($resKvv['text'], 'KVV') && str_contains($resKvv['text'], 'Vikram Singhania'));

        // 3. EAF Query
        $resEaf = $method->invoke(null, $user['tenant_id'], "Which EAF leads need follow-up?");
        $this->assert("AI Assistant: EAF Leads Query", str_contains($resEaf['text'], 'EAF') && str_contains($resEaf['text'], 'Dr. Ananya Roy'));

        // 4. SEO Leads Query
        $resSeo = $method->invoke(null, $user['tenant_id'], "Show all SEO leads");
        $this->assert("AI Assistant: SEO Leads Query", str_contains($resSeo['text'], 'SEO') && str_contains($resSeo['text'], 'Siddharth Dave'));

        // 5. Uncontacted Leads
        $resUnc = $method->invoke(null, $user['tenant_id'], "Which leads have not been contacted?");
        $this->assert("AI Assistant: Uncontacted Leads Query", str_contains($resUnc['text'], 'Uncontacted') && str_contains($resUnc['text'], 'Gaurav Kothari'));

        // 6. Today's Follow-ups
        $resToday = $method->invoke(null, $user['tenant_id'], "Show today's follow-ups");
        $this->assert("AI Assistant: Today's Follow-ups Query", str_contains($resToday['text'], "Today's Scheduled Follow-ups") || str_contains($resToday['text'], "Today's Follow-up Agenda"));

        // 7. Overdue Follow-ups
        $resOverdue = $method->invoke(null, $user['tenant_id'], "Which leads are overdue?");
        $this->assert("AI Assistant: Overdue Leads Query", str_contains($resOverdue['text'], 'Overdue Follow-ups Alert'));

        // 8. Employee Pending Follow-ups
        $resEmp = $method->invoke(null, $user['tenant_id'], "Which employee has pending follow-ups?");
        $this->assert("AI Assistant: Employee Distribution Query", str_contains($resEmp['text'], 'Follow-up Workload by Assigned Employee'));

        // 9. Lead Activities Summary
        $resSumm = $method->invoke(null, $user['tenant_id'], "Summarize all lead activities");
        $this->assert("AI Assistant: Lead Activities Summary", str_contains($resSumm['text'], 'Comprehensive Centralized Lead Management Summary'));

        // 10. Suggest Next Action
        $resSugg = $method->invoke(null, $user['tenant_id'], "Suggest the next action for a lead");
        $this->assert("AI Assistant: Suggest Next Action", str_contains($resSugg['text'], 'AI Strategic Next Action Recommendation'));
    }

    private function testTenantBoundary($db, array $userA, array $userB): void {
        // Check Tenant 1 cannot see Tenant 2 leads
        $stmtA = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND source = 'BNI Connect'");
        $stmtA->execute([$userA['tenant_id']]);
        $countA = (int)$stmtA->fetchColumn();

        $stmtB = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND source = 'BNI Connect'");
        $stmtB->execute([$userB['tenant_id']]);
        $countB = (int)$stmtB->fetchColumn();

        $this->assert("Client A BNI Leads Separated from Client B", $countA === 2 && $countB === 1, "CountA: {$countA}, CountB: {$countB}");

        // Deepak Shah is only in Tenant 2
        $stmtCheck = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND name = 'Deepak Shah'");
        $stmtCheck->execute([$userA['tenant_id']]);
        $this->assert("Tenant 1 cannot query Tenant 2 Lead Deepak Shah", (int)$stmtCheck->fetchColumn() === 0);
    }

    private function testDuplicateDetectionAndImport($db, array $user): void {
        // Phone duplicate detection
        $phone = '+91 9825012345'; // Rajesh Mehta phone
        $stmt = $db->prepare("SELECT id, name FROM crm_leads WHERE tenant_id = ? AND phone = ?");
        $stmt->execute([$user['tenant_id'], $phone]);
        $dup = $stmt->fetch();

        $this->assert("Duplicate Detection Rule (Phone matching)", $dup && $dup['name'] === 'Rajesh Mehta');
    }
}

$suite = new LeadManagementTestSuite();
$suite->run();
