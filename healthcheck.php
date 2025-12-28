<?php
// healthcheck.php
header('Content-Type: text/plain');
echo "OK - Server is Running\n";
echo "PHP Version: " . phpversion() . "\n";
echo "User: " . get_current_user() . "\n";
echo "Data Dir Writable: " . (is_writable(__DIR__ . '/data') ? 'YES' : 'NO') . "\n";
?>