#!/bin/bash

# ============================================
# Script para crear imágenes Docker SIN internet
# ============================================

set -e

echo "============================================"
echo "  Crear bundle de imágenes Docker"
echo "============================================"

# 1. Construir imagen de la app (una vez con internet)
echo "[1/4] Construyendo imagen de la app..."
docker build -t tcp-app:latest . -f Dockerfile.offline

# 2. Cargar imágenes base (postgres y nginx)
echo "[2/4] Cargando imágenes base..."
[ -f "tcp-postgres.tar" ] && docker load -i tcp-postgres.tar
[ -f "tcp-nginx.tar" ] && docker load -i tcp-nginx.tar

# 3. Etiquetar imágenes
echo "[3/4] Etiquetando imágenes..."
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-postgres:latest 2>/dev/null || true
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-nginx:latest 2>/dev/null || true

# 4. Exportar imágenes a archivos tar
echo "[4/4] Exportando imágenes a archivos tar..."
docker save -o tcp-app.tar tcp-app:latest
docker save -o tcp-postgres.tar tcp-postgres:latest 2>/dev/null || echo "  ⚠ Usando imagen existente de postgres"
docker save -o tcp-nginx.tar tcp-nginx:latest 2>/dev/null || echo "  ⚠ Usando imagen existente de nginx"

echo ""
echo "============================================"
echo "  ✓ Imágenes creadas:"
echo "============================================"
ls -lh tcp-*.tar
echo ""
echo "Para transferir a otro equipo, copia estos archivos:"
echo "  - tcp-app.tar"
echo "  - tcp-postgres.tar"  
echo "  - tcp-nginx.tar"
echo ""
echo "Luego en el otro equipo ejecuta: ./start-offline.sh"
