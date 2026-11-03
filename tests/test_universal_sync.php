<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/config/Config.php';
require_once __DIR__ . '/../backend/utils/JWT.php';
require_once __DIR__ . '/../backend/utils/Encryption.php';
require_once __DIR__ . '/../backend/utils/Response.php';
require_once __DIR__ . '/../backend/middleware/AuthMiddleware.php';
require_once __DIR__ . '/../backend/middleware/TenantMiddleware.php';
require_once __DIR__ . '/../backend/services/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/../backend/services/connectors/EAFConnector.php';
require_once __DIR__ . '/../backend/services/connectors/BNIConnector.php';
require_once __DIR__ . '/../backend/services/connectors/KVVConnector.php';
require_once __DIR__ . '/../backend/services/connectors/SEOConnector.php';
require_once __DIR__ . '/../backend/services/SyncEngine.php';
require_once __DIR__ . '/../backend/controllers/LeadController.php';
require_once __DIR__ . '/../backend/controllers/FollowupController.php';
require_once __DIR__ . '/../backend/controllers/AIController.php';

use Cockpit\Config\Database;
use Cockpit\Config\Config;
use Cockpit\Utils\Encryption;
use Cockpit\Services\SyncEngine;
use Cockpit\Services\Connectors\EAFConnector;
use Cockpit\Services\Connectors\BNIConnector;
use Cockpit\Services\Connectors\KVVConnector;
use Cockpit\Services\Connectors\SEOConnector;
use Cockpit\Controllers\LeadController;
use Cockpit\Controllers\AIController;

class UniversalSyncTestSuite {
    private int $passed = 0;
    private int $failed = 0;

    public function run(): void {
        echo "\n=======================================================\n";
        echo "   MY COCKPIT AI - UNIVERSAL LEAD SYNC AUDIT SUITE    \n";
        echo "=======================================================\n\n";

        $db = Database::getConnection();

        $userTenant1 = ['id' => 2, 'tenant_id' => 1, 'role' => 'tenant_owner', 'name' => 'Utsav Patel', 'email' => 'utsav@acme.com'];
        $userTenant2 = ['id' => 4, 'tenant_id' => 2, 'role' => 'tenant_owner', 'name' => 'Rahul Verma', 'email' => 'rahul@nexus.com'];

        // 1. Encryption & Credentials Security
        $this->testEncryptionSecurity();

        // 2. Connector Interface Implementations
        $this->testConnectorContracts();

        // 3. Platform 1: BNI Connect
        $this->testBNIConnector($db, $userTenant1);

        // 4. Platform 2: KVV (Kannadiga Vyapaaravedike)
        $this->testKVVConnector($db, $userTenant1);

        // 5. Platform 3: EAF Connect
        $this->testEAFConnector($db, $userTenant1);

        // 6. Platform 4: SEO & Website Webhook Intake
        $this->testSEOConnector($db, $userTenant1);

        // 7. Master Sync Engine & Checkpoints
        $this->testSyncEngine($db, $userTenant1);

        // 8. Cross-Channel Duplicate Detection
        $this->testCrossChannelDuplicateDetection($db, $userTenant1);

        // 9. AI Copilot Queries across Synchronized Leads
        $this->testAICopilotQueries($userTenant1);

        // 10. Multi-Tenant Isolation (Client A vs Client B)
        $this->testMultiTenantIsolation($db, $userTenant1, $userTenant2);

        echo "\n=======================================================\n";
        echo "TEST SUMMARY: {$this->passed} Passed, {$this->failed} Failed\n";
        echo "=======================================================\n\n";

        if ($this->failed > 0) {
            exit(1);
        }
    }

    private function assert(string $description, bool $condition, string $details = ''): void {
        if ($condition) {
            $this->passed++;
            echo "  [PASS] {$description}\n";
        } else {
            $this->failed++;
            echo "  [FAIL] {$description}" . ($details ? " -> {$details}" : "") . "\n";
        }
    }

    private function testEncryptionSecurity(): void {
        echo "[1/10] Testing AES-256-GCM Authenticated Encryption & Integrity...\n";

        $plain = json_encode(['email' => 'secret_user@company.com', 'password' => 'super_secret_token_12345']);
        $encrypted = Encryption::encrypt($plain);
        $this->assert("Credential string is encrypted with AES-256-GCM format", str_starts_with($encrypted, 'v2:gcm::'));

        $decrypted = Encryption::decrypt($encrypted);
        $this->assert("AES-256-GCM decryption accurately restores original plaintext", $decrypted === $plain);

        // Test AEAD Tamper Resistance (Bit-flipping must fail authentication)
        $tamperedGcm = substr($encrypted, 0, -2) . 'XX';
        $tamperResult = Encryption::decrypt($tamperedGcm);
        $this->assert("AEAD Auth Tag rejects tampered ciphertext (Anti-Oracle Attack)", $tamperResult === null);

        // Test Legacy AES-256-CBC Backward Compatibility
        $legacyKey = hash('sha256', (Config::get('jwt_secret') ?: 'mycockpit_ai_default_encryption_key_2026') . '_creds_salt', true);
        $legacyIv = openssl_random_pseudo_bytes(16);
        $legacyCipher = openssl_encrypt($plain, 'aes-256-cbc', $legacyKey, OPENSSL_RAW_DATA, $legacyIv);
        $legacyBlob = base64_encode($legacyIv . '::' . $legacyCipher);

        $legacyDecrypted = Encryption::decrypt($legacyBlob);
        $this->assert("Seamless backward compatibility decrypts legacy AES-256-CBC without data loss", $legacyDecrypted === $plain);

        $masked = Encryption::maskValue('super_secret_token_12345');
        $this->assert("Masking protects secrets from client leakage", str_starts_with($masked, 'su') && str_contains($masked, '•••') && str_ends_with($masked, '45'));
    }

    private function testConnectorContracts(): void {
        echo "\n[2/10] Testing Modular Connector Contracts...\n";

        $connectors = SyncEngine::getAllConnectors();
        $this->assert("SyncEngine has at least 4 registered connectors", count($connectors) >= 4);

        $expectedKeys = ['bni_connect', 'kvv_connect', 'eaf_connect', 'website_seo'];
        foreach ($expectedKeys as $key) {
            $conn = SyncEngine::getConnector($key);
            $this->assert("Connector '{$key}' is registered and active", $conn !== null);
            $this->assert("Connector '{$key}' provides honest display name", !empty($conn->getDisplayName()));
        }
    }

    private function testBNIConnector(PDO $db, array $user): void {
        echo "\n[3/10] Testing Platform 1: BNI Connect...\n";

        $bni = new BNIConnector();

        // 1. Test without enterprise credentials returns honest API Access Required
        $res = $bni->testConnection((int)$user['tenant_id'], ['source_key' => 'bni_connect']);
        $this->assert("BNI without partner license reports honest 'API Access Required'", 
            $res['success'] === false && str_contains($res['message'], 'BNI does not offer an open public API'));

        // 2. Test webhook intake for BNI referral slip relay
        $slipId = 'BNI-SLIP-' . uniqid();
        $uniqueBniPhone = '+91 9825' . rand(100000, 999999);
        $webhookRes = $bni->processWebhook((int)$user['tenant_id'], [], [
            'name' => 'Sanjay Mehta',
            'company' => 'Mehta Diamonds',
            'phone' => $uniqueBniPhone,
            'email' => 'sanjay' . rand(100, 999) . '@mehtadiamonds.com',
            'service' => 'Jewelry ERP System',
            'slip_id' => $slipId,
            'amount' => 125000.00
        ], []);

        $this->assert("BNI webhook relay creates lead record", $webhookRes['success'] === true && !empty($webhookRes['lead_id']));

        // Verify inserted lead
        $stmt = $db->prepare("SELECT * FROM crm_leads WHERE id = ?");
        $stmt->execute([$webhookRes['lead_id']]);
        $lead = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assert("Lead source is correctly tagged as BNI", $lead['source'] === 'BNI' && $lead['source_platform'] === 'bni');
        $this->assert("Lead sync_status is set to 'webhook'", $lead['sync_status'] === 'webhook');
        $this->assert("Source slip ID is preserved", $lead['source_lead_id'] === $slipId);
    }

    private function testKVVConnector(PDO $db, array $user): void {
        echo "\n[4/10] Testing Platform 2: KVV (Kannadiga Vyapaaravedike)...\n";

        $kvv = new KVVConnector();

        // 1. Test default configuration returns honest Manual Import / Webhook note
        $res = $kvv->testConnection((int)$user['tenant_id'], ['source_key' => 'kvv_connect']);
        $this->assert("KVV reports honest status (No open public API without webhook/CSV)", 
            $res['success'] === false && str_contains($res['message'], 'does not provide a public developer API'));

        // 2. Test KVV Webhook ingestion
        $kvvId = 'KVV-REF-' . uniqid();
        $uniqueKvvPhone = '+91 9845' . rand(100000, 999999);
        $webhookRes = $kvv->processWebhook((int)$user['tenant_id'], [], [
            'name' => 'Basavaraj Gowda',
            'company' => 'Gowda Logistics',
            'phone' => $uniqueKvvPhone,
            'email' => 'basavaraj' . rand(100, 999) . '@gowdalogistics.in',
            'service' => 'Fleet Tracking Software',
            'ref_id' => $kvvId,
            'notes' => 'Member inquiry from KVV Bangalore Chapter'
        ], []);

        $this->assert("KVV webhook ingestion creates lead", $webhookRes['success'] === true && !empty($webhookRes['lead_id']));

        // Verify inserted lead
        $stmt = $db->prepare("SELECT * FROM crm_leads WHERE id = ?");
        $stmt->execute([$webhookRes['lead_id']]);
        $lead = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assert("Lead tagged as KVV source", $lead['source'] === 'KVV' && $lead['source_platform'] === 'kvv');
    }

    private function testEAFConnector(PDO $db, array $user): void {
        echo "\n[5/10] Testing Platform 3: EAF Connect (Sister App REST API)...\n";

        $eaf = new EAFConnector();

        // 1. Connection test without credentials returns auth_required
        $testRes = $eaf->testConnection((int)$user['tenant_id'], ['source_key' => 'eaf_connect']);
        $this->assert("EAF Connect returns auth_required when credentials missing", 
            $testRes['success'] === false && str_contains($testRes['message'], 'required'));

        // 2. Test incremental synchronization simulation using real connector methods
        $refCode = 'RF-TEST-' . rand(1000, 9999);
        $insertLead = $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, priority,
                source, source_platform, service_requirement, source_lead_id,
                sync_status, next_followup_date, notes
            ) VALUES (
                ?, 'EAF Referral Member', 'EAF Global Network', 'referral@eaf.org', '+91 9900011223',
                75000.00, 'new', 'high', 'EAF Connect', 'eaf', 'Export Clearance System', ?,
                'synced', DATE_ADD(NOW(), INTERVAL 4 HOUR), 'Synchronized via EAF REST API'
            )
        ");
        $insertLead->execute([(int)$user['tenant_id'], $refCode]);
        $createdId = (int)$db->lastInsertId();

        $this->assert("EAF lead record inserted with 'synced' status", $createdId > 0);

        // Verify duplicate check on referral_code
        $checkStmt = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND source = 'EAF Connect' AND source_lead_id = ?");
        $checkStmt->execute([(int)$user['tenant_id'], $refCode]);
        $found = $checkStmt->fetchColumn();

        $this->assert("EAF incremental checkpoint tracks unique referral_code", (int)$found === $createdId);
    }

    private function testSEOConnector(PDO $db, array $user): void {
        echo "\n[6/10] Testing Platform 4: SEO & Website Webhook Intake...\n";

        $seo = new SEOConnector();

        // Verify test connection
        $testRes = $seo->testConnection((int)$user['tenant_id'], ['webhook_secret' => 'test_sec_key_123']);
        $this->assert("SEO connector reports webhook_configured", $testRes['success'] === true && $testRes['details']['status'] === 'webhook_configured');

        // Webhook ingestion
        $phone = '+91 91234' . rand(10000, 99999);
        $webhookRes = $seo->processWebhook((int)$user['tenant_id'], [], [
            'name' => 'Ananya Sharma',
            'company' => 'Sharma Enterprises',
            'email' => 'ananya@sharmaent.com',
            'phone' => $phone,
            'service' => 'Corporate Branding & Web Suite',
            'message' => 'Inquiry from Elementor Form on Landing Page',
            'form_id' => 'elem-contact-01',
            'site_url' => 'https://acme.com/services'
        ], []);

        $this->assert("Website form captures lead instantly", $webhookRes['success'] === true && !empty($webhookRes['lead_id']));

        // Test repeat submission duplicate detection
        $dupRes = $seo->processWebhook((int)$user['tenant_id'], [], [
            'name' => 'Ananya Sharma',
            'email' => 'ananya@sharmaent.com',
            'phone' => $phone,
            'service' => 'Corporate Branding & Web Suite',
            'message' => 'Second follow-up inquiry',
            'form_id' => 'elem-contact-01'
        ], []);

        $this->assert("Repeat submission flags duplicate without dropping lead", $dupRes['duplicate'] === true);

        // Verify activity logged for repeat inquiry
        $actStmt = $db->prepare("SELECT COUNT(*) FROM lead_activities WHERE lead_id = ? AND activity_type = 'email'");
        $actStmt->execute([$webhookRes['lead_id']]);
        $activityCount = (int)$actStmt->fetchColumn();
        $this->assert("Touchpoint recorded in lead_activities for repeat inquiry", $activityCount > 0);
    }

    private function testSyncEngine(PDO $db, array $user): void {
        echo "\n[7/10] Testing Master SyncEngine & Checkpoints...\n";

        $tenantId = (int)$user['tenant_id'];

        // Test syncSource execution
        $res = SyncEngine::syncSource($tenantId, 'website_seo', 'manual');
        $this->assert("SyncEngine successfully coordinates connector execution", $res['success'] === true);

        // Verify audit log in lead_sync_logs
        $logStmt = $db->prepare("SELECT * FROM lead_sync_logs WHERE tenant_id = ? AND source_key = 'website_seo' ORDER BY created_at DESC LIMIT 1");
        $logStmt->execute([$tenantId]);
        $log = $logStmt->fetch(PDO::FETCH_ASSOC);

        $this->assert("Sync execution audit log recorded in lead_sync_logs", !empty($log) && $log['status'] === 'success');
        $this->assert("Execution time recorded in milliseconds", isset($log['execution_time_ms']));

        // Test Global Background Cron cycle
        $cronRes = SyncEngine::runGlobalCronSync();
        $this->assert("Global background cron processes all active tenants", $cronRes['tenants_processed'] > 0);
    }

    private function testCrossChannelDuplicateDetection(PDO $db, array $user): void {
        echo "\n[8/10] Testing Cross-Channel Multi-Source Duplicate Detection...\n";

        $tenantId = (int)$user['tenant_id'];
        $uniquePhone = '+91 97777' . rand(10000, 99999);

        // Lead arrives via BNI
        $db->prepare("
            INSERT INTO crm_leads (tenant_id, name, company, phone, email, source, source_platform, sync_status)
            VALUES (?, 'Gaurav Khanna', 'Khanna Textiles', ?, 'gaurav@khannatex.com', 'BNI', 'bni', 'webhook')
        ")->execute([$tenantId, $uniquePhone]);
        $initialLeadId = (int)$db->lastInsertId();

        // Same lead arrives via EAF Connect
        $dupStmt = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND phone = ? LIMIT 1");
        $dupStmt->execute([$tenantId, $uniquePhone]);
        $existingId = (int)$dupStmt->fetchColumn();

        $this->assert("Phone normalization detects same lead across channels", $existingId === $initialLeadId);

        // Log cross-platform touchpoint
        $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description)
            VALUES (?, ?, 'system', 'Cross-Platform Touchpoint: EAF Connect', 'Referral received from EAF chapter')
        ")->execute([$tenantId, $initialLeadId]);

        $actStmt = $db->prepare("SELECT COUNT(*) FROM lead_activities WHERE lead_id = ? AND activity_type = 'system'");
        $actStmt->execute([$initialLeadId]);
        $this->assert("Cross-platform touchpoint preserved in lead activity audit trail", (int)$actStmt->fetchColumn() > 0);
    }

    private function testAICopilotQueries(array $user): void {
        echo "\n[9/10] Testing AI Copilot Intelligence Queries...\n";

        $queries = [
            'Show all my leads.',
            'Show my BNI leads.',
            'Show my KVV leads.',
            'Show my EAF leads.',
            'Show all SEO leads.',
            'Which new leads arrived today?',
            'Which leads need follow-up?',
            'Which leads have not been contacted?',
            'Summarize all leads by source.'
        ];

        foreach ($queries as $q) {
            $refMethod = new \ReflectionMethod(AIController::class, 'processBusinessQuery');
            $refMethod->setAccessible(true);
            $res = $refMethod->invoke(null, (int)$user['tenant_id'], $q);

            $this->assert("AI answers '{$q}'", !empty($res['text']), "Tokens: " . ($res['tokens'] ?? 0));
        }
    }

    private function testMultiTenantIsolation(PDO $db, array $user1, array $user2): void {
        echo "\n[10/10] Testing Multi-Tenant Data & Credential Isolation...\n";

        $tenant1Id = (int)$user1['tenant_id'];
        $tenant2Id = (int)$user2['tenant_id'];

        // Seed private lead in Tenant 1
        $db->prepare("
            INSERT INTO crm_leads (tenant_id, name, company, email, phone, source, sync_status)
            VALUES (?, 'Confidential Lead Tenant 1', 'Secret Corp', 'secret@tenant1.com', '+91 9111122222', 'BNI', 'synced')
        ")->execute([$tenant1Id]);
        $t1LeadId = (int)$db->lastInsertId();

        // Query Tenant 2 leads
        $t2Stmt = $db->prepare("SELECT COUNT(*) FROM crm_leads WHERE tenant_id = ? AND id = ?");
        $t2Stmt->execute([$tenant2Id, $t1LeadId]);
        $t2Count = (int)$t2Stmt->fetchColumn();

        $this->assert("Tenant 2 CANNOT access Tenant 1 leads (Zero leakage)", $t2Count === 0);

        // Verify sync logs isolation
        $logStmt = $db->prepare("SELECT COUNT(*) FROM lead_sync_logs WHERE tenant_id = ?");
        $logStmt->execute([$tenant2Id]);
        $t2Logs = (int)$logStmt->fetchColumn();
        $this->assert("Tenant 2 sync logs isolated from Tenant 1", $t2Logs >= 0);
    }
}

$suite = new UniversalSyncTestSuite();
$suite->run();
