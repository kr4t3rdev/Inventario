# Accounting Tenant Safety and Reversals Specification

## Purpose

Define non-disclosing tenant isolation and an auditable, least-privilege correction lifecycle for reconciled service sales.

## Requirements

### Requirement: Explicit tenant scoping and ownership

Every tenant-owned reconciliation, report, result, balance, snapshot, comparison, reversal, telemetry, CSV, PDF, and source-detail read or write MUST include an explicit tenant predicate and MUST verify ownership before returning data or changing state. Authentication, route access, or row-level security alone MUST NOT satisfy this requirement.

#### Scenario: Tenant-owned read

- GIVEN tenants A and B have accounting evidence
- WHEN a tenant A actor requests a report, comparison, export, telemetry view, or source detail
- THEN every tenant-owned query MUST be constrained to tenant A
- AND no identifier, count, amount, status, timing, or metadata from tenant B MUST be exposed

#### Scenario: Catalog application ownership

- GIVEN a rate catalog is global but the source record and functional-currency policy are tenant-owned
- WHEN a conversion is requested
- THEN the system MUST verify source ownership and tenant policy before applying the global reference
- AND MUST persist the application as tenant-owned evidence

### Requirement: Typed non-disclosing failures

Expected unavailable, validation, authorization, not-found, and conflict conditions MUST remain distinguishable through typed contracts. Cross-tenant and guessed-identifier requests MUST return the same non-disclosing outcome as an inaccessible or nonexistent resource and MUST NOT reveal internal errors or resource existence.

#### Scenario: Guessed identifier

- GIVEN a tenant A actor guesses the identifier of tenant B's reconciliation, snapshot, reversal, comparison, telemetry source, or export
- WHEN the request is made
- THEN the system MUST return the configured non-disclosing not-found or authorization contract consistently
- AND MUST NOT reveal which resource exists, its tenant, or its state

#### Scenario: Operational diagnostics

- GIVEN an expected authorization denial or unavailable report occurs
- WHEN diagnostics are emitted
- THEN user-facing text MUST be neutral international Spanish
- AND structured server diagnostics MUST be redacted and MUST NOT include sensitive raw account or cross-tenant values

### Requirement: Reconciled service sale immutability

A reconciled service sale MUST NOT be updated or hard-deleted at any server or persistence boundary. Corrections MUST use a reversal and MUST preserve the original recognized record.

#### Scenario: Mutation and hard delete rejected

- GIVEN a service sale is reconciled
- WHEN any actor attempts to edit accounting-relevant fields or hard-delete it
- THEN the system MUST return a typed immutable-record conflict
- AND the original sale and reconciliation MUST remain unchanged

#### Scenario: Legacy unreconciled sale

- GIVEN a service sale has never been reconciled or included in immutable accounting evidence
- WHEN an otherwise authorized update or delete is requested
- THEN this change MUST NOT by itself prohibit behavior already permitted by the existing lifecycle
- AND all tenant and authorization checks MUST still apply

### Requirement: Explicit accounting reversal permission

The system MUST define and enforce the named tenant permission `accounting.reconciled-service-sale.reverse`. Because the existing role model has no suitable granular accounting-reversal permission, this operation MUST NOT rely only on `/api/contabilidad/*`, a manager wildcard, or global platform-admin status. The permission MUST be granted by default to tenant roles `manager` and `economico`, MUST be denied to `dependiente`, and a platform `admin` MUST also hold an active membership in the target tenant with this permission.

#### Scenario: Economic actor reverses own-tenant sale

- GIVEN an authenticated actor has an active target-tenant membership and `accounting.reconciled-service-sale.reverse`
- WHEN all reversal invariants are satisfied
- THEN the actor MUST be authorized independently of broad route access

#### Scenario: Broad privilege without explicit permission

- GIVEN an actor has global admin status or broad route access but lacks the target-tenant permission or membership
- WHEN a reversal is requested
- THEN the system MUST reject it with a non-disclosing authorization result
- AND MUST NOT create a reversal

#### Scenario: Dependent role attempts reversal

- GIVEN an actor's target-tenant role is `dependiente`
- WHEN a reversal is requested
- THEN the system MUST deny the operation even if the actor can perform ordinary service-sale operations

### Requirement: Dated, linked, auditable, idempotent reversal

An authorized reversal MUST record the original record link, tenant, effective time, mandatory non-empty reason, actor identity, immutable audit evidence, and an idempotency key. Its effective time MUST satisfy existing accounting-period controls, and the reversal MUST NOT rewrite an approved snapshot or original conversion evidence.

#### Scenario: Valid reversal

- GIVEN an eligible reconciled service sale belongs to the actor's tenant and the actor has the explicit permission
- WHEN the actor submits a valid effective time, reason, and unused idempotency key
- THEN the system MUST create one linked reversing record with equal-and-opposite canonical accounting effect
- AND MUST preserve the original sale, reconciliation, and approved snapshots

#### Scenario: Same-key retry

- GIVEN a reversal was committed successfully
- WHEN the same tenant and actor retry the same logical request with the same idempotency key and payload
- THEN the system MUST return the original reversal result
- AND MUST NOT create a second financial effect or audit event

#### Scenario: Same key with different payload

- GIVEN an idempotency key already identifies a reversal
- WHEN any amount, original link, effective time, reason, or tenant differs on retry
- THEN the system MUST return a typed idempotency conflict
- AND MUST leave all financial evidence unchanged

#### Scenario: Concurrent reversal race

- GIVEN two authorized requests concurrently attempt to reverse the same original sale
- WHEN they commit with different idempotency keys
- THEN at most one reversal MUST create a financial effect
- AND the other MUST receive a typed already-reversed conflict

#### Scenario: Invalid or closed effective date

- GIVEN the requested effective time is invalid or not eligible under existing accounting-period controls
- WHEN reversal is attempted
- THEN the system MUST reject it without implicitly reopening a period or changing an approved snapshot
- AND MUST leave the original and prior audit evidence unchanged
