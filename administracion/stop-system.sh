#!/bin/bash

# ============================================
# Detener Sistema de Inventario TCP
# ============================================

echo "============================================"
echo "  Deteniendo Sistema de Inventario TCP"
echo "============================================"

echo ""
echo "Deteniendo contenedores..."
docker stop inventario-nginx inventario-app inventario-db 2>/dev/null || true

echo "Eliminando contenedores..."
docker rm inventario-nginx inventario-app inventario-db 2>/dev/null || true

echo ""
echo "============================================"
echo "  ✓ Sistema detenido"
echo "============================================"
echo ""
echo "  Para iniciar nuevamente: ./start-system.sh"
echo "  Para eliminar datos: docker volume rm tcp_postgres_data"
echo "============================================"
