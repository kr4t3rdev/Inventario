# ============================================
# Ejecutar Migraciones de Base de Datos - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Ejecutando Migraciones de Base de Datos"
Write-Host "============================================"

# Determinar el nombre del contenedor
$CONTAINER_NAME = ""
if (docker ps --format "{{.Names}}" | Select-String "tcp-sistema" -Quiet) {
    $CONTAINER_NAME = "tcp-sistema"
    Write-Host "Usando sistema unificado: tcp-sistema"
} elseif (docker ps --format "{{.Names}}" | Select-String "inventario-app" -Quiet) {
    $CONTAINER_NAME = "inventario-app"
    Write-Host "Usando sistema separado: inventario-app"
} else {
    Write-Host "Error: No hay contenedor de la aplicacion corriendo"
    Write-Host "Inicie el sistema primero con: .\start-system.ps1"
    exit 1
}

Write-Host ""
Write-Host "Ejecutando prisma db push..."

docker exec $CONTAINER_NAME sh -c "cd /app && npx prisma db push --accept-data-loss --skip-generate"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Migraciones ejecutadas correctamente"
    Write-Host "============================================"
    
    # Verificar tablas creadas
    Write-Host ""
    Write-Host "Verificando tablas creadas..."
    
    $DB_CONTAINER = ""
    if (docker ps --format "{{.Names}}" | Select-String "tcp-sistema" -Quiet) {
        $DB_CONTAINER = "tcp-sistema"
    } else {
        $DB_CONTAINER = "inventario-db"
    }
    
    $tableCount = docker exec $DB_CONTAINER psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>$null
    Write-Host "Tablas en la base de datos: $tableCount"
    
    Write-Host ""
    Write-Host "Ahora puedes crear el usuario admin:"
    Write-Host "  .\create-admin.ps1"
} else {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Error al ejecutar migraciones"
    Write-Host "============================================"
    Write-Host "Verifica que el contenedor tenga acceso a los archivos de Prisma"
}
