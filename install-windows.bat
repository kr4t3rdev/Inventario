@echo off
chcp 65001 >nul
echo ======================================
echo Instalador FinanceTCP para Windows
echo ======================================
echo.

REM Verificar Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker no está instalado.
    echo Por favor instala Docker Desktop desde: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [1/5] Verificando Docker Desktop...
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop no está corriendo.
    echo Por favor inicia Docker Desktop primero.
    pause
    exit /b 1
)
echo ✅ Docker Desktop está corriendo
echo.

REM Cargar imágenes
echo [2/5] Cargando imágenes Docker...
echo Cargando tcp-app.tar (esto puede tomar varios minutos)...
docker load -i tcp-app.tar
echo Cargando tcp-nginx.tar...
docker load -i tcp-nginx.tar
echo Cargando tcp-postgres.tar...
docker load -i tcp-postgres.tar
echo ✅ Imágenes cargadas
echo.

REM Copiar configuración
echo [3/5] Configurando entorno...
if not exist .env (
    copy .env.windows .env
    echo ✅ Archivo .env creado
) else (
    echo ℹ️  .env ya existe, usando configuración existente
)
echo.

REM Iniciar contenedores
echo [4/5] Iniciando contenedores...
docker-compose -f docker-compose.windows.yml up -d db
timeout /t 10 /nobreak >nul
docker-compose -f docker-compose.windows.yml up -d app
timeout /t 20 /nobreak >nul
docker-compose -f docker-compose.windows.yml up -d nginx
echo ✅ Contenedores iniciados
echo.

REM Verificar
echo [5/5] Verificando instalación...
timeout /t 5 /nobreak >nul

curl -s http://localhost/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Instalación exitosa!
    echo.
    echo ======================================
    echo FinanceTCP está corriendo en:
    echo http://localhost
    echo ======================================
    echo.
    echo Comandos útiles:
    echo   docker-compose -f docker-compose.windows.yml ps
echo   docker-compose -f docker-compose.windows.yml logs -f
    echo   docker exec inventario-db psql -U postgres -d TCPBD -c "SELECT * FROM ""User"";"
) else (
    echo ⚠️  La aplicación está iniciando...
    echo Espera 30 segundos más y verifica: docker-compose -f docker-compose.windows.yml ps
)

echo.
pause
