# ============================================
# Backup de BD - Sistema Unificado Windows
# ============================================

$BACKUP_DIR = ".\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\inventario_backup_$TIMESTAMP.sql"

New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

Write-Host "============================================"
Write-Host "  Backup de Base de Datos"
Write-Host "============================================"
Write-Host ""
Write-Host "Archivo: $BACKUP_FILE"
Write-Host ""

# Verificar que el contenedor existe
if (-not (docker ps --format "{{.Names}}" | Select-String "^tcp-sistema$")) {
    Write-Host "ERROR: El contenedor tcp-sistema no esta corriendo"
    exit 1
}

Write-Host "Ejecutando pg_dump..."
docker exec tcp-sistema pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > $BACKUP_FILE

Write-Host "Comprimiendo backup..."
docker run --rm -v "${PWD}:/data" -w /data alpine gzip -f "inventario_backup_$TIMESTAMP.sql" 2>$null
$BACKUP_FILE = "$BACKUP_FILE.gz"

Write-Host ""
Write-Host "============================================"
Write-Host "  Backup completado"
Write-Host "============================================"
if (Test-Path $BACKUP_FILE) {
    $size = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "  Archivo: $BACKUP_FILE"
    Write-Host "  Tamano:  $([math]::Round($size, 2)) MB"
}
Write-Host "  Fecha:   $(Get-Date)"
Write-Host "============================================"
