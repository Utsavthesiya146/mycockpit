<?php
declare(strict_types=1);

namespace Cockpit\Services\Automation;

/**
 * Hosting Evaluator & Browser Automation Architecture Checker
 * 
 * Assesses whether the host environment can support browser automation
 * (Headless Chromium, Puppeteer, Playwright) and details hosting requirements.
 */
class HostingEvaluator {

    public static function evaluate(): array {
        $phpVersion = PHP_VERSION;
        $os = PHP_OS_FAMILY;
        $memoryLimit = ini_get('memory_limit');
        $maxExecutionTime = ini_get('max_execution_time');
        $disabledFunctions = explode(',', (string)ini_get('disable_functions'));
        $disabledFunctions = array_map('trim', $disabledFunctions);

        $hasExec = !in_array('exec', $disabledFunctions) && function_exists('exec');
        $hasShellExec = !in_array('shell_exec', $disabledFunctions) && function_exists('shell_exec');

        // Check for Node.js
        $nodeInstalled = false;
        $nodeVersion = null;
        if ($hasExec) {
            $output = [];
            $retCode = 1;
            @exec('node -v 2>&1', $output, $retCode);
            if ($retCode === 0 && !empty($output[0])) {
                $nodeInstalled = true;
                $nodeVersion = trim($output[0]);
            }
        }

        // Hostinger Shared Hosting Detection heuristics
        $isSharedHosting = false;
        $hostClues = [];
        if (isset($_SERVER['DOCUMENT_ROOT']) && strpos($_SERVER['DOCUMENT_ROOT'], 'home/u') !== false) {
            $isSharedHosting = true;
            $hostClues[] = 'Hostinger / cPanel path structure detected (/home/u...)';
        }
        if (!$hasExec || !$hasShellExec) {
            $isSharedHosting = true;
            $hostClues[] = 'Process execution functions (exec/shell_exec) restricted';
        }

        return [
            'environment' => [
                'os' => $os,
                'php_version' => $phpVersion,
                'memory_limit' => $memoryLimit,
                'max_execution_time' => $maxExecutionTime . 's',
                'exec_available' => $hasExec,
                'node_installed' => $nodeInstalled,
                'node_version' => $nodeVersion,
                'is_shared_hosting' => $isSharedHosting,
                'host_clues' => $hostClues
            ],
            'shared_hosting_feasibility' => [
                'headless_chromium_support' => false,
                'blockers' => [
                    'Missing OS-level shared libraries (libnss3, libatk, libcups, libxcomposite) requiring root/apt access',
                    'Hostinger CloudLinux LVE memory kill limit (usually 512MB-1GB; Chromium requires 1.5GB+ per instance)',
                    'Strict 30-60 second execution timeout for PHP processes',
                    'Process killing for long-running background daemons'
                ],
                'session_driven_http_worker_support' => true,
                'session_driven_rationale' => 'Uses native PHP cURL to submit authenticated web forms with session cookies; requires only ~15MB RAM and executes in < 2 seconds.'
            ],
            'recommended_production_topology' => [
                'mode_a' => [
                    'title' => 'Session-Driven HTTP Worker (Direct Hostinger Compatible)',
                    'description' => 'Executes authorized web actions directly via secure cURL session state without heavy browser binaries. Zero additional server costs.',
                    'suitable_platforms' => ['EAF Connect', 'KVV Web Ingestion']
                ],
                'mode_b' => [
                    'title' => 'Decoupled Playwright Worker / VPS Companion (For BNI & CAPTCHA)',
                    'description' => 'Host My Cockpit AI core on Hostinger, while a lightweight external container ($4-5/mo VPS or desktop worker) runs Playwright to handle Cloudflare/CAPTCHA challenges via internal queue polling.',
                    'suitable_platforms' => ['BNI Connect', 'Cloudflare-protected portals']
                ]
            ]
        ];
    }
}
