# Backup Storage Specification

## Purpose

Define how backup files are stored, retrieved, and managed across different hosting environments using a pluggable storage adapter pattern.

## Requirements

### Requirement: Pluggable Storage Adapter

The system MUST support at least two storage backends, selectable via the `BACKUP_STORAGE` environment variable: `blob` (Vercel Blob) and `localfs` (local filesystem / Railway Volume).

#### Scenario: Select storage adapter via env var

- GIVEN the environment variable `BACKUP_STORAGE=blob`
- WHEN the backup engine initializes
- THEN it MUST use the Vercel Blob adapter

- GIVEN the environment variable `BACKUP_STORAGE=localfs`
- WHEN the backup engine initializes
- THEN it MUST use the LocalFS adapter

- GIVEN the environment variable `BACKUP_STORAGE` is not set
- WHEN the backup engine initializes
- THEN it SHOULD default to `localfs`

### Requirement: Storage Adapter Interface

All storage adapters MUST implement a common interface with the following methods.

#### Scenario: Adapter contract

- The storage adapter MUST implement `save(path: string, buffer: Buffer): Promise<string>` returning the URL or path of the saved file
- AND implement `get(path: string): Promise<Readable>` returning a readable stream of the file content
- AND implement `delete(path: string): Promise<void>` deleting the file
- AND implement `list(prefix: string): Promise<string[]>` listing files under a prefix
- AND implement `getDownloadUrl(path: string): Promise<string>` returning a time-limited download URL

### Requirement: LocalFS Storage Adapter

The LocalFS adapter MUST store backup files on the local filesystem at a configurable path.

#### Scenario: Save file to local filesystem

- GIVEN `BACKUP_STORAGE=localfs` and `BACKUP_DIR=/data/backups`
- WHEN the backup engine saves a file at path `full/20260524_120000_full.sql.gz`
- THEN the file MUST be written to `/data/backups/full/20260524_120000_full.sql.gz`
- AND any intermediate directories MUST be created automatically
- AND the returned URL MUST be a relative path or file:// URL

#### Scenario: LocalFS directory configuration

- GIVEN `BACKUP_DIR` is not set
- WHEN the LocalFS adapter initializes
- THEN it SHOULD default to `./backups` relative to the project root

#### Scenario: Serve file for download from LocalFS

- GIVEN a file stored via LocalFS
- WHEN a download request is made (via API route with auth)
- THEN the system MUST verify the admin user is authenticated
- AND serve the file with appropriate Content-Type and Content-Disposition headers
- AND the file MUST be readable by the application process

### Requirement: Vercel Blob Storage Adapter

The Vercel Blob adapter MUST store backup files using the `@vercel/blob` SDK.

#### Scenario: Save file to Vercel Blob

- GIVEN `BACKUP_STORAGE=blob` and `BLOB_READ_WRITE_TOKEN` configured
- WHEN the backup engine saves a file
- THEN the adapter MUST upload the buffer to Vercel Blob using the configured path
- AND return the public URL of the uploaded file
- AND the path pattern SHOULD be `backups/{type}/{tenantId?}/{timestamp}_{type}.sql.gz`

#### Scenario: Generate signed download URL

- GIVEN a file stored in Vercel Blob
- WHEN a download URL is requested
- THEN the adapter MUST generate a signed URL with 1-hour expiration
- AND the URL MUST allow direct download without additional authentication

#### Scenario: Vercel Blob without token

- GIVEN `BACKUP_STORAGE=blob` but `BLOB_READ_WRITE_TOKEN` is not set
- WHEN the adapter initializes
- THEN the system MUST fail with a clear configuration error

### Requirement: File Naming Convention

All backup files MUST follow a consistent naming pattern for easy identification and management.

#### Scenario: File naming rules

- Full backup: `backups/full/{YYYYMMDD}_{HHmmss}_full.sql.gz`
- Tenant backup: `backups/tenant/{tenantId}/{YYYYMMDD}_{HHmmss}_tenant_{tenantId}.sql.gz`
- Config backup: `backups/config/{YYYYMMDD}_{HHmmss}_config.sql.gz`

### Requirement: Backup Retention

The system MUST support automatic cleanup of old backup files based on configured retention policy.

#### Scenario: Delete expired backups during prune

- GIVEN a BackupPlan with `retention: 30` days
- WHEN the prune operation runs
- THEN the system MUST list all backup files associated with that plan
- AND delete files older than 30 days from storage
- AND delete corresponding BackupLog records
- AND files NOT associated with any plan SHOULD NOT be pruned automatically

#### Scenario: Manual backup deletion

- GIVEN an authenticated admin user
- WHEN the user selects a backup file for deletion
- THEN the system MUST delete the file from storage (Blob or LocalFS)
- AND update the BackupLog status to `deleted`
- AND the user MUST confirm the deletion before it executes
