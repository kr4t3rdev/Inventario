#!/bin/bash

# ============================================
# Script para iniciar servicios SIN internet
# ============================================

set -e

echo "============================================"
echo "  Iniciar servicios (offline)"
echo "============================================"

# 1. Cargar imágenes desde archivos tar
echo "[1/5] Cargando imágenes..."
[ -f "tcp-app.tar" ] && docker load -i tcp-app.tar
[ -f "tcp-postgres.tar" ] && docker load -i tcp-postgres.tar
[ -f "tcp-nginx.tar" ] && docker load -i tcp-nginx.tar

# 2. Etiquetar
echo "[2/5] Etiquetando..."
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-app:latest 2>/dev/null || true
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-postgres:latest 2>/dev/null || true
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-nginx:latest 2>/dev/null || true

# 3. Iniciar servicios
echo "[3/5] Iniciando servicios..."
docker-compose down 2>/dev/null || true
docker-compose up -d

# 4. Esperar PostgreSQL
echo "[4/5] Esperando PostgreSQL..."
for i in {1..30}; do
  if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "  ✓ PostgreSQL listo"
    break
  fi
  echo "  ⏳ ($i/30)"
  sleep 2
done

# 5. Prisma
echo "[5/5] Ejecutando Prisma..."
sleep 3
docker-compose exec -T app pnpm prisma generate
docker-compose exec -T app pnpm prisma db push

echo ""
echo "============================================"
echo "  ✓ Listo!"
echo "============================================"
echo "  App: http://localhost"
