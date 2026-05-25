# Backup Admin UI Specification

## Purpose

Define the admin panel interface for managing database backups, including the backup dashboard, trigger actions, plan management, and restore workflows.

## Requirements

### Requirement: Backup Dashboard Page

The system MUST provide a `/admin/backups` page with an overview of all backups and management controls.

#### Scenario: Dashboard loads with backup history

- GIVEN an authenticated admin user navigating to `/admin/backups`
- WHEN the page loads
- THEN it MUST display a table/list of all BackupLog entries, ordered by `createdAt` descending
- AND each row MUST show: type, tenant (if applicable), status (with colored badge), file size (formatted), creation date, and action buttons
- AND the page MUST include a "New Backup" button to trigger a manual backup
- AND loading state MUST show a skeleton while data fetches

#### Scenario: Dashboard empty state

- GIVEN no backups have been created
- WHEN the dashboard loads
- THEN it MUST display an empty state with: an icon, "No backups yet" message, and "Create your first backup" button

### Requirement: Backup History Table

The system MUST display backup history with filtering and sorting.

#### Scenario: Table displays backup records

- GIVEN existing BackupLog records
- WHEN the dashboard loads
- THEN the table MUST show columns: Type (full/tenant/config with icon), Tenant name (if applicable), Status (badge), Size, Created at, Actions

#### Scenario: Filter backups by type

- GIVEN backups of multiple types
- WHEN the admin selects a type filter (e.g., "full")
- THEN the table MUST show only backups matching that type
- AND a "clear filter" option MUST be available

#### Scenario: Filter backups by tenant

- GIVEN backups for multiple tenants
- WHEN the admin selects a tenant filter
- THEN the table MUST show only backups for that tenant

#### Scenario: Backup status badges

- GIVEN the dashboard displays backup records
- THEN `completed` status MUST show a green badge
- AND `running` status MUST show a yellow/blue badge with a spinner
- AND `failed` status MUST show a red badge
- AND `pruned` status MUST show a gray badge

### Requirement: Manual Backup Trigger

The system MUST provide a UI dialog to trigger manual backups.

#### Scenario: Open new backup dialog

- GIVEN an admin viewing the dashboard
- WHEN they click "New Backup"
- THEN a dialog MUST open with three options: Full Database, Per-Tenant, Configuration Only
- AND a "Cancel" button to dismiss

#### Scenario: Trigger full backup

- GIVEN the new backup dialog is open
- WHEN the admin selects "Full Database" and clicks "Start Backup"
- THEN the system MUST call the server action with `{ type: 'full' }`
- AND show a progress state: "Backup in progress..."
- AND the dialog MUST close automatically when the backup completes
- AND a toast MUST show: "Full backup completed successfully"
- AND the history table MUST refresh

#### Scenario: Trigger per-tenant backup

- GIVEN the new backup dialog is open
- WHEN the admin selects "Per-Tenant"
- THEN a tenant selector (searchable combobox) MUST appear
- WHEN the admin selects a tenant and clicks "Start Backup"
- THEN the system MUST call the server action with `{ type: 'tenant', tenantId }`
- AND the same progress/feedback flow applies

#### Scenario: Backup fails from dialog

- GIVEN a backup is triggered
- WHEN the server action returns an error
- THEN the dialog MUST show the error message
- AND the admin can retry or cancel
- AND a toast MUST show: "Backup failed: {error message}"

### Requirement: Backup Plans Management UI

The system MUST provide an interface to manage backup plans (scheduled backups).

#### Scenario: Plans section on dashboard

- GIVEN the backup dashboard
- WHEN the admin scrolls or navigates to the Plans section
- THEN they MUST see a list of all backup plans with: type, schedule (human-readable), tenant (if applicable), enabled/disabled toggle, retention days, last run, next run
- AND a "Create Plan" button

#### Scenario: Create a new backup plan

- GIVEN the admin clicks "Create Plan"
- WHEN a form dialog opens
- THEN the admin MUST configure: type (full/tenant/config), schedule via cron input (with helper/presets like "Daily at 2 AM", "Weekly on Sunday"), tenant selector (if type=tenant), retention days (default 30)
- AND the form MUST validate the cron expression before submission
- WHEN saved, the plan MUST appear in the list

#### Scenario: Toggle plan on/off

- GIVEN an existing plan
- WHEN the admin toggles the enabled switch
- THEN the plan status MUST update immediately (optimistic UI)
- AND the server action MUST persist the change

#### Scenario: Delete a plan

- GIVEN an existing plan
- WHEN the admin clicks delete
- THEN a confirmation dialog MUST appear: "This will stop scheduled backups for this plan. Backups already created will NOT be deleted."
- AFTER confirmation, the plan MUST be removed from the list

### Requirement: Restore Dialog UI

The system MUST provide a step-by-step restore dialog with safety confirmations.

#### Scenario: Open restore dialog

- GIVEN a completed backup in the history table
- WHEN the admin clicks "Restore"
- THEN a dialog MUST open showing: backup details (type, date, size, tenant), and the first confirmation step

#### Scenario: Restore first confirmation

- GIVEN the restore dialog is open
- THEN the first step MUST display the warning with appropriate severity
- AND buttons: "Cancel" and "Continue"
- WHEN the admin clicks "Continue", the second confirmation step MUST appear

#### Scenario: Restore second confirmation (type-to-confirm)

- GIVEN the second step of restore dialog
- THEN the admin MUST type "RESTORE" (or "FULL RESTORE" for full DB) in a text input
- AND the "Confirm Restore" button MUST be disabled until the exact text is entered
- WHEN confirmed, the system executes the restore

#### Scenario: Restore progress and result

- GIVEN a restore is executing
- THEN the dialog MUST show a progress spinner with "Restoring backup..."
- WHEN completed: dialog closes, toast shows "Backup restored successfully", table refreshes
- WHEN failed: dialog shows error, "Retry" button available

### Requirement: Download Action

The system MUST provide a download button for completed backups.

#### Scenario: Download completed backup

- GIVEN a backup with status `completed`
- WHEN the admin clicks the download icon
- THEN the browser MUST download the `.sql.gz` file
- AND a toast SHOULD confirm the download started

#### Scenario: Download unavailable for failed backups

- GIVEN a backup with status `failed`
- THEN the download button MUST be disabled or hidden

### Requirement: Sidebar Navigation

The system MUST include a "Backups" navigation item in the admin sidebar.

#### Scenario: Sidebar shows Backups link

- GIVEN an admin viewing any admin page
- WHEN the sidebar is expanded
- THEN the "Herramientas" group MUST include a "Backups" item with a Database icon
- AND the link MUST navigate to `/admin/backups`
- AND it MUST be highlighted as active when on the backups page
