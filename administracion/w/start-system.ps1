# ============================================
# Iniciar Sistema de Inventario TCP - Windows
# ============================================

Write-Host "============================================"
Write-Host "  Sistema de Inventario TCP"
Write-Host "============================================"

# 1. Verificar imágenes
Write-Host ""
Write-Host "[1/6] Verificando imágenes..."
$images = @("tcp-app:latest", "tcp-nginx:latest", "postgres:16-alpine")
foreach ($img in $images) {
    $exists = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String "^$img$"
    if ($exists) {
        Write-Host "   OK $img"
    } else {
        Write-Host "   ERROR $img no encontrada"
        exit 1
    }
}

# 2. Crear red y volúmenes
Write-Host ""
Write-Host "[2/6] Creando red y volúmenes..."
docker network create tcp_app-network 2>$null
docker volume create tcp_postgres_data 2>$null
Write-Host "   OK Red y volúmenes listos"

# 3. Detener contenedores existentes
Write-Host ""
Write-Host "[3/6] Deteniendo contenedores existentes..."
docker stop inventario-nginx 2>$null; docker rm inventario-nginx 2>$null
docker stop inventario-app 2>$null; docker rm inventario-app 2>$null
docker stop inventario-db 2>$null; docker rm inventario-db 2>$null
Write-Host "   OK Contenedores eliminados"

# 4. Iniciar PostgreSQL
Write-Host ""
Write-Host "[4/6] Iniciando PostgreSQL..."
docker run -d --name inventario-db `
    --network tcp_app-network `
    -e POSTGRES_USER=inventario `
    -e POSTGRES_PASSWORD=inventario123 `
    -e POSTGRES_DB=inventario_db `
    -v tcp_postgres_data:/var/lib/postgresql/data `
    postgres:16-alpine

Write-Host "   Esperando a que PostgreSQL esté listo..."
Start-Sleep -Seconds 5

$retries = 0
do {
    $ready = docker exec inventario-db pg_isready -U inventario -d inventario_db 2>$null
    Start-Sleep -Seconds 2
    $retries++
} until ($ready -or $retries -gt 15)

if ($retries -gt 15) {
    Write-Host "   ERROR PostgreSQL no inició"
    exit 1
}
Write-Host "   OK PostgreSQL listo"

# 5. Iniciar aplicación
Write-Host ""
Write-Host "[5/6] Iniciando aplicación..."
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

Start-Sleep -Seconds 10
Write-Host "   OK Aplicación iniciada y migraciones ejecutadas"

# 6. Iniciar Nginx (sin montar archivo, usa config de la imagen)
Write-Host ""
Write-Host "[6/6] Iniciando Nginx..."
docker run -d --name inventario-nginx `
    --network tcp_app-network `
    -p 80:80 `
    tcp-nginx:latest

Start-Sleep -Seconds 2
Write-Host "   OK Nginx iniciado"

# Verificar estado
Write-Host ""
Write-Host "============================================"
Write-Host "  Verificando servicios..."
Write-Host "============================================"

Start-Sleep -Seconds 3
try {
    $health = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "   Health: $($health.Content)"
} catch {
    Write-Host "   Esperando a que el sistema esté listo..."
}

Write-Host ""
Write-Host "=== Estado de contenedores ==="
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema iniciado correctamente"
Write-Host "============================================"
Write-Host "  URL: http://localhost"
Write-Host ""
Write-Host "  Comandos utiles:"
Write-Host "    Ver logs:     docker logs inventario-app"
Write-Host "    Detener:      .\stop-system.ps1"
Write-Host "    Estado:       .\status-system.ps1"
Write-Host "============================================"
