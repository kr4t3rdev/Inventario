@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: Backup de Base de Datos PostgreSQL
:: ============================================

:: Configuración
set BACKUP_DIR=.\backups
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\inventario_backup_%TIMESTAMP%.sql

:: Crear directorio de backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ============================================
echo   Backup de Base de Datos
echo ============================================
echo.
echo Archivo: %BACKUP_FILE%
echo.

:: Ejecutar backup usando pg_dump dentro del contenedor
echo Ejecutando pg_dump...
docker exec inventario-db pg_dump -U inventario -d inventario_db --clean --if-exists > "%BACKUP_FILE%"

:: Comprimir backup
echo Comprimiendo backup...
gzip "%BACKUP_FILE%" 2>nul
if exist "%BACKUP_FILE%.gz" (
    set BACKUP_FILE=%BACKUP_FILE%.gz
)

:: Mostrar información
echo.
echo ============================================
echo   Backup completado
echo ============================================
echo   Archivo: %BACKUP_FILE%
for %%f in ("%BACKUP_FILE%") do echo   Tamaño:  %%~zf bytes
echo   Fecha:   %date% %time%
echo ============================================

echo.
echo NOTA: Los backups antiguos deben limpiarse manualmente
echo       Ubicación: %BACKUP_DIR%
