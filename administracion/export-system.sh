#!/bin/bash

# ============================================
# Exportar Sistema Completo para Transferencia
# ============================================

set -e

EXPORT_DIR="./export"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="tcp_sistema_${TIMESTAMP}"

echo "============================================"
echo "  Exportar Sistema para Transferencia"
echo "============================================"

# Crear directorio de exportación
mkdir -p "${EXPORT_DIR}"

echo ""
echo "[1/5] Exportando imágenes Docker..."

# Exportar imágenes
docker save tcp-app:latest -o "${EXPORT_DIR}/tcp-app.tar"
echo "   ✓ tcp-app:latest"

docker save tcp-nginx:latest -o "${EXPORT_DIR}/tcp-nginx.tar"
echo "   ✓ tcp-nginx:latest"

docker save postgres:16-alpine -o "${EXPORT_DIR}/postgres.tar"
echo "   ✓ postgres:16-alpine"

echo ""
echo "[2/5] Exportando configuración..."

# Copiar archivos de configuración
cp nginx.conf "${EXPORT_DIR}/"
cp Dockerfile.nginx-windows "${EXPORT_DIR}/" 2>/dev/null || echo "FROM nginx:alpine`nRUN rm -f /etc/nginx/conf.d/default.conf`nCOPY nginx.conf /etc/nginx/conf.d/default.conf`nEXPOSE 80`nCMD [\"nginx\", \"-g\", \"daemon off;\"]" > "${EXPORT_DIR}/Dockerfile.nginx-windows"

# Scripts Linux/Mac
cp start-system.sh "${EXPORT_DIR}/" 2>/dev/null || true
cp stop-system.sh "${EXPORT_DIR}/" 2>/dev/null || true
cp create-admin.sh "${EXPORT_DIR}/" 2>/dev/null || true
cp backup-db.sh "${EXPORT_DIR}/" 2>/dev/null || true
cp restore-db.sh "${EXPORT_DIR}/" 2>/dev/null || true
cp setup-auto-backup.sh "${EXPORT_DIR}/" 2>/dev/null || true

# Scripts Windows
cp start-windows.ps1 "${EXPORT_DIR}/" 2>/dev/null || true
cp stop-windows.ps1 "${EXPORT_DIR}/" 2>/dev/null || true
cp create-admin-windows.ps1 "${EXPORT_DIR}/" 2>/dev/null || true
cp import-windows.ps1 "${EXPORT_DIR}/" 2>/dev/null || true

echo "   ✓ Archivos de configuración (Linux/Mac/Windows)"

echo ""
echo "[3/5] Exportando base de datos..."

# Determinar el nombre del contenedor de base de datos
DB_CONTAINER=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    DB_CONTAINER="tcp-sistema"
else
    DB_CONTAINER="inventario-db"
fi

# Backup de la base de datos
docker exec $DB_CONTAINER pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > "${EXPORT_DIR}/database_backup.sql"
gzip "${EXPORT_DIR}/database_backup.sql"
echo "   ✓ database_backup.sql.gz"

echo ""
echo "[4/5] Creando script de importación..."

# Crear script de importación
cat > "${EXPORT_DIR}/import-system.sh" << 'IMPORT_SCRIPT'
#!/bin/bash

# ============================================
# Importar Sistema de Inventario TCP
# ============================================

set -e

echo "============================================"
echo "  Importar Sistema de Inventario TCP"
echo "============================================"

# 1. Cargar imágenes
echo ""
echo "[1/4] Cargando imágenes Docker..."
docker load -i tcp-app.tar
docker load -i tcp-nginx.tar
docker load -i postgres.tar
echo "   ✓ Imágenes cargadas"

# 2. Iniciar el sistema
echo ""
echo "[2/4] Iniciando sistema..."
chmod +x start-system.sh
./start-system.sh

# 3. Esperar a que PostgreSQL esté listo
echo ""
echo "[3/4] Esperando base de datos..."
sleep 10
until docker exec inventario-db pg_isready -U inventario -d inventario_db; do
    echo "   Esperando..."
    sleep 2
done
echo "   ✓ Base de datos lista"

# 4. Restaurar datos (si existe backup)
echo ""
echo "[4/4] Restaurando datos..."
if [ -f database_backup.sql.gz ]; then
    gunzip -c database_backup.sql.gz | docker exec -i inventario-db psql -U inventario -d inventario_db
    echo "   ✓ Datos restaurados"
else
    echo "   ⚠ No se encontró backup de base de datos"
fi

echo ""
echo "============================================"
echo "  ✓ Sistema importado correctamente"
echo "============================================"
echo "  URL: http://localhost"
echo ""
echo "  Para crear admin: ./create-admin.sh"
echo "============================================"
IMPORT_SCRIPT

chmod +x "${EXPORT_DIR}/import-system.sh"
echo "   ✓ import-system.sh"

echo ""
echo "[5/5] Creando archivo comprimido..."

# Crear archivo comprimido final
cd "${EXPORT_DIR}"
tar -czf "../${EXPORT_FILE}.tar.gz" *
cd ..

# Calcular tamaño
SIZE=$(du -h "${EXPORT_FILE}.tar.gz" | cut -f1)

echo ""
echo "============================================"
echo "  ✓ Exportación completada"
echo "============================================"
echo "  Archivo: ${EXPORT_FILE}.tar.gz"
echo "  Tamaño:  ${SIZE}"
echo ""
echo "  Contenido:"
echo "    - Imágenes Docker (app, nginx, postgres)"
echo "    - Configuración nginx"
echo "    - Scripts de inicio/admin/backup"
echo "    - Backup de base de datos"
echo "    - Script de importación"
echo ""
echo "  Para transferir a otro equipo:"
echo ""
echo "    LINUX/MAC:"
echo "      1. Copiar: ${EXPORT_FILE}.tar.gz"
echo "      2. Descomprimir: tar -xzf ${EXPORT_FILE}.tar.gz"
echo "      3. Ejecutar: ./import-system.sh"
echo ""
echo "    WINDOWS (PowerShell):"
echo "      1. Copiar: ${EXPORT_FILE}.tar.gz"
echo "      2. Descomprimir: tar -xzf ${EXPORT_FILE}.tar.gz"
echo "      3. Ejecutar: .\import-windows.ps1"
echo "============================================"

# Limpiar archivos temporales
rm -rf "${EXPORT_DIR}"
