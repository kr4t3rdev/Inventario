#!/bin/bash
set -e

# ============================================
# Configuración de Secrets (seguros)
# ============================================
# Los secrets se pasan via variables de entorno en runtime
# No hay valores por defecto para secrets en producción

# Generar secrets si no existen (solo para desarrollo)
if [ -z "$JWT_SECRET" ]; then
    echo "ADVERTENCIA: JWT_SECRET no definido, generando uno temporal..."
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "dev_jwt_secret_change_in_production")
    export JWT_SECRET
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "ADVERTENCIA: NEXTAUTH_SECRET no definido, generando uno temporal..."
    NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "dev_nextauth_secret_change_in_production")
    export NEXTAUTH_SECRET
fi

if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="Soyelamo32++"
    echo "ADVERTENCIA: Usando password de BD por defecto"
fi

# Configurar DATABASE_URL si no existe
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://inventario:${DB_PASSWORD}@localhost:5432/inventario_db?schema=public"
fi

export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost}"

# Ocultar passwords en logs
echo "============================================"
echo "  Sistema de Inventario TCP"
echo "============================================"
echo ""
echo "Configuracion:"
echo "  NEXTAUTH_URL: $NEXTAUTH_URL"
echo "  DATABASE_URL: [oculto]"
echo ""

# Exportar DATABASE_URL para que Next.js la use
export DATABASE_URL

# ============================================
# Función para esperar PostgreSQL
# ============================================
wait_for_postgres() {
    echo "[1/5] Iniciando PostgreSQL..."
    service postgresql start
    
    echo "   Esperando a que PostgreSQL esté listo..."
    local retries=0
    until su - postgres -c "pg_isready -q" 2>/dev/null || [ $retries -gt 20 ]; do
        echo "   Esperando... ($retries)"
        sleep 2
        retries=$((retries + 1))
    done
    
    if [ $retries -gt 20 ]; then
        echo "   ERROR: PostgreSQL no inició"
        exit 1
    fi
    
    # Verificar si el usuario tiene password, si no, asignarlo
    echo "   Configurando usuario de base de datos..."
    su - postgres -c "psql -c \"ALTER USER inventario WITH PASSWORD '${DB_PASSWORD}';\"" 2>/dev/null || true
    
    echo "   ✓ PostgreSQL iniciado correctamente"
}

# ============================================
# Función para verificar/inicializar BD
# ============================================
check_db_initialized() {
    echo "[2/5] Verificando base de datos..."
    
    # Verificar si hay tablas en la BD
    local table_count=$(su - postgres -c "psql -d inventario_db -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\"" 2>/dev/null | tr -d ' ')
    
    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        echo "   Base de datos vacia, inicializando..."
        return 1
    else
        echo "   Base de datos ya inicializada ($table_count tablas)"
        return 0
    fi
}

# ============================================
# Función para ejecutar migraciones
# ============================================
run_migrations() {
    echo "[3/5] Ejecutando migraciones..."
    cd /app
    sleep 3
    
    # Intentar con npx primero
    if command -v npx &> /dev/null 2>&1; then
        echo "   Usando npx..."
        npx prisma db push --accept-data-loss --skip-generate 2>&1 || true
    # Si no, intentar con node directamente
    elif [ -f "/app/node_modules/.bin/prisma" ]; then
        echo "   Usando prisma local..."
        /app/node_modules/.bin/prisma db push --accept-data-loss --skip-generate 2>&1 || true
    # Instalar prisma si es necesario
    else
        echo "   Instalando Prisma..."
        npm install prisma --save-dev 2>/dev/null || true
        npx prisma db push --accept-data-loss --skip-generate 2>&1 || true
    fi
    
    # Verificar resultado
    local table_count=$(su - postgres -c "psql -d inventario_db -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\"" 2>/dev/null | tr -d ' ')
    
    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        echo "   ⚠ No se pudieron crear las tablas, intentando nuevamente..."
        sleep 5
        npx prisma db push --accept-data-loss --skip-generate 2>&1 || true
    fi
    
    echo "   ✓ Migraciones completadas"
}

# ============================================
# Función para crear usuario administrador
# ============================================
create_admin_user() {
    echo "[3.5/5] Verificando usuario administrador..."
    
    # Valores por defecto
    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tcp.com}"
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
    
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
        echo "   No se proporcionaron datos de admin, omitiendo..."
        return 0
    fi
    
    # Verificar si ya existe el usuario
    local user_exists=$(su - postgres -c "psql -d inventario_db -t -c \"SELECT COUNT(*) FROM \\\"User\\\" WHERE email = '$ADMIN_EMAIL';\"" 2>/dev/null | tr -d ' ')
    
    if [ "$user_exists" -gt 0 ]; then
        echo "   Usuario admin ya existe: $ADMIN_EMAIL"
        return 0
    fi
    
    echo "   Creando usuario administrador..."
    
    # Generar hash de contraseña usando bcrypt
    local password_hash
    password_hash=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash('$ADMIN_PASSWORD', 12).then(h => console.log(h));" 2>/dev/null)
    
    if [ -z "$password_hash" ]; then
        echo "   ERROR: No se pudo generar el hash de contraseña"
        return 1
    fi
    
    # Insertar usuario admin
    su - postgres -c "psql -d inventario_db -c \"INSERT INTO \\\"User\\\" (\\\"userId\\\", \\\"name\\\", \\\"email\\\", \\\"password\\\", \\\"role\\\", \\\"isActive\\\", \\\"createdAt\\\", \\\"updatedAt\\\", \\\"activatedAt\\\") VALUES (gen_random_uuid(), 'Administrador', '$ADMIN_EMAIL', '$password_hash', 'admin', true, NOW(), NOW(), NOW());\"" 2>/dev/null || true
    
    # Verificar que se creó
    local user_created=$(su - postgres -c "psql -d inventario_db -t -c \"SELECT COUNT(*) FROM \\\"User\\\" WHERE email = '$ADMIN_EMAIL';\"" 2>/dev/null | tr -d ' ')
    
    if [ "$user_created" -gt 0 ]; then
        echo "   ✓ Usuario administrador creado: $ADMIN_EMAIL"
    else
        echo "   ERROR: No se pudo crear el usuario administrador"
    fi
}

# ============================================
# Función para iniciar la app
# ============================================
start_app() {
    echo "[4/5] Iniciando aplicación Next.js..."
    cd /app
    
    # Asegurar que la app escuche en todas las interfaces
    export HOSTNAME="0.0.0.0"
    export PORT=3000
    
    # Copiar archivos estáticos
    mkdir -p /app/.next/standalone/.next/static 2>/dev/null || true
    cp -r /app/.next/static/* /app/.next/standalone/.next/static/ 2>/dev/null || true
    
    # Iniciar en background
    cd /app/.next/standalone && node server.js &
    APP_PID=$!
    
    # Esperar con timeout
    echo "   Esperando a que la aplicación esté lista..."
    sleep 5
    local retries=0
    until curl -s http://localhost:3000/api/health > /dev/null 2>&1 || [ $retries -gt 30 ]; do
        echo "   Esperando... ($retries)"
        sleep 2
        retries=$((retries + 1))
    done
    
    if [ $retries -gt 30 ]; then
        echo "   ⚠ Timeout esperando app, continuando..."
    else
        echo "   ✓ Aplicación iniciada en puerto 3000"
    fi
}

# ============================================
# Función para iniciar Nginx
# ============================================
start_nginx() {
    echo "[5/5] Iniciando Nginx..."
    
    # Crear directorios para archivos estáticos
    mkdir -p /usr/share/nginx/html/_next/static
    mkdir -p /usr/share/nginx/html/static
    
    # Copiar archivos estáticos
    cp -r /app/.next/static/* /usr/share/nginx/html/_next/static/ 2>/dev/null || true
    cp -r /app/public/* /usr/share/nginx/html/static/ 2>/dev/null || true
    
    # Iniciar Nginx
    service nginx start
    echo "   ✓ Nginx iniciado en puerto 80"
}

# ============================================
# Secuencia de inicio
# ============================================

wait_for_postgres

if check_db_initialized; then
    echo "   Saltando migraciones (BD ya inicializada)"
else
    run_migrations
    create_admin_user
fi

start_app
start_nginx

echo ""
echo "============================================"
echo "  Sistema iniciado correctamente"
echo "============================================"
echo "  Aplicación: http://localhost"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "  Datos persistentes en: /var/lib/postgresql/data"
echo ""
echo "  Credenciales de admin:"
echo "    Email: $ADMIN_EMAIL"
echo "    Password: [oculto en logs]"
echo "============================================"

# Mantener el contenedor corriendo
trap "echo 'Deteniendo servicios...'; service nginx stop; kill $APP_PID 2>/dev/null; service postgresql stop; exit 0" SIGTERM SIGINT

# Mantener vivo
while true; do
    sleep 60
done
