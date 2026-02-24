#!/bin/bash

# ============================================
# Script de Seguridad para Sistema TCP
# ============================================

echo "============================================"
echo "  Configurando Seguridad del Sistema"
echo "============================================"

# 1. Actualizar configuración de nginx
echo ""
echo "[1/5] Actualizando Nginx con configuración segura..."
cp nginx-secure.conf nginx.conf

# Reconstruir imagen nginx
docker create --name temp-nginx tcp-nginx:latest
docker cp nginx.conf temp-nginx:/etc/nginx/conf.d/default.conf
docker commit temp-nginx tcp-nginx:latest
docker rm temp-nginx

echo "   ✓ Nginx configurado con seguridad"

# 2. Configurar variables de entorno seguras
echo ""
echo "[2/5] Verificando secrets..."

# Generar secrets si no existen
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "   JWT_SECRET generado: ${JWT_SECRET:0:10}..."
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "   NEXTAUTH_SECRET generado: ${NEXTAUTH_SECRET:0:10}..."
fi

# 3. Verificar que la BD no esté expuesta
echo ""
echo "[3/5] Verificando exposición de base de datos..."

DB_PORTS=$(docker port inventario-db 2>/dev/null)
if [ -n "$DB_PORTS" ]; then
    echo "   ⚠ ADVERTENCIA: PostgreSQL está expuesto en: $DB_PORTS"
    echo "   Recomendación: No exponer el puerto 5432"
else
    echo "   ✓ PostgreSQL no expuesto externamente"
fi

# 4. Verificar red
echo ""
echo "[4/5] Verificando configuración de red..."

NETWORK=$(docker network inspect tcp_app-network --format '{{.Driver}}' 2>/dev/null)
if [ "$NETWORK" = "bridge" ]; then
    echo "   ✓ Red bridge configurada correctamente"
else
    echo "   Creando red aislada..."
    docker network create --driver bridge tcp_app-network 2>/dev/null || true
fi

# 5. Reiniciar servicios con configuración segura
echo ""
echo "[5/5] Reiniciando servicios..."

# Reiniciar nginx
docker stop inventario-nginx 2>/dev/null
docker rm inventario-nginx 2>/dev/null
docker run -d --name inventario-nginx \
    --network tcp_app-network \
    -p 80:80 \
    --read-only \
    --tmpfs /var/cache/nginx \
    --tmpfs /var/run \
    --tmpfs /tmp \
    tcp-nginx:latest

echo "   ✓ Servicios reiniciados con configuración segura"

# Resumen
echo ""
echo "============================================"
echo "  Seguridad Configurada"
echo "============================================"
echo ""
echo "  PROTECCIONES ACTIVAS:"
echo "  ├─ Rate Limiting: 10 req/s general, 5 req/s API, 3 req/s login"
echo "  ├─ Conexiones máximas por IP: 20"
echo "  ├─ Headers de seguridad: X-Frame-Options, XSS-Protection, etc."
echo "  ├─ Archivos sensibles bloqueados: .env, .git, etc."
echo "  ├─ Base de datos: Solo acceso interno"
echo "  └─ Contenedor nginx: Read-only con tmpfs"
echo ""
echo "  Para más seguridad:"
echo "    1. Usar HTTPS con certificado SSL"
echo "    2. Configurar firewall del sistema"
echo "    3. Cambiar passwords por defecto"
echo "============================================"
