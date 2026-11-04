<?php
declare(strict_types=1);

namespace Cockpit\Services\Gmail;

/**
 * Official Google Gmail REST API v1 Client
 * 
 * Provides:
 * - Profile and quota verification
 * - Metadata-first message listing & pagination
 * - On-demand full message & attachment retrieval
 * - RFC 2822 MIME message construction (To, CC, BCC, HTML, Attachments)
 * - Send, Draft, Reply, Forward, Reply-All
 * - Trash, Untrash, Modify labels (Read/Unread, Star, Spam, Archive)
 */
class GmailApiService {

    private const API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

    /**
     * Perform authorized HTTP request against Gmail API
     */
    private function request(string $accessToken, string $endpoint, string $method = 'GET', ?array $body = null): array {
        $url = self::API_BASE . $endpoint;
        $ch = curl_init($url);

        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'Accept: application/json'
        ];

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ];

        if ($method === 'POST') {
            $opts[CURLOPT_POST] = true;
            if ($body !== null) {
                $payload = json_encode($body);
                $opts[CURLOPT_POSTFIELDS] = $payload;
                $headers[] = 'Content-Type: application/json';
            } else {
                $headers[] = 'Content-Length: 0';
            }
        } elseif ($method !== 'GET') {
            $opts[CURLOPT_CUSTOMREQUEST] = $method;
            if ($body !== null) {
                $opts[CURLOPT_POSTFIELDS] = json_encode($body);
                $headers[] = 'Content-Type: application/json';
            }
        }

        $opts[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $opts);

        $res = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($res === false) {
            return [
                'success' => false,
                'http_code' => 0,
                'error' => 'Connection to Gmail API failed: ' . ($curlErr ?: 'Unknown network error')
            ];
        }

        $json = json_decode($res, true) ?: [];

        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'http_code' => $httpCode,
                'data' => $json
            ];
        }

        $errMessage = $json['error']['message'] ?? ($json['error']['status'] ?? "HTTP {$httpCode}");
        return [
            'success' => false,
            'http_code' => $httpCode,
            'error' => $errMessage,
            'details' => $json
        ];
    }

    /**
     * Get user profile (email, total messages, historyId)
     */
    public function getProfile(string $accessToken): array {
        return $this->request($accessToken, '/profile');
    }

    /**
     * List message IDs matching label/query with pagination
     */
    public function listMessages(string $accessToken, array $params = []): array {
        $query = [];
        if (!empty($params['q'])) $query['q'] = $params['q'];
        if (!empty($params['labelIds'])) {
            if (is_array($params['labelIds'])) {
                foreach ($params['labelIds'] as $lid) {
                    $query['labelIds'] = $lid;
                }
            } else {
                $query['labelIds'] = $params['labelIds'];
            }
        }
        $query['maxResults'] = !empty($params['maxResults']) ? min(50, (int)$params['maxResults']) : 20;
        if (!empty($params['pageToken'])) $query['pageToken'] = $params['pageToken'];
        if (!empty($params['includeSpamTrash'])) $query['includeSpamTrash'] = 'true';

        $endpoint = '/messages?' . http_build_query($query);
        return $this->request($accessToken, $endpoint);
    }

    /**
     * Retrieve lightweight message metadata (Headers: From, To, Subject, Date)
     */
    public function getMessageMetadata(string $accessToken, string $messageId): array {
        $endpoint = "/messages/{$messageId}?format=metadata"
            . "&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc"
            . "&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID";
        return $this->request($accessToken, $endpoint);
    }

    /**
     * Retrieve full message payload with body and attachment references
     */
    public function getMessageFull(string $accessToken, string $messageId): array {
        $endpoint = "/messages/{$messageId}?format=full";
        $res = $this->request($accessToken, $endpoint);
        if (!$res['success']) {
            return $res;
        }

        $parsed = $this->parseMessagePayload($res['data']);
        return [
            'success' => true,
            'http_code' => 200,
            'data' => $parsed
        ];
    }

    /**
     * Parse raw Gmail message payload into clean structured email record
     */
    public function parseMessagePayload(array $raw): array {
        $id = $raw['id'] ?? '';
        $threadId = $raw['threadId'] ?? '';
        $snippet = html_entity_decode((string)($raw['snippet'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $labelIds = $raw['labelIds'] ?? [];
        $internalDate = (int)($raw['internalDate'] ?? 0);

        $headers = [];
        foreach ($raw['payload']['headers'] ?? [] as $h) {
            $headers[strtolower($h['name'])] = $h['value'];
        }

        $subject = $headers['subject'] ?? '(No Subject)';
        $fromRaw = $headers['from'] ?? '';
        $toRaw = $headers['to'] ?? '';
        $ccRaw = $headers['cc'] ?? '';
        $bccRaw = $headers['bcc'] ?? '';
        $dateRaw = $headers['date'] ?? '';
        $messageIdHeader = $headers['message-id'] ?? '';
        $replyTo = $headers['reply-to'] ?? '';

        // Parse From Name and Email
        $fromName = '';
        $fromEmail = $fromRaw;
        if (preg_match('/^(.*?)\s*<([^>]+)>$/', $fromRaw, $m)) {
            $fromName = trim($m[1], " \t\n\r\0\x0B\"'");
            $fromEmail = trim($m[2]);
        } elseif (filter_var($fromRaw, FILTER_VALIDATE_EMAIL)) {
            $fromEmail = $fromRaw;
        }

        // Parse Body and Attachments recursively
        $plainBody = '';
        $htmlBody = '';
        $attachments = [];

        $this->extractParts($raw['payload'] ?? [], $plainBody, $htmlBody, $attachments);

        // Convert internalDate to DATETIME
        $dateSent = $internalDate > 0
            ? date('Y-m-d H:i:s', (int)($internalDate / 1000))
            : (!empty($dateRaw) ? date('Y-m-d H:i:s', strtotime($dateRaw)) : date('Y-m-d H:i:s'));

        return [
            'message_id' => $id,
            'thread_id' => $threadId,
            'snippet' => $snippet,
            'subject' => $subject,
            'from_name' => $fromName,
            'from_email' => $fromEmail,
            'to_recipients' => $toRaw,
            'cc_recipients' => $ccRaw,
            'bcc_recipients' => $bccRaw,
            'reply_to' => $replyTo,
            'message_id_header' => $messageIdHeader,
            'date_sent' => $dateSent,
            'internal_date' => $internalDate,
            'body_plain' => $plainBody,
            'body_html' => $htmlBody,
            'labels' => $labelIds,
            'is_read' => !in_array('UNREAD', $labelIds, true),
            'is_starred' => in_array('STARRED', $labelIds, true),
            'is_draft' => in_array('DRAFT', $labelIds, true),
            'is_sent' => in_array('SENT', $labelIds, true),
            'is_trash' => in_array('TRASH', $labelIds, true),
            'is_spam' => in_array('SPAM', $labelIds, true),
            'is_important' => in_array('IMPORTANT', $labelIds, true),
            'has_attachments' => !empty($attachments),
            'attachments' => $attachments
        ];
    }

    /**
     * Recursively extract plain/HTML body and attachment metadata from MIME parts
     */
    private function extractParts(array $part, string &$plain, string &$html, array &$attachments): void {
        $mimeType = strtolower($part['mimeType'] ?? '');
        $body = $part['body'] ?? [];
        $filename = $part['filename'] ?? '';

        // If part is an attachment
        if (!empty($filename) || !empty($body['attachmentId'])) {
            $attachments[] = [
                'filename' => $filename ?: 'attachment',
                'mime_type' => $mimeType ?: 'application/octet-stream',
                'size' => (int)($body['size'] ?? 0),
                'attachment_id' => $body['attachmentId'] ?? null
            ];
        }

        // Text plain body
        if ($mimeType === 'text/plain' && empty($filename) && !empty($body['data'])) {
            $decoded = self::base64UrlDecode($body['data']);
            if ($decoded !== false) {
                $plain .= $decoded;
            }
        }

        // Text HTML body
        if ($mimeType === 'text/html' && empty($filename) && !empty($body['data'])) {
            $decoded = self::base64UrlDecode($body['data']);
            if ($decoded !== false) {
                $html .= $decoded;
            }
        }

        // Recurse into sub-parts
        if (!empty($part['parts']) && is_array($part['parts'])) {
            foreach ($part['parts'] as $subPart) {
                $this->extractParts($subPart, $plain, $html, $attachments);
            }
        }
    }

    /**
     * Base64URL decode helper
     */
    public static function base64UrlDecode(string $data): string|false {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padLen = 4 - $remainder;
            $data .= str_repeat('=', $padLen);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }

    /**
     * Base64URL encode helper
     */
    public static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Download binary data for an attachment
     */
    public function getAttachment(string $accessToken, string $messageId, string $attachmentId): ?array {
        $endpoint = "/messages/{$messageId}/attachments/{$attachmentId}";
        $res = $this->request($accessToken, $endpoint);
        if (!$res['success'] || empty($res['data']['data'])) {
            return null;
        }

        $binary = self::base64UrlDecode($res['data']['data']);
        if ($binary === false) {
            return null;
        }

        return [
            'size' => (int)($res['data']['size'] ?? strlen($binary)),
            'data' => $binary
        ];
    }

    /**
     * Move message to Gmail Trash
     */
    public function trashMessage(string $accessToken, string $messageId): array {
        return $this->request($accessToken, "/messages/{$messageId}/trash", 'POST');
    }

    /**
     * Restore message from Gmail Trash
     */
    public function untrashMessage(string $accessToken, string $messageId): array {
        return $this->request($accessToken, "/messages/{$messageId}/untrash", 'POST');
    }

    /**
     * Modify labels on a message (Mark read/unread, Star/unstar, Archive, Spam)
     */
    public function modifyMessageLabels(string $accessToken, string $messageId, array $addLabelIds = [], array $removeLabelIds = []): array {
        $body = [
            'addLabelIds' => array_values(array_unique($addLabelIds)),
            'removeLabelIds' => array_values(array_unique($removeLabelIds))
        ];
        return $this->request($accessToken, "/messages/{$messageId}/modify", 'POST', $body);
    }

    /**
     * Batch modify labels for multiple messages
     */
    public function batchModifyLabels(string $accessToken, array $messageIds, array $addLabelIds = [], array $removeLabelIds = []): array {
        $body = [
            'ids' => array_values($messageIds),
            'addLabelIds' => array_values(array_unique($addLabelIds)),
            'removeLabelIds' => array_values(array_unique($removeLabelIds))
        ];
        return $this->request($accessToken, '/messages/batchModify', 'POST', $body);
    }

    /**
     * Build RFC 2822 MIME Message supporting To, CC, BCC, HTML, Plain Text, and Attachments
     */
    public function buildMimeMessage(array $emailData, array $attachments = []): string {
        $boundaryMixed = '==_Mixed_Part_' . md5((string)microtime());
        $boundaryAlt = '==_Alt_Part_' . md5((string)microtime());

        $to = trim($emailData['to'] ?? '');
        $cc = trim($emailData['cc'] ?? '');
        $bcc = trim($emailData['bcc'] ?? '');
        $from = trim($emailData['from'] ?? '');
        $subject = trim($emailData['subject'] ?? '(No Subject)');
        $bodyPlain = trim((string)($emailData['body_plain'] ?? ''));
        $bodyHtml = trim((string)($emailData['body_html'] ?? ''));
        $inReplyTo = trim($emailData['in_reply_to'] ?? '');
        $references = trim($emailData['references'] ?? '');

        // Fallbacks if one body format is missing
        if (empty($bodyPlain) && !empty($bodyHtml)) {
            $bodyPlain = strip_tags($bodyHtml);
        }
        if (empty($bodyHtml) && !empty($bodyPlain)) {
            $bodyHtml = nl2br(htmlspecialchars($bodyPlain, ENT_QUOTES, 'UTF-8'));
        }

        $headers = [];
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Date: ' . date('r');
        $headers[] = 'Message-ID: <' . md5(uniqid((string)rand(), true)) . '@mycockpit.ai>';
        if (!empty($from)) $headers[] = "From: {$from}";
        if (!empty($to)) $headers[] = "To: {$to}";
        if (!empty($cc)) $headers[] = "Cc: {$cc}";
        if (!empty($bcc)) $headers[] = "Bcc: {$bcc}";
        $headers[] = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';

        if (!empty($inReplyTo)) $headers[] = "In-Reply-To: {$inReplyTo}";
        if (!empty($references)) $headers[] = "References: {$references}";

        $hasAttachments = !empty($attachments);

        if ($hasAttachments) {
            $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundaryMixed}\"";
            $message = implode("\r\n", $headers) . "\r\n\r\n";
            $message .= "--{$boundaryMixed}\r\n";
            $message .= "Content-Type: multipart/alternative; boundary=\"{$boundaryAlt}\"\r\n\r\n";
        } else {
            $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundaryAlt}\"";
            $message = implode("\r\n", $headers) . "\r\n\r\n";
        }

        // Plain text part
        $message .= "--{$boundaryAlt}\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($bodyPlain)) . "\r\n";

        // HTML part
        $message .= "--{$boundaryAlt}\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($bodyHtml)) . "\r\n";

        $message .= "--{$boundaryAlt}--\r\n";

        // Attachment parts
        if ($hasAttachments) {
            foreach ($attachments as $att) {
                $filename = basename($att['name'] ?? ($att['filename'] ?? 'file'));
                $mimeType = $att['type'] ?? ($att['mimeType'] ?? 'application/octet-stream');
                $content = $att['content'] ?? ($att['data'] ?? ''); // Binary string or raw data

                $message .= "\r\n--{$boundaryMixed}\r\n";
                $message .= "Content-Type: {$mimeType}; name=\"{$filename}\"\r\n";
                $message .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n";
                $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $message .= chunk_split(base64_encode($content)) . "\r\n";
            }
            $message .= "\r\n--{$boundaryMixed}--\r\n";
        }

        return $message;
    }

    /**
     * Send email via Gmail API
     */
    public function sendMessage(string $accessToken, string $rawMime, ?string $threadId = null): array {
        $encodedRaw = self::base64UrlEncode($rawMime);
        $body = ['raw' => $encodedRaw];
        if (!empty($threadId)) {
            $body['threadId'] = $threadId;
        }

        return $this->request($accessToken, '/messages/send', 'POST', $body);
    }

    /**
     * Create or update draft via Gmail API
     */
    public function createDraft(string $accessToken, string $rawMime, ?string $threadId = null): array {
        $encodedRaw = self::base64UrlEncode($rawMime);
        $messageObj = ['raw' => $encodedRaw];
        if (!empty($threadId)) {
            $messageObj['threadId'] = $threadId;
        }

        return $this->request($accessToken, '/drafts', 'POST', ['message' => $messageObj]);
    }

    /**
     * List all user and system labels
     */
    public function listLabels(string $accessToken): array {
        return $this->request($accessToken, '/labels');
    }
}
