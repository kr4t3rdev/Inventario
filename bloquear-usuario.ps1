# ============================================
# Bloquear Usuario - Windows
# ============================================
# Uso: .\bloquear-usuario.ps1 -email <email> [-horas <horas>]
#
# Parametros:
#   -email Email del usuario a bloquear (requerido)
#   -horas Horas de bloqueo (default: 24)
#
# Ejemplo:
#   .\bloquear-usuario.ps1 -email usuario@ejemplo.com
#   .\bloquear-usuario.ps1 -email usuario@ejemplo.com -horas 48
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$email,
    [int]$horas = 24
)

$CONTAINER_NAME = "tcp-sistema"

Write-Host "============================================"
Write-Host "  Bloquear Usuario"
Write-Host "============================================"
Write-Host ""
Write-Host "Email: $email"
Write-Host "Duración: $horas horas"
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
$checkQuery = "SELECT userId, name, email, isActive, lockedUntil FROM User WHERE email = '$($email.Replace("'", "''"))';"
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

# Bloquear usuario
$lockedUntil = (Get-Date).AddHours($horas).ToString("yyyy-MM-dd HH:mm:ss")
$updateQuery = "UPDATE User SET lockedUntil = '$lockedUntil' WHERE email = '$($email.Replace("'", "''"))';"
$updateResult = docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -c `"$updateQuery`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "============================================"
    Write-Host "  Usuario bloqueado correctamente"
    Write-Host "============================================"
    Write-Host "  Email: $email"
    Write-Host "  Bloqueado hasta: $lockedUntil"
    Write-Host "============================================"
} else {
    Write-Host "Error al bloquear usuario: $updateResult"
    exit 1
}
