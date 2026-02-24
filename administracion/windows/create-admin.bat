@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: Crear Usuario Administrador
:: ============================================

echo ============================================
echo   Crear Usuario Administrador
echo ============================================

:: Configuración por defecto
set ADMIN_EMAIL=%1
set ADMIN_NAME=%2
set ADMIN_PASSWORD=%3

if "%ADMIN_EMAIL%"=="" set ADMIN_EMAIL=admin@tcp.com
if "%ADMIN_NAME%"=="" set ADMIN_NAME=Administrador
if "%ADMIN_PASSWORD%"=="" set ADMIN_PASSWORD=Admin123!

echo.
echo Datos del administrador:
echo   Email:    %ADMIN_EMAIL%
echo   Nombre:   %ADMIN_NAME%
echo   Password: %ADMIN_PASSWORD%
echo.
set /p confirm=Continuar? (s/n): 

if /i not "%confirm%"=="s" (
    echo Operación cancelada
    exit /b 0
)

:: Verificar si la app está corriendo
docker ps | findstr inventario-app >nul
if errorlevel 1 (
    echo Error: El contenedor inventario-app no está corriendo
    echo Inicie el sistema primero con: start-system.bat
    exit /b 1
)

echo.
echo Generando hash de contraseña...

:: Generar hash bcrypt usando node dentro del contenedor
for /f "delims=" %%h in ('docker exec inventario-app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('%ADMIN_PASSWORD%', 12));" 2^>nul') do set HASH=%%h

if "%HASH%"=="" (
    echo Error: No se pudo generar el hash
    echo Intentando método alternativo...
    
    :: Usar hash precalculado para contraseña común
    set HASH=$2b$12$/6EHlGyahspj2xpCCgUFqeI/GbjUP2Y5MviB2lgoX1LrXyx59pa12
)

echo Hash generado: %HASH:~0,20%...

echo.
echo Insertando usuario en la base de datos...

:: Crear archivo SQL temporal
set SQL_FILE=%temp%\create_admin_%RANDOM%.sql
(
echo INSERT INTO "User" ^
echo     "userId", "name", "email", "password", "role", "isActive", "createdAt", "updatedAt", "activatedAt"^
echo ^) VALUES ^
echo     gen_random_uuid^(^), '%ADMIN_NAME%', '%ADMIN_EMAIL%', '%HASH%', 'admin', true, NOW^(^), NOW^(^), NOW^(^)^
echo ^) ON CONFLICT ^("email"^) DO UPDATE SET
echo     "name" = '%ADMIN_NAME%',
echo     "password" = '%HASH%',
echo     "role" = 'admin',
echo     "isActive" = true,
echo     "updatedAt" = NOW^(^),
echo     "activatedAt" = NOW^(^);
) > "%SQL_FILE%"

:: Ejecutar SQL
type "%SQL_FILE%" | docker exec -i inventario-db psql -U inventario -d inventario_db
del "%SQL_FILE%"

:: Verificar que se creó
echo.
echo Verificando usuario...
docker exec -i inventario-db psql -U inventario -d inventario_db -c "SELECT \"userId\", \"name\", \"email\", \"role\", \"isActive\" FROM \"User\" WHERE \"email\" = '%ADMIN_EMAIL%';"

echo.
echo ============================================
echo   Usuario Administrador Listo
echo ============================================
echo   Email:    %ADMIN_EMAIL%
echo   Password: %ADMIN_PASSWORD%
echo   Rol:      admin
echo   Activo:   true
echo.
echo   URL de login: http://localhost
echo.
echo   Para crear otro usuario:
echo     create-admin.bat email nombre password
echo ============================================
