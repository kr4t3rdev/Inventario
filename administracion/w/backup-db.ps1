# ============================================
# Backup de Base de Datos - Windows
# ============================================

$ErrorActionPreference = "Stop"

# Configuración
$BACKUP_DIR = ".\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\inventario_backup_$TIMESTAMP.sql"

# Crear directorio de backups
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

Write-Host "============================================"
Write-Host "  Backup de Base de Datos"
Write-Host "============================================"
Write-Host ""
Write-Host "Archivo: $BACKUP_FILE"
Write-Host ""

# Ejecutar backup usando pg_dump dentro del contenedor
Write-Host "Ejecutando pg_dump..."
docker exec inventario-db pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > $BACKUP_FILE

# Comprimir backup
Write-Host "Comprimiendo backup..."
docker run --rm -v "${PWD}:/data" -w /data alpine gzip -f "inventario_backup_$TIMESTAMP.sql"
$BACKUP_FILE = "$BACKUP_FILE.gz"

# Mostrar información
Write-Host ""
Write-Host "============================================"
Write-Host "  Backup completado"
Write-Host "============================================"
Write-Host "  Archivo: $BACKUP_FILE"

if (Test-Path $BACKUP_FILE) {
    $size = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "  Tamano:  $([math]::Round($size, 2)) MB"
}

Write-Host "  Fecha:   $(Get-Date)"
Write-Host "============================================"

# Limpiar backups antiguos (mantener últimos 30 días)
Write-Host ""
Write-Host "Limpiando backups antiguos..."
$cutoff = (Get-Date).AddDays(-30)
Get-ChildItem $BACKUP_DIR -Filter "*.gz" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
Write-Host "OK Limpieza completada"
