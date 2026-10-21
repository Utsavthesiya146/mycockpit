<?php
header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'message' => 'PHP backend reachable through Apache',
    'php_version' => PHP_VERSION,
    'timestamp' => date('Y-m-d H:i:s')
]);
