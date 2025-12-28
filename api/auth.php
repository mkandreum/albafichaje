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
    case 'get_users':
        handleGetAllUsers();
        break;
    case 'change_password':
        handleChangePassword();
        break;
    case 'admin_reset_password':
        handleAdminResetPassword();
        break;
    default:
        response(['success' => false, 'message' => 'Acción no válida'], 400);
}

function handleChangePassword()
{
    if (!isset($_SESSION['user'])) {
        response(['success' => false, 'message' => 'No autorizado'], 401);
    }

    $input = getInput();
    $newPassword = $input['newPassword'] ?? '';

    if (empty($newPassword) || strlen($newPassword) < 6) {
        response(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres'], 400);
    }

    $userId = $_SESSION['user']['id'];
    $users = readJson(USERS_FILE);
    $found = false;

    foreach ($users as &$user) {
        if ($user['id'] === $userId) {
            $user['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
            if (isset($user['forcePasswordChange'])) {
                unset($user['forcePasswordChange']);
            }
            // Update session
            $sessionUser = $user;
            unset($sessionUser['password']);
            $_SESSION['user'] = $sessionUser;

            $found = true;
            break;
        }
    }

    if ($found) {
        writeJson(USERS_FILE, $users);
        response(['success' => true, 'message' => 'Contraseña actualizada correcta', 'user' => $_SESSION['user']]);
    } else {
        response(['success' => false, 'message' => 'Usuario no encontrado'], 404);
    }
}

function handleAdminResetPassword()
{
    // Check if user is admin
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        response(['success' => false, 'message' => 'Solo administradores pueden resetear contraseñas'], 403);
    }

    $input = getInput();
    $userId = filter_var($input['userId'] ?? '', FILTER_SANITIZE_FULL_SPECIAL_CHARS);

    if (empty($userId)) {
        response(['success' => false, 'message' => 'ID de usuario requerido'], 400);
    }

    $users = readJson(USERS_FILE);
    $found = false;

    foreach ($users as &$user) {
        if ($user['id'] === $userId) {
            // Set temporary password and force change
            $user['password'] = password_hash('temp123456', PASSWORD_DEFAULT);
            $user['forcePasswordChange'] = true;
            $found = true;
            break;
        }
    }

    if ($found) {
        writeJson(USERS_FILE, $users);
        response(['success' => true, 'message' => 'Contraseña reseteada a: temp123456']);
    } else {
        response(['success' => false, 'message' => 'Usuario no encontrado'], 404);
    }
}

function handleLogin()
{
    // Basic rate limiting - max 5 attempts per minute per IP
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateLimitKey = "login_attempts_$ip";

    if (!isset($_SESSION[$rateLimitKey])) {
        $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
    }

    $rateLimit = $_SESSION[$rateLimitKey];
    if (time() - $rateLimit['time'] > 60) {
        // Reset after 1 minute
        $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
    } elseif ($rateLimit['count'] >= 5) {
        response(['success' => false, 'message' => 'Demasiados intentos. Espera 1 minuto.'], 429);
    }

    $input = getInput();
    $email = filter_var($input['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        response(['success' => false, 'message' => 'Email y contraseña requeridos'], 400);
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(['success' => false, 'message' => 'Email inválido'], 400);
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
        $_SESSION[$rateLimitKey]['count']++;
        response(['success' => false, 'message' => 'Usuario no encontrado'], 401);
    }

    if (!password_verify($password, $user['password'])) {
        $_SESSION[$rateLimitKey]['count']++;
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

    // Special admin email - only allow once
    $isAdminEmail = ($email === 'admin@fichaje.com');
    if ($isAdminEmail) {
        // Check if admin email already exists
        foreach ($users as $u) {
            if ($u['email'] === 'admin@fichaje.com') {
                response(['success' => false, 'message' => 'El usuario administrador ya existe'], 400);
            }
        }
    }

    // Determine role
    $role = $isAdminEmail ? 'admin' : 'employee';

    // Create new user
    $newUser = [
        'id' => uniqid(),
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'nombre' => $nombre,
        'apellidos' => $apellidos,
        'dni' => $dni,
        'afiliacion' => $afiliacion,
        'role' => $role,
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