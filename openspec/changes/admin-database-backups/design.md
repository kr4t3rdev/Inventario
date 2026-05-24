# Design: Admin Database Backup System

## Technical Approach

Motor de backup 100% Node.js que funciona contra cualquier PostgreSQL, sin dependencia de `pg_dump` ni Docker. El engine conecta directo a PostgreSQL vía `pg` (node-postgres), descubre schema mediante `information_schema` + catálogos del sistema, exporta datos con paginación por cursor, genera SQL dump ordenado por dependencias FK, comprime con gzip, y almacena via un adaptador plugable (Vercel Blob o LocalFS).

El scheduling se maneja con cron jobs del host (Vercel Cron, Railway Cron) o `node-cron` como fallback, todos apuntando a la misma API route `/api/cron/backups`.

## Architecture Decisions

### Decision: Pure Node.js engine over pg_dump

**Choice**: Engine basado en `pg` (node-postgres) con query a `information_schema` + SELECT paginado por tabla.

**Alternatives considered**:
1. `pg_dump` via `child_process.exec()` — requiere binario de PostgreSQL en el host, no disponible en Vercel
2. `pg_dump` via Docker exec — requiere Docker, no disponible en Vercel ni Railway sin configuración extra
3. Prisma `findMany()` en todos los modelos — lento, requiere mantener mapping manual de modelos, no captura tablas sin modelo Prisma

**Rationale**: El engine Node.js funciona en **cualquier host** (Vercel, Railway, desarrollo local). La conexión directa a PostgreSQL via `pg` client permite streaming eficiente y acceso a `information_schema` para descubrimiento dinámico de tablas sin necesidad de mantener un listado manual. No hay dependencias externas más allá de `pg`.

### Decision: Pluggable storage adapters over single storage

**Choice**: Interfaz `BackupStorage` abstracta con dos implementaciones: `VercelBlobStorage` y `LocalFSStorage`.

**Alternatives considered**:
1. Solo Vercel Blob — ata la feature a Vercel, no funciona en Railway
2. Solo LocalFS — no funciona en Vercel (no hay FS persistente)
3. S3 unificado — más complejo, requiere credenciales AWS, `@vercel/blob` es más simple para Vercel

**Rationale**: El patrón adapter permite cambiar de storage con solo cambiar una env var (`BACKUP_STORAGE`). En Railway se usa LocalFS con volúmenes persistentes (costo 0, control directo). En Vercel se usa Blob (sin FS persistente). El engine no sabe ni le importa dónde se guarda el archivo.

### Decision: Singleton `pg` pool over per-request connection

**Choice**: Pool de conexiones PostgreSQL dedicado para el backup engine (no el de Prisma).

**Alternatives considered**:
1. Usar el pool de Prisma — Prisma no expone el pool de `pg` directamente, haría wrapping complejo
2. Conexión por backup — overhead innecesario, las queries de schema requieren múltiples calls

**Rationale**: El engine necesita queries directas a `information_schema` y `pg_catalog` que Prisma no modela. Un pool separado de `pg` con `pg.Pool` es la práctica estándar. Se configura con la misma `DATABASE_URL` y se gestiona como singleton (misma vida que la app).

### Decision: SQL dump format over JSON

**Choice**: Archivo `.sql` con CREATE TABLE + INSERT statements, comprimido con gzip.

**Alternatives considered**:
1. JSONL (una línea JSON por registro) — más fácil de parsear programáticamente, pero no restaurable con herramientas SQL estándar
2. CSV por tabla — pierde tipos, no incluye schema, difícil de restaurar con FKs
3. Custom binary — rápido pero opaco, requiere herramienta propia para restore

**Rationale**: SQL es el formato universal de dump. Se puede restaurar con cualquier cliente PostgreSQL (`psql`, pgAdmin, etc.). Es humano-legible. Los INSERT statements son la forma más portátil. Gzip comprime ~10:1 para SQL.

### Decision: Background execution via `waitUntil` + status polling

**Choice**: La Server Action dispara el backup, responde inmediatamente con `{ backupLogId }`, el engine corre en background usando `waitUntil()`, y el frontend polltea el estado del BackupLog.

**Alternatives considered**:
1. Sync execution — la Server Action espera a que termine. Timeout de Vercel (60s) no alcanza para DBs grandes
2. WebSocket — sobreingeniería para esta feature
3. Server-Sent Events — más complejo, no justificado para polling simple

**Rationale**: `waitUntil()` es el mecanismo standard de Next.js/Vercel para tasks post-response. El frontend polltea cada 2s el estado del BackupLog. Simple, predecible, funciona en serverless y containers.

### Decision: Topological sort for FK ordering

**Choice**: Query a `pg_constraint` + `pg_class` para construir el grafo de dependencias FK y ordenar tablas con topological sort (Kahn's algorithm).

**Alternatives considered**:
1. Orden alfabético — falla si una tabla referencia a otra que aparece después
2. Orden manual hardcodeado — no escala, hay que mantenerlo al agregar tablas
3. `pg_dump` ordering — no disponible sin pg_dump

**Rationale**: El topological sort dinámico basado en las FKs reales de la base de datos garantiza que el dump siempre sea válido, sin importar qué tablas existan o cómo cambien. Kahn's algorithm es O(V+E) y detecta ciclos.

## Data Flow

### Manual Backup Trigger

```
┌──────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Browser │    │  Server Action   │    │  Backup Engine    │
│  (React) │    │  (withAction)    │    │  (backup-engine)  │
└────┬─────┘    └────────┬────────┘    └────────┬─────────┘
     │                   │                      │
     │ createBackup()    │                      │
     │──────────────────►│                      │
     │                   │                      │
     │                   │ 1. Auth check        │
     │                   │ 2. Create BackupLog  │
     │                   │    (status=running)  │
     │                   │ 3. Spawn engine      │
     │                   │    via waitUntil()   │
     │                   ├─────────────────────►│
     │ { backupLogId }   │                      │
     │◄──────────────────│                      │
     │                   │                      │
     │ poll status       │    ┌──────────┐      │
     │ every 2s ─────────┼───►│ BackupLog │     │
     │              │    │    │  (DB)     │      │
     │              │    │    └────┬─────┘      │
     │              │    │         │            │
     │              │    │         ▲            │
     │              │    │         │            │
     │ Engine running │    │    4. Engine:      │
     │              │    │    - SchemaReader    │
     │              │    │    - DataExporter    │
     │              │    │    - SQLBuilder      │
     │              │    │    - Compress gzip   │
     │              │    │    - Upload Blob/FS  │
     │              │    │    5. Update BackupLog│
     │              │    │       (completed/fail)│
     │              │    │                      │
     │ status=done  │    │                      │
     │◄──────────────────│                      │
     │                   │                      │
     │ Toast success     │                      │
     │ Refresh table     │                      │
```

### Scheduled Backup Flow

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────┐
│ Vercel/Rail │    │  /api/cron/      │    │  Backup      │
│ Cron Trigger│    │  backups route   │    │  Engine      │
└──────┬──────┘    └────────┬─────────┘    └──────┬───────┘
       │                    │                      │
       │ HTTP GET           │                      │
       │───────────────────►│                      │
       │                    │                      │
       │                    │ 1. Query BackupPlans │
       │                    │    WHERE enabled     │
       │                    │    AND nextRunAt<now │
       │                    │                      │
       │                    │ 2. For each plan:    │
       │                    │    - Execute backup  │
       │                    ├─────────────────────►│
       │                    │    - Update plan     │
       │                    │      (lastRunAt,     │
       │                    │       nextRunAt)     │
       │                    │                      │
       │                    │ 3. Prune old backups │
       │                    │    based on retention │
       │                    │                      │
       │ 200 { executed:N } │                      │
       │◄───────────────────│                      │
```

## Prisma Schema Changes

### New Models

```prisma
enum BackupType {
  full
  tenant
  config
}

enum BackupStatus {
  running
  completed
  failed
  pruned
  deleted
}

/// Registro de cada operación de backup o restore.
model BackupLog {
  backupLogId  String       @id @default(cuid())
  type         BackupType
  tenantId     String?
  status       BackupStatus
  fileUrl      String?      // URL en Vercel Blob o ruta local
  fileName     String?
  fileSize     Int?         // bytes
  startedAt    DateTime     @default(now())
  completedAt  DateTime?
  errorMessage String?
  createdBy    String       // userId
  createdAt    DateTime     @default(now())

  tenant Tenant? @relation(fields: [tenantId], references: [tenantId])
  user   User    @relation(fields: [createdBy], references: [userId])

  @@index([tenantId])
  @@index([status])
  @@index([createdAt])
  @@map("backup_logs")
}

/// Plan de backup programado.
model BackupPlan {
  backupPlanId String     @id @default(cuid())
  type         BackupType
  tenantId     String?
  schedule     String     // cron expression, ej: "0 2 * * *"
  enabled      Boolean    @default(true)
  retention    Int        @default(30) // días a conservar
  lastRunAt    DateTime?
  nextRunAt    DateTime?
  createdBy    String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  tenant Tenant? @relation(fields: [tenantId], references: [tenantId])
  user   User    @relation(fields: [createdBy], references: [userId])

  @@index([enabled, nextRunAt])
  @@index([tenantId])
  @@map("backup_plans")
}
```

### Model Conventions Used

- PascalCase model names (existing convention)
- `@@map("snake_case_table")` (existing convention)
- `cuid()` for IDs (existing convention)
- Enum names in PascalCase (existing convention)
- Relations use singular `tenant`, `user` (existing convention)

## File Structure

```
src/features/backups/
├── index.ts                          # Barrel exports
├── schemas.ts                        # Zod validation schemas
├── types.ts                          # Shared types
├── actions.ts                        # Server Actions
├── backup-engine.ts                  # Core engine (SchemaReader, DataExporter, SQLBuilder)
├── storage/
│   ├── types.ts                      # BackupStorage interface
│   ├── blob-storage.ts              # Vercel Blob adapter
│   └── localfs-storage.ts           # Local filesystem adapter
├── components/
│   ├── backup-dashboard-page.tsx     # Main dashboard page
│   ├── backup-history-table.tsx      # Backup history table
│   ├── backup-trigger-dialog.tsx     # Manual backup trigger dialog
│   ├── restore-dialog.tsx            # Restore with confirmations
│   ├── plan-list.tsx                 # Backup plans list
│   ├── plan-form-dialog.tsx          # Create/edit plan form
│   └── backup-empty-state.tsx        # Empty state component
├── hooks/
│   ├── use-backups.ts               # Hook for backup data fetching
│   └── use-backup-plans.ts          # Hook for plan data fetching
└── __tests__/
    ├── backup-engine.test.ts         # Unit tests for engine
    └── actions.test.ts               # Integration tests for actions

src/app/admin/backups/
└── page.tsx                          # Route page (wraps BackupDashboardPage)

src/app/api/cron/backups/
└── route.ts                          # Cron handler for scheduled backups
```

## Key Interfaces

### Backup Engine

```typescript
// src/features/backups/types.ts

export interface BackupOptions {
  type: 'full' | 'tenant' | 'config'
  tenantId?: string
}

export interface BackupResult {
  backupLogId: string
  fileUrl: string
  fileSize: number
  duration: number // ms
}

export interface TableSchema {
  name: string
  columns: ColumnDef[]
  primaryKey: string[]
  indexes: string[]
  foreignKeys: FKDef[]
}

export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}
```

### Storage Adapter Interface

```typescript
// src/features/backups/storage/types.ts

export interface BackupStorage {
  /** Guarda un buffer en storage, retorna URL/path */
  save(path: string, buffer: Buffer): Promise<string>
  /** Obtiene un stream readable del archivo */
  get(path: string): Promise<Readable>
  /** Elimina un archivo */
  delete(path: string): Promise<void>
  /** Lista archivos bajo un prefijo */
  list(prefix?: string): Promise<string[]>
  /** Genera URL de descarga con expiración */
  getDownloadUrl(path: string): Promise<string>
  /** Obtiene el nombre del archivo desde la URL interna */
  getFileName(url: string): string
}
```

### Server Actions

```typescript
// src/features/backups/actions.ts

// ── Manual Backup ──────────────────────────────────

export const createBackupAction: ServerAction<
  { type: BackupType; tenantId?: string },
  { backupLogId: string }
>

export const getBackupsAction: ServerAction<
  { type?: BackupType; tenantId?: string; status?: BackupStatus; limit?: number; offset?: number },
  { items: BackupLog[]; total: number }
>

export const deleteBackupAction: ServerAction<
  { backupLogId: string },
  { success: true }
>

export const downloadBackupAction: ServerAction<
  { backupLogId: string },
  { url: string }
>

// ── Restore ─────────────────────────────────────────

export const restoreBackupAction: ServerAction<
  { backupLogId: string; confirmation: string },
  { success: true }
>

// ── Backup Plans ────────────────────────────────────

export const createPlanAction: ServerAction<
  { type: BackupType; tenantId?: string; schedule: string; retention?: number },
  BackupPlan
>

export const updatePlanAction: ServerAction<
  { planId: string; schedule?: string; enabled?: boolean; retention?: number },
  BackupPlan
>

export const deletePlanAction: ServerAction<
  { planId: string },
  { success: true }
>

export const getPlansAction: ServerAction<
  void,
  BackupPlan[]
>
```

## Backup Engine Internals

### SchemaReader

```typescript
// src/features/backups/backup-engine.ts

class SchemaReader {
  constructor(private pool: pg.Pool) {}

  async readAllSchemas(): Promise<TableSchema[]> {
    // 1. Query information_schema.tables WHERE table_schema = 'public'
    //    AND table_type = 'BASE TABLE'
    //    EXCLUDE _prisma_migrations
    //
    // 2. For each table, query information_schema.columns
    //
    // 3. Query pg_constraint + pg_class for FKs
    //    SELECT conname, conrelid::regclass AS table,
    //           confrelid::regclass AS foreign_table,
    //           conkey, confkey
    //    FROM pg_constraint
    //    WHERE contype = 'f'
    //
    // 4. Query pg_indexes for index definitions
    //    SELECT indexdef FROM pg_indexes
    //    WHERE tablename = ? AND schemaname = 'public'
    //
    // 5. Topological sort tables by FK dependencies
  }

  private topologicalSort(tables: TableSchema[]): TableSchema[] {
    // Kahn's algorithm O(V+E)
    // Detect cycles and place cyclic tables at the end
  }
}
```

### DataExporter

```typescript
class DataExporter {
  async exportTableData(
    table: TableSchema,
    tenantId?: string
  ): AsyncGenerator<string> {
    // 1. Build SELECT query
    //    - If tenant-scoped AND tenantId provided: WHERE "tenantId" = $1
    //    - ELSE: no filter
    //
    // 2. Execute with cursor pagination (LIMIT 1000 OFFSET ?)
    //
    // 3. For each batch, yield INSERT statements:
    //    INSERT INTO "table" ("col1", "col2") VALUES
    //    (val1, val2),
    //    (val3, val4),
    //    ...;
    //
    // 4. Handle special types:
    //    - JSON/JSONB → JSON.stringify + ::jsonb cast
    //    - BYTEA → hex encode
    //    - DECIMAL → string representation
    //    - UUID → single-quoted string
    //    - DateTime → ISO string with timezone
  }
}
```

### SQLBuilder

```typescript
class SQLBuilder {
  generateCreateTable(table: TableSchema): string {
    // CREATE TABLE IF NOT EXISTS "table" (
    //   "col1" TYPE [NOT NULL] [DEFAULT val],
    //   ...
    //   PRIMARY KEY ("col1")
    // );
    //
    // CREATE INDEX IF NOT EXISTS ...;
  }

  generateTopComment(type: BackupType, tenantId?: string): string {
    // -- ==========================================
    // -- Backup: {type}
    // -- Date: {ISO datetime}
    // -- Tenant: {tenantId or 'ALL'}
    // -- ==========================================
  }
}
```

## Storage Adapters

### VercelBlobStorage

```typescript
class VercelBlobStorage implements BackupStorage {
  // Uses @vercel/blob SDK
  // - save() → upload() to Vercel Blob
  // - get() → download() from Vercel Blob
  // - delete() → delete() from Vercel Blob
  // - list() → list() with prefix
  // - getDownloadUrl() → generate signed URL, 1h expiry
}
```

### LocalFSStorage

```typescript
class LocalFSStorage implements BackupStorage {
  // Uses fs/promises
  // - save() → write file to BACKUP_DIR + path
  // - get() → createReadStream
  // - delete() → unlink
  // - list() → readdir + filter by prefix
  // - getDownloadUrl() → returns internal URL that
  //   hits /api/backups/download?path=... (auth-protected)
}
```

## Scheduling

### Cron Route

```typescript
// src/app/api/cron/backups/route.ts

export async function GET(req: Request) {
  // 1. Verify cron secret (CRON_SECRET env var)
  //    Skip for Vercel Cron (authenticated by platform)
  //
  // 2. Query BackupPlan WHERE enabled=true AND nextRunAt <= now()
  //
  // 3. For each plan:
  //    a. Execute backup via BackupEngine (same as manual)
  //    b. Update lastRunAt, nextRunAt
  //    c. Prune old backups (older than plan.retention days)
  //    d. Log result
  //
  // 4. Return { executed: number, failed: number }
}
```

### Cron Configuration

```json
// vercel.json (if deploying on Vercel)
{
  "cron": [
    { "path": "/api/cron/backups", "schedule": "0 * * * *" }
  ]
}
```

```json
// railway.json (if deploying on Railway)
{
  "$schema": "https://railway.app/railway.schema.json",
  "cron": [
    { "path": "/api/cron/backups", "schedule": "0 * * * *" }
  ]
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_STORAGE` | No | `localfs` | Storage backend: `blob` or `localfs` |
| `BACKUP_DIR` | No | `./backups` | Directory for LocalFS storage |
| `BLOB_READ_WRITE_TOKEN` | If blob | - | Vercel Blob token |
| `CRON_SECRET` | No | - | Secret for cron endpoint auth (optional, platform auth preferred) |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (already exists) |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | `SchemaReader.topologicalSort()` | Test FK ordering with mock FK definitions, cyclic detection |
| **Unit** | `DataExporter` SQL generation | Mock pg Pool, verify INSERT statement format for each column type |
| **Unit** | `SQLBuilder.generateCreateTable()` | Test CREATE TABLE output with various column types and constraints |
| **Unit** | `LocalFSStorage` | Test file save/get/delete with temp directory |
| **Unit** | Cron expression parsing | Test nextRunAt calculation |
| **Integration** | Server Actions | Test auth enforcement, input validation, BackupLog creation |
| **Integration** | Backup flow (real DB) | Test against test database: create full backup, verify SQL is valid |
| **Integration** | Restore flow | Backup + restore cycle, verify data integrity |
| **UI (unit)** | React components | Test render, dialogs, confirmations, empty states with @testing-library/react |

## Rollout / Migration

1. **Add Prisma models**: `prisma migrate dev --name add_backup_models`
2. **Install dependencies**: `pnpm add pg` (and `@vercel/blob` optionally)
3. **Deploy engine**: All server action + backup engine code at once (no feature flag needed)
4. **Add cron**: Update `vercel.json` or Railway config with cron job
5. **Verify**: Manual backup → restore cycle on staging first

No data migration required — new tables only.

## Open Questions

- [x] ¿Vercel o Railway? → Ambos, engine es platform-agnostic
- [x] ¿SQL o JSON? → SQL (recomendación aceptada)
- [x] ¿Storage? → Pluggable (Vercel Blob + LocalFS)
- [ ] Confirmar: ¿se va a usar Railway Volume o Vercel Blob en producción? (afecta qué adapter implementar primero, aunque ambos estarán disponibles)
- [ ] Confirmar: ¿hay algún proof-of-concept de la DB en producción para saber el tamaño aproximado? (ayuda a dimensionar paginación)
