# ============================================
# Detener Sistema de Inventario TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Deteniendo Sistema de Inventario TCP"
Write-Host "============================================"

Write-Host ""
Write-Host "Deteniendo contenedores..."
docker stop inventario-nginx 2>$null
docker stop inventario-app 2>$null
docker stop inventario-db 2>$null

Write-Host "Eliminando contenedores..."
docker rm inventario-nginx 2>$null
docker rm inventario-app 2>$null
docker rm inventario-db 2>$null

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema detenido"
Write-Host "============================================"
Write-Host ""
Write-Host "  Para iniciar nuevamente: .\start-system.ps1"
Write-Host "  Para eliminar datos: docker volume rm tcp_postgres_data"
Write-Host "============================================"
