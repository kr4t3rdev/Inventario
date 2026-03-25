#!/bin/bash

# ============================================
# Iniciar Sistema Unificado TCP
# ============================================
# Uso: ./start-unified.sh [opciones]
#
# Opciones:
#   --jwt-secret "secret"      JWT secret (o usar JWT_SECRET env)
#   --nextauth-secret "secret" NextAuth secret (o usar NEXTAUTH_SECRET env)
#   --db-password "password"   Password de BD (default: Soyelamo32++)
#   --admin-email "email"      Email del admin (default: admin@tcp.com)
#   --admin-password "password" Password del admin (default: Admin123!)
#   --port 80                  Puerto externo (default: 80)
#   --data-dir ./data          Directorio de datos persistentes
#
# Ejemplo:
#   ./start-unified.sh --jwt-secret "mi_secret" --nextauth-secret "otro_secret" --data-dir ./tcp-data
# ============================================

set -e

# Valores por defecto
PORT=80
DB_PASSWORD="Soyelamo32++"
ADMIN_EMAIL="admin@tcp.com"
ADMIN_PASSWORD="Admin123!"
DATA_DIR="./tcp-data"

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --jwt-secret)
            JWT_SECRET="$2"
            shift 2
            ;;
        --nextauth-secret)
            NEXTAUTH_SECRET="$2"
            shift 2
            ;;
        --db-password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --admin-email)
            ADMIN_EMAIL="$2"
            shift 2
            ;;
        --admin-password)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        *)
            echo "Opción desconocida: $1"
            exit 1
            ;;
    esac
done

# Usar variables de entorno si no se pasaron argumentos
JWT_SECRET="${JWT_SECRET:-${JWT_SECRET_ENV:-$(openssl rand -base64 32 2>/dev/null || echo 'jwt_default_secret_change_me')}}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-${NEXTAUTH_SECRET_ENV:-$(openssl rand -base64 32 2>/dev/null || echo 'nextauth_default_secret_change_me')}}"

echo "============================================"
echo "  Sistema de Inventario TCP"
echo "============================================"

# Crear directorio de datos si no existe
mkdir -p "${DATA_DIR}/postgres"
mkdir -p "${DATA_DIR}/logs"

echo ""
echo "Configuración:"
echo "  Puerto:      $PORT"
echo "  Datos:       ${DATA_DIR}/"
echo "  JWT Secret:  ${JWT_SECRET:0:10}..."
echo "  Admin Email: $ADMIN_EMAIL"
echo ""

# Detener contenedor existente
docker stop tcp-sistema 2>/dev/null || true
docker rm tcp-sistema 2>/dev/null || true

# Obtener rutas absolutas para volúmenes
POSTGRES_DIR="$(cd ${DATA_DIR}/postgres 2>/dev/null && pwd)" || POSTGRES_DIR="${DATA_DIR}/postgres"
LOGS_DIR="$(cd ${DATA_DIR}/logs 2>/dev/null && pwd)" || LOGS_DIR="${DATA_DIR}/logs"

# Crear directorios si no existen
mkdir -p "${POSTGRES_DIR}"
mkdir -p "${LOGS_DIR}"

# Construir DATABASE_URL
DATABASE_URL="postgresql://inventario:${DB_PASSWORD}@localhost:5432/inventario_db?schema=public"

# Iniciar contenedor con persistencia y seguridad (sin mostrar passwords)
echo "Iniciando contenedor..."
docker run -d \
    --name tcp-sistema \
    -p ${PORT}:80 \
    \
    -e JWT_SECRET \
    -e NEXTAUTH_SECRET \
    -e NEXTAUTH_URL="http://localhost:${PORT}" \
    -e DATABASE_URL \
    -e DB_PASSWORD \
    -e ADMIN_EMAIL \
    -e ADMIN_PASSWORD \
    \
    -v "${POSTGRES_DIR}:/var/lib/postgresql/data" \
    -v "${LOGS_DIR}:/var/log/tcp" \
    \
    --read-only=false \
    --privileged=true \
    --security-opt "no-new-privileges=true" \
    --cap-drop=ALL \
    --cap-add=CHOWN \
    --cap-add=SETUID \
    --cap-add=SETGID \
    --cap-add=NET_BIND_SERVICE \
    --cap-add=NET_ADMIN \
    \
    --health-cmd="curl -f http://localhost/api/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=60s \
    \
    docker-tcp:latest 2>&1 | grep -v "${DB_PASSWORD}" || true

echo ""
echo "Esperando a que el sistema inicie..."
sleep 10

# Verificar si está funcionando
retries=0
until curl -s http://localhost:${PORT}/api/health > /dev/null 2>&1 || [ $retries -gt 30 ]; do
    echo "  Esperando... ($retries)"
    sleep 3
    retries=$((retries + 1))
done

if [ $retries -gt 30 ]; then
    echo ""
    echo "El sistema puede estar iniciando."
    echo "  Ver logs: docker logs tcp-sistema"
else
    echo ""
    echo "============================================"
    echo "  Sistema iniciado correctamente"
    echo "============================================"
    echo "  URL:      http://localhost:${PORT}"
    echo "  Datos:    ${DATA_DIR}/"
    echo "  Logs:     docker logs tcp-sistema"
    echo ""
    echo "  Admin:    $ADMIN_EMAIL"
    echo "  Password: [oculto]"
    echo "============================================"
fi
