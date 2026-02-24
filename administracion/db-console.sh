#!/bin/bash
# Script para facilitar el acceso a la base de datos

echo "🔌 Conectando a PostgreSQL..."
echo ""
echo "Comandos útiles:"
echo "  \dt              - Ver todas las tablas"
echo "  \d NombreTabla   - Ver estructura de tabla"
echo "  \q               - Salir"
echo "  \h               - Ayuda de comandos SQL"
echo ""
echo "Ejemplos:"
echo '  SELECT * FROM "User";'
echo '  SELECT * FROM "Producto" LIMIT 10;'
echo '  SELECT COUNT(*) FROM "Venta";'
echo ""

docker exec -it inventario-db psql -U postgres -d TCPBD
