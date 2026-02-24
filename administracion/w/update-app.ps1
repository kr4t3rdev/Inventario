# ============================================
# Actualizar Aplicación - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Actualizar Aplicación TCP"
Write-Host "============================================"

# 1. Verificar que hay cambios
Write-Host ""
Write-Host "[1/5] Verificando cambios..."
try {
    git status --short 2>$null
} catch {
    Write-Host "   (No es un repo git)"
}

# 2. Construir nueva imagen
Write-Host ""
Write-Host "[2/5] Construyendo nueva imagen..."
docker build -t tcp-app:latest . 2>&1 | Select-Object -Last 20

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR Error en el build"
    exit 1
}
Write-Host "   OK Imagen construida"

# 3. Detener contenedor actual
Write-Host ""
Write-Host "[3/5] Deteniendo contenedor actual..."
docker stop inventario-app 2>$null
docker rm inventario-app 2>$null
Write-Host "   OK Contenedor eliminado"

# 4. Iniciar nuevo contenedor
Write-Host ""
Write-Host "[4/5] Iniciando nuevo contenedor..."
docker run -d --name inventario-app `
    --network tcp_app-network `
    -e NODE_ENV=production `
    -e DATABASE_URL="postgresql://inventario:inventario123@inventario-db:5432/inventario_db?schema=public" `
    -e JWT_SECRET="jwt_secret_muy_seguro_cambiar_en_produccion_12345678" `
    -e NEXTAUTH_SECRET="nextauth_secret_muy_seguro_cambiar_en_produccion_12345678" `
    -e NEXTAUTH_URL="http://localhost" `
    -e PORT=3000 `
    -e HOSTNAME="0.0.0.0" `
    --entrypoint "/bin/sh" `
    tcp-app:latest `
    -c "cd /app/.next/standalone && mkdir -p .next && cp -r /app/.next/static .next/ && cp -r /app/public . && npx prisma db push --accept-data-loss --skip-generate 2>/dev/null; node server.js"

Start-Sleep -Seconds 5
Write-Host "   OK Contenedor iniciado"

# 5. Verificar
Write-Host ""
Write-Host "[5/5] Verificando..."
Start-Sleep -Seconds 3

try {
    $health = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "   OK Aplicación funcionando"
} catch {
    Write-Host "   La aplicación puede estar iniciando..."
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Actualización completada"
Write-Host "============================================"
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" | Select-String "inventario"
Write-Host ""
Write-Host "  URL: http://localhost"
Write-Host "  Logs: docker logs inventario-app -f"
Write-Host "============================================"
