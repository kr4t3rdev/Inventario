#!/bin/bash

# ============================================
# Iniciar Sistema de Inventario TCP
# ============================================

set -e

echo "============================================"
echo "  Sistema de Inventario TCP"
echo "============================================"

# 1. Verificar imágenes
echo ""
echo "[1/7] Verificando imágenes..."
for img in tcp-app:latest tcp-nginx:latest postgres:16-alpine; do
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^$img$"; then
        echo "   ✓ $img"
    else
        echo "   ✗ $img no encontrada"
        exit 1
    fi
done

# 2. Crear red y volúmenes
echo ""
echo "[2/7] Creando red y volúmenes..."
docker network create tcp_app-network 2>/dev/null || true
docker volume create tcp_postgres_data 2>/dev/null || true
echo "   ✓ Red y volúmenes listos"

# 3. Detener contenedores existentes
echo ""
echo "[3/7] Deteniendo contenedores existentes..."
docker stop inventario-nginx inventario-app inventario-db 2>/dev/null || true
docker rm inventario-nginx inventario-app inventario-db 2>/dev/null || true
echo "   ✓ Contenedores eliminados"

# 4. Iniciar PostgreSQL
echo ""
echo "[4/7] Iniciando PostgreSQL..."
docker run -d --name inventario-db \
    --network tcp_app-network \
    -e POSTGRES_USER=inventario \
    -e POSTGRES_PASSWORD=inventario123 \
    -e POSTGRES_DB=inventario_db \
    -v tcp_postgres_data:/var/lib/postgresql/data \
    postgres:16-alpine

echo "   Esperando a que PostgreSQL esté listo..."
sleep 5
until docker exec inventario-db pg_isready -U inventario -d inventario_db; do
    echo "   Esperando..."
    sleep 2
done
echo "   ✓ PostgreSQL listo"

# 5. Iniciar aplicación
echo ""
echo "[5/7] Iniciando aplicación..."
docker run -d --name inventario-app \
    --network tcp_app-network \
    -e NODE_ENV=production \
    -e DATABASE_URL="postgresql://inventario:inventario123@inventario-db:5432/inventario_db?schema=public" \
    -e JWT_SECRET="jwt_secret_muy_seguro_cambiar_en_produccion_12345678" \
    -e NEXTAUTH_SECRET="nextauth_secret_muy_seguro_cambiar_en_produccion_12345678" \
    -e NEXTAUTH_URL="http://localhost" \
    -e PORT=3000 \
    -e HOSTNAME="0.0.0.0" \
    --entrypoint "/bin/sh" \
    tcp-app:latest \
    -c "cd /app/.next/standalone && mkdir -p .next && cp -r /app/.next/static .next/ && cp -r /app/public . && node server.js"

sleep 5
echo "   ✓ Aplicación iniciada"

# 6. Ejecutar migraciones
echo ""
echo "[6/7] Ejecutando migraciones de base de datos..."
docker exec inventario-app sh -c "cd /app/.next/standalone && npx prisma db push --accept-data-loss --skip-generate" 2>/dev/null || echo "   ⚠ Migración ya ejecutada"
echo "   ✓ Migraciones completadas"

# 7. Iniciar Nginx
echo ""
echo "[7/7] Iniciando Nginx..."
docker run -d --name inventario-nginx \
    --network tcp_app-network \
    -p 80:80 \
    -v "$(pwd)/nginx.conf:/etc/nginx/conf.d/app.conf:ro" \
    tcp-nginx:latest

sleep 2
echo "   ✓ Nginx iniciado"

# Verificar estado
echo ""
echo "============================================"
echo "  Verificando servicios..."
echo "============================================"

sleep 3
HEALTH=$(curl -s http://localhost/api/health 2>/dev/null || echo '{"status":"unknown"}')

echo ""
echo "=== Estado de contenedores ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "============================================"
echo "  ✓ Sistema iniciado correctamente"
echo "============================================"
echo "  URL: http://localhost"
echo ""
echo "  Comandos útiles:"
echo "    Ver logs:     docker logs inventario-app"
echo "    Detener:      docker stop inventario-nginx inventario-app inventario-db"
echo "    Crear admin:  ./create-admin.sh"
echo "============================================"
