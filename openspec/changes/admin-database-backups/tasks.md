# Tasks: Admin Database Backup System

> **Strict TDD Mode active**: Each task that involves logic includes writing tests FIRST (Red → Green → Refactor). See `openspec/config.yaml`.

## Phase 1: Foundation — Data Layer & Dependencies

- [ ] 1.1 Add pg (`node-postgres`) as project dependency
- [ ] 1.2 Add `@vercel/blob` as optional dependency (for future Vercel support; Railway confirmed as primary)
- [ ] 1.3 Add `BackupType` enum (`full`, `tenant`, `config`) and `BackupStatus` enum (`running`, `completed`, `failed`, `pruned`, `deleted`) to `prisma/schema.prisma`
- [ ] 1.4 Add `BackupLog` model to `prisma/schema.prisma` with fields: backupLogId, type, tenantId?, status, fileUrl?, fileName?, fileSize?, startedAt, completedAt?, errorMessage?, createdBy, createdAt. Relations to Tenant (optional) and User. Indexes on tenantId, status, createdAt. Table name: `backup_logs`
- [ ] 1.5 Add `BackupPlan` model to `prisma/schema.prisma` with fields: backupPlanId, type, tenantId?, schedule, enabled, retention, lastRunAt?, nextRunAt?, createdBy, createdAt, updatedAt. Relations to Tenant (optional) and User. Indexes on [enabled, nextRunAt] and tenantId. Table name: `backup_plans`
- [ ] 1.6 Run `pnpm prisma migrate dev --name add_backup_models` and `pnpm prisma generate`
- [ ] 1.7 Create `src/features/backups/types.ts` — shared types: `BackupOptions`, `BackupResult`, `TableSchema`, `ColumnDef`
- [ ] 1.8 Create `src/features/backups/schemas.ts` — Zod schemas for all action inputs (backup trigger, restore, plan CRUD)
- [ ] 1.9 Create `src/features/backups/storage/types.ts` — `BackupStorage` interface: `save()`, `get()`, `delete()`, `list()`, `getDownloadUrl()`, `getFileName()`

## Phase 2: Storage Adapters

- [ ] 2.1 Create `src/features/backups/storage/localfs-storage.ts` — `LocalFSStorage` implementing `BackupStorage`, writes to `BACKUP_DIR` (default `./backups`), with fs/promises + streaming
- [ ] 2.2 Create `src/features/backups/storage/blob-storage.ts` — `VercelBlobStorage` implementing `BackupStorage`, optionally available (for future Vercel deployment)
- [ ] 2.3 Implement storage factory function in `src/features/backups/storage/index.ts` that selects adapter based on `BACKUP_STORAGE` env var (default `localfs`)

## Phase 3: Backup Engine — Core Logic

> Each unit: write tests first (TDD strict). Reference spec scenarios from `backup-execution/spec.md`.

- [ ] 3.1 Create `src/features/backups/backup-engine.ts` with:
  - Singleton pg.Pool (separate from Prisma, same `DATABASE_URL`)
  - `SchemaReader` class: query `information_schema.tables` + `information_schema.columns` + `pg_class` + `pg_indexes` + `pg_constraint` → discover all tables, columns, indexes, FKs
  - `SchemaReader.topologicalSort()`: Kahn's algorithm for FK dependency ordering, cycle detection
  - `DataExporter` class: keyset/cursor pagination (NOT offset), 1000-row batch INSERTs, streaming via AsyncGenerator
  - `DataExporter` type handling: JSON/BYTEA/DECIMAL/UUID/DateTime serialization
  - `DataExporter.tenantScopedTables()`: detect tables with `tenantId` column for per-tenant filtering
  - `SQLBuilder` class: `generateCreateTable()`, `generateCreateIndex()`, `generateInsertBatch()`, `generateTopComment()`
  - `BackupEngine.run()`: orchestrator — creates temp file, runs SchemaReader → DataExporter → SQLBuilder → Compressor → Storage.save(), updates BackupLog
  - AbortSignal support for cancellation of long-running backups
  - Memory-safe: no accumulation, each batch streams to temp file immediately

## Phase 4: Server Actions — Backup Operations

- [ ] 4.1 Create `src/features/backups/actions.ts` with:
  - `createBackupAction` — triggers backup via `waitUntil()`, returns `{ backupLogId }`, auth: admin only
  - `getBackupsAction` — paginated list with type/tenant/status filters
  - `getBackupAction` — single record by ID
  - `deleteBackupAction` — deletes file from storage + marks BackupLog as `deleted`
  - `downloadBackupAction` — returns download URL/signed URL (1h expiry)
  - `restoreBackupAction` — execute restore with confirmation string param, transaction with ROLLBACK
  - `getBackupStatusAction` — polling endpoint: returns current status for a backupLogId
- [ ] 4.2 Create `src/features/backups/actions-plans.ts` with:
  - `createPlanAction` — create BackupPlan with schedule validation
  - `updatePlanAction` — update schedule/enabled/retention
  - `deletePlanAction` — delete plan
  - `getPlansAction` — list all plans

## Phase 5: Cron / Scheduling

- [ ] 5.1 Create `src/app/api/cron/backups/route.ts` — GET handler that:
  - Verifies cron secret (optional; Railway/Vercel authenticate the request itself)
  - Queries BackupPlans WHERE `enabled=true AND nextRunAt <= now()`
  - For each plan: executes backup via BackupEngine, updates lastRunAt/nextRunAt, prunes old backups per retention
  - Returns `{ executed: number, failed: number }`
- [ ] 5.2 Add `node-cron` as dependency only if Railway cron is not used; otherwise document Railway cron configuration
- [ ] 5.3 Create `src/features/backups/prune.ts` — standalone prune function that lists backups older than retention days and deletes them from storage + updates BackupLog

## Phase 6: Admin UI — Pages & Components

- [ ] 6.1 Create `src/app/admin/backups/page.tsx` — server component shell with `'use client'` wrapper loading `BackupDashboardPage`
- [ ] 6.2 Create `src/features/backups/hooks/use-backups.ts` — custom hook: fetch backups list, polling for running status, trigger backup, delete, download
- [ ] 6.3 Create `src/features/backups/hooks/use-backup-plans.ts` — custom hook: fetch plans, CRUD operations
- [ ] 6.4 Create `src/features/backups/components/backup-dashboard-page.tsx` — main page layout with sections: "New Backup" button, history table, plans section
- [ ] 6.5 Create `src/features/backups/components/backup-history-table.tsx` — table with columns: Type (icon + label), Tenant name, Status (colored badge), Size (formatted), Created At, Actions (Download, Restore, Delete). Sorting by date. Filter dropdowns for type, tenant, status. Empty state when no backups.
- [ ] 6.6 Create `src/features/backups/components/backup-trigger-dialog.tsx` — dialog with 3 options: Full DB, Per-Tenant (with tenant searchable combobox), Config Only. Start button. Progress state during backup. Error display.
- [ ] 6.7 Create `src/features/backups/components/restore-dialog.tsx` — 3-step wizard: (1) backup details + warning severity, (2) type "RESTORE" / "FULL RESTORE" to confirm, (3) progress + result spinner
- [ ] 6.8 Create `src/features/backups/components/plan-list.tsx` — list of backup plans with: type, human-readable schedule, tenant name (if any), enabled toggle, retention badge, last run / next run dates, delete button
- [ ] 6.9 Create `src/features/backups/components/plan-form-dialog.tsx` — form: type selector, cron input (with preset helpers: "Daily at 2AM", "Weekly Sunday", "Custom"), tenant selector (conditional), retention days input (default 30)
- [ ] 6.10 Create `src/features/backups/components/backup-empty-state.tsx` — empty state: icon, "No backups yet" message, "Create your first backup" CTA
- [ ] 6.11 Create `src/features/backups/index.ts` — barrel exports for all actions, hooks, and components
- [ ] 6.12 Modify `src/components/admin-sidebar.tsx` — add "Backups" item with Database icon in "Herramientas" group, linking to `/admin/backups`

## Phase 7: Restore Engine

- [ ] 7.1 Add `restoreFromBackup()` to backup-engine.ts:
  - Download file from storage → decompress gzip
  - Parse SQL: split into statements, identify CREATE TABLE vs INSERT vs INDEX
  - For tenant restore: DELETE existing tenant data, INSERT backed-up data (in FK order)
  - For full restore: TRUNCATE in reverse FK order, then INSERT in FK order (ALL in transaction)
  - For config restore: UPSERT only (ON CONFLICT UPDATE)
  - Wrap everything in a single PostgreSQL transaction
  - On any error: ROLLBACK + return error message
  - Create BackupLog entry with type `restore`, referencing original backupLogId

## Phase 8: Testing

- [ ] 8.1 Write unit tests for `SchemaReader.topologicalSort()` — mock FK definitions, test ordering + cycle detection
- [ ] 8.2 Write unit tests for `DataExporter` INSERT generation — verify correct SQL format for each column type (JSON, BYTEA, DECIMAL, UUID, DateTime)
- [ ] 8.3 Write unit tests for `SQLBuilder.generateCreateTable()` — verify DDL output matches expected CREATE TABLE syntax
- [ ] 8.4 Write unit tests for `LocalFSStorage` — test save/get/delete/list with temp directory
- [ ] 8.5 Write unit tests for backup engine orchestrator — mock SchemaReader + DataExporter + Storage, verify flow
- [ ] 8.6 Write integration tests for `createBackupAction` — auth enforcement, validation, BackupLog creation
- [ ] 8.7 Write integration tests for `restoreBackupAction` — happy path, rollback on failure, confirmation enforcement
- [ ] 8.8 Write integration tests for plan actions — CRUD, schedule validation, toggle
- [ ] 8.9 Write UI component tests — render dashboard, dialogs, confirmations, empty states, table states

## Phase 9: Polish & Verification

- [ ] 9.1 Add toast notifications in all UI actions (success, error, progress states)
- [ ] 9.2 Verify sidebar navigation works and highlights active page
- [ ] 9.3 Run `pnpm run lint` and fix any warnings
- [ ] 9.4 Run `pnpm run typecheck` and fix any type errors
- [ ] 9.5 Run `pnpm run test:run` and ensure all tests pass
- [ ] 9.6 Manual smoke test: create backup → verify file exists → download → restore
