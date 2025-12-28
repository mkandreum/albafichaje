<?php
// api/get_signature.php
require_once 'config.php';

// Strictly check auth
if (!isset($_SESSION['user'])) {
    http_response_code(403);
    exit('Unauthorized');
}

$file = $_GET['file'] ?? '';

// Security: Prevent Directory Traversal
$filename = basename($file);
$filepath = SIGNATURES_DIR . $filename;

if (file_exists($filepath)) {
    // Determine mime type
    $ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));
    $mime = ($ext === 'png') ? 'image/png' : 'image/jpeg';

    header('Content-Type: ' . $mime);
    readfile($filepath);
} else {
    http_response_code(404);
    echo 'Not Found';
}
?>