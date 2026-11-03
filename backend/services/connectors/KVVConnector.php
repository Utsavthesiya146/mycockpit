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
        return [
            'api_endpoint' => trim($creds['api_endpoint'] ?? ''),
            'api_token' => trim($creds['api_token'] ?? ''),
            'webhook_secret' => trim($config['webhook_secret'] ?? ($creds['webhook_secret'] ?? ''))
        ];
    }

    public function testConnection(int $tenantId, array $config): array {
        $creds = $this->resolveCredentials($config);

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
            'message' => 'KVV platform does not provide a public developer API. Configure a Webhook Secret for real-time lead capture or use CSV synchronization.',
            'details' => [
                'status' => 'manual_import_only',
                'alternative' => 'Webhook Intake / CSV Batch Import'
            ]
        ];
    }

    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array {
        $creds = $this->resolveCredentials($config);

        if (empty($creds['api_endpoint'])) {
            return [
                'success' => false,
                'leads_fetched' => 0,
                'leads_created' => 0,
                'leads_updated' => 0,
                'leads_skipped' => 0,
                'new_checkpoint' => $checkpoint,
                'error' => 'Automatic polling not available for KVV (No public REST API). Use Real-time Webhook intake or CSV synchronization.'
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
