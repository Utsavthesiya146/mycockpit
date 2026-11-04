<?php
declare(strict_types=1);

namespace Cockpit\Config;

class Config {
    public static function get(string $key, mixed $default = null): mixed {
        $configs = [
            'app_name' => 'MY COCKPIT AI',
            'jwt_secret' => getenv('JWT_SECRET') ?: 'mycockpit_ai_super_secure_enterprise_key_2026',
            'jwt_expiry_seconds' => 86400 * 7, // 7 days
            'ai_provider' => getenv('AI_PROVIDER') ?: 'gemini',
            'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
            'app_url' => getenv('APP_URL') ?: (getenv('RENDER_EXTERNAL_URL') ?: (isset($_SERVER['HTTP_HOST']) && !str_contains($_SERVER['HTTP_HOST'], 'localhost') ? 'https://' . $_SERVER['HTTP_HOST'] : 'http://localhost:5173')),
            'google_client_id' => getenv('GOOGLE_CLIENT_ID') ?: '',
            'google_client_secret' => getenv('GOOGLE_CLIENT_SECRET') ?: '',
            'google_redirect_uri' => getenv('GOOGLE_REDIRECT_URI') ?: (getenv('RENDER_EXTERNAL_URL') ? rtrim(getenv('RENDER_EXTERNAL_URL'), '/') . '/api/gmail/oauth/callback' : (isset($_SERVER['HTTP_HOST']) && !str_contains($_SERVER['HTTP_HOST'], 'localhost') ? 'https://' . $_SERVER['HTTP_HOST'] . '/api/gmail/oauth/callback' : 'http://localhost/mycockpit/backend/api/gmail/oauth/callback')),
            'allowed_origins' => [
                'https://mycockpit-0e86.onrender.com',
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost',
                'http://127.0.0.1'
            ],
            'reserved_routes' => ['admin', 'api', 'login', 'register', 'reset-password', 'dashboard', 'settings']
        ];

        return $configs[$key] ?? $default;
    }
}
