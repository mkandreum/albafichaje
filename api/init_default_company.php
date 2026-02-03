<?php
// api/init_default_company.php
require_once 'config.php';

// Check if user is admin
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
    response(['success' => false, 'message' => 'Acceso denegado'], 403);
}

$companies = readJson(COMPANIES_FILE);

// Check if default company already exists
$defaultExists = false;
foreach ($companies as $company) {
    if (isset($company['isDefault']) && $company['isDefault'] === true) {
        $defaultExists = true;
        break;
    }
}

// If default doesn't exist, create it
if (!$defaultExists) {
    $defaultCompany = [
        'id' => 'default',
        'name' => 'ALBALUZ DESARROLLOS URBANOS, S.A.',
        'cif' => 'A98543432',
        'address' => 'ALBALUZ DESARROLLOS URBANOS S.A',
        'city' => 'ALBACETE',
        'ccc' => '02/1089856/19',
        'sealImage' => '',
        'isDefault' => true,
        'createdAt' => date('c')
    ];
    
    // Add to beginning of array so it appears first
    array_unshift($companies, $defaultCompany);
    
    writeJson(COMPANIES_FILE, $companies);
    response(['success' => true, 'message' => 'Empresa por defecto creada', 'created' => true]);
} else {
    response(['success' => true, 'message' => 'Empresa por defecto ya existe', 'created' => false]);
}
?>
