<?php
declare(strict_types=1);

namespace Cockpit\Controllers;

use Cockpit\Config\Database;
use Cockpit\Middleware\TenantMiddleware;
use Cockpit\Utils\Response;
use PDO;

class CalendarController {
    public static function listEvents(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT * FROM calendar_events
            WHERE tenant_id = ?
            ORDER BY start_time ASC
        ");
        $stmt->execute([$tenantId]);
        Response::success($stmt->fetchAll());
    }

    public static function createEvent(array $currentUser): void {
        $tenantId = TenantMiddleware::resolveTenantId($currentUser);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = trim($input['title'] ?? '');
        $startTime = $input['start_time'] ?? '';
        $endTime = $input['end_time'] ?? '';

        if (empty($title) || empty($startTime) || empty($endTime)) {
            Response::error('Title, start time and end time are required.', 422);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO calendar_events (tenant_id, title, description, event_type, start_time, end_time, location_or_url, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
        ");
        $stmt->execute([
            $tenantId,
            $title,
            trim($input['description'] ?? ''),
            $input['event_type'] ?? 'meeting',
            $startTime,
            $endTime,
            trim($input['location_or_url'] ?? ''),
            $currentUser['id']
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Event created successfully', 201);
    }
}
