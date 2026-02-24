#!/bin/bash

# ============================================
# Estado del Sistema de Inventario TCP
# ============================================

echo "============================================"
echo "  Estado del Sistema de Inventario TCP"
echo "============================================"

# Verificar contenedores
echo ""
echo "=== CONTENEDORES ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -E "NAME|inventario" || echo "No hay contenedores activos"

# Verificar health
echo ""
echo "=== HEALTH CHECK ==="
if curl -s http://localhost/api/health > /dev/null 2>&1; then
    curl -s http://localhost/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost/api/health
else
    echo "Sistema no accesible en http://localhost"
fi

# Verificar backups
echo ""
echo "=== BACKUPS ==="
if [ -d "./backups" ]; then
    echo "Directorio: $(pwd)/backups/"
    ls -lh ./backups/*.gz 2>/dev/null | tail -5 || echo "No hay backups"
else
    echo "Directorio de backups no existe"
fi

# Uso de disco
echo ""
echo "=== RECURSOS DOCKER ==="
echo "Imágenes:"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "tcp|postgres|nginx" | head -5

echo ""
echo "Volúmenes:"
docker volume ls --format "  {{.Name}}" | grep tcp

echo ""
echo "============================================"
