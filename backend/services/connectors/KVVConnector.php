<?php
declare(strict_types=1);

namespace Cockpit\Services\Connectors;

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

class KVVConnector implements LeadConnectorInterface {

    public function getSourceKey(): string {
        return 'kvv_connect';
    }

    public function getDisplayName(): string {
        return 'KVV (Kannadiga Vyapaaravedike)';
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
        if (empty($creds['token']) && empty($creds['mobile_number']) && empty($creds['email']) && empty($creds['username'])) {
            try {
                $db = Database::getConnection();
                $sStmt = $db->prepare("SELECT encrypted_session_data FROM lead_platform_sessions WHERE tenant_id = ? AND source_key = 'kvv' LIMIT 1");
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

        // 1. If member session credentials exist, validate via KVVWebAutomationDriver
        if (!empty($creds['token']) || (!empty($creds['mobile_number']) && !empty($creds['password'])) || (!empty($creds['email']) && !empty($creds['password'])) || (!empty($creds['username']) && !empty($creds['password']))) {
            require_once __DIR__ . '/../automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../automation/KVVWebAutomationDriver.php';
            $driver = new \Cockpit\Services\Automation\KVVWebAutomationDriver();
            $val = $driver->validateSession($tenantId, $creds);
            if (($val['status'] ?? '') === 'active') {
                return [
                    'success' => true,
                    'message' => 'Successfully connected to KVV Portal! Active member session verified.',
                    'details' => [
                        'status' => 'connected',
                        'session_status' => 'active',
                        'mobile_number' => $creds['mobile_number'] ?? ($creds['username'] ?? null)
                    ]
                ];
            }
            return [
                'success' => false,
                'message' => 'KVV connection test failed: ' . ($val['message'] ?? 'Invalid session'),
                'details' => ['status' => $val['status'] ?? 'auth_required']
            ];
        }

        if (!empty($creds['api_endpoint']) && !empty($creds['api_token'])) {
            // Test custom KVV chapter endpoint
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $creds['api_endpoint']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$creds['api_token']}",
                "Accept: application/json"
            ]);
            $res = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 300) {
                return [
                    'success' => true,
                    'message' => 'Successfully connected to custom KVV Chapter API endpoint!',
                    'details' => ['http_code' => $httpCode]
                ];
            }
        }

        if (!empty($creds['webhook_secret'])) {
            return [
                'success' => true,
                'message' => 'KVV Webhook intake is configured and active. KVV member referrals sent to your webhook URL will be captured in real-time.',
                'details' => [
                    'status' => 'webhook_configured',
                    'webhook_secret' => Encryption::maskValue($creds['webhook_secret'])
                ]
            ];
        }

        return [
            'success' => false,
            'message' => 'KVV Portal credentials required. KVV platform does not provide a public developer API without member login credentials. Please enter your 10-digit registered mobile number and password, configure a Webhook Secret, or use CSV synchronization.',
            'details' => [
                'status' => 'auth_required',
                'alternative' => 'Webhook Intake / CSV Batch Import'
            ]
        ];
    }

    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array {
        $config['tenant_id'] = $tenantId;
        $creds = $this->resolveCredentials($config);

        // 1. If member session credentials exist, use KVVWebAutomationDriver
        if (!empty($creds['token']) || (!empty($creds['mobile_number']) && !empty($creds['password'])) || (!empty($creds['username']) && !empty($creds['password']))) {
            require_once __DIR__ . '/../automation/PlatformAutomationDriverInterface.php';
            require_once __DIR__ . '/../automation/KVVWebAutomationDriver.php';
            $driver = new \Cockpit\Services\Automation\KVVWebAutomationDriver();
            $fetchRes = $driver->fetchReceivedReferrals($tenantId, $creds);

            if (!$fetchRes['success']) {
                return [
                    'success' => false,
                    'leads_fetched' => 0,
                    'leads_created' => 0,
                    'leads_updated' => 0,
                    'leads_skipped' => 0,
                    'new_checkpoint' => $checkpoint,
                    'error' => $fetchRes['error'] ?? 'Failed to retrieve received referrals from KVV'
                ];
            }

            $referrals = $fetchRes['data'] ?? [];
            $db = Database::getConnection();
            $leadsCreated = 0;
            $leadsUpdated = 0;
            $leadsSkipped = 0;
            $latestCheckpoint = $checkpoint;

            // Performance Optimization: Pre-fetch existing lead IDs and contact points in batch
            // Eliminates hundreds of sequential network round-trips over SSL to cloud database
            $existingKvvMap = [];
            $mapStmt = $db->prepare("SELECT id, source_lead_id FROM crm_leads WHERE tenant_id = ? AND source = 'KVV' AND source_lead_id IS NOT NULL");
            $mapStmt->execute([$tenantId]);
            while ($row = $mapStmt->fetch(PDO::FETCH_ASSOC)) {
                $existingKvvMap[$row['source_lead_id']] = (int)$row['id'];
            }

            $existingContacts = [];
            $contactStmt = $db->prepare("SELECT phone, email FROM crm_leads WHERE tenant_id = ?");
            $contactStmt->execute([$tenantId]);
            while ($row = $contactStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['phone'])) $existingContacts['p:' . trim($row['phone'])] = true;
                if (!empty($row['email'])) $existingContacts['e:' . strtolower(trim($row['email']))] = true;
            }

            $updateStmt = $db->prepare("UPDATE crm_leads SET status = ?, notes = ?, sync_status = 'synced', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
            $insertStmt = $db->prepare("
                INSERT INTO crm_leads (
                    tenant_id, name, company, email, phone, value, status, priority,
                    source, source_platform, service_requirement, source_lead_id,
                    sync_status, next_followup_date, notes
                ) VALUES (
                    ?, ?, ?, ?, ?, 0.00, ?, 'high',
                    'KVV', 'kvv', ?, ?,
                    'synced', ?, ?
                )
            ");

            $db->beginTransaction();
            try {
                foreach ($referrals as $ref) {
                    $refId = trim((string)($ref['source_lead_id'] ?? ''));
                    $name = trim((string)($ref['name'] ?? 'KVV Member'));
                    $company = trim((string)($ref['company'] ?? 'KVV Forum'));
                    $phone = trim((string)($ref['phone'] ?? ''));
                    $email = trim((string)($ref['email'] ?? ''));
                    $service = trim((string)($ref['requirement'] ?? 'Trade Requirement'));
                    $status = $ref['status'] ?? 'new';
                    $notes = $ref['notes'] ?? '';
                    $createdAt = $ref['created_at'] ?? date('Y-m-d H:i:s');

                    if (!$latestCheckpoint || strcmp($createdAt, $latestCheckpoint) > 0) {
                        $latestCheckpoint = $createdAt;
                    }

                    // Check duplicate by source_lead_id via in-memory map
                    if (!empty($refId) && isset($existingKvvMap[$refId])) {
                        $existingId = $existingKvvMap[$refId];
                        $updateStmt->execute([$status, $notes, $existingId, $tenantId]);
                        $leadsUpdated++;
                        continue;
                    }

                    // Cross-source duplicate check by phone / email via in-memory map
                    $isPhoneDup = !empty($phone) && isset($existingContacts['p:' . $phone]);
                    $isEmailDup = !empty($email) && isset($existingContacts['e:' . strtolower($email)]);
                    if ($isPhoneDup || $isEmailDup) {
                        $leadsSkipped++;
                        continue;
                    }

                    $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
                    $insertStmt->execute([
                        $tenantId, $name, $company, $email, $phone,
                        $status, $service, $refId, $nextFollowup, "Synchronized from KVV Portal: " . $notes
                    ]);
                    $newLeadId = (int)$db->lastInsertId();
                    if (!empty($refId)) $existingKvvMap[$refId] = $newLeadId;
                    if (!empty($phone)) $existingContacts['p:' . $phone] = true;
                    if (!empty($email)) $existingContacts['e:' . strtolower($email)] = true;
                    $leadsCreated++;
                }
                $db->commit();
            } catch (\Throwable $ex) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $ex;
            }

            return [
                'success' => true,
                'leads_fetched' => count($referrals),
                'leads_created' => $leadsCreated,
                'leads_updated' => $leadsUpdated,
                'leads_skipped' => $leadsSkipped,
                'new_checkpoint' => $latestCheckpoint,
                'error' => null
            ];
        }

        if (empty($creds['api_endpoint'])) {
            return [
                'success' => false,
                'leads_fetched' => 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'error' => 'KVV Portal credentials required. Please connect your member session or configure Webhook intake.'
            ];
        }

        // Custom KVV API endpoint if configured
        $url = $creds['api_endpoint'];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$creds['api_token']}",
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
                'error' => "KVV endpoint returned HTTP {$httpCode}"
            ];
        }

        $data = json_decode($res, true) ?: [];
        $referrals = $data['leads'] ?? $data['referrals'] ?? [];
        $db = Database::getConnection();

        $leadsCreated = 0;
        $leadsSkipped = 0;
        $latestCheckpoint = $checkpoint;

        foreach ($referrals as $ref) {
            $refId = trim((string)($ref['id'] ?? uniqid('KVV-')));
            $name = trim($ref['name'] ?? 'KVV Member');
            $company = trim($ref['company'] ?? 'KVV Forum');
            $phone = trim($ref['phone'] ?? '');
            $email = trim($ref['email'] ?? '');
            $service = trim($ref['requirement'] ?? $ref['service'] ?? 'Trade Requirement');
            $createdAt = $ref['created_at'] ?? date('Y-m-d H:i:s');

            if (!$latestCheckpoint || strcmp($createdAt, $latestCheckpoint) > 0) {
                $latestCheckpoint = $createdAt;
            }

            // Duplicate check
            $dup = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND ((source = 'KVV' AND source_lead_id = ?) OR (phone = ? AND phone != '')) LIMIT 1");
            $dup->execute([$tenantId, $refId, $phone]);
            if ($dup->fetchColumn()) {
                $leadsSkipped++;
                continue;
            }

            $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
            $db->prepare("
                INSERT INTO crm_leads (
                    tenant_id, name, company, email, phone, value, status, priority,
                    source, source_platform, service_requirement, source_lead_id,
                    sync_status, next_followup_date, notes
                ) VALUES (
                    ?, ?, ?, ?, ?, 0.00, 'new', 'high',
                    'KVV', 'kvv', ?, ?,
                    'synced', ?, ?
                )
            ")->execute([
                $tenantId, $name, $company, $email, $phone,
                $service, $refId, $nextFollowup, "Synchronized from KVV Chapter Feed"
            ]);
            $leadsCreated++;
        }

        return [
            'success' => true,
            'leads_fetched' => count($referrals),
            'leads_created' => $leadsCreated,
            'leads_updated' => 0,
            'leads_skipped' => $leadsSkipped,
            'new_checkpoint' => $latestCheckpoint,
            'error' => null
        ];
    }

    public function processWebhook(int $tenantId, array $config, array $payload, array $headers): array {
        $db = Database::getConnection();
        $name = trim($payload['name'] ?? $payload['full_name'] ?? '');
        $phone = trim($payload['phone'] ?? $payload['mobile'] ?? '');
        $email = trim($payload['email'] ?? '');
        $company = trim($payload['company'] ?? 'KVV Forum');
        $service = trim($payload['service'] ?? $payload['requirement'] ?? 'KVV Member Lead');
        $notes = trim($payload['notes'] ?? $payload['message'] ?? '');
        $refId = trim($payload['ref_id'] ?? $payload['id'] ?? uniqid('KVV-'));

        if (empty($name)) {
            return ['success' => false, 'message' => 'Lead name is required'];
        }

        // Duplicate check
        $dup = $db->prepare("SELECT id FROM crm_leads WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) LIMIT 1");
        $dup->execute([$tenantId, $phone, $email]);
        $existingId = $dup->fetchColumn();

        if ($existingId) {
            $db->prepare("INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description) VALUES (?, ?, 'system', 'Repeat KVV Referral', ?)")
               ->execute([$tenantId, $existingId, "Repeat KVV inquiry for {$service}. Notes: {$notes}"]);
            return ['success' => true, 'duplicate' => true, 'lead_id' => (int)$existingId];
        }

        $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
        $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, priority,
                source, source_platform, service_requirement, source_lead_id,
                sync_status, next_followup_date, notes
            ) VALUES (
                ?, ?, ?, ?, ?, 0.00, 'new', 'high',
                'KVV', 'kvv', ?, ?,
                'webhook', ?, ?
            )
        ")->execute([
            $tenantId, $name, $company, $email, $phone,
            $service, $refId, $nextFollowup, "Received via KVV Webhook Relay: {$notes}"
        ]);
        $leadId = (int)$db->lastInsertId();

        $db->prepare("
            INSERT INTO follow_ups (tenant_id, lead_id, title, notes, scheduled_at, contact_method, status)
            VALUES (?, ?, ?, ?, ?, 'call', 'pending')
        ")->execute([
            $tenantId, $leadId, "Urgent: KVV Referral - {$name}", "KVV requirement: {$service}. Call promptly.", $nextFollowup
        ]);

        return ['success' => true, 'lead_id' => $leadId];
    }
}
