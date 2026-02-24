#!/bin/bash

# ============================================
# Restaurar Backup de Base de Datos PostgreSQL
# ============================================

set -e

BACKUP_DIR="./backups"

echo "============================================"
echo "  Restaurar Backup de Base de Datos"
echo "============================================"

# Listar backups disponibles
echo ""
echo "Backups disponibles:"
echo ""
ls -lh "${BACKUP_DIR}"/*.gz 2>/dev/null || echo "  No hay backups disponibles"
echo ""

# Si se pasa un archivo como argumento
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    # Usar el más reciente
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.gz 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "Error: No se encontraron backups"
        exit 1
    fi
    echo "Usando backup más reciente: ${BACKUP_FILE}"
fi

echo ""
echo "⚠ ADVERTENCIA: Esto ELIMINARÁ todos los datos actuales"
echo ""
read -p "¿Continuar? (s/n): " confirm

if [ "$confirm" != "s" ]; then
    echo "Operación cancelada"
    exit 0
fi

# Descomprimir si es necesario
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo ""
    echo "Descomprimiendo backup..."
    SQL_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$SQL_FILE"
else
    SQL_FILE="$BACKUP_FILE"
fi

# Restaurar
echo ""
echo "Restaurando base de datos..."

# Determinar el nombre del contenedor de base de datos
DB_CONTAINER=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    DB_CONTAINER="tcp-sistema"
else
    DB_CONTAINER="inventario-db"
fi

cat "$SQL_FILE" | docker exec -i $DB_CONTAINER psql "postgresql://inventario:inventario123@localhost:5432/inventario_db"

# Limpiar archivo temporal
if [[ "$BACKUP_FILE" == *.gz ]]; then
    rm "$SQL_FILE"
fi

echo ""
echo "============================================"
echo "  ✓ Restauración completada"
echo "============================================"
echo "  Archivo restaurado: ${BACKUP_FILE}"
echo "  Fecha: $(date)"
echo "============================================"
