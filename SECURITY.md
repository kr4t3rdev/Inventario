# ============================================
# Guía de Seguridad - Sistema TCP
# ============================================

## 📋 RESUMEN DE PROTECCIONES

### 1. PROTECCIÓN DE APLICACIÓN (Nginx)

| Protección | Descripción |
|------------|-------------|
| Rate Limiting | Limita requests por IP |
| Connection Limit | Limita conexiones simultáneas |
| Security Headers | X-Frame-Options, XSS-Protection, etc. |
| File Protection | Bloquea acceso a .env, .git, etc. |
| Gzip Compression | Reduce tamaño de respuesta |
| Server Tokens | Oculta versión de nginx |

### 2. PROTECCIÓN DE BASE DE DATOS

| Protección | Descripción |
|------------|-------------|
| Puerto cerrado | 5432 no expuesto externamente |
| Red interna | Solo contenedores en tcp_app-network |
| Usuario dedicado | Usuario "inventario" no root |
| Password fuerte | Cambiar password por defecto |

### 3. RATE LIMITS CONFIGURADOS

| Endpoint | Límite | Burst |
|----------|--------|-------|
| General (/) | 10 req/s | 20 |
| API (/api/*) | 5 req/s | 10 |
| Login | 3 req/s | 5 |
| Register | 3 req/s | 3 |

---

## 🔒 CONFIGURACIÓN PASO A PASO

### Paso 1: Aplicar configuración segura

```bash
./setup-security.sh
```

### Paso 2: Cambiar passwords por defecto

```bash
# Cambiar password de PostgreSQL
docker exec -it inventario-db psql -U inventario -d inventario_db
ALTER USER inventario WITH PASSWORD 'nuevo_password_seguro';
\q

# Actualizar en el contenedor de la app
docker stop inventario-app
docker rm inventario-app

# Crear con nuevo password
docker run -d --name inventario-app \
    --network tcp_app-network \
    -e DATABASE_URL="postgresql://inventario:NUEVO_PASSWORD@inventario-db:5432/inventario_db?schema=public" \
    ...
```

### Paso 3: Configurar HTTPS (Recomendado)

```bash
# Generar certificado self-signed (para desarrollo)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx.key -out nginx.crt

# O usar Let's Encrypt para producción
```

### Paso 4: Configurar Firewall del Sistema

#### macOS:
```bash
# Bloquear todo excepto HTTP/HTTPS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/docker
```

#### Linux (ufw):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### Windows (PowerShell Admin):
```powershell
# Bloquear puerto 5432
New-NetFirewallRule -DisplayName "Block PostgreSQL" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block

# Permitir HTTP/HTTPS
New-NetFirewallRule -DisplayName "Allow HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

---

## 🛡️ BUENAS PRÁCTICAS

### 1. Secrets y Variables de Entorno

```bash
# NUNCA hardcodear secrets en el código
# Usar variables de entorno:

# Generar secrets seguros
JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Usar en docker run
docker run ... \
    -e JWT_SECRET="$JWT_SECRET" \
    -e NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    ...
```

### 2. Backups Seguros

```bash
# Backup con contraseña
docker exec inventario-db pg_dump -U inventario inventario_db | \
    openssl enc -aes-256-cbc -salt -pbkdf2 -out backup_encrypted.sql

# Restaurar
openssl enc -aes-256-cbc -d -pbkdf2 -in backup_encrypted.sql | \
    docker exec -i inventario-db psql -U inventario inventario_db
```

### 3. Monitoreo de Logs

```bash
# Ver accesos sospechosos
docker logs inventario-nginx | grep -E "(40[0-9]|50[0-9])"

# Ver intentos de login fallidos
docker logs inventario-app | grep -i "failed\|error\|unauthorized"

# Ver conexiones a BD
docker logs inventario-db | grep -i "connection\|error"
```

### 4. Actualizaciones

```bash
# Actualizar imágenes base regularmente
docker pull node:20
docker pull postgres:16-alpine
docker pull nginx:alpine

# Reconstruir app
./update-app.sh
```

---

## 📊 VERIFICAR SEGURIDAD

### Check de puertos expuestos:
```bash
# Desde fuera del servidor
nmap localhost

# Debería mostrar solo:
# 80/tcp   open  http
# 443/tcp  open  https (si está configurado)
```

### Verificar headers:
```bash
curl -I http://localhost

# Debería incluir:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

### Verificar rate limiting:
```bash
# Hacer múltiples requests rápidos
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost/; done

# Después del burst, debería retornar 429
```

---

## 🚨 RESPUESTA A INCIDENTES

### Si detectas acceso no autorizado:

1. **Cambiar todas las contraseñas**
2. **Revisar logs de acceso**
3. **Bloquear IP sospechosa**
4. **Restaurar backup limpio**

```bash
# Bloquear IP específica (temporal)
docker exec inventario-nginx nginx -s reload

# Ver sesiones activas
docker exec inventario-db psql -U inventario -d inventario_db \
    -c "SELECT * FROM \"UserSession\" ORDER BY \"createdAt\" DESC LIMIT 10;"

# Invalidar todas las sesiones
docker exec inventario-db psql -U inventario -d inventario_db \
    -c "DELETE FROM \"UserSession\";"
```

---

## 📝 CHECKLIST DE SEGURIDAD

- [ ] Rate limiting configurado
- [ ] Headers de seguridad activos
- [ ] Base de datos no expuesta
- [ ] Passwords cambiados
- [ ] HTTPS configurado (producción)
- [ ] Firewall activo
- [ ] Backups encriptados
- [ ] Logs monitoreados
- [ ] Secrets seguros (mínimo 32 caracteres)
- [ ] Actualizaciones programadas
