@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: Exportar Sistema Completo para Transferencia
:: ============================================

set EXPORT_DIR=.\export
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set EXPORT_FILE=tcp_sistema_%TIMESTAMP%

echo ============================================
echo   Exportar Sistema para Transferencia
echo ============================================

:: Crear directorio de exportación
if not exist "%EXPORT_DIR%" mkdir "%EXPORT_DIR%"

echo.
echo [1/5] Exportando imágenes Docker...

:: Exportar imágenes
docker save tcp-app:latest -o "%EXPORT_DIR%\tcp-app.tar"
echo    OK tcp-app:latest

docker save tcp-nginx:latest -o "%EXPORT_DIR%\tcp-nginx.tar"
echo    OK tcp-nginx:latest

docker save postgres:16-alpine -o "%EXPORT_DIR%\postgres.tar"
echo    OK postgres:16-alpine

echo.
echo [2/5] Exportando configuración...

:: Copiar archivos de configuración
copy nginx.conf "%EXPORT_DIR%\" >nul
copy start-system.bat "%EXPORT_DIR%\" >nul
copy stop-system.bat "%EXPORT_DIR%\" >nul
copy create-admin.bat "%EXPORT_DIR%\" >nul
copy backup-db.bat "%EXPORT_DIR%\" >nul
copy restore-db.bat "%EXPORT_DIR%\" >nul
echo    OK Archivos de configuración

echo.
echo [3/5] Exportando base de datos...

:: Backup de la base de datos
docker exec inventario-db pg_dump -U inventario -d inventario_db --clean --if-exists > "%EXPORT_DIR%\database_backup.sql"
gzip "%EXPORT_DIR%\database_backup.sql"
echo    OK database_backup.sql.gz

echo.
echo [4/5] Creando script de importación...

:: Crear script de importación
(
echo @echo off
echo chcp 65001 ^>nul
echo echo ============================================
echo echo   Importar Sistema de Inventario TCP
echo echo ============================================
echo.
echo echo [1/4] Cargando imágenes Docker...
echo docker load -i tcp-app.tar
echo docker load -i tcp-nginx.tar
echo docker load -i postgres.tar
echo echo    OK Imágenes cargadas
echo.
echo echo [2/4] Iniciando sistema...
echo start-system.bat
echo.
echo echo [3/4] Esperando base de datos...
echo timeout /t 10 /nobreak ^>nul
echo :wait_db
echo docker exec inventario-db pg_isready -U inventario -d inventario_db ^>nul 2^>^&1
echo if errorlevel 1 ^(
echo     echo    Esperando...
echo     timeout /t 2 /nobreak ^>nul
echo     goto wait_db
echo ^)
echo echo    OK Base de datos lista
echo.
echo echo [4/4] Restaurando datos...
echo if exist database_backup.sql.gz ^(
echo     gzip -d -c database_backup.sql.gz ^| docker exec -i inventario-db psql -U inventario -d inventario_db
echo     echo    OK Datos restaurados
echo ^) else ^(
echo     echo    ADVERTENCIA: No se encontró backup de base de datos
echo ^)
echo.
echo echo ============================================
echo echo   Sistema importado correctamente
echo echo ============================================
echo echo   URL: http://localhost
echo echo.
echo echo   Para crear admin: create-admin.bat
echo echo ============================================
) > "%EXPORT_DIR%\import-system.bat"

echo    OK import-system.bat

echo.
echo [5/5] Creando archivo comprimido...

:: Crear archivo comprimido usando PowerShell
powershell -command "Compress-Archive -Path '%EXPORT_DIR%\*' -DestinationPath '%EXPORT_FILE%.zip' -Force"

echo.
echo ============================================
echo   Exportación completada
echo ============================================
echo   Archivo: %EXPORT_FILE%.zip
echo.
echo   Contenido:
echo     - Imágenes Docker (app, nginx, postgres)
echo     - Configuración nginx
echo     - Scripts de inicio/admin/backup
echo     - Backup de base de datos
echo     - Script de importación
echo.
echo   Para transferir a otro equipo:
echo     1. Copiar: %EXPORT_FILE%.zip
echo     2. Descomprimir
echo     3. Ejecutar: import-system.bat
echo ============================================

:: Limpiar archivos temporales
rmdir /s /q "%EXPORT_DIR%"
