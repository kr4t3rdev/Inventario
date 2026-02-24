# ============================================
# Exportar Sistema Completo para Transferencia (Windows)
# ============================================

$ErrorActionPreference = "Stop"

$EXPORT_DIR = ".\export"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$EXPORT_FILE = "tcp_sistema_$TIMESTAMP"

Write-Host "============================================"
Write-Host "  Exportar Sistema para Transferencia"
Write-Host "============================================"

# Crear directorio de exportación
New-Item -ItemType Directory -Force -Path $EXPORT_DIR | Out-Null

Write-Host ""
Write-Host "[1/5] Exportando imágenes Docker..."

# Exportar imágenes
docker save tcp-app:latest -o "$EXPORT_DIR\tcp-app.tar"
Write-Host "   OK tcp-app:latest"

docker save tcp-nginx:latest -o "$EXPORT_DIR\tcp-nginx.tar"
Write-Host "   OK tcp-nginx:latest"

docker save postgres:16-alpine -o "$EXPORT_DIR\postgres.tar"
Write-Host "   OK postgres:16-alpine"

Write-Host ""
Write-Host "[2/5] Exportando configuración..."

# Copiar archivos de configuración
Copy-Item "nginx.conf" "$EXPORT_DIR\" -ErrorAction SilentlyContinue
Copy-Item "Dockerfile.nginx-windows" "$EXPORT_DIR\" -ErrorAction SilentlyContinue
Copy-Item "*.sh" "$EXPORT_DIR\" -ErrorAction SilentlyContinue
Copy-Item "*.ps1" "$EXPORT_DIR\" -ErrorAction SilentlyContinue

Write-Host "   OK Archivos de configuración"

Write-Host ""
Write-Host "[3/5] Exportando base de datos..."

# Backup de la base de datos
docker exec inventario-db pg_dump -U inventario -d inventario_db --clean --if-exists > "$EXPORT_DIR\database_backup.sql"

# Comprimir con gzip usando Docker
docker run --rm -v "${PWD}\export:/data" alpine gzip -f database_backup.sql

Write-Host "   OK database_backup.sql.gz"

Write-Host ""
Write-Host "[4/5] Creando archivo comprimido..."

# Crear tar.gz final
$exportPath = Join-Path $PWD $EXPORT_DIR
docker run --rm -v "${PWD}:/data" -w /data alpine tar -czf "$EXPORT_FILE.tar.gz" -C export .

Write-Host "   OK $EXPORT_FILE.tar.gz"

Write-Host ""
Write-Host "[5/5] Limpiando..."
Remove-Item -Recurse -Force $EXPORT_DIR

# Mostrar tamaño
$size = (Get-Item "$EXPORT_FILE.tar.gz").Length / 1MB
$sizeFormatted = "{0:N2} MB" -f $size

Write-Host ""
Write-Host "============================================"
Write-Host "  Exportación completada"
Write-Host "============================================"
Write-Host "  Archivo: $EXPORT_FILE.tar.gz"
Write-Host "  Tamaño:  $sizeFormatted"
Write-Host ""
Write-Host "  Contenido:"
Write-Host "    - Imágenes Docker (app, nginx, postgres)"
Write-Host "    - Configuración nginx"
Write-Host "    - Scripts de inicio/admin/backup"
Write-Host "    - Backup de base de datos"
Write-Host ""
Write-Host "  Para transferir:"
Write-Host "    Linux/Mac: tar -xzf $EXPORT_FILE.tar.gz && ./import-system.sh"
Write-Host "    Windows:   tar -xzf $EXPORT_FILE.tar.gz; .\import-windows.ps1"
Write-Host "============================================"
