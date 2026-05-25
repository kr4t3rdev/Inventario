# Backup Plans & Scheduling Specification

## Purpose

Define how the system manages scheduled backup plans — recurring backups that run automatically for full database, per-tenant, or configuration-only backups.

## Requirements

### Requirement: BackupPlan Model

The system MUST store backup plan configurations in a `BackupPlan` database table (via Prisma).

#### Scenario: Create a backup plan

- GIVEN an authenticated admin user
- WHEN the admin creates a backup plan with type `full`, schedule `0 2 * * *` (daily at 2 AM), and retention of 30 days
- THEN the system MUST persist the plan in the BackupPlan table
- AND the plan MUST default to `enabled: true`
- AND the system MUST calculate `nextRunAt` based on the cron expression
- AND the response MUST include the created plan with all fields

#### Scenario: Create a per-tenant backup plan

- GIVEN an authenticated admin user
- AND a valid tenant
- WHEN the admin creates a backup plan with type `tenant`, tenantId set, and schedule `0 0 * * 0` (weekly on Sunday)
- THEN the system MUST persist the plan with the specified tenantId
- AND the plan MUST scope backups to that tenant when executed

#### Scenario: Create plan with invalid cron expression

- GIVEN an authenticated admin user
- WHEN the admin creates a plan with an invalid cron expression (`not-a-cron`)
- THEN the system MUST reject the plan with a validation error
- AND the plan MUST NOT be persisted

### Requirement: Update BackupPlan

The system MUST support updating existing backup plans.

#### Scenario: Update plan schedule

- GIVEN an existing backup plan
- WHEN the admin changes its schedule from `0 2 * * *` to `0 4 * * *`
- THEN the system MUST update the cron expression
- AND MUST recalculate `nextRunAt`
- AND the response MUST include the updated plan

#### Scenario: Toggle plan enabled/disabled

- GIVEN an existing enabled backup plan
- WHEN the admin disables the plan
- THEN the system MUST set `enabled: false`
- AND the plan MUST NOT be executed during scheduled cron runs
- WHEN the admin re-enables the plan
- THEN the system MUST set `enabled: true`
- AND recalculate `nextRunAt` from the current time

### Requirement: Delete BackupPlan

The system MUST support deleting backup plans.

#### Scenario: Delete a plan

- GIVEN an existing backup plan
- WHEN the admin deletes the plan
- THEN the system MUST permanently remove the plan from the database
- AND associated backup files MUST NOT be deleted (they remain in storage)

### Requirement: Execute Scheduled Backups

The system MUST check for due backup plans and execute them on a recurring schedule.

#### Scenario: Cron triggers a due plan

- GIVEN a cron job hits the `/api/cron/backups` endpoint
- AND a BackupPlan exists with `enabled: true` and `nextRunAt <= now()`
- WHEN the cron handler executes
- THEN the system MUST trigger a backup according to the plan's type and tenantId
- AND create a BackupLog record with the result
- AND update `lastRunAt` to the current time
- AND calculate the new `nextRunAt` based on the schedule

#### Scenario: Multiple plans due at the same time

- GIVEN multiple backup plans with `nextRunAt <= now()`
- WHEN the cron handler executes
- THEN the system MUST process each plan sequentially (one at a time)
- AND each plan MUST have its own BackupLog entry
- AND if one plan fails, the remaining plans MUST still execute

#### Scenario: Cron handler with no due plans

- GIVEN no backup plans with `nextRunAt <= now()`
- WHEN the cron handler executes
- THEN the system MUST respond with status 200 and `{ executed: 0 }`
- AND MUST NOT create any backup files or logs

### Requirement: Retention Policy Execution

The system MUST automatically prune old backups based on each plan's retention configuration.

#### Scenario: Prune after backup execution

- GIVEN a BackupPlan with `retention: 30`
- AFTER the plan executes a scheduled backup
- THEN the system MUST list all BackupLog entries for that plan with status `completed`
- AND delete files older than 30 days from storage
- AND update their BackupLog status to `pruned`
- AND the retention applies ONLY to backups created by that plan

### Requirement: Next Run Calculation

The system MUST correctly compute the next execution time from a cron expression.

#### Scenario: Calculate next run after plan creation

- GIVEN a new plan with cron `0 2 * * *` created at 2026-05-24T10:00:00
- WHEN the plan is saved
- THEN `nextRunAt` MUST be 2026-05-25T02:00:00

#### Scenario: Calculate next run after execution

- GIVEN a plan that just executed at 2026-05-25T02:00:15
- WHEN `lastRunAt` is updated
- THEN `nextRunAt` MUST be 2026-05-26T02:00:00
