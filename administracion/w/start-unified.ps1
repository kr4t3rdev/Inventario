# ============================================
# Iniciar Sistema Unificado TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Sistema de Inventario TCP (Unificado)"
Write-Host "============================================"

# Verificar que la imagen existe
Write-Host ""
Write-Host "[1/2] Verificando imagen..."
$imageExists = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String "^docker-tcp:latest$"
if (-not $imageExists) {
    Write-Host "   ERROR docker-tcp:latest no encontrada"
    Write-Host "   Ejecuta primero: docker load -i docker-tcp.tar"
    exit 1
}
Write-Host "   OK docker-tcp:latest"

# Detener contenedor existente
Write-Host ""
Write-Host "[2/2] Iniciando sistema..."
docker stop tcp-sistema 2>$null
docker rm tcp-sistema 2>$null

# Iniciar contenedor unificado
docker run -d --name tcp-sistema `
    -p 80:80 `
    -e JWT_SECRET="jwt_secret_muy_seguro_cambiar_en_produccion_12345678" `
    -e NEXTAUTH_SECRET="nextauth_secret_muy_seguro_cambiar_en_produccion_12345678" `
    -e NEXTAUTH_URL="http://localhost" `
    docker-tcp:latest

Write-Host "   OK Sistema iniciado"

# Esperar a que esté listo
Write-Host ""
Write-Host "Esperando a que el sistema este listo..."
Start-Sleep -Seconds 30

# Verificar
try {
    $health = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 10
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Sistema iniciado correctamente"
    Write-Host "============================================"
    Write-Host "  URL: http://localhost"
    Write-Host ""
    Write-Host "  Para crear admin: .\create-admin-unified.ps1"
    Write-Host "  Para ver logs:    docker logs tcp-sistema"
    Write-Host "  Para detener:     docker stop tcp-sistema"
    Write-Host "============================================"
} catch {
    Write-Host "   El sistema puede estar iniciando..."
    Write-Host "   Verifica con: docker logs tcp-sistema"
}
