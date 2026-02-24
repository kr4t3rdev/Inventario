# ============================================
# Estado del Sistema de Inventario TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Estado del Sistema de Inventario TCP"
Write-Host "============================================"

# Verificar contenedores
Write-Host ""
Write-Host "=== CONTENEDORES ==="
$containers = docker ps -a --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>$null
if ($containers) {
    $containers | Select-String "NAME|inventario|tcp"
} else {
    Write-Host "No hay contenedores activos"
}

# Verificar health
Write-Host ""
Write-Host "=== HEALTH CHECK ==="
try {
    $health = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host $health.Content
} catch {
    Write-Host "Sistema no accesible en http://localhost"
}

# Verificar backups
Write-Host ""
Write-Host "=== BACKUPS ==="
if (Test-Path ".\backups") {
    Write-Host "Directorio: $PWD\backups\"
    Get-ChildItem ".\backups\*.gz" -ErrorAction SilentlyContinue | Select-Object -Last 5 | ForEach-Object {
        Write-Host "  $($_.Name) - $([math]::Round($_.Length / 1KB, 2)) KB"
    }
    if (-not (Get-ChildItem ".\backups\*.gz" -ErrorAction SilentlyContinue)) {
        Write-Host "  No hay backups"
    }
} else {
    Write-Host "Directorio de backups no existe"
}

# Uso de disco
Write-Host ""
Write-Host "=== RECURSOS DOCKER ==="
Write-Host "Imagenes:"
docker images --format "  {{.Repository}}:{{.Tag}}`t{{.Size}}" 2>$null | Select-String "tcp|postgres|nginx"

Write-Host ""
Write-Host "Volumenes:"
docker volume ls --format "  {{.Name}}" 2>$null | Select-String "tcp"

Write-Host ""
Write-Host "============================================"
