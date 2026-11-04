<?php
declare(strict_types=1);

namespace Cockpit\Services\Gmail;

/**
 * Strict HTML Sanitizer for Email Rendering
 * 
 * Prevents Cross-Site Scripting (XSS), script execution, unsafe embedded objects,
 * and malicious event handlers in incoming email bodies.
 */
class HtmlSanitizer {

    /**
     * Dangerous tags that must be completely removed along with their content
     */
    private static array $blockedTags = [
        'script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link',
        'form', 'input', 'button', 'select', 'textarea', 'frame', 'frameset',
        'base', 'svg', 'math'
    ];

    /**
     * Whitelist of safe HTML tags permitted in email content
     */
    private static array $allowedTags = [
        'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
        'blockquote', 'pre', 'code', 'a', 'img', 'font', 'center'
    ];

    /**
     * Whitelist of safe tag attributes
     */
    private static array $allowedAttributes = [
        'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height',
        'align', 'valign', 'bgcolor', 'color', 'size', 'face', 'border',
        'cellpadding', 'cellspacing', 'style', 'class', 'dir'
    ];

    /**
     * Sanitize raw HTML email content
     *
     * @param string $html Raw HTML content
     * @param bool $allowRemoteImages Whether to permit remote http/https images (default: false for tracking protection)
     * @return string Safe, sanitized HTML string
     */
    public static function sanitize(string $html, bool $allowRemoteImages = false): string {
        if (trim($html) === '') {
            return '';
        }

        // 1. Remove dangerous tags and everything inside them
        foreach (self::$blockedTags as $tag) {
            $html = preg_replace('#<' . $tag . '\b[^>]*>(.*?)</' . $tag . '>#is', '', $html);
            $html = preg_replace('#<' . $tag . '\b[^>]*>#is', '', $html);
        }

        // 2. Remove style blocks if they contain dangerous expression or import
        $html = preg_replace('#<style\b[^>]*>(.*?)</style>#is', '', $html);

        // 3. Remove all inline event handlers (e.g. onclick, onload, onerror, onmouseover)
        $html = preg_replace('/(\s|^)on[a-z0-9_-]+\s*=\s*(["\'][^"\']*["\']|[^\s>]+)/i', '', $html);

        // 4. Remove javascript:, vbscript:, data: (except data:image/) in attributes
        $html = preg_replace('/href\s*=\s*(["\'])\s*(javascript|vbscript):/i', 'href=$1#blocked:', $html);
        $html = preg_replace('/href\s*=\s*(["\'])\s*data:(?!image\/)/i', 'href=$1#blocked:', $html);
        $html = preg_replace('/src\s*=\s*(["\'])\s*(javascript|vbscript):/i', 'src=$1#blocked:', $html);
        $html = preg_replace('/src\s*=\s*(["\'])\s*data:(?!image\/)/i', 'src=$1#blocked:', $html);

        // 5. Clean CSS expressions and dangerous behavior in style attributes
        $html = preg_replace_callback('/style\s*=\s*(["\'])(.*?)\1/is', function ($matches) {
            $quote = $matches[1];
            $style = $matches[2];
            // Remove expression(), url(javascript:), behavior:
            $cleaned = preg_replace('/expression\s*\([^)]*\)/i', '', $style);
            $cleaned = preg_replace('/url\s*\(\s*(["\']?)\s*(javascript|vbscript|data):[^)]*\)/i', '', $cleaned);
            $cleaned = preg_replace('/behavior\s*:[^;]+;?/i', '', $cleaned);
            $cleaned = preg_replace('/-moz-binding\s*:[^;]+;?/i', '', $cleaned);
            return 'style=' . $quote . $cleaned . $quote;
        }, $html);

        // 6. Handle remote tracking images protection
        if (!$allowRemoteImages) {
            $html = preg_replace_callback('/<img\b([^>]*)>/i', function ($matches) {
                $attrs = $matches[1];
                // If src is an external http/https URL, replace with data-deferred-src
                if (preg_match('/src\s*=\s*(["\'])(https?:\/\/[^"\']+)\1/i', $attrs, $srcMatch)) {
                    $originalUrl = htmlspecialchars($srcMatch[2], ENT_QUOTES);
                    $attrs = preg_replace('/src\s*=\s*(["\'])https?:\/\/[^"\']+\1/i', 'src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'><rect width=\'16\' height=\'16\' fill=\'%23f3f4f6\'/></svg>" data-remote-src="' . $originalUrl . '" data-blocked-tracker="1"', $attrs);
                }
                return '<img ' . trim($attrs) . '>';
            }, $html);
        }

        // 7. Enforce safe target and rel on all links
        $html = preg_replace_callback('/<a\b([^>]*)>/i', function ($matches) {
            $attrs = $matches[1];
            // Remove existing target and rel
            $attrs = preg_replace('/\s*(target|rel)\s*=\s*(["\'][^"\']*["\']|[^\s>]+)/i', '', $attrs);
            return '<a ' . trim($attrs) . ' target="_blank" rel="noopener noreferrer">';
        }, $html);

        return $html;
    }

    /**
     * Convert plain text email to safe HTML formatting
     */
    public static function plainTextToHtml(string $plainText): string {
        $escaped = htmlspecialchars($plainText, ENT_QUOTES, 'UTF-8');
        // Convert URLs to clickable links
        $linked = preg_replace(
            '/(https?:\/\/[^\s<]+)/i',
            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#D62839; text-decoration:underline;">$1</a>',
            $escaped
        );
        return nl2br($linked);
    }
}

