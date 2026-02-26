# ============================================
# Plan de Salvas - Windows
# ============================================
# Uso: .\plan-salvas.ps1 [-action <install|uninstall|run>] [-backupDir <directorio>]
#
# Acciones:
#   install   - Instalar tareas programadas (default)
#   uninstall - Eliminar tareas programadas
#   run       - Ejecutar backup inmediatamente
#
# Parametros:
#   -backupDir Directorio para guardar backups (default: .\backups)
#
# El plan ejecuta backups automaticos 2 veces al dia:
#   - 08:00 AM
#   - 06:00 PM
#
# Ejemplo:
#   .\plan-salvas.ps1 -action install
#   .\plan-salvas.ps1 -action uninstall
#   .\plan-salvas.ps1 -action run
# ============================================

param(
    [string]$action = "install",
    [string]$backupDir = ".\backups"
)

$TASK_NAME_MORNING = "TCP_Backup_Mañana"
$TASK_NAME_EVENING = "TCP_Backup_Tarde"
$SCRIPT_PATH = $MyInvocation.MyCommand.Path
$SCRIPT_DIR = Split-Path $SCRIPT_PATH -Parent

function Install-ScheduledTasks {
    Write-Host "============================================"
    Write-Host "  Instalando Plan de Salvas"
    Write-Host "============================================"
    Write-Host ""
    
    # Obtener ruta absoluta del script de backup
    $backupScript = Join-Path $SCRIPT_DIR "backup-bd.ps1"
    if (-not (Test-Path $backupScript)) {
        Write-Host "Error: No se encontró backup-bd.ps1 en $SCRIPT_DIR"
        exit 1
    }
    
    $backupScript = (Resolve-Path $backupScript).Path
    
    # Convertir a ruta Windows para el scheduler
    $backupScriptWin = $backupScript -replace '/', '\'
    
    # Tarea de la mañana (8:00 AM)
    $taskMorningExists = Get-ScheduledTask -TaskName $TASK_NAME_MORNING -ErrorAction SilentlyContinue
    if ($taskMorningExists) {
        Unregister-ScheduledTask -TaskName $TASK_NAME_MORNING -Confirm:$false
    }
    
    $actionMorning = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScriptWin`" -backupDir `"$backupDir`""
    $triggerMorning = New-ScheduledTaskTrigger -Daily -At "08:00"
    $settingsMorning = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    Register-ScheduledTask -TaskName $TASK_NAME_MORNING -Action $actionMorning -Trigger $triggerMorning -Settings $settingsMorning -Description "Backup automático de la base de datos TCP - Mañana" | Out-Null
    
    Write-Host "  ✓ Tarea matutina instalada (08:00 AM)"
    
    # Tarea de la tarde (6:00 PM)
    $taskEveningExists = Get-ScheduledTask -TaskName $TASK_NAME_EVENING -ErrorAction SilentlyContinue
    if ($taskEveningExists) {
        Unregister-ScheduledTask -TaskName $TASK_NAME_EVENING -Confirm:$false
    }
    
    $actionEvening = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScriptWin`" -backupDir `"$backupDir`""
    $triggerEvening = New-ScheduledTaskTrigger -Daily -At "18:00"
    $settingsEvening = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    Register-ScheduledTask -TaskName $TASK_NAME_EVENING -Action $actionEvening -Trigger $triggerEvening -Settings $settingsEvening -Description "Backup automático de la base de datos TCP - Tarde" | Out-Null
    
    Write-Host "  ✓ Tarea vespertina instalada (06:00 PM)"
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Plan de salvas instalado correctamente"
    Write-Host "============================================"
    Write-Host "  Directorio de backups: $backupDir"
    Write-Host "  Horarios: 08:00 AM y 06:00 PM"
    Write-Host "============================================"
}

function Uninstall-ScheduledTasks {
    Write-Host "============================================"
    Write-Host "  Desinstalando Plan de Salvas"
    Write-Host "============================================"
    Write-Host ""
    
    $taskMorning = Get-ScheduledTask -TaskName $TASK_NAME_MORNING -ErrorAction SilentlyContinue
    if ($taskMorning) {
        Unregister-ScheduledTask -TaskName $TASK_NAME_MORNING -Confirm:$false
        Write-Host "  ✓ Tarea matutina eliminada"
    }
    
    $taskEvening = Get-ScheduledTask -TaskName $TASK_NAME_EVENING -ErrorAction SilentlyContinue
    if ($taskEvening) {
        Unregister-ScheduledTask -TaskName $TASK_NAME_EVENING -Confirm:$false
        Write-Host "  ✓ Tarea vespertina eliminada"
    }
    
    Write-Host ""
    Write-Host "Plan de salvas desinstalado correctamente"
}

function Run-BackupNow {
    Write-Host "============================================"
    Write-Host "  Ejecutando Backup Manual"
    Write-Host "============================================"
    Write-Host ""
    
    & "$SCRIPT_DIR\backup-bd.ps1" -backupDir $backupDir
}

switch ($action.ToLower()) {
    "install" { Install-ScheduledTasks }
    "uninstall" { Uninstall-ScheduledTasks }
    "run" { Run-BackupNow }
    default {
        Write-Host "Acción no válida: $action"
        Write-Host "Usar: install, uninstall o run"
        exit 1
    }
}
