<?php
declare(strict_types=1);

// ===================================================
// MY COCKPIT AI - Unified REST API Front Controller
// ===================================================

error_reporting(E_ALL);
ini_set('display_errors', '1');

// Explicitly require core backend files (bulletproof on all Linux distributions)
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/JWT.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/TenantMiddleware.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/TenantController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/FinancialController.php';
require_once __DIR__ . '/../controllers/CrmController.php';
require_once __DIR__ . '/../controllers/HrmController.php';
require_once __DIR__ . '/../controllers/CalendarController.php';
require_once __DIR__ . '/../controllers/TaskController.php';
require_once __DIR__ . '/../controllers/FollowupController.php';
require_once __DIR__ . '/../controllers/InvoiceController.php';
require_once __DIR__ . '/../controllers/AppHubController.php';
require_once __DIR__ . '/../controllers/AIController.php';

use Cockpit\Utils\Response;
use Cockpit\Middleware\AuthMiddleware;
use Cockpit\Controllers\AuthController;
use Cockpit\Controllers\TenantController;
use Cockpit\Controllers\DashboardController;
use Cockpit\Controllers\FinancialController;
use Cockpit\Controllers\CrmController;
use Cockpit\Controllers\HrmController;
use Cockpit\Controllers\CalendarController;
use Cockpit\Controllers\TaskController;
use Cockpit\Controllers\FollowupController;
use Cockpit\Controllers\InvoiceController;
use Cockpit\Controllers\AppHubController;
use Cockpit\Controllers\AIController;

// Handle CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tenant-Slug");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Global Exception Handler
set_exception_handler(function (\Throwable $e) {
    Response::error('Server Error: ' . $e->getMessage(), 500);
});

// Resolve Route
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedUrl = parse_url($requestUri, PHP_URL_PATH) ?? '/';

// Normalize path: strip folder prefixes like /mycockpit/backend/api or /backend/api and /index.php
$path = preg_replace('#^.*?(?:/backend/api|/api)#i', '', $parsedUrl);
$path = preg_replace('#^/index\.php#i', '', $path);
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Route Dispatcher
try {
    // Health / Test
    if ($path === '' || $path === '/' || $path === '/health') {
        Response::success([
            'system' => 'MY COCKPIT AI API Engine',
            'version' => '1.0.0',
            'status' => 'operational',
            'timestamp' => date('Y-m-d H:i:s')
        ], 'API is online');
    }

    // Public Auth
    if ($path === '/auth/login' && $method === 'POST') {
        AuthController::login();
    }
    if ($path === '/auth/register' && $method === 'POST') {
        AuthController::register();
    }

    // Tenant Public Slug Lookup (e.g. /tenants/lookup/utsav)
    if (preg_match('#^/tenants/lookup/([a-zA-Z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        TenantController::getBySlug($matches[1]);
    }

    // Authenticated Endpoints (Strict JWT & Status Verification)
    $currentUser = AuthMiddleware::authenticate();

    // Current User Profile
    if ($path === '/auth/me' && $method === 'GET') {
        AuthController::me($currentUser);
    }

    // Tenant Management (Super Admin)
    if ($path === '/tenants' && $method === 'GET') {
        TenantController::listTenants($currentUser);
    }
    if (preg_match('#^/tenants/([0-9]+)/status$#', $path, $matches) && $method === 'POST') {
        TenantController::updateStatus($currentUser, (int)$matches[1]);
    }
    if ($path === '/tenants/team' && $method === 'GET') {
        TenantController::listTeamMembers($currentUser);
    }
    if ($path === '/tenants/team' && $method === 'POST') {
        TenantController::addTeamMember($currentUser);
    }

    // Dashboard & Financial Intelligence
    if ($path === '/dashboard/stats' && $method === 'GET') {
        DashboardController::getStats($currentUser);
    }
    if ($path === '/financial/summary' && $method === 'GET') {
        FinancialController::getSummary($currentUser);
    }

    // CRM
    if ($path === '/crm/customers') {
        if ($method === 'GET') CrmController::listCustomers($currentUser);
        if ($method === 'POST') CrmController::createCustomer($currentUser);
    }
    if ($path === '/crm/leads') {
        if ($method === 'GET') CrmController::listLeads($currentUser);
        if ($method === 'POST') CrmController::createLead($currentUser);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/status$#', $path, $matches) && $method === 'POST') {
        CrmController::updateLeadStatus($currentUser, (int)$matches[1]);
    }

    // HRM
    if ($path === '/hrm/employees') {
        if ($method === 'GET') HrmController::listEmployees($currentUser);
        if ($method === 'POST') HrmController::createEmployee($currentUser);
    }
    if ($path === '/hrm/departments' && $method === 'GET') {
        HrmController::listDepartments($currentUser);
    }

    // Calendar
    if ($path === '/calendar/events') {
        if ($method === 'GET') CalendarController::listEvents($currentUser);
        if ($method === 'POST') CalendarController::createEvent($currentUser);
    }

    // Tasks
    if ($path === '/tasks') {
        if ($method === 'GET') TaskController::listTasks($currentUser);
        if ($method === 'POST') TaskController::createTask($currentUser);
    }
    if (preg_match('#^/tasks/([0-9]+)/status$#', $path, $matches) && $method === 'POST') {
        TaskController::updateStatus($currentUser, (int)$matches[1]);
    }

    // Follow-ups
    if ($path === '/followups') {
        if ($method === 'GET') FollowupController::listFollowups($currentUser);
        if ($method === 'POST') FollowupController::createFollowup($currentUser);
    }
    if (preg_match('#^/followups/([0-9]+)/toggle$#', $path, $matches) && $method === 'POST') {
        FollowupController::toggleStatus($currentUser, (int)$matches[1]);
    }

    // Invoices & Payments
    if ($path === '/invoices') {
        if ($method === 'GET') InvoiceController::listInvoices($currentUser);
        if ($method === 'POST') InvoiceController::createInvoice($currentUser);
    }
    if (preg_match('#^/invoices/([0-9]+)$#', $path, $matches) && $method === 'GET') {
        InvoiceController::getInvoice($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/invoices/([0-9]+)/payments$#', $path, $matches) && $method === 'POST') {
        InvoiceController::recordPayment($currentUser, (int)$matches[1]);
    }

    // Connected Applications Hub
    if ($path === '/apps') {
        if ($method === 'GET') AppHubController::listApps($currentUser);
        if ($method === 'POST') AppHubController::addApp($currentUser);
    }
    if (preg_match('#^/apps/([0-9]+)$#', $path, $matches)) {
        if ($method === 'POST' || $method === 'PUT') AppHubController::updateApp($currentUser, (int)$matches[1]);
        if ($method === 'DELETE') AppHubController::deleteApp($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/apps/([0-9]+)/pin$#', $path, $matches) && $method === 'POST') {
        AppHubController::togglePin($currentUser, (int)$matches[1]);
    }

    // Personal AI Assistant
    if ($path === '/ai/chat' && $method === 'POST') {
        AIController::chat($currentUser);
    }
    if ($path === '/ai/conversations' && $method === 'GET') {
        AIController::listConversations($currentUser);
    }
    if (preg_match('#^/ai/conversations/([0-9]+)$#', $path, $matches) && $method === 'GET') {
        AIController::getConversation($currentUser, (int)$matches[1]);
    }

    // Route not found
    Response::error("Endpoint not found: [{$method}] {$path}", 404);

} catch (\Throwable $e) {
    Response::error($e->getMessage(), 500);
}
