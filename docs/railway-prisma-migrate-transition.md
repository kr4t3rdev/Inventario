# Railway → Prisma Migrate Transition

## Estado actual verificado

- Producción en Railway **ya tiene** cambios de schema aplicados (por ejemplo `Notification.link`).
- La base **no tiene** `public._prisma_migrations`.
- El deploy actual usa `prisma db push`, no `prisma migrate deploy`.

## Objetivo

Pasar Railway a un flujo auditable y reproducible con `prisma migrate deploy`.

## Riesgo principal

No cambiar el deploy directo a `migrate deploy` sobre la base actual.

Si la DB no está baselineada, Prisma Migrate no tiene historial y el cambio puede fallar o quedar inconsistente.

## Estrategia segura

### 1. Hacer backup de producción

Antes de cualquier cambio de estrategia.

### 2. Baselinear migraciones existentes

Usar el script:

```bash
export DATABASE_URL="postgresql://...produccion..."
./scripts/baseline-prisma-migrations.sh
```

Esto marca las migraciones locales como aplicadas en `_prisma_migrations` sin reejecutarlas.

### 3. Verificar estado

```bash
pnpm exec prisma migrate status
```

Esperado:
- `_prisma_migrations` existe
- no hay migraciones pendientes inmediatamente después del baseline

### 4. Activar Prisma Migrate en el deploy

Una vez baselineado Railway:

- configurar:

```bash
PRISMA_MIGRATION_MODE=migrate-deploy
```

- mantener `prisma generate`

## Archivos del repo que hoy usan `db push`

- `start.sh`
- `vercel.json`
- `entrypoint-unified.sh`
- `administracion/entrypoint-unified.sh`

## Cambio ya preparado en el repo

El repo ahora centraliza la sincronización en:

- `scripts/run-prisma-schema-sync.sh`

Modos soportados:

- `PRISMA_MIGRATION_MODE=db-push` (default actual, compatibilidad)
- `PRISMA_MIGRATION_MODE=migrate-deploy` (objetivo después del baseline)

## Recomendación

Primero baselinear Railway.  
Después, activar `PRISMA_MIGRATION_MODE=migrate-deploy` en el entorno.
