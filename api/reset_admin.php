<?php
require_once 'config.php';

// Security: Only allow running if we have a specific query param or just simple for now since it's temp.
// We will rely on the user removing it, or we can make it self-destruct (risky).
// Let's just do it.

$users = readJson(USERS_FILE);
$found = false;

foreach ($users as &$user) {
    if ($user['email'] === 'admin@fichajes.com') {
        // Password: admin123
        $user['password'] = password_hash('admin123', PASSWORD_DEFAULT);
        $user['forcePasswordChange'] = true;
        $found = true;
        break;
    }
}

if (!$found) {
    // Create Default Admin
    $users[] = [
        'id' => uniqid(),
        'email' => 'admin@fichajes.com',
        'password' => password_hash('albafichaje2025', PASSWORD_DEFAULT),
        'nombre' => 'Administrador',
        'apellidos' => 'Sistema',
        'role' => 'admin',
        'dni' => '00000000T',
        'afiliacion' => '000000000000',
        'forcePasswordChange' => true,
        'createdAt' => date('c')
    ];
    $found = true;
    echo "<h1>USUARIO CREADO</h1>";
} else {
    // Force update existing
    foreach ($users as &$u) {
        if ($u['email'] === 'admin@fichajes.com') {
            $u['password'] = password_hash('albafichaje2025', PASSWORD_DEFAULT);
            $u['forcePasswordChange'] = true;
        }
    }
    echo "<h1>CONTRASEÑA RESETEADA</h1>";
}

if ($found) {
    $result = writeJson(USERS_FILE, $users);

    if ($result === false) {
        echo "<h2>ERROR CRITICO: No se pudo escribir en " . USERS_FILE . ". Chequea permisos.</h2>";
    } else {
        echo "<p>Archivo guardado correctamente.</p>";
        echo "<p>Usa: <strong>admin@fichajes.com</strong> / <strong>albafichaje2025</strong></p>";
    }

    echo "<pre>";
    print_r(array_map(function ($u) {
        unset($u['password']);
        return $u; }, $users));
    echo "</pre>";
}
?>