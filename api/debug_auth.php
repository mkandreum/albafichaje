<?php
// api/debug_auth.php
ini_set('display_errors', 1);
error_reporting(E_ALL);
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

echo "<h1>Debug Auth & Permissions</h1>";

$dataDir = __DIR__ . '/../data';
$usersFile = $dataDir . '/users.json';

// --- PASSWORD RESET LOGIC ---
$resetDone = false;
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true);
    if (is_array($users)) {
        foreach ($users as &$user) {
            // Check for either plural or singular to catch both
            if ($user['email'] === 'admin@fichajes.com' || $user['email'] === 'admin@fichaje.com') {
                $user['email'] = 'admin@fichaje.com'; // Normalize to singular
                $user['password'] = password_hash('admin123', PASSWORD_DEFAULT); // Set to admin123
                $resetDone = true;
                echo "<div style='background:lightgreen;padding:10px;border:1px solid green;margin:10px 0'>";
                echo "<strong>SUCCESS:</strong> Password reset to 'admin123' for user 'admin@fichaje.com'";
                echo "</div>";
                break;
            }
        }
        if ($resetDone) {
            file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));
        } else {
            echo "<div style='background:orange;padding:10px;border:1px solid orange;margin:10px 0'>";
            echo "<strong>WARNING:</strong> Admin user not found to reset.";
            echo "</div>";
        }
    }
}
// -----------------------------

echo "<h2>Paths</h2>";
echo "Data Dir: " . $dataDir . "<br>";
echo "Users File: " . $usersFile . "<br>";

echo "<h2>Permissions</h2>";
echo "Data Dir Exists: " . (file_exists($dataDir) ? 'YES' : 'NO') . "<br>";
echo "Data Dir Writable: " . (is_writable($dataDir) ? 'YES' : 'NO') . "<br>";
echo "Users File Exists: " . (file_exists($usersFile) ? 'YES' : 'NO') . "<br>";
echo "Users File Readable: " . (is_readable($usersFile) ? 'YES' : 'NO') . "<br>";
echo "Users File Writable: " . (is_writable($usersFile) ? 'YES' : 'NO') . "<br>";

echo "<h2>Content</h2>";
if (file_exists($usersFile)) {
    $content = file_get_contents($usersFile);
    $users = json_decode($content, true);
    echo "User Count: " . (is_array($users) ? count($users) : 'N/A') . "<br>";

    if (is_array($users)) {
        echo "<ul>";
        foreach ($users as $u) {
            echo "<li>Email: " . htmlspecialchars($u['email']) . " | Role: " . htmlspecialchars($u['role']) . "</li>";
        }
        echo "</ul>";
    }
} else {
    echo "Users file does not exist.<br>";
}

echo "<h2>Session Test</h2>";
$_SESSION['debug_test'] = 'works';
echo "Session ID: " . session_id() . "<br>";
echo "Session Val: " . $_SESSION['debug_test'] . "<br>";
?>