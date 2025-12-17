<?php
// api/auth.php
require_once 'config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'register':
        handleRegister();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
        handleCheckSession();
        break;
    case 'users':
        handleGetAllUsers();
        break;
    default:
        response(['success' => false, 'message' => 'Invalid action'], 400);
}

function handleLogin()
{
    $input = getInput();
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        response(['success' => false, 'message' => 'Email y contraseña requeridos'], 400);
    }

    $users = readJson(USERS_FILE);
    $user = null;

    foreach ($users as $u) {
        if ($u['email'] === $email) {
            $user = $u;
            break;
        }
    }

    if (!$user) {
        response(['success' => false, 'message' => 'Usuario no encontrado'], 401);
    }

    if (!password_verify($password, $user['password'])) {
        response(['success' => false, 'message' => 'Contraseña incorrecta'], 401);
    }

    // Store user in session (without password)
    unset($user['password']);
    $_SESSION['user'] = $user;

    response(['success' => true, 'user' => $user]);
}

function handleRegister()
{
    $input = getInput();

    $nombre = trim($input['nombre'] ?? '');
    $apellidos = trim($input['apellidos'] ?? '');
    $dni = trim($input['dni'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $afiliacion = trim($input['afiliacion'] ?? '');

    // Validation
    if (empty($nombre) || empty($apellidos) || empty($dni) || empty($email) || empty($password)) {
        response(['success' => false, 'message' => 'Todos los campos son requeridos'], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(['success' => false, 'message' => 'Email inválido'], 400);
    }

    $users = readJson(USERS_FILE);

    // Check if email already exists
    foreach ($users as $u) {
        if ($u['email'] === $email) {
            response(['success' => false, 'message' => 'El email ya está registrado'], 400);
        }
    }

    // Create new user
    $newUser = [
        'id' => uniqid(),
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'nombre' => $nombre,
        'apellidos' => $apellidos,
        'dni' => $dni,
        'afiliacion' => $afiliacion,
        'role' => 'employee', // Default role
        'createdAt' => date('c')
    ];

    $users[] = $newUser;
    writeJson(USERS_FILE, $users);

    // Auto-login after registration
    unset($newUser['password']);
    $_SESSION['user'] = $newUser;

    response(['success' => true, 'user' => $newUser]);
}

function handleLogout()
{
    session_destroy();
    response(['success' => true, 'message' => 'Sesión cerrada']);
}

function handleCheckSession()
{
    if (isset($_SESSION['user'])) {
        response(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        response(['success' => false, 'message' => 'No hay sesión activa'], 401);
    }
}

function handleGetAllUsers()
{
    // Check if user is admin
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        response(['success' => false, 'message' => 'Acceso denegado'], 403);
    }

    $users = readJson(USERS_FILE);

    // Remove passwords from response
    $usersWithoutPasswords = array_map(function ($user) {
        unset($user['password']);
        return $user;
    }, $users);

    response(['success' => true, 'users' => $usersWithoutPasswords]);
}
?>