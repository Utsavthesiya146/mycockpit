<?php
declare(strict_types=1);

namespace Cockpit\Services\Connectors;

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

class BNIConnector implements LeadConnectorInterface {

    public function getSourceKey(): string {
        return 'bni_connect';
    }

    public function getDisplayName(): string {
        return 'BNI Connect';
    }

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

        $tenantId = !empty($config['tenant_id']) ? (int)$config['tenant_id'] : 1;
        if (empty($creds['username']) && empty($creds['email']) && empty($creds['access_token'])) {
            try {
                $db = Database::getConnection();
                $sStmt = $db->prepare("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = 'bni' LIMIT 1");
                $sStmt->execute([$tenantId]);
                $sessRow = $sStmt->fetch(PDO::FETCH_ASSOC);
                if (!empty($sessRow['encrypted_session_data'])) {
                    $sessDec = Encryption::decrypt($sessRow['encrypted_session_data']);
                    if ($sessDec) {
                        $creds = array_merge(json_decode($sessDec, true) ?: [], $creds);
                    }
                }
            } catch (\Throwable $e) {}
        }

        return $creds;
    }

    public function testConnection(int $tenantId, array $config): array {
        $config['tenant_id'] = $tenantId;
        $creds = $this->resolveCredentials($config);

        // 1. If member session credentials exist, validate via BNIWebAutomationDriver
        if (!empty($creds['access_token']) || (!empty($creds['email']) && !empty($creds['password'])) || (!empty($creds['username']) && !empty($creds['password']))) {
            require_once __DIR__ . '/../automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../automation/BNIWebAutomationDriver.php';
            $driver = new \Cockpit\Services\Automation\BNIWebAutomationDriver();
            $val = $driver->validateSession($tenantId, $creds);
            if (($val['status'] ?? '') === 'active') {
                return [
                    'success' => true,
                    'message' => 'Successfully connected to BNI Connect! Active member session verified.',
                    'details' => [
                        'status' => 'connected',
                        'session_status' => 'active',
                        'username' => $creds['username'] ?? ($creds['email'] ?? null)
                    ]
                ];
            }
            return [
                'success' => false,
                'message' => 'BNI connection test failed: ' . ($val['message'] ?? 'Invalid session'),
                'details' => ['status' => $val['status'] ?? 'auth_required']
            ];
        }

        if (empty($creds['api_endpoint']) && empty($creds['partner_token'])) {
            return [
                'success' => false,
                'message' => 'BNI Connect credentials required. BNI does not offer an open public API without an approved BNI Global Partner License. Please enter your BNI Connect Username and Password or Enterprise Partner Token.',
                'details' => [
                    'status' => 'auth_required',
                    'official_docs' => 'https://www.bniconnectglobal.com',
                    'alternative' => 'Automated CSV Import / Chapter Email Webhook'
                ]
            ];
        }

        // Test custom enterprise endpoint if provided
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $creds['api_endpoint'] . '/health');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$creds['partner_token']}",
            "Accept: application/json"
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'message' => 'Successfully verified BNI Enterprise Partner API endpoint!',
                'details' => ['http_code' => $httpCode]
            ];
        }

        return [
            'success' => false,
            'message' => "BNI API returned HTTP {$httpCode}. Verify your Enterprise Partner Token.",
            'details' => ['http_code' => $httpCode]
        ];
    }

    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array {
        $config['tenant_id'] = $tenantId;
        $creds = $this->resolveCredentials($config);

        // 1. If member credentials or session exist, use BNIWebAutomationDriver
        if (!empty($creds['access_token']) || (!empty($creds['email']) && !empty($creds['password'])) || (!empty($creds['username']) && !empty($creds['password']))) {
            require_once __DIR__ . '/../automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../automation/BNIWebAutomationDriver.php';
            $driver = new \Cockpit\Services\Automation\BNIWebAutomationDriver();
            $fetchRes = $driver->fetchReceivedReferrals($tenantId, $creds);
            
            return [
                'success' => true,
                'leads_fetched' => $fetchRes['count'] ?? 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'message' => $fetchRes['capability_note'] ?? 'BNI Connect member session active.'
            ];
        }

        if (empty($creds['api_endpoint']) && empty($creds['partner_token'])) {
            return [
                'success' => false,
                'leads_fetched' => 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'error' => 'BNI Connect credentials required. Please connect your member session or configure Partner credentials.'
            ];
        }

        // Incremental sync via Enterprise Partner endpoint
        $url = $creds['api_endpoint'] . '/referrals/received';
        if ($checkpoint) {
            $url .= '?since=' . urlencode($checkpoint);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$creds['partner_token']}",
            "Accept: application/json"
        ]);
        $res = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$res) {
            return [
                'success' => false,
                'leads_fetched' => 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'error' => "BNI Enterprise Partner API failed with HTTP {$httpCode}"
            ];
        }

        $data = json_decode($res, true) ?: [];
        $referrals = $data['referrals'] ?? $data['data'] ?? [];
        $db = Database::getConnection();

        $leadsFetched = count($referrals);
        $leadsCreated = 0;
        $leadsUpdated = 0;
        $leadsSkipped = 0;
        $latestCheckpoint = $checkpoint;

        foreach ($referrals as $ref) {
            $refId = trim((string)($ref['id'] ?? $ref['slip_id'] ?? ''));
            $name = trim(($ref['first_name'] ?? '') . ' ' . ($ref['last_name'] ?? ''));
            if (empty($name)) $name = trim($ref['name'] ?? 'BNI Referral');
            $company = trim($ref['company'] ?? 'BNI Network');
            $phone = trim($ref['phone'] ?? $ref['mobile'] ?? '');
            $email = trim($ref['email'] ?? '');
            $service = trim($ref['service_requirement'] ?? $ref['comments'] ?? 'BNI Referral Slip');
            $amount = (float)($ref['estimated_value'] ?? $ref['amount'] ?? 0);
            $createdAt = $ref['date'] ?? date('Y-m-d H:i:s');

            if (!$latestCheckpoint || strcmp($createdAt, $latestCheckpoint) > 0) {
                $latestCheckpoint = $createdAt;
            }

            // Duplicate prevention
            $existing = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND source = 'BNI' AND source_lead_id = ? LIMIT 1");
            $existing->execute([$tenantId, $refId]);
            $leadId = $existing->fetchColumn();

            if ($leadId) {
                $leadsUpdated++;
                continue;
            }

            // Cross-channel check
            if (!empty($phone) || !empty($email)) {
                $cross = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) LIMIT 1");
                $cross->execute([$tenantId, $phone, $email]);
                $crossId = $cross->fetchColumn();
                if ($crossId) {
                    $db->prepare("INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description) VALUES (?, ?, 'system', 'Cross-Platform Referral from BNI Connect', ?)")
                       ->execute([$tenantId, $crossId, "Slip ID: {$refId}. Requirement: {$service}"]);
                    $leadsSkipped++;
                    continue;
                }
            }

            $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
            $db->prepare("
                INSERT INTO crm_leads (
                    tenant_id, name, company, email, phone, value, status, priority,
                    source, source_platform, service_requirement, source_lead_id,
                    sync_status, next_followup_date, notes
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, 'new', 'high',
                    'BNI', 'bni', ?, ?,
                    'synced', ?, ?
                )
            ")->execute([
                $tenantId, $name, $company, $email, $phone, $amount,
                $service, $refId, $nextFollowup, "Synchronized via BNI Enterprise API (Slip: {$refId})"
            ]);
            $newId = (int)$db->lastInsertId();
            $leadsCreated++;

            $db->prepare("
                INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, status)
                VALUES (?, ?, ?, ?, ?, 'call', 'pending')
            ")->execute([
                $tenantId, $newId, "New BNI Referral: {$name}", "Referral slip {$refId} received for {$service}. Call promptly.", $nextFollowup
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
        $db = Database::getConnection();
        $name = trim($payload['name'] ?? ($payload['first_name'] ?? '') . ' ' . ($payload['last_name'] ?? ''));
        $phone = trim($payload['phone'] ?? $payload['mobile'] ?? '');
        $email = trim($payload['email'] ?? '');
        $company = trim($payload['company'] ?? 'BNI Network');
        $service = trim($payload['service'] ?? $payload['requirement'] ?? 'BNI Referral');
        $slipId = trim($payload['slip_id'] ?? $payload['id'] ?? uniqid('BNI-'));
        $amount = (float)($payload['amount'] ?? $payload['value'] ?? 0);

        if (empty($name)) {
            return ['success' => false, 'message' => 'Lead name is required'];
        }

        // Duplicate check
        $dup = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) LIMIT 1");
        $dup->execute([$tenantId, $phone, $email]);
        $existingId = $dup->fetchColumn();

        if ($existingId) {
            $db->prepare("INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description) VALUES (?, ?, 'system', 'Repeat BNI Referral', ?)")
               ->execute([$tenantId, $existingId, "Incoming BNI referral webhook for {$service}. Slip: {$slipId}"]);
            return ['success' => true, 'duplicate' => true, 'lead_id' => (int)$existingId];
        }

        $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
        $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, priority,
                source, source_platform, service_requirement, source_lead_id,
                sync_status, next_followup_date, notes
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 'new', 'high',
                'BNI', 'bni', ?, ?,
                'webhook', ?, ?
            )
        ")->execute([
            $tenantId, $name, $company, $email, $phone, $amount,
            $service, $slipId, $nextFollowup, "Received via BNI Webhook Relay (Slip: {$slipId})"
        ]);
        $leadId = (int)$db->lastInsertId();

        $db->prepare("
            INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, status)
            VALUES (?, ?, ?, ?, ?, 'call', 'pending')
        ")->execute([
            $tenantId, $leadId, "Urgent: BNI Referral - {$name}", "Referral slip {$slipId}. Contact immediately.", $nextFollowup
        ]);

        return ['success' => true, 'lead_id' => $leadId];
    }
}
