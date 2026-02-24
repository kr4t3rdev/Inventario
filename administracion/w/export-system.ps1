# ============================================
# Exportar Sistema Completo - Windows
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

# Scripts Windows
Copy-Item ".\w\*.ps1" "$EXPORT_DIR\" -ErrorAction SilentlyContinue

# Scripts Linux/Mac
Copy-Item "*.sh" "$EXPORT_DIR\" -ErrorAction SilentlyContinue

Write-Host "   OK Archivos de configuración"

Write-Host ""
Write-Host "[3/5] Exportando base de datos..."

# Determinar contenedor de BD
$dbContainer = ""
if (docker ps --format "{{.Names}}" | Select-String "tcp-sistema" -Quiet) {
    $dbContainer = "tcp-sistema"
} else {
    $dbContainer = "inventario-db"
}

# Backup de la base de datos
docker exec $dbContainer pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > "$EXPORT_DIR\database_backup.sql"

# Comprimir con gzip usando Docker
Push-Location $EXPORT_DIR
docker run --rm -v "${PWD}:/data" -w /data alpine gzip -f database_backup.sql
Pop-Location

Write-Host "   OK database_backup.sql.gz"

Write-Host ""
Write-Host "[4/5] Creando script de importación..."

# Crear script de importación Windows
$importScript = @'
# ============================================
# Importar Sistema de Inventario TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Importar Sistema de Inventario TCP"
Write-Host "============================================"

# 1. Cargar imágenes
Write-Host ""
Write-Host "[1/3] Cargando imágenes Docker..."
docker load -i tcp-app.tar
docker load -i tcp-nginx.tar
docker load -i postgres.tar
Write-Host "   OK Imágenes cargadas"

# 2. Iniciar el sistema
Write-Host ""
Write-Host "[2/3] Iniciando sistema..."
.\start-system.ps1

# 3. Restaurar datos
Write-Host ""
Write-Host "[3/3] Restaurando datos..."
if (Test-Path "database_backup.sql.gz") {
    docker run --rm -v "${PWD}:/data" -w /data alpine sh -c "gunzip -c database_backup.sql.gz > database_backup.sql"
    Get-Content "database_backup.sql" | docker exec -i inventario-db psql -U inventario -d inventario_db
    Remove-Item "database_backup.sql" -ErrorAction SilentlyContinue
    Write-Host "   OK Datos restaurados"
} else {
    Write-Host "   No se encontró backup de base de datos"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema importado correctamente"
Write-Host "============================================"
Write-Host "  URL: http://localhost"
Write-Host ""
Write-Host "  Para crear admin: .\create-admin.ps1"
Write-Host "============================================"
'@

$importScript | Out-File -Encoding UTF8 "$EXPORT_DIR\import-system.ps1"

Write-Host "   OK import-system.ps1"

Write-Host ""
Write-Host "[5/5] Creando archivo comprimido..."

# Crear tar.gz final
Push-Location $EXPORT_DIR
docker run --rm -v "${PWD}:/data" -w /data alpine tar -czf "../$EXPORT_FILE.tar.gz" .
Pop-Location

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
Write-Host "  Para transferir a otro equipo:"
Write-Host "    1. Copiar: $EXPORT_FILE.tar.gz"
Write-Host "    2. Descomprimir: tar -xzf $EXPORT_FILE.tar.gz"
Write-Host "    3. Ejecutar: .\import-system.ps1"
Write-Host "============================================"

# Limpiar archivos temporales
Remove-Item -Recurse -Force $EXPORT_DIR
