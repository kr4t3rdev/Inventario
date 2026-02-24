@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo   Sistema de Inventario TCP
echo ============================================

:: 1. Verificar imágenes
echo.
echo [1/6] Verificando imágenes...
for %%i in ("tcp-app:latest" "tcp-nginx:latest" "postgres:16-alpine") do (
    docker images --format "{{.Repository}}:{{.Tag}}" | findstr /x "%%~i" >nul
    if !errorlevel! equ 0 (
        echo    OK %%~i
    ) else (
        echo    ERROR: %%~i no encontrada
        exit /b 1
    )
)

:: 2. Crear red y volúmenes
echo.
echo [2/6] Creando red y volúmenes...
docker network create tcp_app-network 2>nul
docker volume create tcp_postgres_data 2>nul
echo    OK Red y volúmenes listos

:: 3. Detener contenedores existentes
echo.
echo [3/6] Deteniendo contenedores existentes...
docker stop inventario-nginx inventario-app inventario-db 2>nul
docker rm inventario-nginx inventario-app inventario-db 2>nul
echo    OK Contenedores eliminados

:: 4. Iniciar PostgreSQL
echo.
echo [4/6] Iniciando PostgreSQL...
docker run -d --name inventario-db ^
    --network tcp_app-network ^
    -e POSTGRES_USER=inventario ^
    -e POSTGRES_PASSWORD=inventario123 ^
    -e POSTGRES_DB=inventario_db ^
    -v tcp_postgres_data:/var/lib/postgresql/data ^
    postgres:16-alpine

echo    Esperando a que PostgreSQL esté listo...
timeout /t 5 /nobreak >nul
:wait_pg
docker exec inventario-db pg_isready -U inventario -d inventario_db >nul 2>&1
if errorlevel 1 (
    echo    Esperando...
    timeout /t 2 /nobreak >nul
    goto wait_pg
)
echo    OK PostgreSQL listo

:: 5. Iniciar aplicación
echo.
echo [5/6] Iniciando aplicación...
docker run -d --name inventario-app ^
    --network tcp_app-network ^
    -e NODE_ENV=production ^
    -e DATABASE_URL="postgresql://inventario:inventario123@inventario-db:5432/inventario_db?schema=public" ^
    -e JWT_SECRET="jwt_secret_muy_seguro_cambiar_en_produccion_12345678" ^
    -e NEXTAUTH_SECRET="nextauth_secret_muy_seguro_cambiar_en_produccion_12345678" ^
    -e NEXTAUTH_URL="http://localhost" ^
    -e PORT=3000 ^
    -e HOSTNAME="0.0.0.0" ^
    --entrypoint "/bin/sh" ^
    tcp-app:latest ^
    -c "cd /app/.next/standalone && mkdir -p .next && cp -r /app/.next/static .next/ && cp -r /app/public . && node server.js"

timeout /t 5 /nobreak >nul
echo    OK Aplicación iniciada

:: 6. Iniciar Nginx
echo.
echo [6/6] Iniciando Nginx...
docker run -d --name inventario-nginx ^
    --network tcp_app-network ^
    -p 80:80 ^
    -v "%cd%\nginx.conf:/etc/nginx/conf.d/app.conf:ro" ^
    tcp-nginx:latest

timeout /t 2 /nobreak >nul
echo    OK Nginx iniciado

:: Verificar estado
echo.
echo ============================================
echo   Verificando servicios...
echo ============================================

timeout /t 3 /nobreak >nul

echo.
echo === Estado de contenedores ===
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ============================================
echo   Sistema iniciado correctamente
echo ============================================
echo   URL: http://localhost
echo.
echo   Comandos útiles:
echo     Ver logs:     docker logs inventario-app
echo     Detener:      stop-system.bat
echo     Reiniciar:    start-system.bat
echo ============================================
