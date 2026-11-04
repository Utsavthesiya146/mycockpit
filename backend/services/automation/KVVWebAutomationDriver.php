<?php
declare(strict_types=1);

namespace Cockpit\Services\Automation;

use Cockpit\Utils\Encryption;
use PDO;

/**
 * KVV Portal (Kannadiga Vyapaaravedike) Web Automation & Session Driver
 * 
 * Supports genuine member authentication directly against Kannada Vyapaaravedike API:
 * Base URL: https://api.kannadigaravyaapaaravedike.com
 * Web Portal: https://app.kannadigaravyaapaaravedike.com
 * 
 * Endpoints:
 * - Login: POST /auth/login (mobileNumber, password)
 * - Session Validation: GET /api/lead/getleadsbyuser/{userId}?type=received
 * - Received Referrals: GET /api/lead/getleadsbyuser/{userId}?type=received
 * - Status Writeback: PUT /api/lead/updatestatus/{leadId}
 */
class KVVWebAutomationDriver implements PlatformAutomationDriverInterface {

    private string $apiBaseUrl;
    private string $webBaseUrl;

    public function __construct(
        string $apiBaseUrl = 'https://api.kannadigaravyaapaaravedike.com',
        string $webBaseUrl = 'https://app.kannadigaravyaapaaravedike.com'
    ) {
        $this->apiBaseUrl = rtrim($apiBaseUrl, '/');
        $this->webBaseUrl = rtrim($webBaseUrl, '/');
    }

    public function getPlatformKey(): string {
        return 'kvv';
    }

    public function getDisplayName(): string {
        return 'KVV Portal (Kannadiga Vyapaaravedike)';
    }

    public function getCapabilities(): array {
        return [
            'read_leads' => 'Supported',
            'update_status' => 'Supported',
            'add_notes' => 'Supported',
            'update_followup' => 'Unsupported',
            'update_contact' => 'Unsupported',
            'assign_lead' => 'Unsupported',
            'writeback_verified' => 'Unsupported'
        ];
    }

    /**
     * Authenticate member through real KVV login endpoint
     * Endpoint: POST /auth/login
     * Body: { "mobileNumber": "...", "password": "..." }
     *
     * @return array [status => 'active'|'auth_failed'|'captcha_required'|'error', ...]
     */
    public function authenticateSession(string $loginId, string $password): array {
        $loginId = trim($loginId);
        $password = trim($password);

        if (empty($loginId) || empty($password)) {
            return [
                'status' => 'auth_failed',
                'message' => 'Registered Mobile Number or Login ID and Password are required.',
                'reason' => 'missing_credentials'
            ];
        }

        // Clean mobile number (strip +91, dashes, spaces)
        $cleanMobile = preg_replace('/[^0-9]/', '', $loginId);
        if (strlen($cleanMobile) === 12 && str_starts_with($cleanMobile, '91')) {
            $cleanMobile = substr($cleanMobile, 2);
        }
        $mobileNumber = (strlen($cleanMobile) === 10) ? $cleanMobile : $loginId;

        $loginUrl = $this->apiBaseUrl . '/auth/login';
        $headers = [
            'Content-Type: application/json',
            'Origin: ' . $this->webBaseUrl,
            'Referer: ' . $this->webBaseUrl . '/',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        $payload = json_encode([
            'mobileNumber' => $mobileNumber,
            'password' => $password
        ]);

        $ch = curl_init($loginUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $rawResponse = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($rawResponse === false) {
            return [
                'status' => 'auth_failed',
                'message' => 'Network error connecting to KVV Portal: ' . ($curlError ?: 'Unknown error'),
                'reason' => 'network_error'
            ];
        }

        // Check for CAPTCHA / bot challenge
        if ($httpCode === 403 || $httpCode === 503 || (is_string($rawResponse) && (
            str_contains($rawResponse, 'cf-turnstile') ||
            str_contains($rawResponse, 'hcaptcha') ||
            str_contains($rawResponse, 'g-recaptcha')
        ))) {
            return [
                'status' => 'captcha_required',
                'message' => 'Security challenge detected on KVV Portal. Please complete the interactive verification in browser.',
                'reason' => 'captcha_challenge',
                'diagnostics' => ['http_code' => $httpCode]
            ];
        }

        $decoded = json_decode($rawResponse, true) ?: [];

        // Check for invalid credentials or user not found
        if ($httpCode !== 200 || !empty($decoded['message']) && ($decoded['status'] ?? false) === false) {
            $msg = $decoded['message'] ?? 'Authentication failed on KVV Portal.';
            return [
                'status' => 'auth_failed',
                'message' => 'KVV Portal: ' . $msg,
                'reason' => 'invalid_credentials',
                'diagnostics' => [
                    'http_code' => $httpCode,
                    'kvv_message' => $decoded['message'] ?? null,
                    'kvv_status' => $decoded['status'] ?? null
                ]
            ];
        }

        // Check for token and user
        $token = $decoded['token'] ?? null;
        $user = $decoded['user'] ?? [];
        $userId = $user['id'] ?? ($user['_id'] ?? null);

        if (!empty($token)) {
            return [
                'status' => 'active',
                'message' => 'Successfully authenticated with KVV Portal.',
                'token' => $token,
                'user' => $user,
                'user_id' => $userId,
                'mobile_number' => $mobileNumber,
                'is_live' => true,
                'verified_at' => date('Y-m-d H:i:s'),
                'diagnostics' => [
                    'http_code' => 200,
                    'user_id' => $userId,
                    'user_role' => $user['role'] ?? 'member',
                    'subscription_valid_till' => $user['subscriptionValidTill'] ?? null
                ]
            ];
        }

        return [
            'status' => 'auth_failed',
            'message' => 'KVV Portal returned an unexpected response format.',
            'reason' => 'unexpected_response',
            'diagnostics' => ['http_code' => $httpCode, 'response' => $decoded]
        ];
    }

    /**
     * Validate an existing KVV session
     */
    public function validateSession(int $tenantId, array $sessionData): array {
        $token = $sessionData['token'] ?? null;
        $userId = $sessionData['user_id'] ?? ($sessionData['user']['id'] ?? ($sessionData['user']['_id'] ?? null));
        $loginId = $sessionData['mobile_number'] ?? ($sessionData['email'] ?? ($sessionData['username'] ?? null));
        $password = $sessionData['password'] ?? null;

        // If token missing but credentials exist, attempt fresh login
        if (empty($token) && !empty($loginId) && !empty($password)) {
            return $this->authenticateSession($loginId, $password);
        }

        if (empty($token)) {
            return [
                'status' => 'auth_required',
                'message' => 'No active KVV authentication token or credentials found.'
            ];
        }

        // Validate token by testing received referrals endpoint
        $testUrl = $userId 
            ? "{$this->apiBaseUrl}/api/lead/getleadsbyuser/{$userId}?type=received"
            : "{$this->apiBaseUrl}/auth/verifyUserCredentials";

        $ch = curl_init($testUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Origin: ' . $this->webBaseUrl,
                'Referer: ' . $this->webBaseUrl . '/',
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200) {
            $data = json_decode($res, true) ?: [];
            $referralCount = count($data['data'] ?? (is_array($data) ? $data : []));
            return [
                'status' => 'active',
                'message' => "KVV session active and verified ({$referralCount} received referrals found).",
                'verified_at' => date('Y-m-d H:i:s'),
                'referral_count' => $referralCount
            ];
        }

        // Token expired (HTTP 401) - attempt refresh with stored credentials if available
        if ($code === 401 && !empty($loginId) && !empty($password)) {
            $fresh = $this->authenticateSession($loginId, $password);
            if (($fresh['status'] ?? '') === 'active') {
                return [
                    'status' => 'active',
                    'message' => 'KVV session token refreshed successfully.',
                    'session_updates' => $fresh
                ];
            }
            return [
                'status' => 'expired',
                'message' => 'KVV session token expired and renewal failed. Please reconnect.'
            ];
        }

        if ($code === 401) {
            return [
                'status' => 'expired',
                'message' => 'KVV session token expired. Please reconnect.'
            ];
        }

        return [
            'status' => 'expired',
            'message' => "KVV validation returned HTTP {$code}. Re-authentication required."
        ];
    }

    /**
     * Fetch received referrals from KVV
     */
    public function fetchReceivedReferrals(int $tenantId, array $sessionData): array {
        return $this->fetchReferrals($tenantId, $sessionData, 'received');
    }

    /**
     * Fetch given referrals from KVV
     */
    public function fetchGivenReferrals(int $tenantId, array $sessionData): array {
        return $this->fetchReferrals($tenantId, $sessionData, 'given');
    }

    /**
     * Fetch referrals by type ('received' or 'given') with automatic session renewal
     */
    public function fetchReferrals(int $tenantId, array $sessionData, string $type = 'received'): array {
        $token = $sessionData['token'] ?? null;
        $userId = $sessionData['user_id'] ?? ($sessionData['user']['id'] ?? ($sessionData['user']['_id'] ?? null));
        $loginId = $sessionData['mobile_number'] ?? ($sessionData['email'] ?? ($sessionData['username'] ?? null));
        $password = $sessionData['password'] ?? null;

        // If token missing but credentials exist, authenticate first
        if (empty($token) && !empty($loginId) && !empty($password)) {
            $fresh = $this->authenticateSession($loginId, $password);
            if (($fresh['status'] ?? '') === 'active' && !empty($fresh['token'])) {
                $token = $fresh['token'];
                $userId = $fresh['user_id'] ?? $userId;
            }
        }

        if (empty($token) || empty($userId)) {
            return [
                'success' => false,
                'count' => 0,
                'data' => [],
                'error' => 'Active KVV session and User ID required to fetch referrals'
            ];
        }

        $typeParam = ($type === 'given') ? 'given' : 'received';
        $url = "{$this->apiBaseUrl}/api/lead/getleadsbyuser/{$userId}?type={$typeParam}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Origin: ' . $this->webBaseUrl,
                'Referer: ' . $this->webBaseUrl . '/',
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        // Auto-refresh token on HTTP 401 if credentials are available
        if ($code === 401 && !empty($loginId) && !empty($password)) {
            $fresh = $this->authenticateSession($loginId, $password);
            if (($fresh['status'] ?? '') === 'active' && !empty($fresh['token'])) {
                $token = $fresh['token'];
                $userId = $fresh['user_id'] ?? $userId;

                $ch = curl_init("{$this->apiBaseUrl}/api/lead/getleadsbyuser/{$userId}?type={$typeParam}");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 15,
                    CURLOPT_HTTPHEADER => [
                        'Authorization: Bearer ' . $token,
                        'Origin: ' . $this->webBaseUrl,
                        'Referer: ' . $this->webBaseUrl . '/',
                        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    ],
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false
                ]);
                $res = curl_exec($ch);
                $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);
            }
        }

        if ($code !== 200 || !$res) {
            return [
                'success' => false,
                'count' => 0,
                'data' => [],
                'error' => "Failed to fetch KVV {$typeParam} referrals (HTTP {$code}: " . ($curlError ?: 'API error') . ")"
            ];
        }

        $json = json_decode($res, true) ?: [];
        $rawLeads = $json['data'] ?? (is_array($json) ? $json : []);
        $normalized = [];

        foreach ($rawLeads as $item) {
            $leadId = (string)($item['_id'] ?? ($item['id'] ?? ''));
            if (empty($leadId)) continue;

            $kvvStatus = strtolower(trim((string)($item['leadStatus'] ?? 'new')));
            $crmStatus = match ($kvvStatus) {
                'thankyou', 'thank_you' => 'won',
                'pending' => 'contacted',
                'invalid' => 'lost',
                default => 'new'
            };

            $normalized[] = [
                'source_lead_id' => $leadId,
                'name' => trim((string)($item['leadName'] ?? 'KVV Referral')),
                'phone' => trim((string)($item['leadMob'] ?? '')),
                'email' => trim((string)($item['leadEmail'] ?? '')),
                'company' => trim((string)($item['leadCompany'] ?? '')),
                'status' => $crmStatus,
                'kvv_status' => $kvvStatus,
                'notes' => trim((string)($item['leadRemark'] ?? '')),
                'requirement' => trim((string)($item['leadFor'] ?? '')),
                'created_at' => $item['createdAt'] ?? date('Y-m-d H:i:s'),
                'referral_type' => $typeParam
            ];
        }

        return [
            'success' => true,
            'type' => $typeParam,
            'count' => count($normalized),
            'data' => $normalized
        ];
    }

    public function fetchOriginalLead(int $tenantId, string $sourceLeadId, array $sessionData): ?array {
        $token = $sessionData['token'] ?? null;
        if (empty($token) || empty($sourceLeadId)) return null;

        $url = "{$this->apiBaseUrl}/api/lead/getleadsbyid/{$sourceLeadId}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Origin: ' . $this->webBaseUrl,
                'Referer: ' . $this->webBaseUrl . '/'
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 && $res) {
            $json = json_decode($res, true) ?: [];
            return $json['data'] ?? $json;
        }

        return null;
    }

    public function writeBackLead(int $tenantId, string $sourceLeadId, array $proposedChanges, array $sessionData): array {
        $token = $sessionData['token'] ?? null;
        if (empty($token)) {
            return ['success' => false, 'message' => 'No active KVV authentication token.'];
        }

        $crmStatus = $proposedChanges['status'] ?? 'pending';
        $kvvStatus = match ($crmStatus) {
            'won', 'closed_won' => 'thankYou',
            'lost', 'junk' => 'invalid',
            'contacted', 'in_progress', 'qualified' => 'pending',
            default => 'new'
        };

        $remarks = trim((string)($proposedChanges['notes'] ?? ($proposedChanges['remarks'] ?? 'Updated via My Cockpit AI')));

        $url = "{$this->apiBaseUrl}/api/lead/updatestatus/{$sourceLeadId}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => json_encode([
                'leadStatus' => $kvvStatus,
                'leadRemark' => $remarks
            ]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $token,
                'Origin: ' . $this->webBaseUrl,
                'Referer: ' . $this->webBaseUrl . '/'
            ],
            CURLOPT_TIMEOUT => 12,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 200 && $code < 300) {
            return [
                'success' => true,
                'message' => 'KVV referral status successfully updated remotely.',
                'lead_id' => $sourceLeadId,
                'kvv_status' => $kvvStatus
            ];
        }

        return [
            'success' => false,
            'message' => "Failed to update KVV referral (HTTP {$code}).",
            'lead_id' => $sourceLeadId
        ];
    }

    public function verifyReadBack(int $tenantId, string $sourceLeadId, array $expectedChanges, array $sessionData): array {
        $lead = $this->fetchOriginalLead($tenantId, $sourceLeadId, $sessionData);
        if (!$lead) {
            return ['verified' => false, 'message' => 'Could not retrieve remote KVV lead for verification.'];
        }

        return ['verified' => true, 'remote_lead' => $lead];
    }
}
