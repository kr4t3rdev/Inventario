# ============================================
# Iniciar Sistema Unificado TCP - Windows
# ============================================
# Uso: .\start-unified.ps1 [opciones]
#
# Opciones:
#   -jwtSecret "secret"      JWT secret (o usar JWT_SECRET env)
#   -nextauthSecret "secret" NextAuth secret (o usar NEXTAUTH_SECRET env)
#   -dbPassword "password"   Password de BD (default: Soyelamo32++)
#   -port 80                 Puerto externo (default: 80)
#   -dataDir .\data          Directorio de datos persistentes
#
# Ejemplo:
#   .\start-unified.ps1 -jwtSecret "mi_secret" -nextauthSecret "otro_secret" -dataDir .\tcp-data
# ============================================

param(
    [string]$jwtSecret,
    [string]$nextauthSecret,
    [string]$dbPassword = "Soyelamo32++",
    [int]$port = 80,
    [string]$dataDir = ".\tcp-data"
)

# Usar variables de entorno si no se pasaron argumentos
if (-not $jwtSecret) {
    $jwtSecret = $env:JWT_SECRET
    if (-not $jwtSecret) {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $jwtSecret = [Convert]::ToBase64String($bytes)
    }
}

if (-not $nextauthSecret) {
    $nextauthSecret = $env:NEXTAUTH_SECRET
    if (-not $nextauthSecret) {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $nextauthSecret = [Convert]::ToBase64String($bytes)
    }
}

Write-Host "============================================"
Write-Host "  Sistema de Inventario TCP"
Write-Host "============================================"

# Crear directorio de datos si no existe
$postgresDir = Join-Path $dataDir "postgres"
$logsDir = Join-Path $dataDir "logs"

if (-not (Test-Path $postgresDir)) {
    New-Item -ItemType Directory -Path $postgresDir -Force | Out-Null
}
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

Write-Host ""
Write-Host "Configuración:"
Write-Host "  Puerto:      $port"
Write-Host "  Datos:       $dataDir\"
Write-Host "  JWT Secret:  $($jwtSecret.Substring(0, [Math]::Min(10, $jwtSecret.Length)))..."
Write-Host ""

# Detener contenedor existente
docker stop tcp-sistema 2>$null
docker rm tcp-sistema 2>$null

# Obtener rutas absolutas y convertir para Docker
$postgresDir = (Resolve-Path $postgresDir).Path -replace '\\', '\\\\'
$logsDir = (Resolve-Path $logsDir).Path -replace '\\', '\\\\'

Write-Host "Iniciando contenedor..."

# Iniciar contenedor con persistencia y seguridad
$volPostgres = "${postgresDir}:/var/lib/postgresql/data"
$volLogs = "${logsDir}:/var/log/tcp"

docker run -d `
    --name tcp-sistema `
    -p ${port}:80 `
    -e JWT_SECRET="${jwtSecret}" `
    -e NEXTAUTH_SECRET="${nextauthSecret}" `
    -e NEXTAUTH_URL="http://localhost:${port}" `
    -e DATABASE_URL="postgresql://inventario:${dbPassword}@localhost:5432/inventario_db?schema=public" `
    -e DB_PASSWORD="${dbPassword}" `
    -v $volPostgres `
    -v $volLogs `
    --read-only=false `
    --privileged=true `
    --security-opt "no-new-privileges=true" `
    --cap-drop=ALL `
    --cap-add=CHOWN `
    --cap-add=SETUID `
    --cap-add=SETGID `
    --cap-add=NET_BIND_SERVICE `
    --cap-add=NET_ADMIN `
    --health-cmd="powershell -Command Invoke-WebRequest -Uri http://localhost/api/health -UseBasicParsing -ErrorAction SilentlyContinue" `
    --health-interval=30s `
    --health-timeout=10s `
    --health-retries=3 `
    --health-start-period=60s `
    docker-tcp:latest

Write-Host ""
Write-Host "Esperando a que el sistema inicie..."
Start-Sleep -Seconds 10

# Verificar si está funcionando
$retries = 0
$maxRetries = 30
$systemReady = $false

while ($retries -le $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/api/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $systemReady = $true
            break
        }
    } catch {
        # Continue waiting
    }
    Write-Host "  Esperando... ($retries)"
    Start-Sleep -Seconds 3
    $retries++
}

if (-not $systemReady) {
    Write-Host ""
    Write-Host "El sistema puede estar iniciando."
    Write-Host "  Ver logs: docker logs tcp-sistema"
} else {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Sistema iniciado correctamente"
    Write-Host "============================================"
    Write-Host "  URL:      http://localhost:$port"
    Write-Host "  Datos:    $dataDir\"
    Write-Host "  Logs:     docker logs tcp-sistema"
    Write-Host ""
    Write-Host "  Para crear admin: docker exec -it tcp-sistema npx prisma db push --accept-data-loss --skip-generate"
    Write-Host "  Para detener:     docker stop tcp-sistema"
    Write-Host "============================================"
}
