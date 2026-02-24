# ============================================
# Detener Sistema Unificado TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Deteniendo Sistema de Inventario TCP"
Write-Host "============================================"

Write-Host ""
Write-Host "Deteniendo contenedor..."
docker stop tcp-sistema 2>$null

Write-Host "Eliminando contenedor..."
docker rm tcp-sistema 2>$null

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema detenido"
Write-Host "============================================"
Write-Host ""
Write-Host "  Para iniciar: .\start-unified.ps1"
Write-Host "  Para eliminar datos: docker volume rm tcp_postgres_data"
Write-Host "============================================"
