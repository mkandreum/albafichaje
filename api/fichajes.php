<?php
// api/fichajes.php
require_once 'config.php';

// Check if user is logged in
if (!isset($_SESSION['user'])) {
    response(['success' => false, 'message' => 'No autenticado'], 401);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$userId = $_GET['user_id'] ?? null;

if ($method === 'GET') {
    if ($action === 'all') {
        handleGetAllFichajes();
    } else if ($userId) {
        handleGetUserFichajes($userId);
    } else {
        handleGetUserFichajes($_SESSION['user']['id']);
    }
} else if ($method === 'POST') {
    handleSaveFichaje();
} else {
    response(['success' => false, 'message' => 'Método no permitido'], 405);
}

function handleGetUserFichajes($userId)
{
    $fichajes = readJson(FICHAJES_FILE);

    // Filter fichajes for this user
    $userFichajes = array_filter($fichajes, function ($f) use ($userId) {
        return $f['userId'] === $userId;
    });

    // Re-index array
    $userFichajes = array_values($userFichajes);

    response(['success' => true, 'fichajes' => $userFichajes]);
}

function handleGetAllFichajes()
{
    // Check if user is admin
    if ($_SESSION['user']['role'] !== 'admin') {
        response(['success' => false, 'message' => 'Acceso denegado'], 403);
    }

    $fichajes = readJson(FICHAJES_FILE);
    response(['success' => true, 'fichajes' => $fichajes]);
}

function handleSaveFichaje()
{
    $input = getInput();

    // Sanitize inputs
    $userId = filter_var($input['userId'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $userName = filter_var($input['userName'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $date = filter_var($input['date'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $entryTime = filter_var($input['entryTime'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $exitTime = filter_var($input['exitTime'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $entrySignature = $input['entrySignature'] ?? null;
    $exitSignature = $input['exitSignature'] ?? null;

    // Validate date format (YYYY-MM-DD)
    if (!empty($date) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        response(['success' => false, 'message' => 'Formato de fecha inválido'], 400);
    }

    // Validate time format (HH:MM)
    if (!empty($entryTime) && !preg_match('/^\d{2}:\d{2}$/', $entryTime)) {
        response(['success' => false, 'message' => 'Formato de hora de entrada inválido'], 400);
    }
    if (!empty($exitTime) && !preg_match('/^\d{2}:\d{2}$/', $exitTime)) {
        response(['success' => false, 'message' => 'Formato de hora de salida inválido'], 400);
    }

    // Validation
    if (empty($userId) || empty($date) || empty($entryTime)) {
        response(['success' => false, 'message' => 'Datos incompletos'], 400);
    }

    // Check if user can only save their own fichajes (unless admin)
    if ($_SESSION['user']['role'] !== 'admin' && $userId !== $_SESSION['user']['id']) {
        response(['success' => false, 'message' => 'No puedes crear fichajes para otros usuarios'], 403);
    }

    $fichajes = readJson(FICHAJES_FILE);

    // Find all fichajes for this user and date
    $existingFichajes = [];
    foreach ($fichajes as $index => $f) {
        if ($f['userId'] === $userId && $f['date'] === $date) {
            $existingFichajes[] = ['index' => $index, 'fichaje' => $f];
        }
    }

    $newFichaje = [
        'userId' => $userId,
        'userName' => $userName,
        'date' => $date,
        'entryTime' => $entryTime,
        'exitTime' => $exitTime,
        'entrySignature' => $entrySignature,
        'exitSignature' => $exitSignature,
        'updatedAt' => date('c')
    ];

    // Determine shift number and whether to update or create
    if (count($existingFichajes) === 0) {
        // No fichajes exist, create shift 1
        $newFichaje['shift'] = 1;
        $newFichaje['createdAt'] = date('c');
        $fichajes[] = $newFichaje;
    } elseif (count($existingFichajes) === 1) {
        // One fichaje exists, check if we should update it or create shift 2
        $existing = $existingFichajes[0];
        $existingEntry = strtotime("2000-01-01 " . $existing['fichaje']['entryTime']);
        $newEntry = strtotime("2000-01-01 " . $entryTime);

        // If new entry time is within 1 hour of existing, update it
        $timeDiff = abs($newEntry - $existingEntry);
        if ($timeDiff < 3600) { // 1 hour = 3600 seconds
            // Update existing fichaje
            $newFichaje['shift'] = $existing['fichaje']['shift'];
            $newFichaje['createdAt'] = $existing['fichaje']['createdAt'];
            $fichajes[$existing['index']] = $newFichaje;
        } else {
            // Create shift 2
            $newFichaje['shift'] = 2;
            $newFichaje['createdAt'] = date('c');
            $fichajes[] = $newFichaje;
        }
    } else {
        // Two fichajes exist, determine which to update based on time proximity
        $shift1 = $existingFichajes[0];
        $shift2 = $existingFichajes[1];

        $entry1 = strtotime("2000-01-01 " . $shift1['fichaje']['entryTime']);
        $entry2 = strtotime("2000-01-01 " . $shift2['fichaje']['entryTime']);
        $newEntry = strtotime("2000-01-01 " . $entryTime);

        $diff1 = abs($newEntry - $entry1);
        $diff2 = abs($newEntry - $entry2);

        // Update the closest one
        if ($diff1 < $diff2) {
            $newFichaje['shift'] = 1;
            $newFichaje['createdAt'] = $shift1['fichaje']['createdAt'];
            $fichajes[$shift1['index']] = $newFichaje;
        } else {
            $newFichaje['shift'] = 2;
            $newFichaje['createdAt'] = $shift2['fichaje']['createdAt'];
            $fichajes[$shift2['index']] = $newFichaje;
        }
    }

    writeJson(FICHAJES_FILE, $fichajes);

    response(['success' => true, 'fichaje' => $newFichaje]);
}
?>