# Spec: Importar Salva Externa

## Requirements

### Functional
- FR1: Admin MUST be able to upload a .sql.gz file from local filesystem
- FR2: Admin MUST be able to provide a download URL for a .sql.gz file
- FR3: The system MUST validate the file is valid gzip (magic bytes 1f 8b)
- FR4: The system MUST validate the file contains SQL content after decompression
- FR5: The system MUST store the file in backup storage
- FR6: The system MUST create a BackupLog with type='imported' and status='completed'
- FR7: Imported backups MUST appear in the backup history table
- FR8: Imported backups MUST be restorable via the existing RestoreDialog
- FR9: Imported backups MUST be deletable and downloadable like any other backup
- FR10: The upload API MUST reject files larger than 100MB
- FR11: Imported backups MUST obey the same retention/prune rules

### Non-functional
- NF1: Upload response time SHOULD be < 5s for files up to 50MB
- NF2: Validation MUST happen before storage (reject early)
- NF3: Only admin role MAY import backups

### Scenarios

#### Scenario 1: Upload file successfully
**Given** an admin user on the backup dashboard
**When** they open the Import dialog and select a valid .sql.gz file
**Then** the file is validated, stored, and a new BackupLog appears in the history with type "Importada"

#### Scenario 2: Upload invalid file
**Given** an admin user on the import dialog
**When** they select a file that is not valid gzip
**Then** an error toast shows "El archivo no es un backup válido (.sql.gz)"
**And** no BackupLog is created

#### Scenario 3: URL import
**Given** an admin user on the import dialog
**When** they paste a URL to a valid .sql.gz file
**Then** the file is downloaded, validated, stored, and a BackupLog appears in the history

#### Scenario 4: URL import with invalid data
**Given** an admin user on the import dialog
**When** they paste a URL that returns non-gzip content
**Then** an error toast shows "El archivo en la URL no es un backup válido"

### Rollback Plan
1. Revert Prisma migration: `prisma migrate dev --name rollback_import_backup`
2. Revert API route and Server Action
3. Remove ImportBackupDialog component
4. Restore backup-dashboard-page.tsx imports
