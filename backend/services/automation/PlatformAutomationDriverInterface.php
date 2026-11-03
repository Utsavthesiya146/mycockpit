<?php
declare(strict_types=1);

namespace Cockpit\Services\Automation;

/**
 * Interface for Platform Browser Automation and Session-Driven Drivers
 */
interface PlatformAutomationDriverInterface {

    /**
     * Unique platform key (e.g. 'eaf', 'bni', 'kvv')
     */
    public function getPlatformKey(): string;

    /**
     * Platform human-readable display name
     */
    public function getDisplayName(): string;

    /**
     * Return verified capability matrix
     * [
     *   'read_leads' => 'Supported' | 'Unsupported' | 'Permission Required' | 'CAPTCHA/MFA Required',
     *   'update_status' => ...,
     *   'add_notes' => ...,
     *   'update_followup' => ...,
     *   'update_contact' => ...,
     *   'assign_lead' => ...,
     *   'writeback_verified' => ...
     * ]
     */
    public function getCapabilities(): array;

    /**
     * Validate current session / credentials
     * Returns: ['status' => 'active'|'expired'|'captcha_required'|'mfa_required'|'disconnected', 'message' => string]
     */
    public function validateSession(int $tenantId, array $sessionData): array;

    /**
     * Read current original values from the external platform
     */
    public function fetchOriginalLead(int $tenantId, string $sourceLeadId, array $sessionData): ?array;

    /**
     * Apply user-approved write-back changes through normal authorized UI / web session
     */
    public function writeBackLead(int $tenantId, string $sourceLeadId, array $proposedChanges, array $sessionData): array;

    /**
     * Read back external lead after write to verify remote state before marking synced
     */
    public function verifyReadBack(int $tenantId, string $sourceLeadId, array $expectedChanges, array $sessionData): array;
}
