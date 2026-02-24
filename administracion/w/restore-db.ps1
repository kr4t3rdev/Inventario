# ============================================
# Restaurar Backup de Base de Datos - Windows
# ============================================

$BACKUP_DIR = ".\backups"

Write-Host "============================================"
Write-Host "  Restaurar Backup de Base de Datos"
Write-Host "============================================"

# Listar backups disponibles
Write-Host ""
Write-Host "Backups disponibles:"
Write-Host ""

if (Test-Path $BACKUP_DIR) {
    Get-ChildItem $BACKUP_DIR -Filter "*.gz" | ForEach-Object {
        Write-Host "  $($_.Name) - $($_.Length / 1KB) KB"
    }
} else {
    Write-Host "  No hay backups disponibles"
}

Write-Host ""

# Si se pasa un archivo como argumento
if ($args.Count -ge 1) {
    $BACKUP_FILE = $args[0]
} else {
    # Usar el más reciente
    $latest = Get-ChildItem $BACKUP_DIR -Filter "*.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $BACKUP_FILE = $latest.FullName
        Write-Host "Usando backup más reciente: $BACKUP_FILE"
    } else {
        Write-Host "Error: No se encontraron backups"
        exit 1
    }
}

Write-Host ""
Write-Host "ADVERTENCIA: Esto ELIMINARA todos los datos actuales"
Write-Host ""

$confirm = Read-Host "Continuar? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Operación cancelada"
    exit 0
}

# Descomprimir si es necesario
if ($BACKUP_FILE -like "*.gz") {
    Write-Host ""
    Write-Host "Descomprimiendo backup..."
    $SQL_FILE = $BACKUP_FILE -replace '\.gz$', ''
    docker run --rm -v "${PWD}:/data" -w /data alpine sh -c "gunzip -c `"$BACKUP_FILE`" > `"$SQL_FILE`""
} else {
    $SQL_FILE = $BACKUP_FILE
}

# Restaurar
Write-Host ""
Write-Host "Restaurando base de datos..."
Get-Content $SQL_FILE | docker exec -i inventario-db psql "postgresql://inventario:inventario123@localhost:5432/inventario_db"

# Limpiar archivo temporal
if ($BACKUP_FILE -like "*.gz") {
    Remove-Item $SQL_FILE -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Restauración completada"
Write-Host "============================================"
Write-Host "  Archivo restaurado: $BACKUP_FILE"
Write-Host "  Fecha: $(Get-Date)"
Write-Host "============================================"
