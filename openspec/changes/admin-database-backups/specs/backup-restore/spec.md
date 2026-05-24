# Backup Restore Specification

## Purpose

Define the behavior for restoring database backups from stored files, with safety confirmations and automatic rollback on failure.

## Requirements

### Requirement: Restore from Backup

The system MUST support restoring a database from a previously created backup file, with different behavior for full, tenant, and config backups.

#### Scenario: Restore a per-tenant backup

- GIVEN an authenticated admin user
- AND a completed tenant backup with type `tenant` and known `tenantId`
- WHEN the admin initiates a restore for that backup
- AND confirms the first prompt ("This will overwrite existing data")
- AND types "RESTORE" in the second confirmation prompt
- THEN the system MUST download the backup file from storage
- AND decompress the `.sql.gz` file
- AND execute the restore within a database TRANSACTION
- AND for tenant-scoped tables: DELETE all existing rows WHERE `tenantId = ?` first, then INSERT the backed-up rows
- AND for global tables: UPSERT (INSERT ON CONFLICT UPDATE) to preserve non-tenant data
- AND on success: COMMIT the transaction
- AND create a BackupLog entry with type `restore`, referencing the original backup
- AND return success

#### Scenario: Restore fails and rolls back

- GIVEN a tenant restore is in progress
- WHEN an INSERT fails due to constraint violation
- THEN the system MUST ROLLBACK the entire transaction
- AND NOT modify any database rows
- AND create a BackupLog entry with status `failed` and the error message
- AND return an error to the user

#### Scenario: Restore full database backup

- GIVEN an authenticated admin user
- AND a completed full backup
- WHEN the admin initiates a full restore
- THEN the system MUST show an additional warning: "This will COMPLETELY REPLACE all database data"
- AND require the admin to type "FULL RESTORE" to enable the button
- AND the system MUST execute TRUNCATE + INSERT in topological order
- AND the entire operation MUST be wrapped in a TRANSACTION with ROLLBACK on failure

#### Scenario: Restore config backup

- GIVEN a config-only backup
- WHEN the admin initiates restore
- THEN the system MUST UPDATE existing records (users, plans, tenants) rather than DELETE+INSERT
- AND use UPSERT logic for all records
- AND NOT touch any operational tables

### Requirement: Restore Safety Confirmations

The system MUST require explicit user confirmation before executing any restore, with increasing severity for full database restores.

#### Scenario: Tenant restore confirmation flow

- GIVEN an admin clicks "Restore" on a tenant backup
- THEN a dialog MUST appear with: backup details (type, date, size, tenant), and warning text "This will overwrite existing data for this tenant"
- AND two buttons: "Cancel" and "Continue"
- AFTER clicking "Continue"
- THEN a second dialog MUST appear requiring the admin to type "RESTORE" in a text input
- AND the "Confirm Restore" button MUST be disabled until the exact text is typed

#### Scenario: Full restore confirmation flow

- GIVEN an admin clicks "Restore" on a full backup
- THEN the first dialog MUST show stronger warning using red alert styling: "This will COMPLETELY REPLACE the entire database"
- AND the second confirmation MUST require typing "FULL RESTORE"
- AND a third checkbox MUST be required: "I have verified that this is the correct backup and I understand the consequences"

#### Scenario: Cancel restore at any step

- GIVEN an admin is in the restore confirmation flow
- WHEN they click "Cancel" at any step
- THEN the dialogs MUST close
- AND NO changes MUST be made to the database
- AND NO BackupLog entry MUST be created

### Requirement: Download Backup File

The system MUST support downloading backup files as `.sql.gz`.

#### Scenario: Download a backup

- GIVEN an authenticated admin user
- AND a completed backup
- WHEN the admin clicks "Download"
- THEN the system MUST generate a download URL (signed URL for Blob, direct serve for LocalFS)
- AND the browser MUST download the file with the original filename and `.sql.gz` extension
- AND the download URL for Blob MUST expire after 1 hour

#### Scenario: Download expired backup

- GIVEN a backup stored in Vercel Blob
- AND the file was deleted from storage but the BackupLog record still exists (status `completed`)
- WHEN the admin attempts to download
- THEN the system MUST return an error: "Backup file not found in storage"

### Requirement: Restore Authorization

The system MUST restrict restore operations to admin users only.

#### Scenario: Non-admin user attempts restore

- GIVEN an authenticated user with role `regularUser`
- WHEN the user attempts to restore any backup
- THEN the system MUST return an authorization error
- AND the restore MUST NOT proceed
