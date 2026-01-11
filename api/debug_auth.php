<?php
// api/debug_auth.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Debug Auth & Permissions</h1>";

$dataDir = __DIR__ . '/../data';
$usersFile = $dataDir . '/users.json';

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
    echo "Raw Content Length: " . strlen($content) . "<br>";
    echo "JSON Decode Status: " . (json_last_error() === JSON_ERROR_NONE ? 'OK' : 'ERROR: ' . json_last_error_msg()) . "<br>";
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
session_start();
$_SESSION['debug_test'] = 'works';
echo "Session ID: " . session_id() . "<br>";
echo "Session Val: " . $_SESSION['debug_test'] . "<br>";
?>