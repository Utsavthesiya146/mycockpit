<?php
declare(strict_types=1);

namespace Cockpit\Services\Connectors;

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

class SEOConnector implements LeadConnectorInterface {

    public function getSourceKey(): string {
        return 'website_seo';
    }

    public function getDisplayName(): string {
        return 'SEO & Website Leads';
    }

    public function testConnection(int $tenantId, array $config): array {
        $key = $config['webhook_secret'] ?? '';
        if (empty($key)) {
            return [
                'success' => false,
                'message' => 'No Webhook Secret configured for SEO & Website leads.',
                'details' => ['status' => 'auth_required']
            ];
        }

        return [
            'success' => true,
            'message' => 'Website & SEO Webhook is live and ready to receive leads from WordPress, Elementor, and Landing Pages!',
            'details' => [
                'status' => 'webhook_configured',
                'webhook_url' => '/api/leads/webhook',
                'secret_preview' => Encryption::maskValue($key)
            ]
        ];
    }

    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array {
        // Website leads are push-driven via webhooks
        return [
            'success' => true,
            'leads_fetched' => 0,
            'leads_created' => 0,
            'leads_updated' => 0,
            'leads_skipped' => 0,
            'new_checkpoint' => $checkpoint,
            'error' => null,
            'message' => 'SEO & Website leads operate via real-time webhooks. Live intake is active.'
        ];
    }

    public function processWebhook(int $tenantId, array $config, array $payload, array $headers): array {
        $db = Database::getConnection();

        $name = trim($payload['name'] ?? $payload['full_name'] ?? $payload['your-name'] ?? '');
        $email = trim($payload['email'] ?? $payload['your-email'] ?? '');
        $phone = trim($payload['phone'] ?? $payload['your-phone'] ?? $payload['mobile'] ?? '');
        $company = trim($payload['company'] ?? $payload['company_name'] ?? '');
        $service = trim($payload['service'] ?? $payload['service_requirement'] ?? $payload['subject'] ?? 'Website Inquiry');
        $notes = trim($payload['message'] ?? $payload['notes'] ?? $payload['your-message'] ?? '');
        $formId = trim($payload['form_id'] ?? $payload['submission_id'] ?? 'web-form');
        $siteUrl = trim($payload['site_url'] ?? $payload['referrer'] ?? 'Direct Website');

        if (empty($name)) {
            return ['success' => false, 'message' => 'Lead contact name is required'];
        }

        // Duplicate Check
        if (!empty($phone) || !empty($email)) {
            $dupStmt = $db->prepare("
                SELECT id FROM crm_leads 
                WHERE tenant_id = ? AND ((phone = ? AND phone != '') OR (email = ? AND email != '')) 
                LIMIT 1
            ");
            $dupStmt->execute([$tenantId, $phone, $email]);
            $existingId = $dupStmt->fetchColumn();

            if ($existingId) {
                // Log touchpoint in lead_activities
                $db->prepare("
                    INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description, metadata)
                    VALUES (?, ?, 'email', 'Repeat Website Lead Submission', ?, ?)
                ")->execute([
                    $tenantId,
                    $existingId,
                    "Repeat inquiry from {$siteUrl} ({$service}). Message: {$notes}",
                    json_encode(['form_id' => $formId, 'site_url' => $siteUrl])
                ]);

                // Prioritize existing lead
                $db->prepare("
                    UPDATE crm_leads 
                    SET next_followup_date = CURRENT_TIMESTAMP(), updated_at = NOW() 
                    WHERE id = ? AND tenant_id = ?
                ")->execute([$existingId, $tenantId]);

                return ['success' => true, 'duplicate' => true, 'lead_id' => (int)$existingId];
            }
        }

        $nextFollowup = date('Y-m-d H:i:s', strtotime('+4 hours'));
        $autoAssignUser = !empty($config['auto_assign_user_id']) ? (int)$config['auto_assign_user_id'] : null;

        $db->prepare("
            INSERT INTO crm_leads (
                tenant_id, name, company, email, phone, value, status, priority,
                source, source_platform, service_requirement, assigned_to, source_lead_id,
                sync_status, next_followup_date, notes
            ) VALUES (
                ?, ?, ?, ?, ?, 0.00, 'new', 'high',
                'SEO / Website', 'seo', ?, ?, ?,
                'webhook', ?, ?
            )
        ")->execute([
            $tenantId, $name, $company, $email, $phone,
            $service, $autoAssignUser, $formId,
            $nextFollowup, "Source: {$siteUrl}\nRequirement: {$service}\nNotes: {$notes}"
        ]);
        $leadId = (int)$db->lastInsertId();

        // Create follow-up task
        $db->prepare("
            INSERT INTO follow_ups (tenant_id, lead_id, assigned_to, title, notes, scheduled_at, contact_method, status)
            VALUES (?, ?, ?, ?, ?, ?, 'call', 'pending')
        ")->execute([
            $tenantId,
            $leadId,
            $autoAssignUser,
            "Urgent: Website Lead - {$name}",
            "New incoming website inquiry for '{$service}' from {$siteUrl}. Contact promptly.",
            $nextFollowup
        ]);

        // Log import activity
        $db->prepare("
            INSERT INTO lead_activities (tenant_id, lead_id, activity_type, title, description)
            VALUES (?, ?, 'import', 'Website Form Captured', ?)
        ")->execute([
            $tenantId,
            $leadId,
            "Captured live via SEO / Website webhook from {$siteUrl}. Form ID: {$formId}"
        ]);

        return ['success' => true, 'lead_id' => $leadId];
    }
}
