#!/bin/bash

# ============================================
# Configurar Inicio Automático - Mac
# ============================================
# Uso: ./auto-start.sh [install|uninstall]
#
# Acciones:
#   install   - Configurar inicio automático (default)
#   uninstall - Eliminar inicio automático
#
# Este script configura Docker Desktop y el contenedor
# para iniciar automáticamente con Mac
#
# Ejemplo:
#   ./auto-start.sh install
#   ./auto-start.sh uninstall
# ============================================

set -e

CONTAINER_NAME="tcp-sistema"
ACTION="${1:-install}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

install_autostart() {
    echo "============================================"
    echo "  Configurar Inicio Automático"
    echo "============================================"
    echo ""

    # Verificar que Docker está instalado
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no está instalado${NC}"
        exit 1
    fi

    # Verificar que el contenedor existe
    if ! docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}Error: El contenedor $CONTAINER_NAME no existe${NC}"
        echo "Cree el contenedor primero con: ./start-unified.sh"
        exit 1
    fi

    # Verificar que el contenedor está ejecutándose
    CONTAINER_RUNNING=$(docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>/dev/null || echo "false")
    if [ "$CONTAINER_RUNNING" != "true" ]; then
        echo "El contenedor no está ejecutándose. Iniciándolo..."
        docker start $CONTAINER_NAME
        sleep 5
    fi

    # Configurar restart policy del contenedor
    echo "Configurando restart policy del contenedor..."
    docker update --restart=always $CONTAINER_NAME

    # Verificar si Docker Desktop está en LaunchAgents
    DOCKER_LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.docker.docker.plist"
    DOCKER_DESKTOP_APP="/Applications/Docker.app"

    if [ -d "$DOCKER_DESKTOP_APP" ]; then
        # Crear LaunchAgent para Docker Desktop si no existe
        if [ ! -f "$DOCKER_LAUNCH_AGENT" ]; then
            echo "Creando LaunchAgent para Docker Desktop..."
            mkdir -p "$HOME/Library/LaunchAgents"
            
            cat > "$DOCKER_LAUNCH_AGENT" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.docker.docker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Docker.app/Contents/MacOS/Docker</string>
        <string>--autostart</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
            chmod 644 "$DOCKER_LAUNCH_AGENT"
            echo -e "${GREEN}  Docker Desktop configurado para iniciar automáticamente${NC}"
        else
            echo -e "${YELLOW}  Docker Desktop ya está configurado para iniciar automáticamente${NC}"
        fi
    else
        echo -e "${YELLOW}  Docker Desktop no encontrado en /Applications${NC}"
        echo "  Asegúrese de que Docker Desktop esté configurado para iniciar automáticamente"
    fi

    echo ""
    echo "============================================"
    echo "  Configuración completada"
    echo "============================================"
    echo "  Contenedor: $CONTAINER_NAME"
    echo "  Restart Policy: always"
    echo ""
    echo "  El contenedor se iniciarán automáticamente"
    echo "  cuando Docker Desktop esté ejecutándose"
    echo "============================================"
}

uninstall_autostart() {
    echo "============================================"
    echo "  Eliminar Inicio Automático"
    echo "============================================"
    echo ""

    # Quitar restart policy del contenedor
    if docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "Quitando restart policy del contenedor..."
        docker update --restart=no $CONTAINER_NAME
        echo -e "${GREEN}  ✓ Restart policy eliminada${NC}"
    fi

    # Quitar Docker Desktop del inicio automático
    DOCKER_LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.docker.docker.plist"
    if [ -f "$DOCKER_LAUNCH_AGENT" ]; then
        echo "Quitando Docker Desktop del inicio automático..."
        rm -f "$DOCKER_LAUNCH_AGENT"
        echo -e "${GREEN}  ✓ Docker Desktop eliminado del inicio${NC}"
    fi

    echo ""
    echo "Inicio automático eliminado correctamente"
}

case "$ACTION" in
    install)
        install_autostart
        ;;
    uninstall)
        uninstall_autostart
        ;;
    *)
        echo "Acción no válida: $ACTION"
        echo "Usar: install o uninstall"
        exit 1
        ;;
esac
