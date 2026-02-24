#!/bin/bash

# ============================================
# Actualizar Aplicación (Modo Offline)
# ============================================
# Usa imágenes locales sin conexión a internet

set -e

echo "============================================"
echo "  Actualizar Aplicación TCP (Offline)"
echo "============================================"
echo ""
echo "⚠ Este modo usa solo imágenes locales"
echo ""

# Verificar que la imagen base existe localmente
if ! docker images node:20 --format "{{.Repository}}:{{.Tag}}" | grep -q "node:20"; then
    echo "✗ Error: La imagen node:20 no existe localmente"
    echo "  Necesitas conexión a internet para el primer build"
    exit 1
fi

# 1. Build sin conexión externa
echo ""
echo "[1/5] Construyendo imagen (offline)..."
docker build \
    --network none \
    --no-cache \
    -t tcp-app:latest . 2>&1 | tail -30 || {
    echo ""
    echo "⚠ Build con --network none falló, intentando normal..."
    docker build -t tcp-app:latest . 2>&1 | tail -30
}

echo "   ✓ Imagen construida"

# 2. Detener contenedor
echo ""
echo "[2/5] Deteniendo contenedor actual..."
docker stop inventario-app 2>/dev/null || true
docker rm inventario-app 2>/dev/null || true
echo "   ✓ Contenedor eliminado"

# 3. Iniciar nuevo
echo ""
echo "[3/5] Iniciando contenedor..."
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
    -c "cd /app/.next/standalone && mkdir -p .next && cp -r /app/.next/static .next/ && cp -r /app/public . && npx prisma db push --accept-data-loss --skip-generate 2>/dev/null; node server.js"

echo "   ✓ Contenedor iniciado"

# 4. Verificar
echo ""
echo "[4/5] Verificando..."
sleep 5
curl -s http://localhost/api/health && echo "" || echo "   Iniciando..."

# 5. Mostrar estado
echo ""
echo "[5/5] Estado final..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep inventario

echo ""
echo "============================================"
echo "  ✓ Actualización completada"
echo "============================================"
