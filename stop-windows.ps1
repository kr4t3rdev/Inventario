# ============================================
# Detener Sistema TCP en Windows
# ============================================

Write-Host "============================================"
Write-Host "  Detener Sistema de Inventario TCP"
Write-Host "============================================"
Write-Host ""

Write-Host "Deteniendo contenedores..."
docker stop inventario-nginx 2>$null
docker stop inventario-app 2>$null
docker stop inventario-db 2>$null

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema detenido"
Write-Host "============================================"
Write-Host ""
Write-Host "  Para iniciar: .\start-windows.ps1"
Write-Host "============================================"
