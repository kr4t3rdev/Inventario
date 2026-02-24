#!/bin/bash

# ============================================
# Build de imagen unificada TCP (todo en uno)
# ============================================
# Este script construye una imagen Docker que incluye:
#   - Dockerfile.unified   : Imagen con PostgreSQL + Next.js + Nginx
#   - entrypoint-unified.sh: Script de inicio del contenedor
#   - start-unified.sh     : Script para iniciar el sistema
#
# Uso: ./build-unified.sh
# ============================================

set -e

echo "============================================"
echo "  Creando imagen unificada TCP"
echo "============================================"

# Verificar que existen los archivos requeridos
REQUIRED_FILES=(
    "Dockerfile.unified"
    "entrypoint-unified.sh"
    "start-unified.sh"
    "nginx-unified.conf"
    "supervisord.conf"
)

echo ""
echo "[1/4] Verificando archivos requeridos..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file NO ENCONTRADO"
        exit 1
    fi
done

# Crear directorio de logs
mkdir -p logs

# Construir imagen
echo ""
echo "[2/4] Construyendo imagen docker-tcp:latest..."
docker build -t docker-tcp:latest -f Dockerfile.unified .

# Asegurar permisos de ejecución en scripts
echo ""
echo "[3/4] Configurando permisos..."
chmod +x start-unified.sh
chmod +x entrypoint-unified.sh
echo "  ✓ Scripts con permisos de ejecución"

# Exportar imagen
echo ""
echo "[4/4] Exportando imagen a docker-tcp.tar..."
docker save -o docker-tcp.tar docker-tcp:latest

echo ""
echo "============================================"
echo "  ✓ Imagen creada correctamente"
echo "============================================"
ls -lh docker-tcp.tar
echo ""
echo "=== ARCHIVOS INCLUIDOS ==="
echo "  ✓ Dockerfile.unified    - Imagen sin secrets hardcodeados"
echo "  ✓ entrypoint-unified.sh - Inicio con verificación de BD"
echo "  ✓ start-unified.sh      - Script de ejecución seguro"
echo "  ✓ nginx-unified.conf    - Configuración de proxy"
echo "  ✓ supervisord.conf      - Gestión de procesos"
echo ""
echo "=== SEGURIDAD ==="
echo "  ✓ Secrets NO incluidos en la imagen"
echo "  ✓ Secrets se pasan en runtime via -e"
echo "  ✓ Capacidades de Docker limitadas (--cap-drop=ALL)"
echo ""
echo "=== PERSISTENCIA ==="
echo "  ✓ Datos de BD en volumen externo"
echo "  ✓ Logs en directorio local"
echo ""
echo "=== PARA EJECUTAR ==="
echo "  ./start-unified.sh"
echo ""
echo "Con secrets personalizados:"
echo "  ./start-unified.sh --jwt-secret 'mi_secret' --nextauth-secret 'otro_secret' --data-dir ./mis-datos"
echo ""
