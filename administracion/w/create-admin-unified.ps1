# ============================================
# Crear Usuario Administrador - Sistema Unificado Windows
# ============================================

Write-Host "============================================"
Write-Host "  Crear Usuario Administrador"
Write-Host "============================================"

# Configuración por defecto
$ADMIN_EMAIL = "admin@tcp.com"
$ADMIN_NAME = "Administrador"
$ADMIN_PASSWORD = "Admin123!"

if ($args.Count -ge 1) { $ADMIN_EMAIL = $args[0] }
if ($args.Count -ge 2) { $ADMIN_NAME = $args[1] }
if ($args.Count -ge 3) { $ADMIN_PASSWORD = $args[2] }

Write-Host ""
Write-Host "Datos del administrador:"
Write-Host "  Email:    $ADMIN_EMAIL"
Write-Host "  Nombre:   $ADMIN_NAME"
Write-Host "  Password: $ADMIN_PASSWORD"
Write-Host ""

$confirm = Read-Host "Continuar? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Operacion cancelada"
    exit 0
}

# Verificar si el contenedor está corriendo
$containerRunning = docker ps --format "{{.Names}}" | Select-String "^tcp-sistema$"
if (-not $containerRunning) {
    Write-Host "Error: El contenedor tcp-sistema no esta corriendo"
    Write-Host "Inicie el sistema primero con: .\start-unified.ps1"
    exit 1
}

Write-Host ""
Write-Host "Generando hash de contrasena..."

# Generar hash bcrypt usando node dentro del contenedor
$hashScript = "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 12));"
$HASH = docker exec tcp-sistema node -e $hashScript 2>$null

if (-not $HASH) {
    Write-Host "   Usando hash precalculado..."
    $HASH = '$2b$12$/6EHlGyahspj2xpCCgUFqeI/GbjUP2Y5MviB2lgoX1LrXyx59pa12'
}

Write-Host "   Hash generado"

# Escapar comillas para SQL
$HASH_ESCAPED = $HASH -replace "'", "''"

# SQL para insertar usuario
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
    '$ADMIN_NAME',
    '$ADMIN_EMAIL',
    '$HASH_ESCAPED',
    'admin',
    true,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT ("email") DO UPDATE SET
    "name" = '$ADMIN_NAME',
    "password" = '$HASH_ESCAPED',
    "role" = 'admin',
    "isActive" = true,
    "updatedAt" = NOW(),
    "activatedAt" = NOW();
"@

Write-Host ""
Write-Host "Insertando usuario en la base de datos..."
$sql | docker exec -i tcp-sistema psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" 2>$null

# Verificar
Write-Host ""
Write-Host "Verificando usuario..."
$verifySql = "SELECT `"userId`", `"name`", `"email`", `"role`", `"isActive`" FROM `"User`" WHERE `"email`" = '$ADMIN_EMAIL';"
$verifySql | docker exec -i tcp-sistema psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" 2>$null

Write-Host ""
Write-Host "============================================"
Write-Host "  Usuario Administrador Listo"
Write-Host "============================================"
Write-Host "  Email:    $ADMIN_EMAIL"
Write-Host "  Password: $ADMIN_PASSWORD"
Write-Host "  Rol:      admin"
Write-Host "  Activo:   true"
Write-Host ""
Write-Host "  URL de login: http://localhost"
Write-Host ""
Write-Host "  Para crear otro usuario:"
Write-Host "    .\create-admin-unified.ps1 email nombre password"
Write-Host "============================================"
