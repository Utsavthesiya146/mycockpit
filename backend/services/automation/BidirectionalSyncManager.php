<?php
declare(strict_types=1);

namespace Cockpit\Services\Automation;

use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

/**
 * Bidirectional Sync & Browser Automation Manager
 * 
 * Coordinates authorized session-driven write-back across EAF, BNI, and KVV.
 * Enforces conflict detection, verification read-backs, CAPTCHA/MFA pauses,
 * and strict audit logging without modifying external code or databases.
 */
class BidirectionalSyncManager {

    private PDO $db;
    /** @var array<string, PlatformAutomationDriverInterface> */
    private array $drivers = [];

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
        $this->registerDriver(new EAFWebAutomationDriver());
        $this->registerDriver(new BNIWebAutomationDriver());
        $this->registerDriver(new KVVWebAutomationDriver());
    }

    public function registerDriver(PlatformAutomationDriverInterface $driver): void {
        $this->drivers[$driver->getPlatformKey()] = $driver;
    }

    public function getDriver(string $platformKey): ?PlatformAutomationDriverInterface {
        return $this->drivers[strtolower($platformKey)] ?? null;
    }

    /**
     * Get consolidated capability matrix across all platforms
     */
    public function getCapabilityMatrix(): array {
        $matrix = [];
        foreach ($this->drivers as $key => $driver) {
            $matrix[$key] = [
                'platform_key' => $key,
                'display_name' => $driver->getDisplayName(),
                'capabilities' => $driver->getCapabilities()
            ];
        }
        return $matrix;
    }

    /**
     * Get or validate platform session
     */
    public function getPlatformSession(int $tenantId, string $platformKey): array {
        $stmt = $this->db->prepare("SELECT * FROM `lead_platform_sessions` WHERE `tenant_id` = ? AND `source_key` = ? LIMIT 1");
        $stmt->execute([$tenantId, $platformKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $driver = $this->getDriver($platformKey);
        if (!$driver) {
            return ['status' => 'disconnected', 'message' => 'Driver not found for ' . $platformKey];
        }

        if (!$row || empty($row['encrypted_session_data'])) {
            return [
                'status' => 'disconnected',
                'message' => 'No active session or credentials configured.',
                'platform' => $platformKey
            ];
        }

        $sessionData = [];
        try {
            $decrypted = Encryption::decrypt($row['encrypted_session_data']);
            $sessionData = json_decode((string)$decrypted, true) ?? [];
        } catch (\Throwable $e) {
            return [
                'status' => 'expired',
                'message' => 'Failed to decrypt session state: ' . $e->getMessage()
            ];
        }

        $validation = $driver->validateSession($tenantId, $sessionData);
        // Update session_status in DB
        $updateStmt = $this->db->prepare("UPDATE `lead_platform_sessions` SET `session_status` = ?, `last_validated_at` = NOW() WHERE `id` = ?");
        $updateStmt->execute([$validation['status'], $row['id']]);

        return array_merge($validation, [
            'platform' => $platformKey,
            'last_validated_at' => date('Y-m-d H:i:s')
        ]);
    }

    /**
     * Save/update encrypted platform session
     */
    public function savePlatformSession(int $tenantId, string $platformKey, array $sessionData): bool {
        $driver = $this->getDriver($platformKey);
        if (!$driver) return false;

        $validation = $driver->validateSession($tenantId, $sessionData);
        $encrypted = Encryption::encrypt(json_encode($sessionData));

        $stmt = $this->db->prepare("INSERT INTO `lead_platform_sessions` 
            (`tenant_id`, `source_key`, `session_status`, `encrypted_session_data`, `last_validated_at`)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                `session_status` = VALUES(`session_status`),
                `encrypted_session_data` = VALUES(`encrypted_session_data`),
                `last_validated_at` = NOW()");
        return $stmt->execute([$tenantId, $platformKey, $validation['status'], $encrypted]);
    }

    /**
     * Step 1 & 2: Queue a writeback operation when a Cockpit lead is updated
     */
    public function queueWriteback(int $tenantId, int $leadId, array $proposedChanges, bool $autoConfirm = false): array {
        // Fetch current lead record
        $stmt = $this->db->prepare("SELECT * FROM `crm_leads` WHERE `id` = ? AND `tenant_id` = ? LIMIT 1");
        $stmt->execute([$leadId, $tenantId]);
        $lead = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$lead) {
            return ['success' => false, 'message' => 'Lead not found or tenant unauthorized.'];
        }

        $platform = strtolower($lead['source_platform'] ?? '');
        $sourceLeadId = $lead['source_lead_id'] ?? null;

        if (empty($platform) || empty($sourceLeadId)) {
            // Not an external lead
            return [
                'success' => true,
                'status' => 'not_applicable',
                'message' => 'Lead is a manual / local lead; external sync not required.'
            ];
        }

        $driver = $this->getDriver($platform);
        if (!$driver) {
            return [
                'success' => false,
                'status' => 'unsupported',
                'message' => "External sync is unsupported for source platform: {$platform}."
            ];
        }

        // Check if write-back is supported by this platform
        $capabilities = $driver->getCapabilities();
        if (($capabilities['writeback_verified'] ?? '') === 'Unsupported') {
            // Record honest status
            $this->updateLeadSyncStatus($leadId, $tenantId, 'manual_required');
            return [
                'success' => false,
                'status' => 'manual_required',
                'message' => "The external {$driver->getDisplayName()} portal does not support external write-back. All updates are preserved inside Cockpit.",
                'capabilities' => $capabilities
            ];
        }

        // Get session data
        $sessionInfo = $this->getPlatformSession($tenantId, $platform);
        if ($sessionInfo['status'] === 'captcha_required' || $sessionInfo['status'] === 'mfa_required') {
            $this->updateLeadSyncStatus($leadId, $tenantId, 'manual_required');
            return [
                'success' => false,
                'status' => 'captcha_required',
                'message' => "External platform ({$driver->getDisplayName()}) requires CAPTCHA / 2FA verification. Automation paused.",
                'session' => $sessionInfo
            ];
        }

        $decryptedSession = $this->getDecryptedSessionData($tenantId, $platform);

        // Step 4 & 5: Check external platform for conflicts
        $currentRemote = $driver->fetchOriginalLead($tenantId, $sourceLeadId, $decryptedSession);
        $previousSnapshot = !empty($lead['external_snapshot_json']) ? json_decode($lead['external_snapshot_json'], true) : null;

        // Conflict Detection: If remote platform was changed outside Cockpit since last snapshot
        $conflict = $this->detectConflict($previousSnapshot, $currentRemote, $proposedChanges);

        $initialStatus = $conflict ? 'conflict_detected' : ($autoConfirm ? 'queued' : 'pending_confirmation');

        // Create queue item
        $qStmt = $this->db->prepare("INSERT INTO `lead_writeback_queue` 
            (`tenant_id`, `lead_id`, `source_platform`, `source_lead_id`, `action_type`, `proposed_payload`, `original_snapshot`, `status`, `conflict_details`)
            VALUES (?, ?, ?, ?, 'update_status', ?, ?, ?, ?)");
        $qStmt->execute([
            $tenantId,
            $leadId,
            $platform,
            $sourceLeadId,
            json_encode($proposedChanges),
            $currentRemote ? json_encode($currentRemote) : null,
            $initialStatus,
            $conflict ? json_encode($conflict) : null
        ]);
        $queueId = (int)$this->db->lastInsertId();

        if ($conflict) {
            $this->updateLeadSyncStatus($leadId, $tenantId, 'conflict');
            return [
                'success' => false,
                'status' => 'conflict_detected',
                'queue_id' => $queueId,
                'message' => 'Conflict detected: The external record was modified directly on ' . $driver->getDisplayName() . ' since the last sync.',
                'conflict' => $conflict
            ];
        }

        $this->updateLeadSyncStatus($leadId, $tenantId, 'pending_writeback');

        if ($autoConfirm) {
            return $this->executeWriteback($tenantId, $queueId);
        }

        return [
            'success' => true,
            'status' => 'pending_confirmation',
            'queue_id' => $queueId,
            'message' => "Change queued for external synchronization. Awaiting explicit user confirmation before applying to {$driver->getDisplayName()}."
        ];
    }

    /**
     * Step 6, 7 & 8: Execute writeback after user confirmation
     */
    public function executeWriteback(int $tenantId, int $queueId): array {
        $stmt = $this->db->prepare("SELECT * FROM `lead_writeback_queue` WHERE `id` = ? AND `tenant_id` = ? LIMIT 1");
        $stmt->execute([$queueId, $tenantId]);
        $queueItem = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$queueItem) {
            return ['success' => false, 'message' => 'Queue item not found.'];
        }

        $platform = $queueItem['source_platform'];
        $sourceLeadId = $queueItem['source_lead_id'];
        $leadId = (int)$queueItem['lead_id'];
        $proposedChanges = json_decode($queueItem['proposed_payload'], true) ?? [];

        $driver = $this->getDriver($platform);
        if (!$driver) {
            $this->markQueueFailed($queueId, $leadId, $tenantId, 'Driver not available.');
            return ['success' => false, 'message' => 'Driver not available.'];
        }

        // Set status in_progress
        $this->db->prepare("UPDATE `lead_writeback_queue` SET `status` = 'in_progress', `updated_at` = NOW() WHERE `id` = ?")
            ->execute([$queueId]);

        $decryptedSession = $this->getDecryptedSessionData($tenantId, $platform);

        // Step 6: Apply change through authorized normal UI / session
        $writeResult = $driver->writeBackLead($tenantId, $sourceLeadId, $proposedChanges, $decryptedSession);

        if (!$writeResult['success']) {
            $err = $writeResult['message'] ?? 'Write-back operation failed.';
            $this->markQueueFailed($queueId, $leadId, $tenantId, $err);
            return [
                'success' => false,
                'status' => 'failed',
                'message' => 'External sync failed: ' . $err,
                'details' => $writeResult
            ];
        }

        // Step 7: Read updated value back from remote platform to verify
        $verifyResult = $driver->verifyReadBack($tenantId, $sourceLeadId, $proposedChanges, $decryptedSession);

        if (!$verifyResult['verified']) {
            $err = $verifyResult['message'] ?? 'Verification read-back mismatch.';
            $this->markQueueFailed($queueId, $leadId, $tenantId, $err);
            return [
                'success' => false,
                'status' => 'verification_failed',
                'message' => 'External write occurred, but verification read-back did not match: ' . $err,
                'details' => $verifyResult
            ];
        }

        // Step 8: Mark externally synchronized only after verification
        $newRemoteSnapshot = $verifyResult['remote_values'] ?? $writeResult['applied_changes'] ?? [];
        $this->db->prepare("UPDATE `lead_writeback_queue` SET 
            `status` = 'synced', 
            `original_snapshot` = ?,
            `error_message` = NULL,
            `updated_at` = NOW() 
            WHERE `id` = ?")
            ->execute([json_encode($newRemoteSnapshot), $queueId]);

        $this->db->prepare("UPDATE `crm_leads` SET 
            `external_sync_status` = 'synced',
            `last_external_sync_at` = NOW(),
            `external_snapshot_json` = ?
            WHERE `id` = ? AND `tenant_id` = ?")
            ->execute([json_encode($newRemoteSnapshot), $leadId, $tenantId]);

        // Log in lead activities
        $this->db->prepare("INSERT INTO `lead_activities` 
            (`tenant_id`, `lead_id`, `activity_type`, `description`, `created_at`) 
            VALUES (?, ?, 'sync', ?, NOW())")
            ->execute([$tenantId, $leadId, "External write-back synchronized to {$driver->getDisplayName()} (Slip: {$sourceLeadId})"]);

        return [
            'success' => true,
            'status' => 'synced',
            'message' => "Changes verified and externally synchronized to {$driver->getDisplayName()}.",
            'verified_state' => $newRemoteSnapshot
        ];
    }

    /**
     * Resolve conflict between Cockpit and remote platform
     */
    public function resolveConflict(int $tenantId, int $queueId, string $resolution): array {
        $stmt = $this->db->prepare("SELECT * FROM `lead_writeback_queue` WHERE `id` = ? AND `tenant_id` = ? LIMIT 1");
        $stmt->execute([$queueId, $tenantId]);
        $queueItem = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$queueItem) {
            return ['success' => false, 'message' => 'Conflict record not found.'];
        }

        $leadId = (int)$queueItem['lead_id'];

        if ($resolution === 'keep_cockpit') {
            // User explicitly chose to overwrite external platform with Cockpit value
            return $this->executeWriteback($tenantId, $queueId);
        }

        if ($resolution === 'keep_external') {
            // User chose to preserve external platform values in Cockpit
            $conflictDetails = json_decode($queueItem['conflict_details'] ?? '{}', true);
            $remoteValues = $conflictDetails['remote'] ?? [];

            if (!empty($remoteValues['status'])) {
                $cockpitStatus = $this->mapEAFStatusToCockpit($remoteValues['status']);
                $this->db->prepare("UPDATE `crm_leads` SET `status` = ?, `external_sync_status` = 'synced', `last_external_sync_at` = NOW() WHERE `id` = ? AND `tenant_id` = ?")
                    ->execute([$cockpitStatus, $leadId, $tenantId]);
            }

            $this->db->prepare("UPDATE `lead_writeback_queue` SET `status` = 'synced', `error_message` = 'Resolved: Kept external platform value.', `updated_at` = NOW() WHERE `id` = ?")
                ->execute([$queueId]);

            return [
                'success' => true,
                'status' => 'synced',
                'message' => 'Conflict resolved: Local Cockpit lead updated with external platform values.'
            ];
        }

        return ['success' => false, 'message' => 'Invalid resolution choice. Use keep_cockpit or keep_external.'];
    }

    private function detectConflict(?array $previousSnapshot, ?array $currentRemote, array $proposedChanges): ?array {
        if (!$previousSnapshot || !$currentRemote) {
            return null; // No previous baseline to detect external drift
        }

        $differences = [];
        // Check if external status changed without Cockpit knowing
        if (!empty($currentRemote['status']) && !empty($previousSnapshot['status'])) {
            if (strcasecmp($currentRemote['status'], $previousSnapshot['status']) !== 0) {
                $differences['status'] = [
                    'previous' => $previousSnapshot['status'],
                    'remote_now' => $currentRemote['status'],
                    'proposed_local' => $proposedChanges['status'] ?? null
                ];
            }
        }

        // Check if external contact number or notes changed
        if (!empty($currentRemote['contact_number']) && !empty($previousSnapshot['contact_number'])) {
            if ($currentRemote['contact_number'] !== $previousSnapshot['contact_number']) {
                $differences['contact_number'] = [
                    'previous' => $previousSnapshot['contact_number'],
                    'remote_now' => $currentRemote['contact_number'],
                    'proposed_local' => $proposedChanges['phone'] ?? null
                ];
            }
        }

        if (!empty($differences)) {
            return [
                'remote' => $currentRemote,
                'previous_snapshot' => $previousSnapshot,
                'differences' => $differences
            ];
        }

        return null;
    }

    private function updateLeadSyncStatus(int $leadId, int $tenantId, string $status): void {
        $stmt = $this->db->prepare("UPDATE `crm_leads` SET `external_sync_status` = ? WHERE `id` = ? AND `tenant_id` = ?");
        $stmt->execute([$status, $leadId, $tenantId]);
    }

    private function markQueueFailed(int $queueId, int $leadId, int $tenantId, string $errorMessage): void {
        $this->db->prepare("UPDATE `lead_writeback_queue` SET `status` = 'failed', `error_message` = ?, `updated_at` = NOW() WHERE `id` = ?")
            ->execute([$errorMessage, $queueId]);

        $this->updateLeadSyncStatus($leadId, $tenantId, 'failed');
    }

    private function getDecryptedSessionData(int $tenantId, string $platform): array {
        $stmt = $this->db->prepare("SELECT `encrypted_session_data` FROM `lead_platform_sessions` WHERE `tenant_id` = ? AND `source_key` = ? LIMIT 1");
        $stmt->execute([$tenantId, $platform]);
        $enc = $stmt->fetchColumn();
        if ($enc) {
            try {
                $decrypted = Encryption::decrypt($enc);
                return json_decode((string)$decrypted, true) ?? [];
            } catch (\Throwable $e) {
                return [];
            }
        }
        return [];
    }

    private function mapEAFStatusToCockpit(string $eafStatus): string {
        return match (strtolower(trim($eafStatus))) {
            'open for discussion' => 'new',
            'contacted' => 'contacted',
            'pending' => 'qualified',
            'need sometime' => 'proposal',
            'completed', 'mitb' => 'won',
            'cancelled' => 'lost',
            default => 'new'
        };
    }
}
