#!/bin/bash

# ============================================
# Build de imagen unificada (todo en uno)
# ============================================

set -e

echo "============================================"
echo "  Creando imagen unificada TCP"
echo "============================================"

# Crear directorio de logs
mkdir -p logs

# Construir imagen
echo ""
echo "[1/2] Construyendo imagen docker-tcp:latest..."
docker build -t docker-tcp:latest -f Dockerfile.unified .

# Exportar imagen
echo ""
echo "[2/2] Exportando imagen a docker-tcp.tar..."
docker save -o docker-tcp.tar docker-tcp:latest

echo ""
echo "============================================"
echo "  ✓ Imagen creada correctamente"
echo "============================================"
ls -lh docker-tcp.tar
echo ""
echo "Para ejecutar:"
echo "  docker load -i docker-tcp.tar"
echo "  docker run -d -p 80:80 --name tcp-sistema docker-tcp:latest"
echo ""
