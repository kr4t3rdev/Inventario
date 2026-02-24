@echo off
chcp 65001 >nul

echo.
echo ============================================
echo   Sistema de Inventario TCP - Comandos
echo ============================================
echo.
echo GESTIÓN DEL SISTEMA:
echo   start-system.bat       Iniciar todos los servicios
echo   stop-system.bat        Detener todos los servicios
echo   status-system.bat      Ver estado del sistema
echo.
echo USUARIOS:
echo   create-admin.bat                    Crear admin (interactivo)
echo   create-admin.bat email nombre pass  Crear admin (directo)
echo.
echo BACKUP Y RESTAURACIÓN:
echo   backup-db.bat          Crear backup de la BD
echo   restore-db.bat         Restaurar backup (más reciente)
echo   restore-db.bat file    Restaurar backup específico
echo.
echo EXPORTAR/IMPORTAR:
echo   export-system.bat      Exportar todo para transferir
echo   build-offline.bat      Crear imágenes para transferir
echo.
echo UBICACIONES:
echo   Backups:    .\backups\
echo   Logs:       .\logs\
echo   Export:     .\tcp_sistema_*.tar.gz
echo.
echo COMANDOS DOCKER ÚTILES:
echo   docker ps                     Ver contenedores activos
echo   docker logs inventario-app    Ver logs de la app
echo   docker logs inventario-app -f Ver logs en tiempo real
echo   docker exec -it inventario-db psql -U inventario -d inventario_db
echo                                 Acceder a la BD
echo.
echo ============================================
