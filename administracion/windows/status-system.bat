@echo off
chcp 65001 >nul

echo ============================================
echo   Estado del Sistema de Inventario TCP
echo ============================================

:: Verificar contenedores
echo.
echo === CONTENEDORES ===
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>nul | findstr /i "NAME inventario"
if errorlevel 1 echo No hay contenedores activos

:: Verificar health
echo.
echo === HEALTH CHECK ===
curl -s http://localhost/api/health >nul 2>&1
if errorlevel 0 (
    curl -s http://localhost/api/health
) else (
    echo Sistema no accesible en http://localhost
)

:: Verificar backups
echo.
echo === BACKUPS ===
if exist ".\backups" (
    echo Directorio: %cd%\backups\
    dir /b /o-d .\backups\*.gz 2>nul | findstr /n "^" | findstr "^[1-5]:"
    if errorlevel 1 echo No hay backups
) else (
    echo Directorio de backups no existe
)

:: Uso de disco
echo.
echo === RECURSOS DOCKER ===
echo Imágenes:
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}" | findstr /i "tcp postgres nginx"

echo.
echo Volúmenes:
docker volume ls --format "  {{.Name}}" | findstr tcp

echo.
echo ============================================
