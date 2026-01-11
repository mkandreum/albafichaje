<?php
/**
 * CSRF Token Generation Endpoint
 * Generates and returns a CSRF token for the current session
 */

session_start();

// Generate CSRF token if not exists
if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Set headers
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

// Return token
echo json_encode([
    'success' => true,
    'token' => $_SESSION['csrf_token']
]);
