@echo off
chcp 65001 >nul

:: ============================================
:: Build de imagen unificada (todo en uno)
:: ============================================

echo ============================================
echo   Creando imagen unificada TCP
echo ============================================

:: Crear directorio de logs
if not exist logs mkdir logs

:: Construir imagen
echo.
echo [1/2] Construyendo imagen docker-tcp:latest...
docker build -t docker-tcp:latest -f Dockerfile.unified .
if errorlevel 1 (
    echo ERROR: No se pudo construir la imagen
    exit /b 1
)

:: Exportar imagen
echo.
echo [2/2] Exportando imagen a docker-tcp.tar...
docker save -o docker-tcp.tar docker-tcp:latest

echo.
echo ============================================
echo   Imagen creada correctamente
echo ============================================
dir docker-tcp.tar
echo.
echo Para ejecutar:
echo   docker load -i docker-tcp.tar
echo   docker run -d -p 80:80 --name tcp-sistema docker-tcp:latest
echo.
