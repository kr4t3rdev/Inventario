# Design: Importar Salva Externa

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BackupDashboardPage (client)                           │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │ ImportBackupDialog   │   │ BackupHistoryTable      │  │
│  │ (upload file / URL)  │   │ (shows imported + other)│  │
│  └──────┬──────────────┘   └─────────────────────────┘  │
│         │                                                 │
│         ▼                                                 │
│  ┌─────────────────┐  ┌──────────────────────────┐       │
│  │ importBackup     │  │ createBackupAction       │       │
│  │ Action (URL)     │  │ (existing)               │       │
│  └────────┬────────┘  └──────────────────────────┘       │
└───────────┼──────────────────────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌──────────┐ ┌──────────────┐
│ API Route │ │ Server Action │
│ POST /api │ │ importBackup  │
│ /backups/ │ │ Action(URL)   │
│ import    │ │              │
└─────┬────┘ └──────┬───────┘
      │             │
      ▼             ▼
┌──────────────────────────┐
│  validateBackupFile()    │
│  - check gzip magic bytes│
│  - gunzip → check SQL    │
│  - store to storage      │
│  - create BackupLog      │
└──────────────────────────┘
```

## Data Flow

### File Upload (API Route)
1. Client sends multipart POST with `file` field
2. `withAuth` middleware validates admin role
3. Read stream, validate gzip magic bytes (first 2 bytes: 0x1f 0x8b)
4. Validate decompressed content starts with SQL comment or CREATE/INSERT
5. Store to backup storage via `createStorage().save()`
6. Create BackupLog with type='imported', status='completed'
7. Return BackupLog ID and type

### URL Import (Server Action)
1. Client calls `importBackupAction({ url })`
2. `withAction` validates admin role
3. Fetch URL, validate gzip magic bytes from response
4. Same validation + storage + BackupLog flow

## File Validation

```typescript
function validateBackupFile(buffer: Buffer): { valid: boolean; error?: string } {
  // 1. Check gzip magic bytes
  if (buffer.length < 2 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
    return { valid: false, error: 'El archivo no es un backup válido (.sql.gz)' }
  }

  // 2. Decompress and check SQL content
  try {
    const decompressed = gunzipSync(buffer)
    const content = decompressed.toString('utf-8').trim()

    if (!content || content.length === 0) {
      return { valid: false, error: 'El archivo está vacío' }
    }

    // Check for common SQL header patterns
    const hasSQLHeader = /^(--|<|CREATE|INSERT|SET|BEGIN)/i.test(content)
    if (!hasSQLHeader) {
      return { valid: false, error: 'El archivo no contiene un backup SQL válido' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'El archivo no se puede descomprimir como gzip' }
  }
}
```

## Component: ImportBackupDialog

- Two tabs: "Subir archivo" and "URL"
- Tab 1: File input accept=".sql.gz" + max size validation
- Tab 2: Text input for URL
- Submit button
- Progress indicator for upload/import
- Error/success toast feedback

## File Size Limit

100MB (104857600 bytes). Enforced at the API route level before processing.

## Prisma Migration

```prisma
enum BackupType {
  full
  tenant
  config
  imported
}
```

## Files to Modify/Create

| File | Action |
|---|---|
| prisma/schema.prisma | Add `imported` to BackupType |
| src/features/backups/schemas.ts | Add `importBackupSchema` |
| src/features/backups/cron-utils.ts | No change |
| src/features/backups/actions.ts | Add `importBackupAction` |
| src/app/api/backups/import/route.ts | NEW: upload API route |
| src/features/backups/components/import-backup-dialog.tsx | NEW: import dialog |
| src/features/backups/components/backup-dashboard-page.tsx | Add import button + dialog state |
| src/features/backups/components/backup-history-table.tsx | Add `imported` to TYPE_LABELS |
| src/features/backups/components/restore-dialog.tsx | Handle `imported` type |
| src/features/backups/restore-engine.ts | Handle `imported` type (same as full) |
| src/features/backups/index.ts | Export new items |
| src/lib/auth-middleware.ts | No change (withAuthPost handles admin check) |

## Client/Server Validation Split

- **Client**: file extension (.sql.gz), file size (< 100MB), URL format
- **Server**: gzip magic bytes, decompress + SQL content check, storage
- **Toast feedback**: success → "Salva importada correctamente", error → specific error message
