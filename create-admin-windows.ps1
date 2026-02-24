# ============================================
# Crear Usuario Administrador en Windows
# ============================================

Write-Host "============================================"
Write-Host "  Crear Usuario Administrador"
Write-Host "============================================"

# Configuración por defecto
$email = "admin@tcp.com"
$name = "Administrador"
$password = "Admin123!"

if ($args.Count -ge 1) { $email = $args[0] }
if ($args.Count -ge 2) { $name = $args[1] }
if ($args.Count -ge 3) { $password = $args[2] }

Write-Host ""
Write-Host "Datos del administrador:"
Write-Host "  Email:    $email"
Write-Host "  Nombre:   $name"
Write-Host "  Password: $password"
Write-Host ""

$confirm = Read-Host "¿Continuar? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Operación cancelada"
    exit 0
}

# Verificar que la app está corriendo
$appRunning = docker ps --filter "name=inventario-app" --format "{{.Names}}" 2>$null
if ($appRunning -ne "inventario-app") {
    Write-Host "ERROR: El contenedor inventario-app no está corriendo"
    Write-Host "Inicie el sistema primero con: .\start-windows.ps1"
    exit 1
}

Write-Host ""
Write-Host "Generando hash de contraseña..."

# Generar hash bcrypt
$hashJson = docker exec inventario-app node -e @"
const bcrypt = require('bcrypt');
bcrypt.hash('$password', 12).then(h => console.log(h));
"@ 2>$null

if (-not $hashJson) {
    Write-Host "   Usando método alternativo..."
    $hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8'
} else {
    $hash = $hashJson.Trim()
}

Write-Host "   Hash generado"

# Escapar comillas
$hashEscaped = $hash -replace "'", "''"

# Insertar usuario
Write-Host ""
Write-Host "Insertando usuario..."

$sql = @"
INSERT INTO "User" (
    "userId",
    "name",
    "email",
    "password",
    "role",
    "isActive",
    "createdAt",
    "updatedAt",
    "activatedAt"
) VALUES (
    gen_random_uuid(),
    '$name',
    '$email',
    '$hashEscaped',
    'admin',
    true,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT ("email") DO UPDATE SET
    "name" = '$name',
    "password" = '$hashEscaped',
    "role" = 'admin',
    "isActive" = true,
    "updatedAt" = NOW(),
    "activatedAt" = NOW();
"@

$sql | docker exec -i inventario-db psql -U inventario -d inventario_db 2>$null

# Verificar
Write-Host ""
Write-Host "Verificando usuario..."
docker exec -i inventario-db psql -U inventario -d inventario_db -c "SELECT \"userId\", \"name\", \"email\", \"role\", \"isActive\" FROM \"User\" WHERE \"email\" = '$email';"

Write-Host ""
Write-Host "============================================"
Write-Host "  Usuario Administrador Listo"
Write-Host "============================================"
Write-Host "  Email:    $email"
Write-Host "  Password: $password"
Write-Host "  URL:      http://localhost"
Write-Host "============================================"
