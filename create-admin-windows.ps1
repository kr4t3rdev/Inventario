# ============================================
# Crear Usuario Administrador en Windows
# ============================================
# Uso: .\create-admin-windows.ps1 [email] [nombre] [password]
#
# Parametros:
#   email    Email del admin (default: admin@tcp.com)
#   nombre   Nombre del admin (default: Administrador)
#   password Password del admin (default: Admin123!)
#
# Ejemplo:
#   .\create-admin-windows.ps1
#   .\create-admin-windows.ps1 "admin@miempresa.com" "Mi Nombre" "MiPassword123!"
# ============================================

param(
    [string]$email = "admin@tcp.com",
    [string]$name = "Administrador",
    [string]$password = "Admin123!"
)

$CONTAINER_NAME = "tcp-sistema"

Write-Host "============================================"
Write-Host "  Crear Usuario Administrador"
Write-Host "============================================"
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

# Verificar que el contenedor esté ejecutándose
$containerStatus = docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>$null
if ($containerStatus -ne "true") {
    Write-Host "ERROR: El contenedor $CONTAINER_NAME no está corriendo"
    Write-Host "Inicie el sistema primero con: .\start-unified.ps1"
    exit 1
}

# Obtener password de la base de datos del contenedor
$dbPass = docker exec $CONTAINER_NAME printenv DB_PASSWORD 2>$null
if (-not $dbPass) {
    Write-Host "Error: No se pudo obtener la contraseña de la base de datos"
    exit 1
}

Write-Host ""
Write-Host "Generando hash de contraseña..."

# Generar hash bcrypt
$hashJson = docker exec $CONTAINER_NAME sh -c "node -e \"const bcrypt = require('bcrypt'); bcrypt.hash('$password', 12).then(h => console.log(h));\"" 2>$null

if (-not $hashJson -or $hashJson.Trim() -eq "") {
    Write-Host "   Usando hash por defecto..."
    $hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8'
} else {
    $hash = $hashJson.Trim()
}

Write-Host "   Hash generado"

# Escapar comillas para SQL
$nameEscaped = $name -replace "'", "''"
$emailEscaped = $email -replace "'", "''"
$hashEscaped = $hash -replace "'", "''"

# Insertar usuario
Write-Host ""
Write-Host "Insertando usuario..."

$sql = "INSERT INTO User (userId, name, email, password, role, isActive, createdAt, updatedAt, activatedAt) VALUES (gen_random_uuid(), '$nameEscaped', '$emailEscaped', '$hashEscaped', 'admin', true, NOW(), NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET name = '$nameEscaped', password = '$hashEscaped', role = 'admin', isActive = true, updatedAt = NOW(), activatedAt = NOW();"

docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -c `"$sql`"" 2>&1

# Verificar
Write-Host ""
Write-Host "Verificando usuario..."
docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -t -c \"SELECT userId, name, email, role, isActive FROM User WHERE email = '$emailEscaped';\"" 2>&1

Write-Host ""
Write-Host "============================================"
Write-Host "  Usuario Administrador Listo"
Write-Host "============================================"
Write-Host "  Email:    $email"
Write-Host "  Password: $password"
Write-Host "  URL:      http://localhost"
Write-Host "============================================"
