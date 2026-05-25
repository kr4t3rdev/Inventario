# Proposal: Admin Database Backup System

## Intent

Implementar un sistema completo de backups de base de datos accesible desde el Admin Panel, diseñado para funcionar en **múltiples entornos de producción** (Vercel serverless, Railway containers, o cualquier host Node.js).

Actualmente los backups solo se pueden hacer vía scripts shell con Docker (`administracion/backup-db.sh`), lo cual no funciona en Vercel ni Railway moderno. Necesitamos un **motor de backup 100% Node.js, platform-agnostic** que permita:

- Ejecutar backups completos y por tenant desde la UI
- Programar backups automáticos (planes por tenant y generales)
- Almacenar backups en Vercel Blob **o** en filesystem local (Railway Volumes)
- Descargar y restaurar backups desde el panel
- Tracking completo con historial y notificaciones

## Scope

### In Scope

1. **Backup Engine Node.js** — motor de dump que extrae schema + datos vía PostgreSQL directo (`pg` client), genera SQL INSERT statements y comprime con gzip. Sin dependencia de `pg_dump` ni Docker. **Funciona idéntico en Vercel, Railway, o cualquier host.**
2. **Pluggable Storage** — dos adaptadores: **Vercel Blob** (para Vercel) y **LocalFS** (para Railway Volumes / filesystem local). Se selecciona vía env vars, sin cambiar el engine.
3. **Full DB Backup** — dump completo: todas las tablas con CREATE TABLE + INSERTs, ordenado por dependencias FK.
4. **Per-Tenant Backup** — dump filtrado por `tenantId` en tablas scoped; tablas globales (Users, Plans, etc.) se incluyen como referencia.
5. **Config Backup** — exporta solo metadatos del sistema (tenants, planes, licencias, usuarios) sin data operacional pesada.
6. **BackupLog Model** — nueva tabla Prisma para trackear cada backup (tipo, tenant, estado, tamaño, URL, creador, timestamps).
6. **Backup Dashboard UI** — página `/admin/backups` con tabla de historial, filtros, acciones (descargar, restaurar, eliminar).
7. **Descarga 1-click** — signed URLs desde Vercel Blob para download directo.
8. **Restore con doble confirmación** — flujo de restore con confirmación + rollback on failure.
9. **Backup Plans Model** — nueva tabla Prisma para planes de backup programados (tipo, tenant, schedule cron, retención).
10. **Vercel Cron Jobs** — scheduling automático vía `vercel.json` + API route que ejecuta los planes.
11. **Notificaciones** — toast + notificación en-app cuando un backup programado se completa o falla.
12. **Sidebar Navigation** — nuevo ítem "Backups" en el grupo "Herramientas" del Admin Sidebar.

### Out of Scope

- Backup a servicios externos (S3, GCS) — solo Vercel Blob o LocalFS inicialmente, S3 como mejora futura
- Backup incremental — siempre dump completo
- Streaming replication o Point-in-Time Recovery (PITR) — eso es responsabilidad del proveedor DB (Neon ya lo tiene)
- UI de gestión de archivos Blob (listar/eliminar archivos huérfanos)
- Local backups en entorno de desarrollo (pueden seguir usando los scripts shell existentes)

## Approach

### Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    Admin Panel UI                       │
│  /admin/backups                                         │
│  - Dashboard (historial, filtros, acciones)              │
│  - Trigger backup (full / tenant / config)              │
│  - Backup Plans (CRUD + toggle on/off)                  │
│  - Restore wizard                                       │
└───────────────┬─────────────────────────────────────────┘
                │ Server Actions (withAction)
┌───────────────▼─────────────────────────────────────────┐
│              Backup Engine (Node.js)                     │
│                                                          │
│  SchemaReader ─► query information_schema + pg_class    │
│       │              → reconstruye CREATE TABLE DDL     │
│       ▼                                                 │
│  DataExporter ─► SELECT * con cursor pagination         │
│       │              → genera INSERT statements          │
│       ▼                                                 │
│  SQLBuilder ─► ensambla dump.sql ordenado por FKs      │
│       │                                                 │
│       ▼                                                 │
│  Compressor ─► gzip (zlib) → dump.sql.gz               │
│       │                                                 │
│       ▼                                                 │
│  ┌──────────────────┐   ┌─────────────────────┐        │
│  │ Vercel Blob Adap.│   │  LocalFS Adapter    │        │
│  │ (Vercel)         │   │  (Railway / Local)  │        │
│  └────────┬─────────┘   └──────────┬──────────┘        │
│           │                        │                    │
│           ▼                        ▼                    │
│    Vercel Blob              Railway Volume /            │
│    Storage                  ./backups/ directory        │
│           │                        │                    │
│           ▼────────────────────────▼                    │
│  BackupLog ← registra en DB (tipo, estado, path, etc.)│
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│              Scheduling                                  │
│                                                          │
│  ┌──────────────────┐   ┌─────────────────────┐        │
│  │ Vercel Cron      │   │ Railway Cron        │        │
│  │ (vercel.json)    │   │ (railway.json)      │        │
│  └──────────────────┘   └─────────────────────┘        │
│                                                          │
│  Ambos → /api/cron/backups (misma route)                │
│    → ejecuta BackupPlans vencidos                       │
│    → notifica resultados                                │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Full Backup

1. Admin hace clic en "Backup Full DB"
2. Server Action `createBackupAction({ type: 'full' })` valida permisos (solo admin)
3. Crea registro `BackupLog` con status `running`
4. Backup Engine ejecuta:
   a. `SchemaReader`: query `information_schema.tables` + `pg_class` + `pg_indexes` + `pg_constraint` → genera CREATE TABLE statements (orden topológico por FKs)
   b. `DataExporter`: para cada tabla en orden → `SELECT *` con paginación → genera INSERT statements
   c. Ensambla dump.sql, comprime con gzip
   d. Upload a Vercel Blob → obtiene URL pública (signed)
5. Actualiza `BackupLog`: status `completed`, fileUrl, fileSize, completedAt
6. Retorna al frontend → toast success, refresca dashboard

### Data Flow: Per-Tenant Backup

1. Admin selecciona tenant + "Backup this Tenant"
2. Server Action recibe `{ type: 'tenant', tenantId }`
3. SchemaReader genera CREATE TABLE (mismo que full)
4. DataExporter itera tablas y aplica `WHERE tenantId = ?` en las que tienen el campo
5. Igual flujo de compresión, upload y logging

### Storage: Estrategia Plugable

El motor de backup decide el backend de storage según la variable de entorno `BACKUP_STORAGE`:

#### Opción A: Vercel Blob (para Vercel serverless)

```
BACKUP_STORAGE=blob
BLOB_READ_WRITE_TOKEN=...
```

- Path pattern: `backups/{type}/{tenantId?}/{timestamp}_{type}.sql.gz`
- Signed URLs para descarga segura (expiran en 1h)
- Sin filesystem persistente necesario
- Retención: se eliminan del Blob al prunear

#### Opción B: LocalFS (para Railway con Volumes o cualquier host)

```
BACKUP_STORAGE=localfs
BACKUP_DIR=/data/backups       # Railway Volume mount point
# or
BACKUP_DIR=./backups           # Desarrollo local
```

- Path pattern: `{BACKUP_DIR}/{type}/{tenantId?}/{timestamp}_{type}.sql.gz`
- Railway Volume montado en `/data/backups` garantiza persistencia
- Descarga: API Route sirve el archivo estático con autenticación
- Retención: cleanup directo de archivos del filesystem
- **Ventaja sobre Blob**: sin límite de egress, sin costos de almacenamiento externo, control directo de los archivos

Ambos adaptores implementan la misma interfaz: `save(path, buffer) → string`, `get(path) → Readable`, `delete(path) → void`, `list(prefix) → string[]`.

### Scheduling: Según el Host

Ambos hosts apuntan a la **misma API route** `/api/cron/backups` — el handler es idéntico, solo cambia la configuración:

#### En Vercel

```json
// vercel.json
{
  "cron": [
    { "path": "/api/cron/backups", "schedule": "0 * * * *" }
  ]
}
```

#### En Railway

```json
// railway.json o desde dashboard
{
  "cron": [
    { "path": "/api/cron/backups", "schedule": "0 * * * *" }
  ]
}
```

O usando un worker interno con `node-cron` como fallback simple si no hay cron nativo.

- `/api/cron/backups` ejecuta cada hora
- Busca BackupPlans con `enabled = true` y `nextRunAt <= now()`
- Ejecuta el backup correspondiente
- Actualiza `lastRunAt` y calcula `nextRunAt`
- Envía notificación si falla

### Restore Flow

1. Admin selecciona backup de la tabla → clic "Restaurar"
2. Modal de confirmación: "Esto va a sobrescribir datos existentes. ¿Tenés otro backup reciente?"
3. Segunda confirmación: tipear "RESTORE" para habilitar el botón
4. Server Action `restoreBackupAction`:
   a. Descarga el archivo .sql.gz desde Vercel Blob
   b. Descomprime
   c. Para **tenant backup**: DELETE de datos existentes del tenant + INSERT desde backup (todo en transacción)
   d. Para **full backup**: TRUNCATE + INSERT en orden (peligroso, requiere confirmación extra)
   e. Si algo falla → ROLLBACK automático
5. Log del restore en BackupLog con tipo `restore`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Nuevos modelos `BackupLog`, `BackupPlan` + enums |
| `src/generated/prisma/` | Regenerated | Post-generate |
| `src/features/backups/` | **New** | Feature completa: actions, components, types, schemas |
| `src/features/backups/actions.ts` | **New** | Server Actions: createBackup, getBackups, deleteBackup, restoreBackup, createPlan, updatePlan, deletePlan, getPlans |
| `src/features/backups/backup-engine.ts` | **New** | Core engine: SchemaReader, DataExporter, SQLBuilder, Compressor, BlobUploader |
| `src/features/backups/components/` | **New** | BackupDashboard, BackupHistoryTable, BackupTriggerDialog, RestoreDialog, PlanForm, PlanList |
| `src/features/backups/hooks/` | **New** | Custom hooks |
| `src/features/backups/schemas.ts` | **New** | Zod schemas |
| `src/features/backups/index.ts` | **New** | Barrel exports |
| `src/app/admin/backups/page.tsx` | **New** | Ruta del dashboard |
| `src/app/api/cron/backups/route.ts` | **New** | Cron handler para scheduled backups |
| `src/components/admin-sidebar.tsx` | Modified | +1 ítem en "Herramientas" |
| `package.json` | Modified | +`@vercel/blob`, +`pg` |
| `vercel.json` | Modified | +cron config |
| `.env` | Modified | +`BLOB_READ_WRITE_TOKEN` (Vercel Blob) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Timeout en backups grandes** (>500MB) en Vercel | Medium | Vercel Background Functions (15min) o `waitUntil()`. Railway no tiene este límite por ser container |
| **Memoria insuficiente** en serverless | Medium | Streaming con buffers de 1000 registros, no cargar tablas enteras en RAM |
| **FK violations en restore** por orden incorrecto | High | Query `pg_constraint` para orden topológico estricto. Transacción con ROLLBACK automático |
| **Costo Blob** si hay backups frecuentes en Vercel | Low | Usar LocalFS en Railway evita este costo. Retención configurable |
| **Railway Volume persistence** | Low | Los volúmenes Railway persisten entre deploys. Hacer backup de los backups a S3 opcional |
| **Error en medio de backup** deja registro "running" | Medium | Timeout detector + status "failed" automático si no se completa en X minutos |
| **Migración entre hosts** | Low | El engine es el mismo. Solo cambiar `BACKUP_STORAGE` env var + adaptador |

## Rollback Plan

1. **Revertir cambios de Prisma**: `prisma migrate down` para eliminar modelos BackupLog/BackupPlan
2. **Eliminar feature folder**: `rm -rf src/features/backups/`
3. **Restaurar sidebar**: revertir cambios en `src/components/admin-sidebar.tsx`
4. **Eliminar ruta**: `rm -rf src/app/admin/backups/`
5. **Eliminar cron**: revertir cambios en `vercel.json` o config de Railway
6. **Eliminar dependencias**: `pnpm remove @vercel/blob pg` (y `node-cron` si se agregó)
7. **Archivos de backup**: si se usó LocalFS, eliminar la carpeta de backups. Si se usó Blob, los archivos quedan huérfanos pero no afectan el sistema

## Dependencies

| Dependency | Razón |
|------------|-------|
| `@vercel/blob` | Solo si se usa Vercel como host + `BACKUP_STORAGE=blob` |
| `pg` (node-postgres) | Conexión directa a PostgreSQL para schema introspection y data export |
| `Vercel Pro` | Solo si se usa Vercel (cron jobs + background functions) |
| `Railway Volume` | Solo si se usa Railway (montar volumen persistente para backups) |
| `node-cron` | Solo como fallback para scheduling si el host no tiene cron nativo |

## Success Criteria

- [ ] Admin puede ejecutar un backup full DB desde la UI y verlo completado en < 5 min
- [ ] Admin puede ejecutar un backup por tenant y descargar el archivo
- [ ] Backup programado (cada hora) se ejecuta automáticamente y queda registrado
- [ ] Restore de un backup de tenant funciona: datos reemplazados correctamente
- [ ] Restore de full DB falla gracefulmente si hay violaciones de integridad
- [ ] Historial de backups muestra correctamente tipo, tamaño, fecha, estado
- [ ] Sidebar muestra el nuevo ítem "Backups" en Herramientas
- [ ] Tests unitarios del Backup Engine pasan
- [ ] Notificación aparece cuando un backup programado falla
