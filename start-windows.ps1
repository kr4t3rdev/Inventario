# ============================================
# Iniciar Sistema TCP en Windows
# ============================================

Write-Host "============================================"
Write-Host "  Sistema de Inventario TCP"
Write-Host "============================================"

# Verificar que las imágenes existen
Write-Host ""
Write-Host "[1/4] Verificando imágenes..."

$images = @("tcp-app:latest", "tcp-nginx:latest", "postgres:16-alpine")
foreach ($img in $images) {
    $exists = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String $img
    if (-not $exists) {
        Write-Host "   ERROR Falta imagen: $img"
        Write-Host "   Ejecuta: .\import-windows.ps1"
        exit 1
    }
    Write-Host "   OK $img"
}

# Crear red si no existe
Write-Host ""
Write-Host "[2/4] Configurando red..."
docker network create tcp_app-network 2>$null
Write-Host "   OK"

# Iniciar contenedores
Write-Host ""
Write-Host "[3/4] Iniciando servicios..."

# PostgreSQL
$dbStatus = docker ps -a --filter "name=inventario-db" --format "{{.Status}}" 2>$null
if ($dbStatus -match "Up") {
    Write-Host "   OK PostgreSQL ya corre"
} elseif ($dbStatus -match "Exited") {
    docker start inventario-db
    Write-Host "   OK PostgreSQL iniciado"
} else {
    docker run -d --name inventario-db `
        --network tcp_app-network `
        -e POSTGRES_USER=inventario `
        -e POSTGRES_PASSWORD=inventario123 `
        -e POSTGRES_DB=inventario_db `
        -v tcp_postgres_data:/var/lib/postgresql/data `
        postgres:16-alpine
    Write-Host "   OK PostgreSQL creado"
    
    Start-Sleep -Seconds 5
    do {
        $ready = docker exec inventario-db pg_isready -U inventario -d inventario_db 2>$null
        Start-Sleep -Seconds 2
    } until ($ready)
}

# App
$appStatus = docker ps -a --filter "name=inventario-app" --format "{{.Status}}" 2>$null
if ($appStatus -match "Up") {
    Write-Host "   OK App ya corre"
} elseif ($appStatus -match "Exited") {
    docker start inventario-app
    Write-Host "   OK App iniciada"
} else {
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
    Write-Host "   OK App creada"
}

# Nginx (sin montar archivo, usa config de la imagen)
$nginxStatus = docker ps -a --filter "name=inventario-nginx" --format "{{.Status}}" 2>$null
if ($nginxStatus -match "Up") {
    Write-Host "   OK Nginx ya corre"
} elseif ($nginxStatus -match "Exited") {
    docker start inventario-nginx
    Write-Host "   OK Nginx iniciado"
} else {
    docker run -d --name inventario-nginx `
        --network tcp_app-network `
        -p 80:80 `
        tcp-nginx:latest
    Write-Host "   OK Nginx creado"
}

# Verificar
Write-Host ""
Write-Host "[4/4] Verificando..."
Start-Sleep -Seconds 3

$health = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing 2>$null
if ($health.StatusCode -eq 200) {
    Write-Host "   OK Sistema funcionando"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Sistema iniciado"
Write-Host "============================================"
Write-Host ""
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
Write-Host ""
Write-Host "  URL: http://localhost"
Write-Host "============================================"
