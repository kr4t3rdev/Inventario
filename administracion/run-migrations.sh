#!/bin/bash

# ============================================
# Ejecutar Migraciones de Base de Datos
# ============================================

echo "============================================"
echo "  Ejecutando Migraciones de Base de Datos"
echo "============================================"

# Determinar el nombre del contenedor
CONTAINER_NAME=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    CONTAINER_NAME="tcp-sistema"
    echo "Usando sistema unificado: tcp-sistema"
elif docker ps --format "{{.Names}}" | grep -q "inventario-app"; then
    CONTAINER_NAME="inventario-app"
    echo "Usando sistema separado: inventario-app"
else
    echo "Error: No hay contenedor de la aplicación corriendo"
    echo "Inicie el sistema primero con: ./start-system.sh"
    exit 1
fi

echo ""
echo "Ejecutando prisma db push..."

docker exec $CONTAINER_NAME sh -c "cd /app && npx prisma db push --accept-data-loss --skip-generate"

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "  ✓ Migraciones ejecutadas correctamente"
    echo "============================================"
    
    # Verificar tablas creadas
    echo ""
    echo "Verificando tablas creadas..."
    
    DB_CONTAINER=""
    if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
        DB_CONTAINER="tcp-sistema"
    else
        DB_CONTAINER="inventario-db"
    fi
    
    docker exec $DB_CONTAINER psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null
    
    echo ""
    echo "Ahora puedes crear el usuario admin:"
    echo "  ./create-admin.sh"
else
    echo ""
    echo "Error al ejecutar migraciones"
    exit 1
fi
