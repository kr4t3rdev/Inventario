# Backup Execution Specification

## Purpose

Define how the system creates database backups — both full-database and per-tenant — using a pure Node.js engine that introspects PostgreSQL schema and exports data programmatically.

## Requirements

### Requirement: Full Database Backup

The system MUST support creating a complete backup of all database tables, including both schema (CREATE TABLE) and data (INSERT statements), ordered to respect foreign key dependencies.

#### Scenario: Create a full backup successfully

- GIVEN an authenticated admin user with role 'admin'
- WHEN the admin requests a full database backup
- THEN the system MUST query `information_schema.tables` to discover all user tables in the `public` schema
- AND the system MUST generate CREATE TABLE statements with columns, data types, nullability, defaults, primary keys, indexes, and constraints
- AND the system MUST query all rows from each table using cursor-based pagination
- AND the system MUST generate INSERT statements for each row
- AND the system MUST order tables topologically by foreign key dependencies (parents before children)
- AND the system MUST compress the resulting SQL to `.sql.gz` format
- AND the system MUST store the compressed file via the configured storage adapter
- AND the system MUST create a `BackupLog` record with type `full`, status `completed`, file size, and storage URL/path

#### Scenario: Full backup with no data (empty database)

- GIVEN a database with no rows in any table
- WHEN a full backup is created
- THEN the resulting dump MUST include all CREATE TABLE statements
- AND the dump SHOULD omit INSERT statements for empty tables (or include empty INSERTs as comments)

#### Scenario: Full backup with large table (>100K rows)

- GIVEN a table with more than 100,000 rows
- WHEN a full backup is created
- THEN the system MUST paginate the SELECT query in batches of 1,000 rows
- AND the system MUST stream each batch to the output without loading the entire table into memory
- AND the backup MUST complete within the configured timeout

#### Scenario: Full backup fails mid-process

- GIVEN a database connection drops during a full backup
- WHEN the backup process encounters a connection error
- THEN the system MUST set the `BackupLog` status to `failed`
- AND the system MUST include the error message in the `BackupLog.errorMessage` field
- AND the system MUST clean up any partial file from storage

### Requirement: Per-Tenant Backup

The system MUST support creating a backup scoped to a single tenant, including only rows that belong to that tenant in tenant-scoped tables, plus all rows from global tables (users, plans, etc.) as reference data.

#### Scenario: Create a per-tenant backup

- GIVEN an authenticated admin user
- AND a valid tenant identified by `tenantId`
- WHEN the admin requests a backup for that specific tenant
- THEN the system MUST identify which tables have a `tenantId` column
- AND the system MUST include all rows from tables WITHOUT `tenantId` (global tables: User, Plan, etc.)
- AND the system MUST include only rows WHERE `tenantId = ?` for tenant-scoped tables
- AND the system MUST generate INSERT statements with the same schema DDL as a full backup
- AND the system MUST name the file to include the tenant identifier

#### Scenario: Per-tenant backup of non-existent tenant

- GIVEN a `tenantId` that does not exist in the Tenant table
- WHEN a per-tenant backup is requested
- THEN the system MUST reject the backup with error "Tenant not found"
- AND the system MUST NOT create any file or BackupLog record

#### Scenario: Per-tenant backup with tenant that has no data

- GIVEN a tenant that exists but has no related records in any table
- WHEN a per-tenant backup is created
- THEN the system MUST include global reference tables (User, Plan, etc.)
- AND the system SHOULD generate a valid SQL file with CREATE TABLE + empty or commented INSERTs for tenant-scoped tables
- AND the BackupLog status MUST be `completed`

### Requirement: Config-Only Backup

The system MUST support creating a lightweight backup containing only system metadata: tenants, plans, licenses, users, and their relationships — without operational data (products, sales, etc.).

#### Scenario: Create a configuration backup

- GIVEN an authenticated admin user
- WHEN the admin requests a configuration-only backup
- THEN the system MUST include only these tables: Tenant, TenantMembership, TenantLicense, User, Plan, Licencia, LicenciaAudit
- AND the system MUST exclude all operational tables (Producto, Venta, etc.)
- AND the file naming MUST indicate it is a config backup
- AND the BackupLog type MUST be `config`

### Requirement: Backup Engine Discovery

The system MUST dynamically discover all user tables in the `public` schema and their columns, types, and constraints using PostgreSQL system catalogs.

#### Scenario: Schema introspection

- GIVEN a PostgreSQL database
- WHEN the backup engine starts
- THEN it MUST query `information_schema.tables` for all `BASE TABLE` entries in `public` schema
- AND it MUST query `information_schema.columns` for each table's column metadata (name, data_type, is_nullable, column_default)
- AND it MUST query `pg_class` + `pg_attribute` for primary key information
- AND it MUST query `pg_indexes` for index definitions
- AND it MUST query `pg_constraint` for foreign key relationships to determine topological ordering
- AND it MUST exclude system tables and Prisma migration tables (`_prisma_migrations`)

### Requirement: Backup Authorization

The system MUST restrict backup creation to users with the `admin` role only.

#### Scenario: Non-admin user attempts backup

- GIVEN an authenticated user with role `regularUser`
- WHEN the user attempts to create any type of backup
- THEN the system MUST return an authorization error
- AND the system MUST NOT create any BackupLog or storage file

#### Scenario: Unauthenticated request

- GIVEN no authenticated user
- WHEN a backup request is made
- THEN the `withAction` wrapper MUST return `success: false` with error code `AUTH_REQUIRED`
