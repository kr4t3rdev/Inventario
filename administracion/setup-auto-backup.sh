#!/bin/bash

# ============================================
# Configurar Backups Diarios Automáticos
# ============================================

set -e

echo "============================================"
echo "  Configurar Backups Diarios Automáticos"
echo "============================================"

# Ruta absoluta al directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${PROJECT_DIR}/backup-db.sh"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Crear directorio de backups
mkdir -p "${BACKUP_DIR}"

echo ""
echo "Directorio del proyecto: ${PROJECT_DIR}"
echo "Directorio de backups:   ${BACKUP_DIR}"
echo ""

# Detectar sistema operativo
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - usar launchd
    echo "Configurando backup diario en macOS (launchd)..."
    
    PLIST_FILE="$HOME/Library/LaunchAgents/com.tcp.inventario.backup.plist"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tcp.inventario.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${BACKUP_SCRIPT}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${BACKUP_DIR}/backup.log</string>
    <key>StandardErrorPath</key>
    <string>${BACKUP_DIR}/backup-error.log</string>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
</dict>
</plist>
EOF

    # Cargar el plist
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    
    echo ""
    echo "============================================"
    echo "  ✓ Backup diario configurado (macOS)"
    echo "============================================"
    echo "  Hora:      02:00 AM diario"
    echo "  Ubicación: ${BACKUP_DIR}/"
    echo "  Logs:      ${BACKUP_DIR}/backup.log"
    echo ""
    echo "  Comandos útiles:"
    echo "    Ver estado:  launchctl list | grep tcp"
    echo "    Detener:     launchctl unload ${PLIST_FILE}"
    echo "    Iniciar:     launchctl load ${PLIST_FILE}"
    echo "============================================"

else
    # Linux - usar cron
    echo "Configurando backup diario en Linux (cron)..."
    
    # Crear entrada de cron
    CRON_JOB="0 2 * * * cd ${PROJECT_DIR} && ${BACKUP_SCRIPT} >> ${BACKUP_DIR}/backup.log 2>&1"
    
    # Agregar al crontab
    (crontab -l 2>/dev/null | grep -v "backup-db.sh"; echo "$CRON_JOB") | crontab -
    
    echo ""
    echo "============================================"
    echo "  ✓ Backup diario configurado (Linux/cron)"
    echo "============================================"
    echo "  Hora:      02:00 AM diario"
    echo "  Ubicación: ${BACKUP_DIR}/"
    echo "  Logs:      ${BACKUP_DIR}/backup.log"
    echo ""
    echo "  Comandos útiles:"
    echo "    Ver cron:    crontab -l"
    echo "    Editar cron: crontab -e"
    echo "============================================"
fi
