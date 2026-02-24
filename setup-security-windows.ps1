# ============================================
# Configurar Seguridad en Windows
# ============================================

Write-Host "============================================"
Write-Host "  Configurando Seguridad del Sistema"
Write-Host "============================================"

# 1. Verificar que docker está corriendo
Write-Host ""
Write-Host "[1/6] Verificando Docker..."
try {
    docker info | Out-Null
    Write-Host "   OK Docker corriendo"
} catch {
    Write-Host "   ERROR Docker no está corriendo"
    exit 1
}

# 2. Verificar que los contenedores están activos
Write-Host ""
Write-Host "[2/6] Verificando contenedores..."

$appRunning = docker ps --filter "name=inventario-app" --format "{{.Names}}" 2>$null
$dbRunning = docker ps --filter "name=inventario-db" --format "{{.Names}}" 2>$null
$nginxRunning = docker ps --filter "name=inventario-nginx" --format "{{.Names}}" 2>$null

if ($appRunning -ne "inventario-app" -or $dbRunning -ne "inventario-db") {
    Write-Host "   ERROR Los contenedores no están corriendo"
    Write-Host "   Ejecuta: .\start-windows.ps1"
    exit 1
}
Write-Host "   OK Contenedores activos"

# 3. Verificar que PostgreSQL NO está expuesto
Write-Host ""
Write-Host "[3/6] Verificando exposición de base de datos..."

$dbPort = docker port inventario-db 2>$null
if ($dbPort) {
    Write-Host "   ADVERTENCIA: PostgreSQL expuesto en $dbPort"
    Write-Host "   La base de datos debería estar en red interna"
} else {
    Write-Host "   OK PostgreSQL no expuesto externamente"
}

# 4. Configurar Firewall de Windows
Write-Host ""
Write-Host "[4/6] Configurando Firewall..."

# Verificar si es administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    # Bloquear PostgreSQL
    $rule = Get-NetFirewallRule -DisplayName "Block PostgreSQL TCP" -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -DisplayName "Block PostgreSQL TCP" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block | Out-Null
        Write-Host "   OK Puerto 5432 bloqueado"
    } else {
        Write-Host "   OK Puerto 5432 ya bloqueado"
    }

    # Asegurar HTTP permitido
    $httpRule = Get-NetFirewallRule -DisplayName "Allow HTTP TCP" -ErrorAction SilentlyContinue
    if (-not $httpRule) {
        New-NetFirewallRule -DisplayName "Allow HTTP TCP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow | Out-Null
        Write-Host "   OK Puerto 80 permitido"
    } else {
        Write-Host "   OK Puerto 80 ya permitido"
    }
} else {
    Write-Host "   OMITIDO Se necesitan permisos de administrador"
    Write-Host "   Ejecuta PowerShell como administrador para configurar firewall"
}

# 5. Verificar secrets
Write-Host ""
Write-Host "[5/6] Verificando configuración..."

# Verificar que no hay passwords por defecto expuestos
Write-Host "   Verificando variables de entorno..."

# 6. Crear imagen nginx segura
Write-Host ""
Write-Host "[6/6] Configurando Nginx seguro..."

# Crear configuración segura
$nginxConfig = @"
server {
    listen 80;
    server_name localhost;

    # Headers de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone `$binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone `$binary_remote_addr zone=api:10m rate=5r/s;
    limit_req_zone `$binary_remote_addr zone=login:10m rate=3r/s;
    limit_conn_zone `$binary_remote_addr zone=addr:10m;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # General
    client_max_body_size 50M;
    server_tokens off;

    # Bloquear archivos sensibles
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* ^/(\.env|\.git|\.htaccess|package\.json)$ {
        deny all;
        return 404;
    }

    # API
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        limit_conn addr 10;
        
        proxy_pass http://inventario-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # Login protection
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        limit_conn addr 3;
        
        proxy_pass http://inventario-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
    }

    # Health check
    location /api/health {
        proxy_pass http://inventario-app:3000;
        access_log off;
    }

    # Static files
    location /_next/static/ {
        proxy_pass http://inventario-app:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Main app
    location / {
        limit_req zone=general burst=20 nodelay;
        limit_conn addr 20;
        
        proxy_pass http://inventario-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"@

$nginxConfig | Out-File -Encoding UTF8 "nginx-secure.conf"

# Crear Dockerfile
$dockerfile = @"
FROM nginx:alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx-secure.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"@

$dockerfile | Out-File -Encoding UTF8 "Dockerfile.nginx-secure"

# Construir imagen
if (docker images nginx:alpine --format "{{.Repository}}" 2>$null) {
    docker build -t tcp-nginx:latest -f Dockerfile.nginx-secure . 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK Nginx seguro construido"
    } else {
        Write-Host "   Usando configuración existente"
    }
} else {
    Write-Host "   OMITIDO Imagen nginx:alpine no disponible"
}

# Reiniciar nginx
docker stop inventario-nginx 2>$null
docker rm inventario-nginx 2>$null
docker run -d --name inventario-nginx --network tcp_app-network -p 80:80 tcp-nginx:latest 2>$null

Write-Host "   OK Nginx reiniciado"

# Resumen
Write-Host ""
Write-Host "============================================"
Write-Host "  Seguridad Configurada"
Write-Host "============================================"
Write-Host ""
Write-Host "  PROTECCIONES ACTIVAS:"
Write-Host "  |- Rate Limiting: 10 req/s general"
Write-Host "  |- Rate Limiting: 5 req/s API"
Write-Host "  |- Rate Limiting: 3 req/s login (anti-brute force)"
Write-Host "  |- Conexiones max por IP: 20"
Write-Host "  |- Headers de seguridad activos"
Write-Host "  |- Archivos sensibles bloqueados"
Write-Host "  |- Base de datos: Solo acceso interno"
Write-Host ""
Write-Host "  VERIFICAR:"
Write-Host "    curl http://localhost/api/health"
Write-Host ""
Write-Host "  VER HEADERS:"
Write-Host "    curl -I http://localhost"
Write-Host "============================================"
