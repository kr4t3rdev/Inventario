# ============================================
# Backup de Base de Datos - Windows
# ============================================
# Uso: .\backup-bd.ps1 [-backupDir <directorio>]
#
# Parametros:
#   -backupDir Directorio para guardar backups (default: .\backups)
#
# Ejemplo:
#   .\backup-bd.ps1
#   .\backup-bd.ps1 -backupDir D:\backups
# ============================================

param(
    [string]$backupDir = ".\backups"
)

$CONTAINER_NAME = "tcp-sistema"
$DB_NAME = "inventario_db"
$DB_USER = "inventario"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "backup_${TIMESTAMP}.sql"

# Crear directorio de backups si no existe
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$backupPath = Join-Path $backupDir $BACKUP_FILE

Write-Host "============================================"
Write-Host "  Backup de Base de Datos"
Write-Host "============================================"
Write-Host ""
Write-Host "Contenedor: $CONTAINER_NAME"
Write-Host "Base de datos: $DB_NAME"
Write-Host "Archivo: $BACKUP_FILE"
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

Write-Host "Creando backup..."

# Ejecutar pg_dump dentro del contenedor
docker exec -i $CONTAINER_NAME sh -c "PGPASSWORD='$dbPass' pg_dump -h localhost -U $DB_USER -d $DB_NAME" > $backupPath 2>&1

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $backupPath).Length
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Backup creado exitosamente"
    Write-Host "============================================"
    Write-Host "  Archivo: $backupPath"
    Write-Host "  Tamaño:  $fileSizeMB MB"
    Write-Host "============================================"
    
    # Limpiar backups antiguos (mantener solo los ultimos 7)
    $backups = Get-ChildItem -Path $backupDir -Filter "backup_*.sql" | Sort-Object LastWriteTime -Descending
    if ($backups.Count -gt 7) {
        $toDelete = $backups | Select-Object -Skip 7
        foreach ($file in $toDelete) {
            Remove-Item $file.FullName -Force
            Write-Host "  Eliminado: $($file.Name)"
        }
    }
} else {
    Write-Host "Error: Falló la creación del backup"
    Remove-Item $backupPath -Force -ErrorAction SilentlyContinue
    exit 1
}
