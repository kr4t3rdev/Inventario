@echo off
chcp 65001 >nul

:: ============================================
:: Script para crear imágenes Docker SIN internet
:: ============================================

echo ============================================
echo   Crear bundle de imágenes Docker
echo ============================================

:: 1. Construir imagen de la app
echo [1/4] Construyendo imagen de la app...
docker build -t tcp-app:latest . -f Dockerfile.offline
if errorlevel 1 (
    echo ERROR: No se pudo construir la imagen
    exit /b 1
)

:: 2. Cargar imágenes base
echo [2/4] Cargando imágenes base...
if exist tcp-postgres.tar docker load -i tcp-postgres.tar
if exist tcp-nginx.tar docker load -i tcp-nginx.tar

:: 3. Exportar imágenes a archivos tar
echo [3/4] Exportando imágenes a archivos tar...
docker save -o tcp-app.tar tcp-app:latest
docker save -o tcp-postgres.tar postgres:16-alpine 2>nul || echo   Usando imagen existente de postgres
docker save -o tcp-nginx.tar tcp-nginx:latest 2>nul || echo   Usando imagen existente de nginx

echo.
echo ============================================
echo   Imágenes creadas:
echo ============================================
dir /b tcp-*.tar
echo.
echo Para transferir a otro equipo, copia estos archivos:
echo   - tcp-app.tar
echo   - tcp-postgres.tar
echo   - tcp-nginx.tar
echo.
echo Luego en el otro equipo ejecuta: start-offline.bat
