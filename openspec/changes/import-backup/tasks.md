# Tasks: Importar Salva Externa

## Task 1 — Prisma: Add `imported` to BackupType enum

**Files**: prisma/schema.prisma, src/generated/prisma/schema.prisma
**Action**: Add `imported` to BackupType enum in source schema + regenerate client
**Dependency**: None
**Verification**: `pnpm run build` compiles, enum is available in generated client

## Task 2 — Schema: Add importBackupSchema

**Files**: src/features/backups/schemas.ts
**Action**: Add `importBackupSchema` Zod schema (url optional string, type defaults to 'imported')
**Dependency**: Task 1
**Verification**: TypeScript compiles clean

## Task 3 — Validation: create validateBackupFile

**File**: src/features/backups/backup-engine.ts (add static method) OR new file
**Action**: Implement validateBackupFile(gzip magic bytes + SQL header check)
**Dependency**: None (pure function)
**Verification**: Unit test passes for valid/invalid files

## Task 4 — Server Action: importBackupAction (URL-based)

**File**: src/features/backups/actions.ts
**Action**: Add importBackupAction that downloads from URL, validates, stores, creates BackupLog
**Dependency**: Task 2, Task 3
**Verification**: Compiles, returns BackupLog ID

## Task 5 — API Route: POST /api/backups/import (file upload)

**File**: src/app/api/backups/import/route.ts (NEW)
**Action**: Multipart file upload with auth, validation, storage, BackupLog creation
**Dependency**: Task 3
**Verification**: Returns BackupLog ID on success, proper error codes on failure

## Task 6 — Component: ImportBackupDialog

**File**: src/features/backups/components/import-backup-dialog.tsx (NEW)
**Action**: Two-tab dialog (upload file / URL), validates client-side, submits to API/action
**Dependency**: Task 4, Task 5
**Verification**: Open dialog, file picker works, URL input works, submit triggers action

## Task 7 — Dashboard: Wire ImportBackupDialog into BackupDashboardPage

**File**: src/features/backups/components/backup-dashboard-page.tsx
**Action**: Add import button, import dialog state, refresh handlers
**Dependency**: Task 6
**Verification**: Dialog opens/closes, backup list refreshes after import

## Task 8 — UI Labels: Add `imported` to TYPE_LABELS and restore handling

**Files**: src/features/backups/components/backup-history-table.tsx, src/features/backups/components/restore-dialog.tsx, src/features/backups/restore-engine.ts
**Action**: Add "Importada" label, handle in restore dialog/engine (same as full)
**Dependency**: Task 1
**Verification**: Imported backup shows correct label, restore works

## Task 9 — Barrel & tests

**File**: src/features/backups/index.ts
**Action**: Export new items (importBackupAction, ImportBackupDialog, importBackupSchema)
**Tests**: Unit test for validateBackupFile
**Dependency**: Task 4, Task 6
**Verification**: All 111+ existing tests pass + new test passes
