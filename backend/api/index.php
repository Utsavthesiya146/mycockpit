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
require_once __DIR__ . '/../utils/Encryption.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/TenantMiddleware.php';
require_once __DIR__ . '/../services/connectors/LeadConnectorInterface.php';
require_once __DIR__ . '/../services/connectors/EAFConnector.php';
require_once __DIR__ . '/../services/connectors/BNIConnector.php';
require_once __DIR__ . '/../services/connectors/KVVConnector.php';
require_once __DIR__ . '/../services/connectors/SEOConnector.php';
require_once __DIR__ . '/../services/automation/PlatformAutomationDriverInterface.php';
require_once __DIR__ . '/../services/automation/HostingEvaluator.php';
require_once __DIR__ . '/../services/automation/EAFWebAutomationDriver.php';
require_once __DIR__ . '/../services/automation/BNIWebAutomationDriver.php';
require_once __DIR__ . '/../services/automation/KVVWebAutomationDriver.php';
require_once __DIR__ . '/../services/automation/BidirectionalSyncManager.php';
require_once __DIR__ . '/../services/SyncEngine.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/TenantController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/FinancialController.php';
require_once __DIR__ . '/../controllers/CrmController.php';
require_once __DIR__ . '/../controllers/LeadController.php';
require_once __DIR__ . '/../controllers/HrmController.php';
require_once __DIR__ . '/../controllers/CalendarController.php';
require_once __DIR__ . '/../controllers/TaskController.php';
require_once __DIR__ . '/../controllers/FollowupController.php';
require_once __DIR__ . '/../controllers/InvoiceController.php';
require_once __DIR__ . '/../controllers/AppHubController.php';
require_once __DIR__ . '/../controllers/AIController.php';
require_once __DIR__ . '/../controllers/GmailController.php';

// PSR-4 Autoloader fallback for Cockpit namespace (case-safe across Windows, Linux, and Docker)
spl_autoload_register(function (string $class): void {
    $prefix = 'Cockpit\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $className = array_pop($parts);

    // Map directory parts to lowercase to prevent Linux case-sensitivity issues
    $dir = __DIR__ . '/../' . implode('/', array_map('strtolower', $parts));
    $file = $dir . '/' . $className . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

use Cockpit\Utils\Response;
use Cockpit\Middleware\AuthMiddleware;
use Cockpit\Controllers\AuthController;
use Cockpit\Controllers\TenantController;
use Cockpit\Controllers\DashboardController;
use Cockpit\Controllers\FinancialController;
use Cockpit\Controllers\CrmController;
use Cockpit\Controllers\LeadController;
use Cockpit\Controllers\HrmController;
use Cockpit\Controllers\CalendarController;
use Cockpit\Controllers\TaskController;
use Cockpit\Controllers\FollowupController;
use Cockpit\Controllers\InvoiceController;
use Cockpit\Controllers\AppHubController;
use Cockpit\Controllers\AIController;
use Cockpit\Controllers\GmailController;

// Handle CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tenant-Slug, X-Tenant-Key");
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
        try {
            AppHubController::ensureSchemaCompatibility();
        } catch (\Throwable $e) {}

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

    // Public Lead Webhook Intake for SEO & Website Form Integrations
    if ($path === '/leads/webhook' && $method === 'POST') {
        LeadController::webhookIntake();
    }

    // Public Canonical Google OAuth 2.0 Callback
    if ($path === '/gmail/oauth/callback' && $method === 'GET') {
        GmailController::oauthCallback();
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
    if ($path === '/dashboard/lead-stats' && $method === 'GET') {
        LeadController::getDashboardStats($currentUser);
    }
    if ($path === '/financial/summary' && $method === 'GET') {
        FinancialController::getSummary($currentUser);
    }

    // CRM Customers
    if ($path === '/crm/customers') {
        if ($method === 'GET') CrmController::listCustomers($currentUser);
        if ($method === 'POST') CrmController::createCustomer($currentUser);
    }

    // Centralized Lead Management & Integration Sources
    if ($path === '/crm/leads') {
        if ($method === 'GET') LeadController::listLeads($currentUser);
        if ($method === 'POST') LeadController::createLead($currentUser);
    }
    if ($path === '/crm/leads/import' && $method === 'POST') {
        LeadController::importLeads($currentUser);
    }
    if (preg_match('#^/crm/leads/([0-9]+)$#', $path, $matches)) {
        if ($method === 'GET') LeadController::getLead($currentUser, (int)$matches[1]);
        if ($method === 'PUT' || $method === 'POST') LeadController::updateLead($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/status$#', $path, $matches) && $method === 'POST') {
        LeadController::updateLeadStatus($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/assign$#', $path, $matches) && $method === 'POST') {
        LeadController::assignLead($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/activities$#', $path, $matches) && $method === 'POST') {
        LeadController::logActivity($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/queue-writeback$#', $path, $matches) && $method === 'POST') {
        LeadController::queueLeadWriteback($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/queue/([0-9]+)/execute$#', $path, $matches) && $method === 'POST') {
        LeadController::executeLeadWriteback($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/queue/([0-9]+)/resolve$#', $path, $matches) && $method === 'POST') {
        LeadController::resolveLeadConflict($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/leads/([0-9]+)/sync-status$#', $path, $matches) && $method === 'GET') {
        LeadController::getLeadWritebackStatus($currentUser, (int)$matches[1]);
    }
    if ($path === '/crm/automation/capabilities' && $method === 'GET') {
        LeadController::getPlatformCapabilityMatrix($currentUser);
    }
    if ($path === '/crm/automation/session' && $method === 'POST') {
        LeadController::savePlatformSession($currentUser);
    }
    if (preg_match('#^/crm/automation/session/([a-zA-Z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        LeadController::getPlatformSession($currentUser, $matches[1]);
    }
    if (($path === '/crm/lead-sources' || $path === '/crm/leads/sources') && $method === 'GET') {
        LeadController::listSources($currentUser);
    }
    if ($path === '/crm/lead-sources/sync-logs' && $method === 'GET') {
        LeadController::getSyncLogs($currentUser);
    }
    if (preg_match('#^/crm/lead-sources/([0-9]+)/status$#', $path, $matches) && $method === 'POST') {
        LeadController::updateSourceStatus($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/lead-sources/([0-9]+)/configure$#', $path, $matches) && $method === 'POST') {
        LeadController::configureSource($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/lead-sources/([0-9]+)/test-connection$#', $path, $matches) && $method === 'POST') {
        LeadController::testSourceConnection($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/crm/lead-sources/([0-9]+)/sync-now$#', $path, $matches) && $method === 'POST') {
        LeadController::syncSourceNow($currentUser, (int)$matches[1]);
    }
    if ($path === '/crm/lead-sources/embed-code' && $method === 'GET') {
        LeadController::getEmbedCode($currentUser);
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
    if (preg_match('#^/followups/([0-9]+)/complete$#', $path, $matches) && $method === 'POST') {
        FollowupController::completeFollowup($currentUser, (int)$matches[1]);
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
    if (preg_match('#^/apps/([0-9]+)/connect$#', $path, $matches) && $method === 'POST') {
        AppHubController::connectPortal($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/apps/([0-9]+)/test-connection$#', $path, $matches) && $method === 'POST') {
        AppHubController::testConnection($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/apps/([0-9]+)/disconnect$#', $path, $matches) && $method === 'POST') {
        AppHubController::disconnectPortal($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/apps/([0-9]+)/sync-now$#', $path, $matches) && $method === 'POST') {
        AppHubController::syncPortalNow($currentUser, (int)$matches[1]);
    }
    if (preg_match('#^/apps/([0-9]+)/portal-referrals$#', $path, $matches) && $method === 'GET') {
        AppHubController::getPortalReferrals($currentUser, (int)$matches[1]);
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

    // Full Gmail Management Integration
    if ($path === '/gmail/status' && $method === 'GET') {
        GmailController::getStatus($currentUser);
    }
    if ($path === '/gmail/configure' && $method === 'POST') {
        GmailController::configure($currentUser);
    }
    if ($path === '/gmail/auth-url' && $method === 'GET') {
        GmailController::getAuthUrl($currentUser);
    }
    if ($path === '/gmail/disconnect' && $method === 'POST') {
        GmailController::disconnect($currentUser);
    }
    if ($path === '/gmail/sync' && $method === 'POST') {
        GmailController::sync($currentUser);
    }
    if ($path === '/gmail/messages' && $method === 'GET') {
        GmailController::listMessages($currentUser);
    }
    if ($path === '/gmail/messages/send' && $method === 'POST') {
        GmailController::sendMessage($currentUser);
    }
    if ($path === '/gmail/drafts' && $method === 'POST') {
        GmailController::createDraft($currentUser);
    }
    if ($path === '/gmail/batch' && $method === 'POST') {
        GmailController::batchAction($currentUser);
    }
    if ($path === '/gmail/labels' && $method === 'GET') {
        GmailController::getLabels($currentUser);
    }
    if (preg_match('#^/gmail/messages/([a-zA-Z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        GmailController::getMessage($currentUser, $matches[1]);
    }
    if (preg_match('#^/gmail/messages/([a-zA-Z0-9_-]+)/modify$#', $path, $matches) && $method === 'POST') {
        GmailController::modifyMessage($currentUser, $matches[1]);
    }
    if (preg_match('#^/gmail/messages/([a-zA-Z0-9_-]+)/trash$#', $path, $matches) && $method === 'POST') {
        GmailController::trashMessage($currentUser, $matches[1]);
    }
    if (preg_match('#^/gmail/messages/([a-zA-Z0-9_-]+)/untrash$#', $path, $matches) && $method === 'POST') {
        GmailController::untrashMessage($currentUser, $matches[1]);
    }
    if (preg_match('#^/gmail/messages/([a-zA-Z0-9_-]+)/attachment/([a-zA-Z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        GmailController::getAttachment($currentUser, $matches[1], $matches[2]);
    }

    // Route not found
    Response::error("Endpoint not found: [{$method}] {$path}", 404);

} catch (\Throwable $e) {
    Response::error($e->getMessage(), 500);
}
