<?php
declare(strict_types=1);

namespace Cockpit\Services\Automation;

/**
 * KVV (Kannadigara Vyaapaara Vedike) Web Automation Driver
 * 
 * Evaluates KVV member portal capabilities:
 * - Read Leads: Supported (Member portal enquiry list)
 * - Update Status: Unsupported / Permission Required (KVV portal does not offer editable pipeline status for received referrals)
 * - Add Notes: Unsupported on external portal
 * - Update Follow-up: Unsupported
 * - Update Contact Details: Unsupported
 * - Assign Lead: Unsupported
 * - Write-back Verified: Unsupported (External write-back is not supported by KVV portal architecture)
 * 
 * Manages local Cockpit CRM enhancements while honestly reporting external portal limits.
 */
class KVVWebAutomationDriver implements PlatformAutomationDriverInterface {

    private string $portalUrl;

    public function __construct(string $portalUrl = 'https://app.kannadigaravyaapaaravedike.com') {
        $this->portalUrl = rtrim($portalUrl, '/');
    }

    public function getPlatformKey(): string {
        return 'kvv';
    }

    public function getDisplayName(): string {
        return 'KVV (Kannadigara Vyaapaara Vedike)';
    }

    public function getCapabilities(): array {
        return [
            'read_leads' => 'Supported',
            'update_status' => 'Unsupported',      // KVV is a reference/enquiry board; no editable status workflow
            'add_notes' => 'Unsupported',          // No notes field on received references
            'update_followup' => 'Unsupported',    // No calendar/follow-up alarms on portal
            'update_contact' => 'Unsupported',     // Contact info entered by referring member is immutable
            'assign_lead' => 'Unsupported',        // Single member profile
            'writeback_verified' => 'Unsupported'  // External write-back not supported by KVV portal
        ];
    }

    public function validateSession(int $tenantId, array $sessionData): array {
        $cookieJar = $sessionData['cookie_jar'] ?? '';
        if (empty($cookieJar)) {
            return [
                'status' => 'disconnected',
                'message' => 'No active KVV member portal session.'
            ];
        }

        return [
            'status' => 'active',
            'message' => 'KVV session active (Read-only enquiry viewing available).'
        ];
    }

    public function fetchOriginalLead(int $tenantId, string $sourceLeadId, array $sessionData): ?array {
        if (!empty($sessionData['cached_enquiries'][$sourceLeadId])) {
            return $sessionData['cached_enquiries'][$sourceLeadId];
        }
        return null;
    }

    public function writeBackLead(int $tenantId, string $sourceLeadId, array $proposedChanges, array $sessionData): array {
        // KVV does not support external write-back through its member portal
        return [
            'success' => false,
            'status' => 'unsupported',
            'message' => 'KVV portal does not support external write-back. All pipeline updates, notes, and follow-ups must be maintained inside My Cockpit AI.',
            'platform' => 'kvv'
        ];
    }

    public function verifyReadBack(int $tenantId, string $sourceLeadId, array $expectedChanges, array $sessionData): array {
        return [
            'verified' => false,
            'message' => 'KVV does not support remote state verification (read-only platform).'
        ];
    }
}
