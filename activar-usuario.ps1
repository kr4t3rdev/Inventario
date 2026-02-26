# ============================================
# Activar Usuario - Windows
# ============================================
# Uso: .\activar-usuario.ps1 -email <email>
#
# Parametros:
#   -email Email del usuario a activar (requerido)
#
# Ejemplo:
#   .\activar-usuario.ps1 -email usuario@ejemplo.com
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$email
)

$CONTAINER_NAME = "tcp-sistema"

Write-Host "============================================"
Write-Host "  Activar Usuario"
Write-Host "============================================"
Write-Host ""
Write-Host "Email: $email"
Write-Host ""

# Verificar que el contenedor esté ejecutándose
$containerStatus = docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>$null
if ($containerStatus -ne "true") {
    Write-Host "Error: El contenedor $CONTAINER_NAME no está en ejecución"
    exit 1
}

# Obtener password de la base de datos del contenedor
$dbPass = docker exec $CONTAINER_NAME printenv DB_PASSWORD 2>$null
if (-not $dbPass) {
    Write-Host "Error: No se pudo obtener la contraseña de la base de datos"
    exit 1
}

# Verificar que el usuario existe
$checkQuery = "SELECT userId, name, email, isActive FROM User WHERE email = '$($email.Replace("'", "''"))';"
$result = docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -t -c `"$checkQuery`"" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al verificar usuario: $result"
    exit 1
}

if ($result.Trim() -eq "") {
    Write-Host "Error: No existe un usuario con el email $email"
    exit 1
}

Write-Host "Usuario encontrado:"
Write-Host $result
Write-Host ""

# Activar usuario
$updateQuery = "UPDATE User SET isActive = true, activatedAt = NOW() WHERE email = '$($email.Replace("'", "''"))';"
$updateResult = docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -c `"$updateQuery`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "============================================"
    Write-Host "  Usuario activado correctamente"
    Write-Host "============================================"
    Write-Host "  Email: $email"
    Write-Host "============================================"
} else {
    Write-Host "Error al activar usuario: $updateResult"
    exit 1
}
