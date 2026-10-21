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
            'allowed_origins' => [
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
