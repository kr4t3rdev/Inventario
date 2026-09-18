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

## Migraciones de Base de Datos

Railway ejecuta `prisma db push` automáticamente al iniciar el contenedor.
Para migraciones manuales:
```bash
railway run npx prisma migrate deploy
```

## Railway CLI

- **Ruta:** `/Users/arturo/.nvm/versions/node/v22.19.0/bin/railway`
- **Importante:** Usar ruta absoluta en scripts (nvm no está en PATH de cron/background)
- **Link:** `railway link -p serene-surprise -s FinanceMDM`
- **Bug conocido:** Cloudflare puede bloquear `backboard.railway.com`. Si ocurre, reintentar tras ~10 minutos.

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

## Troubleshooting

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Build falla | Error de compilación | `railway logs -s FinanceMDM -n 100` |
| App no responde | Container crash | `railway restart -s FinanceMDM -y` |
| CLI bloqueado | Cloudflare | Esperar ~10 min, reintentar |
| Prisma validation error | Campo no existe en schema | Revisar logs, el error marca el campo con `~~~~` |
