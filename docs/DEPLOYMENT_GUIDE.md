# Guía de Deployment — FinanceMDM en Railway

## Stack de Producción

- **Hosting:** Railway (proyecto `serene-surprise`, servicio `FinanceMDM`)
- **Base de datos:** PostgreSQL provisto por Railway
- **Rama de deploy:** `codex/upgrade-next-16`
- **Build:** Nixpacks (detección automática de Next.js)
- **URL:** https://kr4t3rdev.xyz

## Deploy Automático

1. Trabajar en local, commitar cambios
2. Hacer push a `origin codex/upgrade-next-16`
3. Railway detecta el push, construye y despliega (~2-5 min)
4. Verificar: `railway deployment list -s FinanceMDM` → status SUCCESS

## Aceptación de release

CI verde confirma los controles previos al despliegue; no confirma que Railway haya publicado
ese commit. Antes de declarar un release completo:

1. Confirma que todos los checks requeridos de CI terminaron correctamente.
2. En Railway, verifica que el despliegue activo corresponde al SHA completo esperado.
3. Ejecuta el workflow manual **Smoke post-deploy** para ese entorno y SHA. El smoke debe
   confirmar `/api/health` saludable, el entorno esperado y el mismo SHA.

Para staging, ejecuta la validación solo después de que staging tenga desplegado ese SHA.
No marques el release como completo si el despliegue no coincide exactamente o el smoke falla.

## Migraciones de Base de Datos

Railway ejecuta `prisma db push` automáticamente al iniciar el contenedor.
Para migraciones manuales:
```bash
railway run npx prisma migrate deploy
```

## Railway CLI

- **Ruta:** `/opt/homebrew/bin/railway` (instalado via Homebrew)
- **Link:** `railway link -p serene-surprise -s FinanceMDM`
- **Bug conocido:** Cloudflare puede bloquear `backboard.railway.com`. Si ocurre, reintentar tras ~10 minutos.
- **Deploys con commits solo-docs:** Railway puede marcar el deploy como `SKIPPED` (watch patterns). Un cambio de variable hereda ese skip: forzar con `railway deployment redeploy -s FinanceMDM -y` para que el runtime tome las variables nuevas.

## Health Check

```bash
curl -sI https://kr4t3rdev.xyz/ | grep HTTP
# → HTTP/2 200

curl -s --max-time 10 https://kr4t3rdev.xyz/api/health
```

## Logs

```bash
railway logs -s FinanceMDM -n 50
```

## Variables de Entorno

Gestionadas desde Railway Dashboard → Variables. No hay `.env` en producción.
Para ver:
```bash
railway variables -s FinanceMDM -k
```

### Google OAuth (login "Continuar con Google")

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: credenciales del OAuth client en Google Cloud Console.
- `GOOGLE_REDIRECT_URI`: **debe usar el dominio de producción** (`https://kr4t3rdev.xyz/api/auth/google/callback`). Si apunta a `http://localhost:3000/...`, Google redirige el navegador a la máquina del usuario y el login se rompe (fix de 2026-10-23).
- La misma URI debe estar registrada en Google Cloud Console → Credentials → Authorized redirect URIs.
- Verificación rápida:
```bash
curl -s -o /dev/null -w "%{redirect_url}\n" https://kr4t3rdev.xyz/api/auth/google/authorize
# redirect_uri debe ser https%3A%2F%2Fkr4t3rdev.xyz%2Fapi%2Fauth%2Fgoogle%2Fcallback
```

## Troubleshooting

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Build falla | Error de compilación | `railway logs -s FinanceMDM -n 100` |
| "Continuar con Google" redirige a localhost tras consentir | `GOOGLE_REDIRECT_URI` apunta a `http://localhost:3000` en Railway | `railway variable set GOOGLE_REDIRECT_URI=https://kr4t3rdev.xyz/api/auth/google/callback -s FinanceMDM` + redeploy |
| Error 400 `redirect_uri_mismatch` de Google | URI no registrada en Google Cloud Console | Agregar la URI de producción en Credentials → Authorized redirect URIs |
| Variable de entorno no toma efecto tras `variable set` | Deploy SKIPPED por watch patterns (commit solo-docs) | `railway deployment redeploy -s FinanceMDM -y` |
| App no responde | Container crash | `railway restart -s FinanceMDM -y` |
| CLI bloqueado | Cloudflare | Esperar ~10 min, reintentar |
| Prisma validation error | Campo no existe en schema | Revisar logs, el error marca el campo con `~~~~` |
