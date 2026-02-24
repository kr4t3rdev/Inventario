#!/bin/bash
set -e

echo "============================================"
echo "  Iniciando Sistema de Inventario TCP"
echo "============================================"

# Función para esperar PostgreSQL
wait_for_postgres() {
    echo "[1/4] Iniciando PostgreSQL..."
    service postgresql start
    
    echo "   Esperando a que PostgreSQL esté listo..."
    until su - postgres -c "pg_isready -q" 2>/dev/null; do
        echo "   PostgreSQL no está listo aún..."
        sleep 2
    done
    echo "   ✓ PostgreSQL iniciado correctamente"
}

# Función para ejecutar migraciones
run_migrations() {
    echo "[2/4] Ejecutando migraciones de base de datos..."
    cd /app
    
    until npx prisma db push --accept-data-loss 2>/dev/null; do
        echo "   Reintentando migración..."
        sleep 2
    done
    echo "   ✓ Migraciones completadas"
}

# Función para iniciar la app
start_app() {
    echo "[3/4] Iniciando aplicación Next.js..."
    cd /app
    
    # Iniciar en background
    pnpm start &
    APP_PID=$!
    
    # Esperar a que la app responda
    echo "   Esperando a que la aplicación esté lista..."
    until curl -s http://localhost:3000 > /dev/null 2>&1; do
        sleep 2
    done
    echo "   ✓ Aplicación iniciada en puerto 3000"
}

# Función para iniciar Nginx
start_nginx() {
    echo "[4/4] Iniciando Nginx..."
    
    # Crear directorios para archivos estáticos
    mkdir -p /usr/share/nginx/html/_next/static
    mkdir -p /usr/share/nginx/html/static
    
    # Copiar archivos estáticos de Next.js
    if [ -d "/app/.next/static" ]; then
        cp -r /app/.next/static/* /usr/share/nginx/html/_next/static/ 2>/dev/null || true
    fi
    if [ -d "/app/public" ]; then
        cp -r /app/public/* /usr/share/nginx/html/static/ 2>/dev/null || true
    fi
    
    # Iniciar Nginx
    service nginx start
    echo "   ✓ Nginx iniciado en puerto 80"
}

# ============================================
# Secuencia de inicio
# ============================================

wait_for_postgres
run_migrations
start_app
start_nginx

echo ""
echo "============================================"
echo "  ✓ Sistema iniciado correctamente"
echo "============================================"
echo "  Aplicación: http://localhost"
echo "  PostgreSQL: localhost:5432"
echo "============================================"

# Mantener el contenedor corriendo y monitorear procesos
trap "echo 'Deteniendo servicios...'; service nginx stop; kill $APP_PID 2>/dev/null; service postgresql stop; exit 0" SIGTERM SIGINT

# Mantener vivo
while true; do
    # Verificar que los servicios sigan corriendo
    if ! pgrep -x "postgres" > /dev/null; then
        echo "⚠ PostgreSQL se detuvo, reiniciando..."
        service postgresql start
    fi
    
    if ! pgrep -x "nginx" > /dev/null; then
        echo "⚠ Nginx se detuvo, reiniciando..."
        service nginx start
    fi
    
    if ! pgrep -f "next start" > /dev/null; then
        echo "⚠ App se detuvo, reiniciando..."
        cd /app && pnpm start &
    fi
    
    sleep 10
done
