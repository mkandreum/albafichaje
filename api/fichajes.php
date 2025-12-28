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

    // Check if fichaje already exists for this user and date
    $id = $input['id'] ?? null;

    // Check if fichaje already exists by ID
    $existingIndex = -1;
    if ($id) {
        foreach ($fichajes as $index => $f) {
            if (isset($f['id']) && $f['id'] === $id) {
                // Security check: ensure user owns this record (unless admin)
                if ($_SESSION['user']['role'] !== 'admin' && $f['userId'] !== $userId) {
                    response(['success' => false, 'message' => 'No autorizado para modificar este fichaje'], 403);
                }
                $existingIndex = $index;
                break;
            }
        }
    }

    $fichaje = [
        'id' => $id ?: uniqid('fich_'), // Generate new ID if not provided
        'userId' => $userId,
        'userName' => $userName,
        'date' => $date,
        'entryTime' => $entryTime,
        'exitTime' => $exitTime,
        'entrySignature' => $entrySignature,
        'exitSignature' => $exitSignature,
        'updatedAt' => date('c')
    ];

    if ($existingIndex !== -1) {
        // Update existing fichaje: Preserve created timestamp
        $fichaje['createdAt'] = $fichajes[$existingIndex]['createdAt'] ?? date('c');
        $fichajes[$existingIndex] = $fichaje;
    } else {
        // Add new fichaje
        $fichaje['createdAt'] = date('c');
        $fichajes[] = $fichaje;
    }

    writeJson(FICHAJES_FILE, $fichajes);

    response(['success' => true, 'fichaje' => $fichaje]);
}
?>