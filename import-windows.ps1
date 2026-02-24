# ============================================
# Importar Sistema TCP en Windows
# ============================================

Write-Host "============================================"
Write-Host "  Importar Sistema de Inventario TCP"
Write-Host "============================================"

# Verificar que Docker está corriendo
Write-Host ""
Write-Host "[1/6] Verificando Docker..."
try {
    docker info | Out-Null
    Write-Host "   OK Docker está corriendo"
} catch {
    Write-Host "   ERROR Docker no está corriendo. Inicia Docker Desktop."
    exit 1
}

# Cargar imágenes
Write-Host ""
Write-Host "[2/6] Cargando imágenes Docker..."

if (Test-Path "tcp-app.tar") {
    docker load -i tcp-app.tar
    Write-Host "   OK tcp-app:latest"
} else {
    Write-Host "   ERROR No se encuentra tcp-app.tar"
    exit 1
}

if (Test-Path "postgres.tar") {
    docker load -i postgres.tar
    Write-Host "   OK postgres:16-alpine"
} else {
    Write-Host "   ERROR No se encuentra postgres.tar"
    exit 1
}

# Cargar o construir nginx
Write-Host ""
Write-Host "[3/6] Configurando Nginx..."

if (Test-Path "tcp-nginx.tar") {
    docker load -i tcp-nginx.tar
    Write-Host "   OK tcp-nginx:latest"
} elseif (Test-Path "nginx.conf") {
    Write-Host "   Construyendo imagen nginx con configuracion..."
    docker build -t tcp-nginx:latest -f Dockerfile.nginx-windows .
    Write-Host "   OK nginx construido"
} else {
    Write-Host "   ERROR No se encuentra tcp-nginx.tar ni nginx.conf"
    exit 1
}

# Crear red y volumen
Write-Host ""
Write-Host "[4/6] Creando red y volúmenes..."
docker network create tcp_app-network 2>$null
docker volume create tcp_postgres_data 2>$null
Write-Host "   OK Red y volúmenes creados"

# Iniciar PostgreSQL
Write-Host ""
Write-Host "[5/6] Iniciando PostgreSQL..."
docker stop inventario-db 2>$null
docker rm inventario-db 2>$null

docker run -d --name inventario-db `
    --network tcp_app-network `
    -e POSTGRES_USER=inventario `
    -e POSTGRES_PASSWORD=inventario123 `
    -e POSTGRES_DB=inventario_db `
    -v tcp_postgres_data:/var/lib/postgresql/data `
    postgres:16-alpine

Write-Host "   Esperando PostgreSQL..."
Start-Sleep -Seconds 5

$retries = 0
do {
    $ready = docker exec inventario-db pg_isready -U inventario -d inventario_db 2>$null
    Start-Sleep -Seconds 2
    $retries++
} until ($ready -or $retries -gt 15)

if ($retries -gt 15) {
    Write-Host "   ERROR PostgreSQL no inicia"
    exit 1
}
Write-Host "   OK PostgreSQL listo"

# Iniciar App
Write-Host ""
Write-Host "[6/6] Iniciando servicios..."
docker stop inventario-app 2>$null
docker rm inventario-app 2>$null

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
Write-Host "   OK Aplicación iniciada"

# Iniciar Nginx (sin montar archivo)
docker stop inventario-nginx 2>$null
docker rm inventario-nginx 2>$null

docker run -d --name inventario-nginx `
    --network tcp_app-network `
    -p 80:80 `
    tcp-nginx:latest

Start-Sleep -Seconds 2
Write-Host "   OK Nginx iniciado"

# Restaurar base de datos si existe backup
if (Test-Path "database_backup.sql.gz") {
    Write-Host ""
    Write-Host "Restaurando base de datos..."
    
    # Crear archivo temporal descomprimido
    $tempFile = "database_backup_temp.sql"
    
    # Usar gzip de Alpine
    docker run --rm -v "${PWD}:/data" -w /data alpine sh -c "gunzip -c database_backup.sql.gz > database_backup_temp.sql"
    
    if (Test-Path $tempFile) {
        Get-Content $tempFile | docker exec -i inventario-db psql -U inventario -d inventario_db 2>$null
        Remove-Item $tempFile
        Write-Host "   OK Datos restaurados"
    }
}

# Verificar
Write-Host ""
Start-Sleep -Seconds 3

Write-Host "============================================"
Write-Host "  Sistema iniciado correctamente"
Write-Host "============================================"
Write-Host ""
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
Write-Host ""
Write-Host "  URL: http://localhost"
Write-Host ""
Write-Host "  Para crear admin: .\create-admin-windows.ps1"
Write-Host "============================================"
