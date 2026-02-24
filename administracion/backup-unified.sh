#!/bin/bash

# ============================================
# Backup de Base de Datos - Sistema Unificado
# ============================================

set -e

BACKUP_DIR="${1:-./backups}"
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

# Verificar que el contenedor existe
if ! docker ps --format "{{.Names}}" | grep -q "^tcp-sistema$"; then
    echo "ERROR: El contenedor tcp-sistema no esta corriendo"
    exit 1
fi

echo "Ejecutando pg_dump..."
docker exec tcp-sistema pg_dump "postgresql://inventario:inventario123@localhost:5432/inventario_db" --clean --if-exists > "$BACKUP_FILE"

echo "Comprimiendo backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo ""
echo "============================================"
echo "  Backup completado"
echo "============================================"
echo "  Archivo: ${BACKUP_FILE}"
echo "  Tamaño:  $(du -h "${BACKUP_FILE}" | cut -f1)"
echo "============================================"
