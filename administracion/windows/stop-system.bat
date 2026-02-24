@echo off
chcp 65001 >nul

echo ============================================
echo   Deteniendo Sistema de Inventario TCP
echo ============================================

echo.
echo Deteniendo contenedores...
docker stop inventario-nginx inventario-app inventario-db 2>nul

echo Eliminando contenedores...
docker rm inventario-nginx inventario-app inventario-db 2>nul

echo.
echo ============================================
echo   Sistema detenido
echo ============================================
echo.
echo   Para iniciar nuevamente: start-system.bat
echo   Para eliminar datos: docker volume rm tcp_postgres_data
echo ============================================
