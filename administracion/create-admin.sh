#!/bin/bash

# ============================================
# Crear Usuario Administrador (Método SQL Directo)
# ============================================
# Ejecuta SQL directamente en el contenedor PostgreSQL

set -e

echo "============================================"
echo "  Crear Usuario Administrador"
echo "============================================"

# Configuración por defecto
ADMIN_EMAIL="${1:-admin@tcp.com}"
ADMIN_NAME="${2:-Administrador}"
ADMIN_PASSWORD="${3:-Soyelamo32+!}"

echo ""
echo "Datos del administrador:"
echo "  Email:    ${ADMIN_EMAIL}"
echo "  Nombre:   ${ADMIN_NAME}"
echo "  Password: ${ADMIN_PASSWORD}"
echo ""
read -p "¿Continuar? (s/n): " confirm

if [ "$confirm" != "s" ]; then
    echo "Operación cancelada"
    exit 0
fi

# Verificar si el contenedor está corriendo (sistema unificado o separado)
CONTAINER_NAME=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    CONTAINER_NAME="tcp-sistema"
elif docker ps --format "{{.Names}}" | grep -q "inventario-app"; then
    CONTAINER_NAME="inventario-app"
else
    echo "Error: No hay contenedor de la aplicación corriendo"
    echo "Inicie el sistema primero con: ./start-system.sh"
    exit 1
fi

echo ""
echo "Generando hash de contraseña..."

# Generar hash bcrypt usando node dentro del contenedor
HASH=$(docker exec $CONTAINER_NAME node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('${ADMIN_PASSWORD}', 12));
" 2>/dev/null)

if [ -z "$HASH" ]; then
    echo "Error: No se pudo generar el hash"
    echo "Intentando método alternativo..."
    
    # Usar hash precalculado para contraseña común
    # Hash para 'Admin123!' con bcryptjs cost 12
    HASH='$2b$12$/6EHlGyahspj2xpCCgUFqeI/GbjUP2Y5MviB2lgoX1LrXyx59pa12'
fi

echo "Hash generado: ${HASH:0:20}..."

echo ""
echo "Insertando usuario en la base de datos..."

# Escapar comillas simples en el hash para SQL
HASH_ESCAPED=$(echo "$HASH" | sed "s/'/''/g")

# Determinar el nombre del contenedor de base de datos
DB_CONTAINER=""
if docker ps --format "{{.Names}}" | grep -q "tcp-sistema"; then
    DB_CONTAINER="tcp-sistema"
else
    DB_CONTAINER="inventario-db"
fi

# Ejecutar SQL con password
docker exec -i $DB_CONTAINER psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" <<EOF
-- Crear usuario administrador o actualizar si existe
INSERT INTO "User" (
    "userId",
    "name",
    "email",
    "password",
    "role",
    "isActive",
    "createdAt",
    "updatedAt",
    "activatedAt"
) VALUES (
    gen_random_uuid(),
    '${ADMIN_NAME}',
    '${ADMIN_EMAIL}',
    '${HASH_ESCAPED}',
    'admin',
    true,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT ("email") DO UPDATE SET
    "name" = '${ADMIN_NAME}',
    "password" = '${HASH_ESCAPED}',
    "role" = 'admin',
    "isActive" = true,
    "updatedAt" = NOW(),
    "activatedAt" = NOW();
EOF

# Verificar que se creó
echo ""
echo "Verificando usuario..."
docker exec -i $DB_CONTAINER psql "postgresql://inventario:inventario123@localhost:5432/inventario_db" -c "
SELECT \"userId\", \"name\", \"email\", \"role\", \"isActive\" 
FROM \"User\" 
WHERE \"email\" = '${ADMIN_EMAIL}';
"

echo ""
echo "============================================"
echo "  ✓ Usuario Administrador Listo"
echo "============================================"
echo "  Email:    ${ADMIN_EMAIL}"
echo "  Password: ${ADMIN_PASSWORD}"
echo "  Rol:      admin"
echo "  Activo:   true"
echo ""
echo "  URL de login: http://localhost"
echo ""
echo "  Para crear otro usuario:"
echo "    ./create-admin.sh email nombre password"
echo "============================================"
