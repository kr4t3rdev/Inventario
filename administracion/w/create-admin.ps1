# ============================================
# Crear Usuario Administrador - Windows
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
    Write-Host "Operación cancelada"
    exit 0
}

# Verificar si el contenedor está corriendo (sistema unificado o separado)
$containerName = ""
if (docker ps --format "{{.Names}}" | Select-String "tcp-sistema" -Quiet) {
    $containerName = "tcp-sistema"
} elseif (docker ps --format "{{.Names}}" | Select-String "inventario-app" -Quiet) {
    $containerName = "inventario-app"
} else {
    Write-Host "Error: No hay contenedor de la aplicacion corriendo"
    Write-Host "Inicie el sistema primero con: .\start-system.ps1"
    exit 1
}

Write-Host ""
Write-Host "Generando hash de contraseña..."

# Generar hash bcrypt usando node dentro del contenedor
$hashScript = "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 12));"
$HASH = docker exec $containerName node -e $hashScript 2>$null

if (-not $HASH) {
    Write-Host "   Usando hash precalculado..."
    $HASH = '$2b$12$/6EHlGyahspj2xpCCgUFqeI/GbjUP2Y5MviB2lgoX1LrXyx59pa12'
}

Write-Host "   Hash generado"

# Escapar comillas para SQL
$HASH_ESCAPED = $HASH -replace "'", "''"

# Determinar el nombre del contenedor de base de datos
$dbContainer = ""
if (docker ps --format "{{.Names}}" | Select-String "tcp-sistema" -Quiet) {
    $dbContainer = "tcp-sistema"
} else {
    $dbContainer = "inventario-db"
}

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
$sql | docker exec -i $dbContainer psql -U inventario -d inventario_db 2>$null

# Verificar
Write-Host ""
Write-Host "Verificando usuario..."
$verifySql = "SELECT `"userId`", `"name`", `"email`", `"role`", `"isActive`" FROM `"User`" WHERE `"email`" = '$ADMIN_EMAIL';"
$verifySql | docker exec -i $dbContainer psql -U inventario -d inventario_db 2>$null

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
Write-Host "    .\create-admin.ps1 email nombre password"
Write-Host "============================================"
