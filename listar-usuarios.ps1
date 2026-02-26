# ============================================
# Listar Usuarios - Windows
# ============================================
# Uso: .\listar-usuarios.ps1
#
# Muestra todos los usuarios de la base de datos
# ============================================

$CONTAINER_NAME = "tcp-sistema"

Write-Host "============================================"
Write-Host "  Listar Usuarios"
Write-Host "============================================"
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

# Obtener todos los usuarios
$query = "SELECT userId, name, email, role, isActive, lockedUntil, loginAttempts FROM User ORDER BY createdAt DESC;"
$result = docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' psql -h localhost -U inventario -d inventario_db -t -c `"$query`"" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al obtener usuarios: $result"
    exit 1
}

Write-Host "Usuarios en el sistema:"
Write-Host ""
Write-Host "ID                                | Nombre              | Email                    | Rol          | Activo | Bloqueado Hasta          | Intentos"
Write-Host "---------------------------------------------------------------------------------------------------------------------------"

$result -split "`n" | ForEach-Object {
    $line = $_.Trim()
    if ($line -ne "") {
        Write-Host $line
    }
}

$userCount = ($result -split "`n" | Where-Object { $_.Trim() -ne "" }).Count
Write-Host ""
Write-Host "Total de usuarios: $userCount"
