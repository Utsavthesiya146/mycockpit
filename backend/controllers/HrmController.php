<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class HrmController {
    public static function listEmployees(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT e.*, d.name AS department_name
            FROM hrm_employees e
            LEFT JOIN hrm_departments d ON e.department_id = d.id
            WHERE e.tenant_id = ?
            ORDER BY e.created_at DESC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function listDepartments(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT d.*,
                   (SELECT COUNT(*) FROM hrm_employees e WHERE e.department_id = d.id) AS employee_count
            FROM hrm_departments d
            WHERE d.tenant_id = ?
            ORDER BY d.name ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createEmployee(array $currentUser): void {
        TenantMiddleware::requireRole($currentUser, ['super_admin', 'tenant_owner', 'tenant_admin']);
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $firstName = trim($input['first_name'] ?? '');
        $lastName = trim($input['last_name'] ?? '');
        $email = trim($input['email'] ?? '');
        $designation = trim($input['designation'] ?? '');
        $joiningDate = $input['joining_date'] ?? date('Y-m-d');
        $salary = (float)($input['salary'] ?? 0);
        $code = trim($input['employee_code'] ?? ('EMP-' . rand(100, 999)));

        if (empty($firstName) || empty($email) || empty($designation)) {
            Response::error('First name, email and designation are required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO hrm_employees (tenant_id, employee_code, first_name, last_name, email, phone, department_id, designation, joining_date, salary, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $code,
            $firstName,
            $lastName,
            $email,
            trim($input['phone'] ?? ''),
            !empty($input['department_id']) ? (int)$input['department_id'] : null,
            $designation,
            $joiningDate,
            $salary,
            $input['status'] ?? 'active'
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Employee created successfully', 201);
    }
}
