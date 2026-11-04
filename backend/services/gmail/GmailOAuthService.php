<?php
declare(strict_types=1);

namespace Cockpit\Services\Gmail;

use Cockpit\Config\Config;
use Cockpit\Config\Database;
use Cockpit\Utils\Encryption;
use PDO;

/**
 * Google OAuth 2.0 Service for Gmail Management
 * 
 * Implements strict security:
 * - Single canonical backend OAuth callback
 * - Scopes: gmail.readonly, gmail.send, gmail.compose, gmail.modify, openid, email
 * - Offline access with encrypted AES-256-GCM token storage
 * - PKCE code challenge and state CSRF validation
 * - Automatic token renewal and revocation
 * - Multi-tenant isolation
 */
class GmailOAuthService {

    public const APPROVED_SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.modify',
        'openid',
        'email'
    ];

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Get the single canonical backend OAuth callback URI
     */
    public static function getCanonicalRedirectUri(): string {
        return (string)Config::get('google_redirect_uri', 'http://localhost/mycockpit/backend/api/gmail/oauth/callback');
    }

    /**
     * Resolve Google OAuth Client ID and Secret for tenant
     * Checks tenant-specific lead_sources_config first, then system Config
     */
    public function getClientCredentials(int $tenantId): array {
        // 1. Check tenant lead_sources_config for custom client override
        try {
            $stmt = $this->db->prepare("SELECT encrypted_credentials FROM lead_sources_config WHERE tenant_id = ? AND source_key = 'gmail' LIMIT 1");
            $stmt->execute([$tenantId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!empty($row['encrypted_credentials'])) {
                $dec = json_decode((string)Encryption::decrypt($row['encrypted_credentials']), true);
                if (!empty($dec['client_id']) && !empty($dec['client_secret'])) {
                    return [
                        'client_id' => trim($dec['client_id']),
                        'client_secret' => trim($dec['client_secret']),
                        'source' => 'tenant_config'
                    ];
                }
            }
        } catch (\Throwable $e) {}

        // 2. Fall back to system-wide Config / environment variables
        $sysId = (string)Config::get('google_client_id', '');
        $sysSecret = (string)Config::get('google_client_secret', '');

        return [
            'client_id' => trim($sysId),
            'client_secret' => trim($sysSecret),
            'source' => 'system_env'
        ];
    }

    /**
     * Check if Google OAuth client credentials are configured
     */
    public function isConfigured(int $tenantId): bool {
        $creds = $this->getClientCredentials($tenantId);
        return !empty($creds['client_id']) && !empty($creds['client_secret']);
    }

    /**
     * Save or update Google OAuth Client Credentials for a tenant
     */
    public function saveClientCredentials(int $tenantId, string $clientId, string $clientSecret): bool {
        $clientId = trim($clientId);
        $clientSecret = trim($clientSecret);

        if (empty($clientId) || empty($clientSecret)) {
            return false;
        }

        $payload = json_encode([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'configured_at' => date('Y-m-d H:i:s')
        ]);

        $encrypted = Encryption::encrypt($payload);

        $stmt = $this->db->prepare("
            INSERT INTO lead_sources_config (tenant_id, source_key, is_enabled, status, encrypted_credentials, updated_at)
            VALUES (?, 'gmail', 1, 'configured', ?, NOW())
            ON DUPLICATE KEY UPDATE 
                encrypted_credentials = VALUES(encrypted_credentials),
                updated_at = NOW()
        ");
        return $stmt->execute([$tenantId, $encrypted]);
    }

    /**
     * Generate PKCE code verifier and code challenge (S256)
     */
    public static function generatePkce(): array {
        $verifier = bin2hex(random_bytes(32)); // 64 chars
        $hash = hash('sha256', $verifier, true);
        $challenge = rtrim(strtr(base64_encode($hash), '+/', '-_'), '=');

        return [
            'verifier' => $verifier,
            'challenge' => $challenge
        ];
    }

    /**
     * Generate secure OAuth state token and store in database
     */
    public function generateStateToken(int $tenantId, int $userId, string $codeVerifier = ''): string {
        $stateToken = bin2hex(random_bytes(32));

        // Clean expired states first
        $this->db->query("DELETE FROM gmail_oauth_states WHERE expires_at < NOW()");

        $stmt = $this->db->prepare("
            INSERT INTO gmail_oauth_states (tenant_id, user_id, state_token, code_verifier, expires_at, created_at)
            VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW())
        ");
        $stmt->execute([$tenantId, $userId, $stateToken, $codeVerifier]);

        return $stateToken;
    }

    /**
     * Generate Google OAuth 2.0 Authorization URL
     */
    public function generateAuthUrl(int $tenantId, int $userId): array {
        $creds = $this->getClientCredentials($tenantId);
        if (empty($creds['client_id'])) {
            return [
                'success' => false,
                'message' => 'Google OAuth Client ID is not configured. Please configure it in Settings or Google Cloud Console.',
                'auth_url' => null
            ];
        }

        $pkce = self::generatePkce();
        $stateToken = $this->generateStateToken($tenantId, $userId, $pkce['verifier']);
        $redirectUri = self::getCanonicalRedirectUri();

        $params = [
            'client_id' => $creds['client_id'],
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => implode(' ', self::APPROVED_SCOPES),
            'access_type' => 'offline',
            'prompt' => 'consent', // Enforce consent to guarantee refresh_token
            'include_granted_scopes' => 'true',
            'state' => $stateToken,
            'code_challenge' => $pkce['challenge'],
            'code_challenge_method' => 'S256'
        ];

        $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);

        return [
            'success' => true,
            'auth_url' => $authUrl,
            'state' => $stateToken,
            'redirect_uri' => $redirectUri,
            'scopes' => self::APPROVED_SCOPES
        ];
    }

    /**
     * Validate state token on callback and return state record
     */
    public function validateState(string $stateToken): ?array {
        $stmt = $this->db->prepare("
            SELECT * FROM gmail_oauth_states 
            WHERE state_token = ? AND expires_at > NOW() 
            LIMIT 1
        ");
        $stmt->execute([$stateToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        // Delete consumed state to prevent replay attacks
        $this->db->prepare("DELETE FROM gmail_oauth_states WHERE id = ?")->execute([$row['id']]);

        return $row;
    }

    /**
     * Exchange authorization code for tokens via backend-only POST request
     */
    public function exchangeCode(int $tenantId, string $code, string $codeVerifier = ''): array {
        $creds = $this->getClientCredentials($tenantId);
        if (empty($creds['client_id']) || empty($creds['client_secret'])) {
            return [
                'success' => false,
                'error' => 'Google Client ID or Client Secret not configured for this tenant.'
            ];
        }

        $redirectUri = self::getCanonicalRedirectUri();

        $postFields = [
            'client_id' => $creds['client_id'],
            'client_secret' => $creds['client_secret'],
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $redirectUri
        ];

        if (!empty($codeVerifier)) {
            $postFields['code_verifier'] = $codeVerifier;
        }

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postFields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json'
            ]
        ]);

        $res = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($res === false) {
            return [
                'success' => false,
                'error' => 'Network error connecting to Google OAuth endpoint: ' . ($curlErr ?: 'Unknown error')
            ];
        }

        $json = json_decode($res, true) ?: [];

        if ($httpCode !== 200 || empty($json['access_token'])) {
            $errorDesc = $json['error_description'] ?? ($json['error'] ?? "HTTP {$httpCode}");
            return [
                'success' => false,
                'error' => 'Google OAuth token exchange failed: ' . $errorDesc,
                'details' => $json
            ];
        }

        $expiresIn = (int)($json['expires_in'] ?? 3600);
        $tokens = [
            'access_token' => $json['access_token'],
            'refresh_token' => $json['refresh_token'] ?? null,
            'token_type' => $json['token_type'] ?? 'Bearer',
            'expires_at' => time() + $expiresIn,
            'expires_in' => $expiresIn,
            'scope' => $json['scope'] ?? '',
            'created_at' => date('Y-m-d H:i:s')
        ];

        return [
            'success' => true,
            'tokens' => $tokens
        ];
    }

    /**
     * Store encrypted OAuth tokens and update connection records
     */
    public function saveAccountTokens(int $tenantId, array $tokens, array $profile = []): bool {
        $email = strtolower(trim($profile['emailAddress'] ?? ($tokens['email'] ?? '')));
        if (empty($email)) {
            $email = 'connected.user@gmail.com';
        }

        // If refresh_token was not returned in this exchange (e.g. re-prompting without prompt=consent),
        // preserve existing refresh_token
        if (empty($tokens['refresh_token'])) {
            $existingTokens = $this->getStoredTokens($tenantId);
            if (!empty($existingTokens['refresh_token'])) {
                $tokens['refresh_token'] = $existingTokens['refresh_token'];
            }
        }

        $tokens['email'] = $email;
        $tokensPayload = json_encode($tokens);
        $encryptedTokens = Encryption::encrypt($tokensPayload);

        // 1. Upsert gmail_accounts
        $historyId = $profile['historyId'] ?? null;
        $messagesTotal = (int)($profile['messagesTotal'] ?? 0);
        $threadsTotal = (int)($profile['threadsTotal'] ?? 0);

        $stmt = $this->db->prepare("
            INSERT INTO gmail_accounts (
                tenant_id, email_address, account_name, connection_status,
                encrypted_tokens, history_id, messages_total, threads_total,
                sync_status, updated_at
            ) VALUES (
                ?, ?, ?, 'connected',
                ?, ?, ?, ?,
                'not_synced', NOW()
            ) ON DUPLICATE KEY UPDATE 
                connection_status = 'connected',
                encrypted_tokens = VALUES(encrypted_tokens),
                history_id = COALESCE(VALUES(history_id), history_id),
                messages_total = VALUES(messages_total),
                threads_total = VALUES(threads_total),
                last_error = NULL,
                updated_at = NOW()
        ");
        $stmt->execute([
            $tenantId, $email, $email,
            $encryptedTokens, $historyId, $messagesTotal, $threadsTotal
        ]);

        // 2. Mirror session in lead_platform_sessions
        $this->db->prepare("
            INSERT INTO lead_platform_sessions (tenant_id, source_key, session_status, encrypted_session_data, last_validated_at, updated_at)
            VALUES (?, 'gmail', 'active', ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                session_status = 'active',
                encrypted_session_data = VALUES(encrypted_session_data),
                last_validated_at = NOW(),
                updated_at = NOW()
        ")->execute([$tenantId, $encryptedTokens]);

        // 3. Update connected_apps for Gmail
        $this->db->prepare("
            UPDATE connected_apps 
            SET connection_status = 'connected', updated_at = NOW() 
            WHERE tenant_id = ? AND (name LIKE '%Gmail%' OR app_url LIKE '%mail.google.com%')
        ")->execute([$tenantId]);

        return true;
    }

    /**
     * Retrieve decrypted tokens for a tenant
     */
    public function getStoredTokens(int $tenantId): ?array {
        $stmt = $this->db->prepare("
            SELECT encrypted_tokens FROM gmail_accounts 
            WHERE tenant_id = ? AND connection_status = 'connected' 
            LIMIT 1
        ");
        $stmt->execute([$tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (empty($row['encrypted_tokens'])) {
            // Fallback check in lead_platform_sessions
            $sStmt = $this->db->prepare("
                SELECT encrypted_session_data FROM lead_platform_sessions 
                WHERE tenant_id = ? AND source_key = 'gmail' AND session_status = 'active' 
                LIMIT 1
            ");
            $sStmt->execute([$tenantId]);
            $sRow = $sStmt->fetch(PDO::FETCH_ASSOC);
            if (!empty($sRow['encrypted_session_data'])) {
                $dec = Encryption::decrypt($sRow['encrypted_session_data']);
                return $dec ? json_decode($dec, true) : null;
            }
            return null;
        }

        $decrypted = Encryption::decrypt($row['encrypted_tokens']);
        if (!$decrypted) {
            return null;
        }

        return json_decode($decrypted, true);
    }

    /**
     * Get active, unexpired Access Token (automatically refreshes if needed)
     */
    public function getValidAccessToken(int $tenantId): ?string {
        $tokens = $this->getStoredTokens($tenantId);
        if (!$tokens || empty($tokens['access_token'])) {
            return null;
        }

        $expiresAt = (int)($tokens['expires_at'] ?? 0);
        // If token expires in less than 90 seconds, refresh it proactively
        if ($expiresAt > 0 && (time() + 90) >= $expiresAt) {
            $refreshToken = $tokens['refresh_token'] ?? null;
            if (!empty($refreshToken)) {
                $refreshRes = $this->refreshAccessToken($tenantId, $refreshToken);
                if ($refreshRes['success'] && !empty($refreshRes['access_token'])) {
                    return $refreshRes['access_token'];
                }
            }
        }

        return $tokens['access_token'];
    }

    /**
     * Refresh access token using stored refresh_token
     */
    public function refreshAccessToken(int $tenantId, string $refreshToken): array {
        $creds = $this->getClientCredentials($tenantId);
        if (empty($creds['client_id']) || empty($creds['client_secret'])) {
            return ['success' => false, 'error' => 'Client credentials missing for refresh'];
        }

        $postFields = [
            'client_id' => $creds['client_id'],
            'client_secret' => $creds['client_secret'],
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token'
        ];

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postFields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $res = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode((string)$res, true) ?: [];

        if ($httpCode !== 200 || empty($json['access_token'])) {
            // If refresh token was revoked by Google
            if (($json['error'] ?? '') === 'invalid_grant') {
                $this->db->prepare("UPDATE gmail_accounts SET connection_status = 'expired', last_error = 'Google session expired or access revoked' WHERE tenant_id = ?")->execute([$tenantId]);
                $this->db->prepare("UPDATE lead_platform_sessions SET session_status = 'expired' WHERE tenant_id = ? AND source_key = 'gmail'")->execute([$tenantId]);
            }
            return [
                'success' => false,
                'error' => $json['error_description'] ?? ($json['error'] ?? 'Token refresh failed')
            ];
        }

        // Update stored tokens with fresh access token
        $stored = $this->getStoredTokens($tenantId) ?: [];
        $stored['access_token'] = $json['access_token'];
        $stored['expires_in'] = (int)($json['expires_in'] ?? 3600);
        $stored['expires_at'] = time() + $stored['expires_in'];
        $stored['updated_at'] = date('Y-m-d H:i:s');
        if (!empty($json['refresh_token'])) {
            $stored['refresh_token'] = $json['refresh_token'];
        }

        $encrypted = Encryption::encrypt(json_encode($stored));
        $this->db->prepare("UPDATE gmail_accounts SET encrypted_tokens = ?, connection_status = 'connected', last_error = NULL, updated_at = NOW() WHERE tenant_id = ?")->execute([$encrypted, $tenantId]);
        $this->db->prepare("UPDATE lead_platform_sessions SET encrypted_session_data = ?, session_status = 'active', updated_at = NOW() WHERE tenant_id = ? AND source_key = 'gmail'")->execute([$encrypted, $tenantId]);

        return [
            'success' => true,
            'access_token' => $json['access_token'],
            'expires_in' => $stored['expires_in']
        ];
    }

    /**
     * Revoke OAuth token and disconnect Gmail integration
     */
    public function disconnect(int $tenantId): bool {
        $tokens = $this->getStoredTokens($tenantId);
        $tokenToRevoke = $tokens['refresh_token'] ?? ($tokens['access_token'] ?? null);

        if (!empty($tokenToRevoke)) {
            $ch = curl_init('https://oauth2.googleapis.com/revoke?token=' . urlencode($tokenToRevoke));
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false
            ]);
            curl_exec($ch);
            curl_close($ch);
        }

        // Update database records
        $this->db->prepare("
            UPDATE gmail_accounts 
            SET connection_status = 'disconnected', encrypted_tokens = NULL, last_error = NULL, updated_at = NOW() 
            WHERE tenant_id = ?
        ")->execute([$tenantId]);

        $this->db->prepare("
            UPDATE lead_platform_sessions 
            SET session_status = 'disconnected', encrypted_session_data = NULL, updated_at = NOW() 
            WHERE tenant_id = ? AND source_key = 'gmail'
        ")->execute([$tenantId]);

        $this->db->prepare("
            UPDATE connected_apps 
            SET connection_status = 'disconnected', updated_at = NOW() 
            WHERE tenant_id = ? AND (name LIKE '%Gmail%' OR app_url LIKE '%mail.google.com%')
        ")->execute([$tenantId]);

        return true;
    }

    /**
     * Get account status snapshot for UI
     */
    public function getStatus(int $tenantId): array {
        $stmt = $this->db->prepare("
            SELECT email_address, account_name, connection_status, last_sync_at, sync_status,
                   messages_total, threads_total, last_error
            FROM gmail_accounts WHERE tenant_id = ? LIMIT 1
        ");
        $stmt->execute([$tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $isConfigured = $this->isConfigured($tenantId);
        $redirectUri = self::getCanonicalRedirectUri();

        $unreadCount = (int)$this->db->query("
            SELECT count(*) FROM gmail_messages 
            WHERE tenant_id = {$tenantId} AND is_read = 0 AND is_trash = 0 AND is_spam = 0
        ")->fetchColumn();

        $messagesCount = (int)$this->db->query("
            SELECT count(*) FROM gmail_messages 
            WHERE tenant_id = {$tenantId} AND is_trash = 0 AND is_spam = 0
        ")->fetchColumn();

        if (!$row) {
            return [
                'is_connected' => false,
                'connection_status' => 'auth_required',
                'is_configured' => $isConfigured,
                'email_address' => null,
                'last_sync_at' => null,
                'sync_status' => 'not_synced',
                'unread_count' => 0,
                'messages_count' => 0,
                'redirect_uri' => $redirectUri
            ];
        }

        return [
            'is_connected' => $row['connection_status'] === 'connected',
            'connection_status' => $row['connection_status'],
            'is_configured' => $isConfigured,
            'email_address' => $row['email_address'],
            'account_name' => $row['account_name'] ?? $row['email_address'],
            'last_sync_at' => $row['last_sync_at'],
            'sync_status' => $row['sync_status'],
            'unread_count' => $unreadCount,
            'messages_count' => $messagesCount,
            'last_error' => $row['last_error'],
            'redirect_uri' => $redirectUri
        ];
    }
}
