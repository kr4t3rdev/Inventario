#!/bin/bash

# ============================================
# Backup de Base de Datos PostgreSQL
# ============================================

set -e

# Configuración
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/inventario_backup_${TIMESTAMP}.sql"

# Crear directorio de backups
mkdir -p "${BACKUP_DIR}"

echo "============================================"
echo "  Backup de Base de Datos"
echo "============================================"
echo ""
echo "Archivo: ${BACKUP_FILE}"
echo ""

# Ejecutar backup usando pg_dump dentro del contenedor
echo "Ejecutando pg_dump..."

# Determinar el nombre del contenedor de base de datos
DB_CONTAINER=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    DB_CONTAINER="tcp-sistema"
else
    DB_CONTAINER="inventario-db"
fi

docker exec $DB_CONTAINER pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > "${BACKUP_FILE}"

# Comprimir backup
echo "Comprimiendo backup..."
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Mostrar información
echo ""
echo "============================================"
echo "  ✓ Backup completado"
echo "============================================"
echo "  Archivo: ${BACKUP_FILE}"
echo "  Tamaño:  $(du -h "${BACKUP_FILE}" | cut -f1)"
echo "  Fecha:   $(date)"
echo "============================================"

# Limpiar backups antiguos (mantener últimos 30 días)
echo ""
echo "Limpiando backups antiguos..."
find "${BACKUP_DIR}" -name "*.gz" -type f -mtime +30 -delete 2>/dev/null || true
echo "✓ Limpieza completada"
