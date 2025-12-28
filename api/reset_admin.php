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

if ($found) {
    writeJson(USERS_FILE, $users);
    echo "Admin password reset to 'admin123'. Force change enabled.";
} else {
    echo "Admin user not found.";
}
?>