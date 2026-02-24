@echo off
chcp 65001 >nul

:: ============================================
:: Configurar Backups Diarios Automáticos (Windows)
:: ============================================

echo ============================================
echo   Configurar Backups Diarios Automáticos
:: ============================================

:: Obtener ruta del script
set SCRIPT_DIR=%~dp0
set BACKUP_SCRIPT=%SCRIPT_DIR%backup-db.bat
set BACKUP_DIR=%SCRIPT_DIR%backups

:: Crear directorio de backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo.
echo Directorio del proyecto: %SCRIPT_DIR%
echo Directorio de backups:   %BACKUP_DIR%
echo.
echo Configurando backup diario en Windows (Task Scheduler)...
echo.

:: Crear tarea programada
schtasks /create /tn "TCP_Inventario_Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc daily /st 02:00 /f

if errorlevel 1 (
    echo ERROR: No se pudo crear la tarea programada
    echo.
    echo Intente ejecutar como Administrador
    exit /b 1
)

echo.
echo ============================================
echo   Backup diario configurado (Windows)
echo ============================================
echo   Hora:      02:00 AM diario
echo   Ubicación: %BACKUP_DIR%\
echo.
echo   Comandos útiles:
echo     Ver tareas:   schtasks /query /tn "TCP_Inventario_Backup"
echo     Ejecutar:     schtasks /run /tn "TCP_Inventario_Backup"
echo     Detener:      schtasks /delete /tn "TCP_Inventario_Backup" /f
echo     Modificar:    schtasks /change /tn "TCP_Inventario_Backup" /st 03:00
echo ============================================
