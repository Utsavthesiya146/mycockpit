<?php
declare(strict_types=1);

namespace Cockpit\Utils;

use Cockpit\Config\Config;

/**
 * Enterprise Cryptographic Utility
 * Authenticated Encryption with Associated Data (AEAD) via AES-256-GCM.
 * Preserves seamless backward compatibility with legacy AES-256-CBC records.
 */
class Encryption {

    private static function getKey(): string {
        $secret = Config::get('jwt_secret') ?: 'mycockpit_ai_default_encryption_key_2026';
        return hash('sha256', $secret . '_creds_salt_gcm_v2', true);
    }

    private static function getLegacyKey(): string {
        $secret = Config::get('jwt_secret') ?: 'mycockpit_ai_default_encryption_key_2026';
        return hash('sha256', $secret . '_creds_salt', true);
    }

    /**
     * Encrypt plaintext string using AES-256-GCM (Authenticated Encryption with 16-byte Auth Tag)
     * Format: v2:gcm::{base64_iv}::{base64_tag}::{base64_ciphertext}
     */
    public static function encrypt(string $plainText): string {
        $key = self::getKey();
        $iv = openssl_random_pseudo_bytes(12); // Standard 96-bit IV for GCM
        $tag = '';
        $encrypted = openssl_encrypt(
            $plainText,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '', // AAD (Additional Authenticated Data)
            16  // 128-bit authentication tag
        );

        if ($encrypted === false) {
            throw new \RuntimeException('AES-256-GCM encryption failed');
        }

        return 'v2:gcm::' . base64_encode($iv) . '::' . base64_encode($tag) . '::' . base64_encode($encrypted);
    }

    /**
     * Decrypt ciphertext safely.
     * Supports both modern AES-256-GCM and legacy AES-256-CBC without breaking existing records.
     */
    public static function decrypt(string $cipherText): ?string {
        try {
            $cipherText = trim($cipherText);

            // Modern AES-256-GCM format
            if (str_starts_with($cipherText, 'v2:gcm::')) {
                $parts = explode('::', $cipherText);
                if (count($parts) !== 4) {
                    return null;
                }
                $iv = base64_decode($parts[1], true);
                $tag = base64_decode($parts[2], true);
                $encrypted = base64_decode($parts[3], true);

                if (!$iv || !$tag || !$encrypted) {
                    return null;
                }

                $key = self::getKey();
                $decrypted = openssl_decrypt(
                    $encrypted,
                    'aes-256-gcm',
                    $key,
                    OPENSSL_RAW_DATA,
                    $iv,
                    $tag
                );

                return $decrypted !== false ? $decrypted : null;
            }

            // Legacy AES-256-CBC format (Backward Compatibility)
            $decoded = base64_decode($cipherText, true);
            if ($decoded && strlen($decoded) > 18 && substr($decoded, 16, 2) === '::') {
                $iv = substr($decoded, 0, 16);
                $encrypted = substr($decoded, 18);
                $legacyKey = self::getLegacyKey();
                $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $legacyKey, OPENSSL_RAW_DATA, $iv);
                if ($decrypted !== false) {
                    return $decrypted;
                }
            } elseif ($decoded && str_contains($decoded, '::')) {
                [$iv, $encrypted] = explode('::', $decoded, 2);
                if (strlen($iv) === 16) {
                    $legacyKey = self::getLegacyKey();
                    $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $legacyKey, OPENSSL_RAW_DATA, $iv);
                    if ($decrypted !== false) {
                        return $decrypted;
                    }
                }
            }

            return null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Mask sensitive values like passwords, tokens and secrets for safe client-side display
     */
    public static function maskValue(string $val): string {
        $len = strlen($val);
        if ($len <= 4) {
            return '••••';
        }
        return substr($val, 0, 2) . str_repeat('•', max(4, $len - 4)) . substr($val, -2);
    }
}
