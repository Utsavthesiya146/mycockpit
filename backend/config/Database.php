<?php
declare(strict_types=1);

namespace Cockpit\Config;

use PDO;
use PDOException;

class Database {
    private static ?PDO $connection = null;

    public static function getConnection(): PDO {
        if (self::$connection === null) {
            $host = getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: '127.0.0.1');
            $port = getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: '3306');
            $dbName = getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: (str_contains($host, 'tidbcloud') ? 'test' : 'mycockpit_dev'));
            $user = getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: 'root');
            $password = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (getenv('MYSQLPASSWORD') !== false ? getenv('MYSQLPASSWORD') : '');

            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            // If connecting to cloud TLS providers (like TiDB Cloud on port 4000), enable SSL
            if ($port === '4000' || str_contains($host, 'tidbcloud') || getenv('DB_SSL') === 'true') {
                $bundledCa = __DIR__ . '/cacert.pem';
                if (file_exists($bundledCa)) {
                    $options[PDO::MYSQL_ATTR_SSL_CA] = $bundledCa;
                } elseif (file_exists('/etc/ssl/certs/ca-certificates.crt')) {
                    $options[PDO::MYSQL_ATTR_SSL_CA] = '/etc/ssl/certs/ca-certificates.crt';
                }
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
            }

            try {
                self::$connection = new PDO($dsn, $user, $password, $options);
            } catch (PDOException $e) {
                http_response_code(500);
                $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
                header("Access-Control-Allow-Origin: {$origin}");
                header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Database connection failed: ' . $e->getMessage()
                ]);
                exit;
            }
        }

        return self::$connection;
    }
}
