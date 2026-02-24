#!/bin/bash

echo "🛑 Deteniendo servidor actual (si está corriendo)..."
echo ""

# Buscar y matar procesos en puerto 3000
PIDS=$(lsof -ti:3000)
if [ -n "$PIDS" ]; then
    echo "✅ Encontrados procesos en puerto 3000, terminando..."
    kill -9 $PIDS 2>/dev/null
    sleep 2
else
    echo "ℹ️  No hay procesos corriendo en puerto 3000"
fi

echo ""
echo "🚀 Iniciando servidor en todas las interfaces de red..."
echo "   Esto permite que el móvil pueda conectarse usando la IP"
echo ""

cd /Users/arturo/Documents/Proyecto\ Inventario/next
npm run dev

