<?php
declare(strict_types=1);

namespace Cockpit\Services\Connectors;

require_once __DIR__ . '/../automation/PlatformAutomationDriverInterface.php';
require_once __DIR__ . '/../automation/EAFWebAutomationDriver.php';

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

class EAFConnector implements LeadConnectorInterface {

    public function getSourceKey(): string {
        return 'eaf_connect';
    }

    public function getDisplayName(): string {
        return 'EAF Connect';
    }

    /**
     * Parse and decrypt credentials from stored config or input
     */
    private function resolveCredentials(array $config): array {
        $creds = [];
        if (!empty($config['encrypted_credentials'])) {
            $decrypted = Encryption::decrypt($config['encrypted_credentials']);
            if ($decrypted) {
                $creds = json_decode($decrypted, true) ?: [];
            }
        }
        if (!empty($config['credentials']) && is_array($config['credentials'])) {
            $creds = array_merge($creds, $config['credentials']);
        }

        // If credentials not found in config, check lead_platform_sessions ONLY if config has database ID
        $tenantId = !empty($config['tenant_id']) ? (int)$config['tenant_id'] : 1;
        if (!empty($config['id']) && empty($creds['email']) && empty($creds['cookie_jar'])) {
            try {
                $db = Database::getConnection();
                $sStmt = $db->prepare("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = 'eaf' LIMIT 1");
                $sStmt->execute([$tenantId]);
                $sessRow = $sStmt->fetch(PDO::FETCH_ASSOC);
                if (!empty($sessRow['encrypted_session_data'])) {
                    $sessDec = Encryption::decrypt($sessRow['encrypted_session_data']);
                    if ($sessDec) {
                        $creds = array_merge(json_decode($sessDec, true) ?: [], $creds);
                    }
                }
            } catch (\Throwable $e) {
                // Ignore fallback lookup errors
            }
        }

        // Defaults for EAF
        $baseUrl = rtrim($creds['base_url'] ?? 'https://eafconnect.com', '/');
        $email = trim($creds['email'] ?? '');
        $password = (string)($creds['password'] ?? '');
        $apiToken = trim($creds['api_token'] ?? '');

        return array_merge($creds, [
            'base_url' => $baseUrl,
            'email' => $email,
            'password' => $password,
            'api_token' => $apiToken
        ]);
    }

    /**
     * Perform HTTP request with timeout and error handling
     */
    private function httpRequest(string $url, string $method = 'GET', array $headers = [], ?array $body = null): array {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($body));
            }
        }

        $formattedHeaders = [];
        foreach ($headers as $k => $v) {
            $formattedHeaders[] = "{$k}: {$v}";
        }
        if (!empty($formattedHeaders)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $formattedHeaders);
        }

        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return [
                'status' => 'error',
                'http_code' => 0,
                'error' => $error ?: 'CURL connection failed',
                'data' => null
            ];
        }

        $json = json_decode($response, true);
        return [
            'status' => ($httpCode >= 200 && $httpCode < 300) ? 'success' : 'error',
            'http_code' => $httpCode,
            'raw' => $response,
            'data' => $json,
            'error' => ($httpCode >= 400) ? ($json['message'] ?? "HTTP error {$httpCode}") : null
        ];
    }

    /**
     * Authenticate with EAF Connect and get valid Bearer token
     */
    private function getValidToken(array $creds): array {
        if (!empty($creds['api_token'])) {
            return ['success' => true, 'token' => $creds['api_token']];
        }

        if (empty($creds['email']) || empty($creds['password'])) {
            return [
                'success' => false,
                'message' => 'EAF email and password or API token required'
            ];
        }

        $loginUrl = $creds['base_url'] . '/api/v1/login';
        $res = $this->httpRequest($loginUrl, 'POST', [
            'Accept' => 'application/json'
        ], [
            'email' => $creds['email'],
            'password' => $creds['password'],
            'device_info' => 'My Cockpit AI Sync Engine'
        ]);

        $token = $res['data']['token'] ?? $res['data']['data']['token'] ?? null;
        $user = $res['data']['user'] ?? $res['data']['data']['user'] ?? null;

        if ($res['status'] !== 'success' || empty($token)) {
            return [
                'success' => false,
                'message' => $res['error'] ?: ($res['data']['message'] ?? 'Authentication failed against EAF Connect API')
            ];
        }

        return [
            'success' => true,
            'token' => $token,
            'user' => $user
        ];
    }

    /**
     * Test connection to EAF Connect
     */
    public function testConnection(int $tenantId, array $config): array {
        $config['tenant_id'] = $tenantId;
        $creds = $this->resolveCredentials($config);

        // 1. If web automation session or member credentials exist, validate via EAFWebAutomationDriver
        if (!empty($creds['cookie_jar']) || !empty($creds['cookies']) || (!empty($creds['email']) && !empty($creds['password']))) {
            $driver = new \Cockpit\Services\Automation\EAFWebAutomationDriver($creds['base_url'] ?? 'https://eafconnect.com');
            $val = $driver->validateSession($tenantId, $creds);
            if (($val['status'] ?? '') === 'active') {
                $refs = $driver->fetchReceivedReferrals($tenantId, $creds);
                $count = $refs['count'] ?? 0;
                return [
                    'success' => true,
                    'message' => "Successfully connected to EAF Connect! Active member session verified ({$count} received referrals available).",
                    'details' => [
                        'status' => 'connected',
                        'base_url' => $creds['base_url'],
                        'received_referrals_found' => $count,
                        'email' => $creds['email'] ?? null
                    ]
                ];
            }
            return [
                'success' => false,
                'message' => 'Connection test failed: ' . ($val['message'] ?? 'Unable to verify session'),
                'details' => ['status' => $val['status'] ?? 'auth_required']
            ];
        }

        // 2. Fallback to API Token / REST login
        $auth = $this->getValidToken($creds);

        if (!$auth['success']) {
            return [
                'success' => false,
                'message' => 'Connection failed: ' . $auth['message'],
                'details' => ['status' => 'auth_required']
            ];
        }

        $token = $auth['token'];
        $connectUrl = $creds['base_url'] . '/api/v1/connect';
        $res = $this->httpRequest($connectUrl, 'GET', [
            'Authorization' => "Bearer {$token}",
            'Accept' => 'application/json'
        ]);

        if ($res['status'] !== 'success') {
            return [
                'success' => false,
                'message' => 'Connected to EAF API, but failed to fetch referrals: ' . ($res['error'] ?? 'API Error'),
                'details' => ['http_code' => $res['http_code']]
            ];
        }

        $receivedCount = (int)($res['data']['data']['received_count'] ?? $res['data']['received_count'] ?? 0);
        $givenCount = (int)($res['data']['data']['given_count'] ?? $res['data']['given_count'] ?? 0);

        return [
            'success' => true,
            'message' => "Successfully connected to EAF Connect! Active session verified ({$receivedCount} received referrals, {$givenCount} given).",
            'details' => [
                'base_url' => $creds['base_url'],
                'received_referrals_found' => $receivedCount,
                'given_referrals_found' => $givenCount,
                'user' => $auth['user'] ?? null
            ]
        ];
    }

    /**
     * Automatic pull synchronization of received referrals into crm_leads
     */
    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array {
        $config['tenant_id'] = $tenantId;
        $creds = $this->resolveCredentials($config);

        $referrals = null;
        // 1. Try web automation driver if session or credentials exist
        if (!empty($creds['cookie_jar']) || !empty($creds['cookies']) || (!empty($creds['email']) && !empty($creds['password']))) {
            $driver = new \Cockpit\Services\Automation\EAFWebAutomationDriver($creds['base_url'] ?? 'https://eafconnect.com');
            $fetchRes = $driver->fetchReceivedReferrals($tenantId, $creds);
            if ($fetchRes['success']) {
                $referrals = $fetchRes['referrals'];
            }
        }

        // 2. Fallback to API endpoint if referrals not fetched yet
        if ($referrals === null) {
            $auth = $this->getValidToken($creds);
            if (!$auth['success']) {
                return [
                    'success' => false,
                    'leads_fetched' => 0,
                    'leads_created' => 0,
                    'leads_updated' => 0,
                    'leads_skipped' => 0,
                    'new_checkpoint' => $checkpoint,
                    'error' => 'Authentication failed: ' . $auth['message']
                ];
            }

            $token = $auth['token'];
            $connectUrl = $creds['base_url'] . '/api/v1/connect';
            $res = $this->httpRequest($connectUrl, 'GET', [
                'Authorization' => "Bearer {$token}",
                'Accept' => 'application/json'
            ]);

            $referrals = $res['data']['data']['received'] ?? $res['data']['received'] ?? null;
            if ($res['status'] !== 'success' || !is_array($referrals)) {
                return [
                    'success' => false,
                    'leads_fetched' => 0,
                    'leads_created' => 0,
                    'leads_updated' => 0,
                    'leads_skipped' => 0,
                    'new_checkpoint' => $checkpoint,
                    'error' => 'Failed to retrieve received referrals: ' . ($res['error'] ?? 'Invalid response')
                ];
            }
        }

        if (!is_array($referrals)) {
            return [
                'success' => false,
                'leads_fetched' => 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'error' => 'Failed to retrieve received referrals from EAF Connect'
            ];
        }

        $leadsFetched = count($referrals);
        $leadsCreated = 0;
        $leadsUpdated = 0;
        $leadsSkipped = 0;

        $db = Database::getConnection();
        $autoAssignUser = !empty($config['auto_assign_user_id']) ? (int)$config['auto_assign_user_id'] : null;

        $latestCheckpoint = $checkpoint;

        foreach ($referrals as $ref) {
            $refCode = trim($ref['referral_code'] ?? '');
            $fromName = trim($ref['from_name'] ?? $ref['from_user'] ?? $ref['name'] ?? 'EAF Member');
            $fromEmail = trim($ref['from_email'] ?? $ref['email'] ?? '');
            $fromPhone = trim($ref['contact_number'] ?? $ref['from_phone'] ?? $ref['phone'] ?? '');
            $businessType = trim($ref['business'] ?? $ref['business_type'] ?? 'Business Referral');
            $description = trim($ref['description'] ?? '');
            $amount = (float)($ref['amount'] ?? 0);
            $temperature = strtolower(trim($ref['temperature'] ?? ''));
            $priority = ($temperature === 'hot') ? 'urgent' : (($temperature === 'warm') ? 'high' : 'medium');
            $createdAt = $ref['created_at'] ?? date('Y-m-d H:i:s');
            $chapterName = trim($ref['chapter_name'] ?? '');

            // Track latest checkpoint timestamp
            if (!$latestCheckpoint || strcmp($createdAt, $latestCheckpoint) > 0) {
                $latestCheckpoint = $createdAt;
            }

            // 1. Check if referral already exists by source_lead_id + tenant_id + source
            $checkStmt = $db->prepare("
                SELECT id, status, value, notes FROM crm_leads 
                WHERE tenant_id = ? AND source = 'EAF Connect' AND source_lead_id = ? 
                LIMIT 1
            ");
            $checkStmt->execute([$tenantId, $refCode]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Update amount or notes if changed
                $db->prepare("
                    UPDATE crm_leads 
                    SET value = ?, service_requirement = ?, sync_status = 'synced', updated_at = NOW() 
                    WHERE id = ? AND tenant_id = ?
                ")->execute([$amount, $businessType, $existing['id'], $tenantId]);
                $leadsUpdated++;
                continue;
            }

            // 2. Cross-Source Duplicate Check by Phone or Email
            if (!empty($fromPhone) || !empty($fromEmail)) {
                $dupStmt = $db->prepare("
                    SELECT id, name, source FROM crm_leads 
                    WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) 
                    LIMIT 1
                ");
                $dupStmt->execute([$tenantId, $fromPhone, $fromEmail]);
                $crossLead = $dupStmt->fetch(PDO::FETCH_ASSOC);

                if ($crossLead) {
                    // Record cross-channel activity touchpoint without overwriting
                    $db->prepare("
                        INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description, metadata)
                        VALUES (?, ?, 'system', 'Cross-Platform Referral from EAF Connect', ?, ?)
                    ")->execute([
                        $tenantId,
                        $crossLead['id'],
                        "Referral Code {$refCode} received via EAF Connect ({$businessType}). Value: ₹{$amount}. Chapter: {$chapterName}. Details: {$description}",
                        json_encode(['referral_code' => $refCode, 'amount' => $amount, 'chapter' => $chapterName])
                    ]);

                    $leadsSkipped++;
                    continue;
                }
            }

            // 3. Insert Brand New Lead
            $nextFollowup = date('Y-m-d H:i:s', strtotime('+6 hours'));
            $companyName = !empty($ref['company']) ? $ref['company'] : ($chapterName ? "EAF ({$chapterName})" : 'EAF Network');

            $insertStmt = $db->prepare("
                INSERT INTO crm_leads (
                    tenant_id, name, company, email, phone, value, status, priority,
                    source, source_platform, service_requirement, assigned_to, source_lead_id,
                    sync_status, next_followup_date, notes
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, 'new', ?,
                    'EAF Connect', 'eaf', ?, ?, ?,
                    'synced', ?, ?
                )
            ");
            $notes = "Referral from EAF Connect\nChapter: {$chapterName}\nDetails: {$description}";
            $insertStmt->execute([
                $tenantId,
                $fromName,
                $companyName,
                $fromEmail,
                $fromPhone,
                $amount,
                $priority,
                $businessType,
                $autoAssignUser,
                $refCode,
                $nextFollowup,
                $notes
            ]);

            $newLeadId = (int)$db->lastInsertId();
            $leadsCreated++;

            // Create initial follow-up reminder
            $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, assigned_to, title, notes, scheduled_at, contact_method, status)
                VALUES (?, ?, ?, ?, ?, ?, 'call', 'pending')
            ")->execute([
                $tenantId,
                $newLeadId,
                $autoAssignUser,
                "New EAF Referral: {$fromName}",
                "Referral Code {$refCode} for {$businessType}. Contact immediately.",
                $nextFollowup
            ]);

            // Record initial activity
            $db->prepare("
                INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description)
                VALUES (?, ?, 'import', 'EAF Referral Synchronized', ?)
            ")->execute([
                $tenantId,
                $newLeadId,
                "Automatically synchronized from EAF Connect (Ref: {$refCode}). Requirement: {$businessType}"
            ]);
        }

        return [
            'success' => true,
            'leads_fetched' => $leadsFetched,
            'leads_created' => $leadsCreated,
            'leads_updated' => $leadsUpdated,
            'leads_skipped' => $leadsSkipped,
            'new_checkpoint' => $latestCheckpoint,
            'error' => null
        ];
    }

    public function processWebhook(int $tenantId, array $config, array $payload, array $headers): array {
        // EAF push webhook handler if configured
        return [
            'success' => true,
            'message' => 'EAF webhook received'
        ];
    }
}
