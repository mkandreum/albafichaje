<?php
// api/upload.php
require_once 'config.php';

if (!isset($_SESSION['user']['id'])) {
    response(['success' => false, 'message' => 'Unauthorized'], 401);
}

// Accepts JSON with Base64 image
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getInput();
    $dataUrl = $input['image'] ?? '';

    if (!$dataUrl) {
        response(['success' => false, 'message' => 'No image data'], 400);
    }

    // Parse Data URL "data:image/png;base64,....."
    if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $type)) {
        $data = substr($dataUrl, strpos($dataUrl, ',') + 1);
        $type = strtolower($type[1]); // jpg, png, gif

        if (!in_array($type, ['jpg', 'jpeg', 'png'])) {
            response(['success' => false, 'message' => 'Invalid image type'], 400);
        }

        $data = base64_decode($data);

        if ($data === false) {
            response(['success' => false, 'message' => 'Base64 decode failed'], 400);
        }
    } else {
        response(['success' => false, 'message' => 'Invalid Base64 string'], 400);
    }

    // Ensure directory exists
    if (!file_exists(SIGNATURES_DIR)) {
        mkdir(SIGNATURES_DIR, 0755, true);
    }

    // Unique filename: user_timestamp_random.png
    $filename = $_SESSION['user']['id'] . '_' . time() . '_' . uniqid() . '.' . $type;
    $filepath = SIGNATURES_DIR . $filename;

    if (file_put_contents($filepath, $data)) {
        // Return the API URL to access this image (via a proxy script)
        // OR relative path if we decide to expose it (but user asked for protected)
        // Let's return the internal relative path for the frontend to pass to the PDF generator, 
        // OR a "view" endpoint. 
        // For PDF generation client-side, it's tricky if the client can't fetch it.
        // Solution: api/get_signature.php?file=...

        response(['success' => true, 'path' => $filename, 'view_url' => 'api/get_signature.php?file=' . $filename]);
    } else {
        response(['success' => false, 'message' => 'Failed to save file'], 500);
    }
}
?>