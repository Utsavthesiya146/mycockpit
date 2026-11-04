<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../middleware/TenantMiddleware.php';
require_once __DIR__ . '/../services/gmail/HtmlSanitizer.php';
require_once __DIR__ . '/../services/gmail/GmailOAuthService.php';
require_once __DIR__ . '/../services/gmail/GmailApiService.php';

use Cockpit\Config\Database;
use Cockpit\Config\Config;
use Cockpit\Utils\Response;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Services\Gmail\HtmlSanitizer;
use Cockpit\Services\Gmail\GmailOAuthService;
use Cockpit\Services\Gmail\GmailApiService;
use PDO;

/**
 * Controller for Complete Gmail Management & OAuth Integration
 */
class GmailController {

    private static function getOAuthService(): GmailOAuthService {
        return new GmailOAuthService();
    }

    private static function getApiService(): GmailApiService {
        return new GmailApiService();
    }

    /**
     * GET /gmail/status - Connection & Account Status
     */
    public static function getStatus(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $oauth = self::getOAuthService();
        $status = $oauth->getStatus($tenantId);

        Response::success($status, 'Gmail status retrieved');
    }

    /**
     * POST /gmail/configure - Save Google Client Credentials for tenant
     */
    public static function configure(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $clientId = trim((string)($input['client_id'] ?? ''));
        $clientSecret = trim((string)($input['client_secret'] ?? ''));

        if (empty($clientId) || empty($clientSecret)) {
            Response::error('Google Client ID and Client Secret are required.', 422);
        }

        $oauth = self::getOAuthService();
        $saved = $oauth->saveClientCredentials($tenantId, $clientId, $clientSecret);

        if (!$saved) {
            Response::error('Failed to save Google Client Credentials.', 500);
        }

        Response::success([
            'is_configured' => true,
            'redirect_uri' => GmailOAuthService::getCanonicalRedirectUri()
        ], 'Google OAuth credentials saved securely');
    }

    /**
     * GET /gmail/auth-url - Initiate Google OAuth 2.0 Flow
     */
    public static function getAuthUrl(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $userId = (int)($currentUser['id'] ?? 1);

        $oauth = self::getOAuthService();
        $result = $oauth->generateAuthUrl($tenantId, $userId);

        if (!$result['success']) {
            Response::error($result['message'], 400, [
                'redirect_uri' => GmailOAuthService::getCanonicalRedirectUri(),
                'scopes' => GmailOAuthService::APPROVED_SCOPES
            ]);
        }

        Response::success($result, 'Authorization URL generated');
    }

    /**
     * GET /gmail/oauth/callback - Canonical Backend OAuth Callback
     * Public endpoint invoked by Google redirect
     */
    public static function oauthCallback(): void {
        $stateToken = $_GET['state'] ?? '';
        $code = $_GET['code'] ?? '';
        $error = $_GET['error'] ?? '';

        $frontendUrl = (string)Config::get('app_url', 'http://localhost:5173');

        if (!empty($error)) {
            $msg = urlencode('Google authorization cancelled: ' . $error);
            header("Location: {$frontendUrl}/?tab=apps&oauth_error={$msg}");
            exit;
        }

        if (empty($stateToken) || empty($code)) {
            $msg = urlencode('Missing OAuth state or authorization code from Google.');
            header("Location: {$frontendUrl}/?tab=apps&oauth_error={$msg}");
            exit;
        }

        $oauth = self::getOAuthService();
        $stateRecord = $oauth->validateState($stateToken);

        if (!$stateRecord) {
            $msg = urlencode('Invalid or expired OAuth state token. Please try again.');
            header("Location: {$frontendUrl}/?tab=apps&oauth_error={$msg}");
            exit;
        }

        $tenantId = (int)$stateRecord['tenant_id'];
        $codeVerifier = (string)($stateRecord['code_verifier'] ?? '');

        // Exchange code for tokens on the backend
        $tokenRes = $oauth->exchangeCode($tenantId, $code, $codeVerifier);
        if (!$tokenRes['success']) {
            $msg = urlencode($tokenRes['error'] ?? 'Token exchange failed.');
            header("Location: {$frontendUrl}/?tab=apps&oauth_error={$msg}");
            exit;
        }

        $tokens = $tokenRes['tokens'];

        // Retrieve user profile to identify connected email
        $api = self::getApiService();
        $profileRes = $api->getProfile($tokens['access_token']);
        $profile = $profileRes['success'] ? $profileRes['data'] : [];

        // Save encrypted tokens & update connected_apps
        $oauth->saveAccountTokens($tenantId, $tokens, $profile);

        // Run initial metadata-first sync
        try {
            self::syncInternal($tenantId);
        } catch (\Throwable $e) {}

        // Redirect user back to the Gmail Workspace in Cockpit
        header("Location: {$frontendUrl}/?tab=gmail&oauth=success");
        exit;
    }

    /**
     * POST /gmail/disconnect - Revoke Tokens & Disconnect
     */
    public static function disconnect(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $oauth = self::getOAuthService();
        $oauth->disconnect($tenantId);

        Response::success(['is_connected' => false], 'Gmail disconnected successfully');
    }

    /**
     * Internal metadata-first message synchronizer
     */
    public static function syncInternal(int $tenantId, int $maxMessages = 30): array {
        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);

        if (!$token) {
            return ['success' => false, 'error' => 'No active Gmail session or token expired'];
        }

        $api = self::getApiService();
        $db = Database::getConnection();

        // 1. Get profile
        $profileRes = $api->getProfile($token);
        $profile = $profileRes['success'] ? $profileRes['data'] : [];

        // 2. Fetch list of recent messages
        $listRes = $api->listMessages($token, ['maxResults' => $maxMessages]);
        if (!$listRes['success']) {
            $db->prepare("UPDATE gmail_accounts SET sync_status = 'sync_failed', last_error = ? WHERE tenant_id = ?")
               ->execute([$listRes['error'], $tenantId]);
            return $listRes;
        }

        $rawMessages = $listRes['data']['messages'] ?? [];
        $syncedCount = 0;
        $accountId = (int)$db->query("SELECT id FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetchColumn();

        foreach ($rawMessages as $msgStub) {
            $msgId = $msgStub['id'] ?? '';
            if (empty($msgId)) continue;

            // Check if already in DB
            $checkStmt = $db->prepare("SELECT id, body_fetched FROM gmail_messages WHERE tenant_id = ? AND message_id = ? LIMIT 1");
            $checkStmt->execute([$tenantId, $msgId]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            // Fetch metadata headers (Fast & lightweight)
            $metaRes = $api->getMessageMetadata($token, $msgId);
            if (!$metaRes['success']) continue;

            $meta = $api->parseMessagePayload($metaRes['data']);

            $labelsJson = json_encode($meta['labels']);
            $hasAttachments = $meta['has_attachments'] ? 1 : 0;

            if ($existing) {
                // Update labels, read status, trash, etc.
                $db->prepare("
                    UPDATE gmail_messages 
                    SET is_read = ?, is_starred = ?, is_trash = ?, is_spam = ?, is_important = ?,
                        labels_json = ?, updated_at = NOW()
                    WHERE id = ? AND tenant_id = ?
                ")->execute([
                    $meta['is_read'] ? 1 : 0,
                    $meta['is_starred'] ? 1 : 0,
                    $meta['is_trash'] ? 1 : 0,
                    $meta['is_spam'] ? 1 : 0,
                    $meta['is_important'] ? 1 : 0,
                    $labelsJson,
                    $existing['id'],
                    $tenantId
                ]);
            } else {
                // Insert metadata-only record (body_fetched = 0)
                $db->prepare("
                    INSERT INTO gmail_messages (
                        tenant_id, gmail_account_id, message_id, thread_id,
                        from_name, from_email, to_recipients, cc_recipients, bcc_recipients,
                        subject, snippet, body_plain, body_html, body_fetched,
                        internal_date, date_sent, is_read, is_starred, is_draft,
                        is_sent, is_trash, is_spam, is_important, labels_json,
                        has_attachments, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, NULL, NULL, 0,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, NOW(), NOW()
                    )
                ")->execute([
                    $tenantId, $accountId, $meta['message_id'], $meta['thread_id'],
                    $meta['from_name'], $meta['from_email'], $meta['to_recipients'], $meta['cc_recipients'], $meta['bcc_recipients'],
                    $meta['subject'], $meta['snippet'],
                    $meta['internal_date'], $meta['date_sent'],
                    $meta['is_read'] ? 1 : 0, $meta['is_starred'] ? 1 : 0, $meta['is_draft'] ? 1 : 0,
                    $meta['is_sent'] ? 1 : 0, $meta['is_trash'] ? 1 : 0, $meta['is_spam'] ? 1 : 0, $meta['is_important'] ? 1 : 0,
                    $labelsJson, $hasAttachments
                ]);
            }
            $syncedCount++;
        }

        // Update account sync state
        $db->prepare("
            UPDATE gmail_accounts 
            SET last_sync_at = NOW(), sync_status = 'sync_successful', last_error = NULL,
                messages_total = ?, threads_total = ?, updated_at = NOW()
            WHERE tenant_id = ?
        ")->execute([
            (int)($profile['messagesTotal'] ?? 0),
            (int)($profile['threadsTotal'] ?? 0),
            $tenantId
        ]);

        return [
            'success' => true,
            'messages_synced' => $syncedCount,
            'last_sync_at' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * POST /gmail/sync - Trigger on-demand Sync
     */
    public static function sync(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $res = self::syncInternal($tenantId);

        if (!$res['success']) {
            Response::error($res['error'] ?? 'Gmail sync failed', 400);
        }

        Response::success($res, "Gmail synchronized successfully ({$res['messages_synced']} messages processed)");
    }

    /**
     * GET /gmail/messages - List messages with folder and search filtering
     */
    public static function listMessages(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $folder = strtolower(trim((string)($_GET['folder'] ?? 'inbox')));
        $search = trim((string)($_GET['q'] ?? ''));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $conditions = ["tenant_id = :tenant_id"];
        $params = [':tenant_id' => $tenantId];

        // Folder Filtering
        switch ($folder) {
            case 'starred':
                $conditions[] = "is_starred = 1 AND is_trash = 0";
                break;
            case 'sent':
                $conditions[] = "is_sent = 1 AND is_trash = 0";
                break;
            case 'drafts':
                $conditions[] = "is_draft = 1 AND is_trash = 0";
                break;
            case 'important':
                $conditions[] = "is_important = 1 AND is_trash = 0";
                break;
            case 'trash':
                $conditions[] = "is_trash = 1";
                break;
            case 'spam':
                $conditions[] = "is_spam = 1 AND is_trash = 0";
                break;
            case 'all':
                $conditions[] = "is_trash = 0";
                break;
            case 'inbox':
            default:
                $conditions[] = "is_trash = 0 AND is_spam = 0 AND is_draft = 0 AND (is_sent = 0 OR labels_json LIKE '%INBOX%')";
                break;
        }

        // Search Query
        if (!empty($search)) {
            $conditions[] = "(subject LIKE :search OR from_name LIKE :search OR from_email LIKE :search OR snippet LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $whereClause = implode(" AND ", $conditions);

        // Count Total
        $countStmt = $db->prepare("SELECT count(*) FROM gmail_messages WHERE {$whereClause}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Count Unread in current folder
        $unreadStmt = $db->prepare("SELECT count(*) FROM gmail_messages WHERE {$whereClause} AND is_read = 0");
        $unreadStmt->execute($params);
        $unreadCount = (int)$unreadStmt->fetchColumn();

        // Select Page
        $sql = "
            SELECT id, message_id, thread_id, from_name, from_email, to_recipients,
                   subject, snippet, date_sent, is_read, is_starred, is_draft, is_sent,
                   is_trash, is_spam, is_important, has_attachments, labels_json
            FROM gmail_messages 
            WHERE {$whereClause}
            ORDER BY date_sent DESC 
            LIMIT {$limit} OFFSET {$offset}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize flags
        foreach ($messages as &$msg) {
            $msg['is_read'] = (bool)$msg['is_read'];
            $msg['is_starred'] = (bool)$msg['is_starred'];
            $msg['is_draft'] = (bool)$msg['is_draft'];
            $msg['is_sent'] = (bool)$msg['is_sent'];
            $msg['is_trash'] = (bool)$msg['is_trash'];
            $msg['is_spam'] = (bool)$msg['is_spam'];
            $msg['is_important'] = (bool)$msg['is_important'];
            $msg['has_attachments'] = (bool)$msg['has_attachments'];
            $msg['labels'] = json_decode((string)$msg['labels_json'], true) ?: [];
            unset($msg['labels_json']);
        }

        Response::success([
            'folder' => $folder,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => (int)ceil($total / $limit),
            'unread_count' => $unreadCount,
            'messages' => $messages
        ], 'Messages retrieved');
    }

    /**
     * GET /gmail/messages/{id} - Get full message detail with on-demand body loading
     */
    public static function getMessage(array $currentUser, string $messageId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM gmail_messages WHERE tenant_id = ? AND (message_id = ? OR id = ?) LIMIT 1");
        $stmt->execute([$tenantId, $messageId, (int)$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('Email message not found or unauthorized.', 404);
        }

        // On-demand body fetching (Metadata-first architecture)
        if (empty($row['body_fetched'])) {
            $oauth = self::getOAuthService();
            $token = $oauth->getValidAccessToken($tenantId);

            if ($token) {
                $api = self::getApiService();
                $fullRes = $api->getMessageFull($token, $row['message_id']);

                if ($fullRes['success']) {
                    $data = $fullRes['data'];
                    // Sanitize HTML body
                    $sanitizedHtml = HtmlSanitizer::sanitize((string)$data['body_html']);
                    $plainBody = (string)$data['body_plain'];
                    $attachmentsJson = json_encode($data['attachments']);

                    // Update DB with full body
                    $db->prepare("
                        UPDATE gmail_messages 
                        SET body_plain = ?, body_html = ?, body_fetched = 1,
                            attachments_json = ?, updated_at = NOW()
                        WHERE id = ? AND tenant_id = ?
                    ")->execute([$plainBody, $sanitizedHtml, $attachmentsJson, $row['id'], $tenantId]);

                    $row['body_plain'] = $plainBody;
                    $row['body_html'] = $sanitizedHtml;
                    $row['attachments_json'] = $attachmentsJson;
                    $row['body_fetched'] = 1;
                }
            }
        }

        // Parse attachments
        $attachments = json_decode((string)($row['attachments_json'] ?? '[]'), true) ?: [];

        $result = [
            'id' => (int)$row['id'],
            'message_id' => $row['message_id'],
            'thread_id' => $row['thread_id'],
            'from_name' => $row['from_name'],
            'from_email' => $row['from_email'],
            'to_recipients' => $row['to_recipients'],
            'cc_recipients' => $row['cc_recipients'],
            'bcc_recipients' => $row['bcc_recipients'],
            'subject' => $row['subject'],
            'snippet' => $row['snippet'],
            'body_plain' => $row['body_plain'],
            'body_html' => $row['body_html'],
            'date_sent' => $row['date_sent'],
            'is_read' => (bool)$row['is_read'],
            'is_starred' => (bool)$row['is_starred'],
            'is_draft' => (bool)$row['is_draft'],
            'is_sent' => (bool)$row['is_sent'],
            'is_trash' => (bool)$row['is_trash'],
            'is_spam' => (bool)$row['is_spam'],
            'is_important' => (bool)$row['is_important'],
            'has_attachments' => (bool)$row['has_attachments'],
            'attachments' => $attachments
        ];

        Response::success($result, 'Message retrieved');
    }

    /**
     * GET /gmail/messages/{id}/attachment/{attachmentId} - Secure Attachment Streaming
     */
    public static function getAttachment(array $currentUser, string $messageId, string $attachmentId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        // 1. Verify tenant owns this message
        $stmt = $db->prepare("SELECT message_id, attachments_json FROM gmail_messages WHERE tenant_id = ? AND (message_id = ? OR id = ?) LIMIT 1");
        $stmt->execute([$tenantId, $messageId, (int)$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('Message not found or unauthorized.', 404);
        }

        $realMessageId = $row['message_id'];
        $attachments = json_decode((string)$row['attachments_json'], true) ?: [];
        $targetAtt = null;
        foreach ($attachments as $a) {
            if (($a['attachment_id'] ?? '') === $attachmentId) {
                $targetAtt = $a;
                break;
            }
        }

        $filename = basename($targetAtt['filename'] ?? 'attachment');
        $mimeType = $targetAtt['mime_type'] ?? 'application/octet-stream';

        // 2. Fetch binary stream via Gmail API
        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if (!$token) {
            Response::error('Gmail session expired. Please re-authenticate.', 401);
        }

        $api = self::getApiService();
        $attData = $api->getAttachment($token, $realMessageId, $attachmentId);

        if (!$attData || empty($attData['data'])) {
            Response::error('Could not download attachment from Gmail.', 404);
        }

        // 3. Stream securely
        header('Content-Type: ' . $mimeType);
        header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
        header('Content-Length: ' . strlen($attData['data']));
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=3600');

        echo $attData['data'];
        exit;
    }

    /**
     * POST /gmail/messages/{id}/modify - Modify labels (Read/Unread, Star, Archive, Spam)
     */
    public static function modifyMessage(array $currentUser, string $messageId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $action = trim((string)($input['action'] ?? ''));

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT id, message_id FROM gmail_messages WHERE tenant_id = ? AND (message_id = ? OR id = ?) LIMIT 1");
        $stmt->execute([$tenantId, $messageId, (int)$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('Message not found.', 404);
        }

        $realMsgId = $row['message_id'];
        $dbId = $row['id'];

        $addLabels = [];
        $removeLabels = [];
        $dbUpdates = [];

        switch ($action) {
            case 'mark_read':
                $removeLabels[] = 'UNREAD';
                $dbUpdates[] = "is_read = 1";
                break;
            case 'mark_unread':
                $addLabels[] = 'UNREAD';
                $dbUpdates[] = "is_read = 0";
                break;
            case 'star':
                $addLabels[] = 'STARRED';
                $dbUpdates[] = "is_starred = 1";
                break;
            case 'unstar':
                $removeLabels[] = 'STARRED';
                $dbUpdates[] = "is_starred = 0";
                break;
            case 'archive':
                $removeLabels[] = 'INBOX';
                break;
            case 'spam':
                $addLabels[] = 'SPAM';
                $removeLabels[] = 'INBOX';
                $dbUpdates[] = "is_spam = 1";
                break;
            case 'unspam':
                $removeLabels[] = 'SPAM';
                $addLabels[] = 'INBOX';
                $dbUpdates[] = "is_spam = 0";
                break;
            default:
                Response::error("Unknown modification action '{$action}'", 400);
        }

        // Apply via Gmail API if token is valid
        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if ($token) {
            $api = self::getApiService();
            $api->modifyMessageLabels($token, $realMsgId, $addLabels, $removeLabels);
        }

        // Update local database
        if (!empty($dbUpdates)) {
            $sql = "UPDATE gmail_messages SET " . implode(", ", $dbUpdates) . ", updated_at = NOW() WHERE id = {$dbId}";
            $db->exec($sql);
        }

        Response::success(['action' => $action, 'message_id' => $realMsgId], 'Message modified successfully');
    }

    /**
     * POST /gmail/messages/{id}/trash - Move Message to Gmail Trash
     * Enforces the critical rule: Normal Delete moves to Trash. No permanent deletion.
     */
    public static function trashMessage(array $currentUser, string $messageId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, message_id FROM gmail_messages WHERE tenant_id = ? AND (message_id = ? OR id = ?) LIMIT 1");
        $stmt->execute([$tenantId, $messageId, (int)$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('Message not found.', 404);
        }

        $realMsgId = $row['message_id'];
        $dbId = $row['id'];

        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if ($token) {
            $api = self::getApiService();
            $api->trashMessage($token, $realMsgId);
        }

        // Mark as trash in database
        $db->prepare("UPDATE gmail_messages SET is_trash = 1, updated_at = NOW() WHERE id = ?")->execute([$dbId]);

        Response::success([
            'message_id' => $realMsgId,
            'is_trash' => true,
            'note' => 'Message moved to Gmail Trash. It will be kept by Gmail for 30 days.'
        ], 'Message moved to Trash');
    }

    /**
     * POST /gmail/messages/{id}/untrash - Restore Message from Gmail Trash
     */
    public static function untrashMessage(array $currentUser, string $messageId): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, message_id FROM gmail_messages WHERE tenant_id = ? AND (message_id = ? OR id = ?) LIMIT 1");
        $stmt->execute([$tenantId, $messageId, (int)$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('Message not found.', 404);
        }

        $realMsgId = $row['message_id'];
        $dbId = $row['id'];

        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if ($token) {
            $api = self::getApiService();
            $api->untrashMessage($token, $realMsgId);
        }

        // Restore in database
        $db->prepare("UPDATE gmail_messages SET is_trash = 0, updated_at = NOW() WHERE id = ?")->execute([$dbId]);

        Response::success([
            'message_id' => $realMsgId,
            'is_trash' => false
        ], 'Message restored from Trash to Inbox');
    }

    /**
     * POST /gmail/messages/send - Compose & Send Email
     */
    public static function sendMessage(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $to = trim((string)($input['to'] ?? ''));
        $subject = trim((string)($input['subject'] ?? ''));
        $bodyHtml = trim((string)($input['body_html'] ?? ''));
        $bodyPlain = trim((string)($input['body_plain'] ?? ''));
        $cc = trim((string)($input['cc'] ?? ''));
        $bcc = trim((string)($input['bcc'] ?? ''));
        $threadId = trim((string)($input['thread_id'] ?? ''));
        $inReplyTo = trim((string)($input['in_reply_to'] ?? ''));
        $attachments = $input['attachments'] ?? []; // Array of {name, type, content (base64)}

        if (empty($to)) {
            Response::error('Recipient email (To) is required.', 422);
        }
        if (empty($subject) && empty($bodyHtml) && empty($bodyPlain)) {
            Response::error('Email must have a subject or body.', 422);
        }

        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if (!$token) {
            Response::error('No active Gmail session found. Please connect your Gmail account.', 401);
        }

        // Get connected email address for From header
        $db = Database::getConnection();
        $fromEmail = (string)$db->query("SELECT email_address FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetchColumn();
        if (empty($fromEmail)) {
            $fromEmail = 'me';
        }

        $emailData = [
            'from' => $fromEmail,
            'to' => $to,
            'cc' => $cc,
            'bcc' => $bcc,
            'subject' => $subject,
            'body_html' => $bodyHtml,
            'body_plain' => $bodyPlain,
            'in_reply_to' => $inReplyTo,
            'references' => $inReplyTo
        ];

        // Process attachments: decode base64 content
        $processedAttachments = [];
        if (is_array($attachments)) {
            foreach ($attachments as $att) {
                if (!empty($att['content']) && !empty($att['name'])) {
                    $binary = base64_decode((string)$att['content']);
                    if ($binary !== false) {
                        $processedAttachments[] = [
                            'name' => basename((string)$att['name']),
                            'type' => (string)($att['type'] ?? 'application/octet-stream'),
                            'content' => $binary
                        ];
                    }
                }
            }
        }

        $api = self::getApiService();
        $rawMime = $api->buildMimeMessage($emailData, $processedAttachments);
        $sendRes = $api->sendMessage($token, $rawMime, $threadId ?: null);

        if (!$sendRes['success']) {
            Response::error('Failed to send email via Gmail API: ' . ($sendRes['error'] ?? 'API error'), 400, $sendRes);
        }

        $sentMsgId = $sendRes['data']['id'] ?? '';
        $sentThreadId = $sendRes['data']['threadId'] ?? ($threadId ?: $sentMsgId);

        // Record in local database as sent email
        $accountId = (int)$db->query("SELECT id FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetchColumn();
        $snippet = substr(strip_tags(!empty($bodyPlain) ? $bodyPlain : $bodyHtml), 0, 150);

        $db->prepare("
            INSERT INTO gmail_messages (
                tenant_id, gmail_account_id, message_id, thread_id,
                from_name, from_email, to_recipients, cc_recipients, bcc_recipients,
                subject, snippet, body_plain, body_html, body_fetched,
                internal_date, date_sent, is_read, is_sent, is_trash, labels_json,
                has_attachments, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, 1,
                ?, NOW(), 1, 1, 0, '[\"SENT\"]',
                ?, NOW(), NOW()
            )
        ")->execute([
            $tenantId, $accountId, $sentMsgId, $sentThreadId,
            $fromEmail, $fromEmail, $to, $cc, $bcc,
            $subject, $snippet, $bodyPlain, $bodyHtml,
            time() * 1000,
            !empty($processedAttachments) ? 1 : 0
        ]);

        Response::success([
            'message_id' => $sentMsgId,
            'thread_id' => $sentThreadId,
            'delivery_status' => 'sent',
            'sent_at' => date('Y-m-d H:i:s')
        ], 'Email sent successfully via Gmail API');
    }

    /**
     * POST /gmail/drafts - Save Draft
     */
    public static function createDraft(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        if (!$token) {
            Response::error('No active Gmail session found.', 401);
        }

        $db = Database::getConnection();
        $fromEmail = (string)$db->query("SELECT email_address FROM gmail_accounts WHERE tenant_id = {$tenantId} LIMIT 1")->fetchColumn();

        $emailData = [
            'from' => $fromEmail ?: 'me',
            'to' => trim((string)($input['to'] ?? '')),
            'cc' => trim((string)($input['cc'] ?? '')),
            'bcc' => trim((string)($input['bcc'] ?? '')),
            'subject' => trim((string)($input['subject'] ?? '(Draft)')),
            'body_html' => trim((string)($input['body_html'] ?? '')),
            'body_plain' => trim((string)($input['body_plain'] ?? ''))
        ];

        $api = self::getApiService();
        $rawMime = $api->buildMimeMessage($emailData);
        $draftRes = $api->createDraft($token, $rawMime);

        if (!$draftRes['success']) {
            Response::error('Failed to create draft: ' . ($draftRes['error'] ?? 'API error'), 400);
        }

        Response::success($draftRes['data'], 'Draft saved successfully');
    }

    /**
     * POST /gmail/batch - Bulk Actions (Mark Read/Unread, Star, Trash, Archive)
     */
    public static function batchAction(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $action = trim((string)($input['action'] ?? ''));
        $messageIds = $input['message_ids'] ?? [];

        if (empty($messageIds) || !is_array($messageIds)) {
            Response::error('Message IDs array is required for bulk actions.', 422);
        }

        $db = Database::getConnection();
        $oauth = self::getOAuthService();
        $token = $oauth->getValidAccessToken($tenantId);
        $api = self::getApiService();

        $addLabels = [];
        $removeLabels = [];
        $dbSql = '';

        switch ($action) {
            case 'mark_read':
                $removeLabels[] = 'UNREAD';
                $dbSql = "is_read = 1";
                break;
            case 'mark_unread':
                $addLabels[] = 'UNREAD';
                $dbSql = "is_read = 0";
                break;
            case 'star':
                $addLabels[] = 'STARRED';
                $dbSql = "is_starred = 1";
                break;
            case 'unstar':
                $removeLabels[] = 'STARRED';
                $dbSql = "is_starred = 0";
                break;
            case 'archive':
                $removeLabels[] = 'INBOX';
                break;
            case 'trash':
                $dbSql = "is_trash = 1";
                break;
            default:
                Response::error("Unknown batch action '{$action}'", 400);
        }

        // Apply via Gmail API in batch
        if ($token) {
            if ($action === 'trash') {
                foreach ($messageIds as $mid) {
                    $api->trashMessage($token, (string)$mid);
                }
            } else {
                $api->batchModifyLabels($token, $messageIds, $addLabels, $removeLabels);
            }
        }

        // Apply in local database
        if (!empty($dbSql)) {
            $inClause = implode(',', array_fill(0, count($messageIds), '?'));
            $params = array_merge([$tenantId], $messageIds);
            $db->prepare("UPDATE gmail_messages SET {$dbSql}, updated_at = NOW() WHERE tenant_id = ? AND message_id IN ({$inClause})")
               ->execute($params);
        }

        Response::success([
            'action' => $action,
            'count' => count($messageIds)
        ], "Bulk action '{$action}' completed for " . count($messageIds) . " messages");
    }

    /**
     * GET /gmail/labels - Folder Counts & Labels
     */
    public static function getLabels(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $inboxCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_trash = 0 AND is_spam = 0 AND is_draft = 0 AND (is_sent = 0 OR labels_json LIKE '%INBOX%')")->fetchColumn();
        $inboxUnread = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_trash = 0 AND is_spam = 0 AND is_read = 0 AND is_draft = 0 AND (is_sent = 0 OR labels_json LIKE '%INBOX%')")->fetchColumn();
        $starredCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_starred = 1 AND is_trash = 0")->fetchColumn();
        $sentCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_sent = 1 AND is_trash = 0")->fetchColumn();
        $draftsCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_draft = 1 AND is_trash = 0")->fetchColumn();
        $importantCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_important = 1 AND is_trash = 0")->fetchColumn();
        $spamCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_spam = 1 AND is_trash = 0")->fetchColumn();
        $trashCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_trash = 1")->fetchColumn();
        $allCount = (int)$db->query("SELECT count(*) FROM gmail_messages WHERE tenant_id = {$tenantId} AND is_trash = 0")->fetchColumn();

        Response::success([
            'folders' => [
                'inbox' => ['label' => 'Inbox', 'count' => $inboxCount, 'unread' => $inboxUnread],
                'starred' => ['label' => 'Starred', 'count' => $starredCount, 'unread' => 0],
                'sent' => ['label' => 'Sent', 'count' => $sentCount, 'unread' => 0],
                'drafts' => ['label' => 'Drafts', 'count' => $draftsCount, 'unread' => 0],
                'important' => ['label' => 'Important', 'count' => $importantCount, 'unread' => 0],
                'spam' => ['label' => 'Spam', 'count' => $spamCount, 'unread' => 0],
                'trash' => ['label' => 'Trash', 'count' => $trashCount, 'unread' => 0],
                'all' => ['label' => 'All Mail', 'count' => $allCount, 'unread' => 0]
            ],
            'unread_total' => $inboxUnread
        ], 'Folder labels retrieved');
    }
}

