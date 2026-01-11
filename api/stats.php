<?php
// api/stats.php
require_once 'config.php';

if (!isset($_SESSION['user'])) {
    response(['success' => false, 'message' => 'No autenticado'], 401);
}

$action = $_GET['action'] ?? '';
$userId = $_GET['user_id'] ?? $_SESSION['user']['id'];

if ($action === 'dashboard') {
    handleDashboardStats($userId);
} else if ($action === 'admin_dashboard') {
    handleAdminStats();
} else {
    response(['success' => false, 'message' => 'Acción inválida'], 400);
}

function handleDashboardStats($userId)
{
    if ($_SESSION['user']['role'] !== 'admin' && $userId !== $_SESSION['user']['id']) {
        response(['success' => false, 'message' => 'Acceso denegado'], 403);
    }

    $fichajes = readJson(FICHAJES_FILE);
    $userFichajes = array_filter($fichajes, function ($f) use ($userId) {
        return $f['userId'] === $userId;
    });

    $today = date('Y-m-d');
    $currentMonth = date('Y-m');
    $currentYear = date('Y');

    $monthHours = 0;
    $todayHours = 0;
    $daysWorked = 0;
    $yearHours = 0;

    $workedDates = [];

    foreach ($userFichajes as $f) {
        if ($f['date'] === $today) {
            if ($f['entryTime'] && $f['exitTime']) {
                $todayHours += calculateHours($f['entryTime'], $f['exitTime']);
            }
        }

        if (strpos($f['date'], $currentMonth) === 0) {
            if ($f['entryTime'] && $f['exitTime']) {
                $monthHours += calculateHours($f['entryTime'], $f['exitTime']);
            }
            if (!in_array($f['date'], $workedDates)) {
                $workedDates[] = $f['date'];
            }
        }

        if (strpos($f['date'], $currentYear) === 0) {
            if ($f['entryTime'] && $f['exitTime']) {
                $yearHours += calculateHours($f['entryTime'], $f['exitTime']);
            }
        }
    }

    $daysWorked = count($workedDates);

    // Average hours per day (only completed days)
    $avgDaily = $daysWorked > 0 ? round($monthHours / $daysWorked, 1) : 0;

    response([
        'success' => true,
        'stats' => [
            'todayHours' => round($todayHours, 2),
            'monthHours' => round($monthHours, 2),
            'daysWorked' => $daysWorked,
            'yearHours' => round($yearHours, 2),
            'avgDaily' => $avgDaily
        ]
    ]);
}

function handleAdminStats()
{
    if ($_SESSION['user']['role'] !== 'admin') {
        response(['success' => false, 'message' => 'Acceso denegado'], 403);
    }

    $fichajes = readJson(FICHAJES_FILE);
    $users = readJson(USERS_FILE);

    $today = date('Y-m-d');
    $activeUsers = 0;
    $totalHoursToday = 0;

    foreach ($fichajes as $f) {
        if ($f['date'] === $today) {
            $activeUsers++; // Approximate
            if ($f['entryTime'] && $f['exitTime']) {
                $totalHoursToday += calculateHours($f['entryTime'], $f['exitTime']);
            }
        }
    }

    response([
        'success' => true,
        'stats' => [
            'totalUsers' => count($users),
            'activeToday' => $activeUsers,
            'totalHoursToday' => round($totalHoursToday, 2)
        ]
    ]);
}

function calculateHours($start, $end)
{
    $t1 = strtotime($start);
    $t2 = strtotime($end);
    return ($t2 - $t1) / 3600;
}
?>