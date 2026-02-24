#!/bin/bash

# ============================================
# Actualizar Aplicación (Rebuild + Redeploy)
# ============================================

set -e

echo "============================================"
echo "  Actualizar Aplicación TCP"
echo "============================================"

# 1. Verificar que hay cambios
echo ""
echo "[1/5] Verificando cambios..."
git status --short 2>/dev/null || echo "   (No es un repo git)"

# 2. Construir nueva imagen
echo ""
echo "[2/5] Construyendo nueva imagen..."
docker build -t tcp-app:latest . 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo "   ✗ Error en el build"
    exit 1
fi
echo "   ✓ Imagen construida"

# 3. Detener contenedor actual
echo ""
echo "[3/5] Deteniendo contenedor actual..."
docker stop inventario-app 2>/dev/null || true
docker rm inventario-app 2>/dev/null || true
echo "   ✓ Contenedor eliminado"

# 4. Iniciar nuevo contenedor
echo ""
echo "[4/5] Iniciando nuevo contenedor..."
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

sleep 5
echo "   ✓ Contenedor iniciado"

# 5. Verificar
echo ""
echo "[5/5] Verificando..."
sleep 3

if curl -s http://localhost/api/health > /dev/null 2>&1; then
    echo "   ✓ Aplicación funcionando"
else
    echo "   ⚠ La aplicación puede estar iniciando..."
fi

echo ""
echo "============================================"
echo "  ✓ Actualización completada"
echo "============================================"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep inventario
echo ""
echo "  URL: http://localhost"
echo "  Logs: docker logs inventario-app -f"
echo "============================================"
