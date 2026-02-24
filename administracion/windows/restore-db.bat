@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: Restaurar Backup de Base de Datos PostgreSQL
:: ============================================

set BACKUP_DIR=.\backups

echo ============================================
echo   Restaurar Backup de Base de Datos
echo ============================================

:: Listar backups disponibles
echo.
echo Backups disponibles:
echo.
dir /b /o-d "%BACKUP_DIR%\*.gz" 2>nul
if errorlevel 1 echo   No hay backups disponibles
echo.

:: Si se pasa un archivo como argumento
if not "%~1"=="" (
    set BACKUP_FILE=%~1
) else (
    :: Usar el más reciente
    for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\*.gz" 2^>nul') do (
        set BACKUP_FILE=%BACKUP_DIR%\%%f
        goto :found
    )
    echo Error: No se encontraron backups
    exit /b 1
    :found
    echo Usando backup más reciente: !BACKUP_FILE!
)

echo.
echo ADVERTENCIA: Esto ELIMINARA todos los datos actuales
echo.
set /p confirm=Continuar? (s/n): 

if /i not "%confirm%"=="s" (
    echo Operación cancelada
    exit /b 0
)

:: Descomprimir si es necesario
if "%BACKUP_FILE:~-3%"==".gz" (
    echo.
    echo Descomprimiendo backup...
    set SQL_FILE=!BACKUP_FILE:~0,-3!
    gzip -d -c "!BACKUP_FILE!" > "!SQL_FILE!"
) else (
    set SQL_FILE=!BACKUP_FILE!
)

:: Restaurar
echo.
echo Restaurando base de datos...
type "!SQL_FILE!" | docker exec -i inventario-db psql -U inventario -d inventario_db

:: Limpiar archivo temporal
if "%BACKUP_FILE:~-3%"==".gz" del "!SQL_FILE!"

echo.
echo ============================================
echo   Restauración completada
echo ============================================
echo   Archivo restaurado: %BACKUP_FILE%
echo   Fecha: %date% %time%
echo ============================================
