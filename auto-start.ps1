# ============================================
# Configurar Inicio Automático - Windows
# ============================================
# Uso: .\auto-start.ps1 [-action <install|uninstall>]
#
# Acciones:
#   install   - Configurar inicio automático (default)
#   uninstall - Eliminar inicio automático
#
# Este script configura Docker Desktop y el contenedor
# para iniciar automáticamente con Windows
#
# Ejemplo:
#   .\auto-start.ps1 -action install
# ============================================

param(
    [string]$action = "install"
)

$CONTAINER_NAME = "tcp-sistema"
$DOCKER_DESKTOP_NAME = "Docker Desktop"

function Install-AutoStart {
    Write-Host "============================================"
    Write-Host "  Configurar Inicio Automático"
    Write-Host "============================================"
    Write-Host ""

    # Verificar que Docker está instalado
    $dockerPath = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerPath) {
        Write-Host "Error: Docker no está instalado"
        exit 1
    }

    # Verificar que el contenedor existe
    $containerExists = docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" 2>$null
    if ($containerExists -ne $CONTAINER_NAME) {
        Write-Host "Error: El contenedor $CONTAINER_NAME no existe"
        Write-Host "Cree el contenedor primero con: .\start-unified.ps1"
        exit 1
    }

    # Verificar que el contenedor está ejecutándose
    $containerRunning = docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>$null
    if ($containerRunning -ne "true") {
        Write-Host "El contenedor no está ejecutándose. Iniciándolo..."
        docker start $CONTAINER_NAME
        Start-Sleep -Seconds 5
    }

    # Configurar restart policy del contenedor
    Write-Host "Configurando restart policy del contenedor..."
    docker update --restart=always $CONTAINER_NAME 2>&1 | Out-Null

    # Verificar Docker Desktop está configurado para iniciar automáticamente
    Write-Host "Verificando Docker Desktop..."

    # Obtener ruta de Docker Desktop
    $dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktopPath) {
        # Verificar si existe el registro de auto-start
        $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        $regName = "DockerDesktop"

        $existingEntry = Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue

        if (-not $existingEntry) {
            Write-Host "Agregando Docker Desktop al inicio automático..."
            Set-ItemProperty -Path $regPath -Name $regName -Value "`"$dockerDesktopPath`""
        } else {
            Write-Host "  Docker Desktop ya está configurado para iniciar automáticamente"
        }
    } else {
        Write-Host "  Docker Desktop no encontrado en ubicación estándar"
        Write-Host "  Asegúrese de que Docker Desktop esté configurado para iniciar automáticamente"
    }

    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Configuración completada"
    Write-Host "============================================"
    Write-Host "  Contenedor: $CONTAINER_NAME"
    Write-Host "  Restart Policy: always"
    Write-Host ""
    Write-Host "  El contenedor se iniciarán automáticamente"
    Write-Host "  cuando Docker Desktop esté ejecutándose"
    Write-Host "============================================"
}

function Uninstall-AutoStart {
    Write-Host "============================================"
    Write-Host "  Eliminar Inicio Automático"
    Write-Host "============================================"
    Write-Host ""

    # Verificar que el contenedor existe
    $containerExists = docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" 2>$null
    if ($containerExists -eq $CONTAINER_NAME) {
        # Quitar restart policy
        Write-Host "Quitando restart policy del contenedor..."
        docker update --restart=no $CONTAINER_NAME 2>&1 | Out-Null
        Write-Host "  ✓ Restart policy eliminada"
    }

    # Quitar Docker Desktop del inicio automático
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $regName = "DockerDesktop"

    $existingEntry = Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue
    if ($existingEntry) {
        Write-Host "Quitando Docker Desktop del inicio automático..."
        Remove-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue
        Write-Host "  ✓ Docker Desktop eliminado del inicio"
    }

    Write-Host ""
    Write-Host "Inicio automático eliminado correctamente"
}

switch ($action.ToLower()) {
    "install" { Install-AutoStart }
    "uninstall" { Uninstall-AutoStart }
    default {
        Write-Host "Acción no válida: $action"
        Write-Host "Usar: install o uninstall"
        exit 1
    }
}
