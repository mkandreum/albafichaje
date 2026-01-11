<?php
// api/config.php

// Error Handling (Disable display in production, log errors)
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Paths
define('DATA_DIR', __DIR__ . '/../data/');
define('USERS_FILE', DATA_DIR . 'users.json');
define('FICHAJES_FILE', DATA_DIR . 'fichajes.json');
define('SIGNATURES_DIR', DATA_DIR . 'signatures/');

// CORS & Headers - Secure Configuration
header('Content-Type: application/json');

// Secure CORS - Only allow same origin in production
$allowedOrigins = ['https://fichaje.xyoncloud.win', 'https://albatecnica.sytes.net'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins) || $_SERVER['SERVER_NAME'] === 'localhost') {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: null');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Secure Session Configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1); // HTTPS only
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);
session_start();

// Helper: Read JSON
function readJson($file)
{
    if (!file_exists($file))
        return [];
    $content = file_get_contents($file);
    return json_decode($content, true) ?: [];
}

// Helper: Write JSON
function writeJson($file, $data)
{
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// Helper: Send Response
function response($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// Helper: Get Input
function getInput()
{
    return json_decode(file_get_contents('php://input'), true);
}
?>