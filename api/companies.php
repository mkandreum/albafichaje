<?php
// api/companies.php
require_once 'config.php';

// Check if user is authenticated
if (!isset($_SESSION['user'])) {
    response(['success' => false, 'message' => 'Acceso denegado'], 403);
}

$isAdmin = (($_SESSION['user']['role'] ?? '') === 'admin');
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        // Any authenticated user can read company data (needed for PDF generation)
        handleGet();
        break;
    case 'POST':
        // Only admins can create, update, or delete companies
        if (!$isAdmin) {
            response(['success' => false, 'message' => 'Acceso denegado'], 403);
        }
        if ($action === 'delete') {
            handleDelete();
        } else {
            handleSave();
        }
        break;
    default:
        response(['success' => false, 'message' => 'Método no permitido'], 405);
}

function handleGet()
{
    $companies = readJson(COMPANIES_FILE);
    response(['success' => true, 'companies' => $companies]);
}

function handleSave()
{
    $input = getInput();
    $id = $input['id'] ?? uniqid();
    $name = trim($input['name'] ?? ''); 
    $cif = trim($input['cif'] ?? '');
    $address = trim($input['address'] ?? '');
    $city = trim($input['city'] ?? 'ALBACETE'); // Default city
    $ccc = trim($input['ccc'] ?? '');
    $sealImage = $input['sealImage'] ?? ''; // Expecting base64 URL or relative path

    if (empty($name) || empty($cif)) {
        response(['success' => false, 'message' => 'Nombre y CIF son obligatorios'], 400);
    }

    $companies = readJson(COMPANIES_FILE);
    
    // Check if updating existing
    $found = false;
    foreach ($companies as &$company) {
        if ($company['id'] === $id) {
            $company['name'] = $name;
            $company['cif'] = $cif;
            $company['address'] = $address;
            $company['city'] = $city;
            $company['ccc'] = $ccc;
            if (!empty($sealImage)) {
                $company['sealImage'] = $sealImage;
            }
            $found = true;
            break;
        }
    }

    if (!$found) {
        $companies[] = [
            'id' => $id,
            'name' => $name,
            'cif' => $cif,
            'address' => $address,
            'city' => $city,
            'ccc' => $ccc,
            'sealImage' => $sealImage,
            'createdAt' => date('c')
        ];
    }

    writeJson(COMPANIES_FILE, $companies);
    response(['success' => true, 'message' => 'Empresa guardada', 'companies' => $companies]);
}

function handleDelete()
{
    $input = getInput();
    $id = $input['id'] ?? '';

    if (empty($id)) {
        response(['success' => false, 'message' => 'ID requerido'], 400);
    }

    // Prevent deletion of default company
    if ($id === 'default') {
        response(['success' => false, 'message' => 'No se puede eliminar la empresa por defecto'], 400);
    }

    $companies = readJson(COMPANIES_FILE);
    $newCompanies = array_filter($companies, function($c) use ($id) {
        return $c['id'] !== $id;
    });

    if (count($companies) === count($newCompanies)) {
        response(['success' => false, 'message' => 'Empresa no encontrada'], 404);
    }

    writeJson(COMPANIES_FILE, array_values($newCompanies));
    response(['success' => true, 'message' => 'Empresa eliminada']);
}
?>
