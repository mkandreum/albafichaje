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

    $userId = $input['userId'] ?? '';
    $userName = $input['userName'] ?? '';
    $date = $input['date'] ?? '';
    $entryTime = $input['entryTime'] ?? '';
    $exitTime = $input['exitTime'] ?? '';
    $entrySignature = $input['entrySignature'] ?? null;
    $exitSignature = $input['exitSignature'] ?? null;

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
    $existingIndex = -1;
    foreach ($fichajes as $index => $f) {
        if ($f['userId'] === $userId && $f['date'] === $date) {
            $existingIndex = $index;
            break;
        }
    }

    $fichaje = [
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
        // Update existing fichaje
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