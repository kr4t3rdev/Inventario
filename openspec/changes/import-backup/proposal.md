## SDD Proposal: Importar Salva Externa

### Problem
Admins need to import external `.sql.gz` backup files (from other environments, manual exports, etc.) into the backup system so they can:
- Centralize all backup files in one place
- Restore from external backups using the same restore interface
- Track imported backups alongside system-generated ones

### Proposed Solution
Add an "Importar salva" feature to the Backup Dashboard. Admin can either upload a `.sql.gz` file or provide a download URL. The system validates the file (checks gzip magic bytes + SQL content), stores it in backup storage, creates a `BackupLog` entry, and makes it available for restore via the existing `RestoreDialog`.

### What changes

| Layer | Change |
|---|---|
| **Prisma** | Add `imported` to `BackupType` enum |
| **Schema** | Add `importBackupSchema` (file/URL + optional tenantId) |
| **Server Action** | `importBackupAction` — URL-based import with validation |
| **API Route** | `POST /api/backups/import` — multipart file upload with auth |
| **Logic** | `validateBackupFile()` — check gzip + SQL header |
| **Components** | `ImportBackupDialog` — upload/URL dialog |
| **Dashboard** | Add "Importar" button next to "Nueva copia" |
| **UI labels** | Add `imported` to `TYPE_LABELS` and `STATUS_BADGES` |
| **Restore** | Handle `imported` type same as `full` in RestoreEngine |

### Non-goals
- No change to BackupPlan (plans only schedule `full`/`tenant`/`config`)
- No change to the backup engine execution path (import doesn't run the engine)
- No change to prune logic (imported backups obey the same retention)
- No change to the download API route (already generic)

### Risks
- Large file uploads (100MB+) could be slow. Use streaming validation + size limit (100MB default).
- Malicious files: validate before storing, reject if not valid gzip+SQL.
- No way to detect whether an imported backup came from this system — acceptable, it's external by definition.
