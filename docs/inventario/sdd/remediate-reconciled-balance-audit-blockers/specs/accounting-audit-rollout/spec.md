# Accounting Audit Rollout Specification

## Purpose

Define conservative migration, rollback invariants, and enforceable audit release gates for the remediation.

## Requirements

### Requirement: Nullable-first writer-before-reader activation

Audit-evidence schema changes MUST be additive and nullable-first. Evidence-complete writers MUST be active and measured before strict readers are enabled for each source, and new writers MUST achieve 100% complete mandatory evidence for successful new conversions before strict activation.

#### Scenario: Nullable foundation deployment

- GIVEN legacy rows do not contain all new provenance or v3 fields
- WHEN the schema foundation is deployed
- THEN legacy rows MUST remain readable under explicit legacy or unresolved contracts
- AND strict readers MUST remain disabled until their activation gate passes

#### Scenario: Incomplete writer blocks strict reader

- GIVEN writer telemetry observes any successful new conversion missing mandatory evidence
- WHEN strict-reader activation is evaluated
- THEN activation MUST be blocked for the affected source
- AND the incomplete write MUST remain observable without being relabeled as proven

### Requirement: Observable conservative dry-run and backfill

A read-only dry-run MUST classify every scanned legacy row as uniquely provable, ambiguous, or missing and MUST report tenant-safe counts for scanned, each classification, eligible updates, unchanged rows, and reasons. Execution MUST update only uniquely provable rows.

A row is uniquely provable only when exactly one governed candidate has the compatible ordered currency pair, an effective time no later than operation time, and an applied rate and converted value that agree with persisted evidence under the canonical decimal and currency-rounding contract. Approximate amount matching, current rates, `createdAt`, `updatedAt`, reconciliation time, or an assumed effective time MUST NOT establish uniqueness.

#### Scenario: Dry-run counts reconcile

- GIVEN a dry-run scans legacy rows
- WHEN its report completes
- THEN `uniquely provable + ambiguous + missing` MUST equal scanned
- AND the report MUST expose no sensitive raw financial values or cross-tenant identifiers

#### Scenario: Unique match is backfilled

- GIVEN exactly one candidate satisfies every unique-proof rule
- WHEN the separately approved backfill executes
- THEN only independently proven evidence fields MUST be populated
- AND the original amount, applied value, and other audit evidence MUST remain unchanged

#### Scenario: Ambiguous or missing match

- GIVEN zero or multiple candidates satisfy the proof rules
- WHEN dry-run or execution evaluates the row
- THEN the row MUST remain unchanged and nullable
- AND strict consumers MUST expose it as unresolved rather than choose a candidate

#### Scenario: Repeated or concurrent execution

- GIVEN the same approved backfill is retried or workers overlap
- WHEN execution completes
- THEN a uniquely provable row MUST receive at most one equivalent update
- AND totals MUST distinguish updated from already-complete or unchanged rows

### Requirement: Non-destructive rollback

Rollback MUST preserve fail-closed unsupported-cutoff behavior, immutable applied FX evidence, reversal audit records, and approved snapshot immutability. Application read activation MAY be rolled back, and nullable additions or indexes MAY remain, but destructive evidence rollback MUST NOT occur.

#### Scenario: Writer rollback

- GIVEN a new writer path is disabled or application code is rolled back
- WHEN rollback completes
- THEN previously persisted complete evidence MUST remain intact
- AND the system MUST NOT null, delete, or replace it with fabricated provenance

#### Scenario: Strict-reader rollback

- GIVEN strict readers create unexpected operational unavailability
- WHEN strict activation is rolled back
- THEN telemetry and fail-before-mutable-read historical protection MUST remain active
- AND no unsupported cutoff or unresolved conversion MUST be presented as proven

#### Scenario: Product consumer rollback

- GIVEN UI or PDF rollout fails
- WHEN that consumer is disabled
- THEN canonical APIs and evidence MUST remain authoritative
- AND legacy formulas MUST NOT be reactivated for new reports, closures, snapshots, or exports

### Requirement: Strict TDD and coverage release gate

Each implementation slice MUST retain strict TDD evidence showing an acceptance test failing for the intended behavioral reason before production code and passing afterward. CI MUST enforce at least 80% coverage for new code and at least 90% for pure financial calculators across statements, branches, functions, and lines.

#### Scenario: Threshold missed in one dimension

- GIVEN statements, branches, functions, or lines fall below an applicable threshold
- WHEN CI evaluates coverage
- THEN the release gate MUST fail even if all tests pass
- AND averaging another dimension above threshold MUST NOT compensate

#### Scenario: Missing red evidence

- GIVEN a slice has passing tests but no retained expected red-test evidence
- WHEN strict TDD conformance is reviewed
- THEN the slice MUST fail the release gate

### Requirement: Reproducible static and focused test gate

Corrected focused test paths MUST resolve and execute the intended suites. `pnpm run typecheck` MUST complete successfully without OOM, skip, or reduced scope, and no in-scope test or acceptance case MAY contain `.skip` or `.todo`.

#### Scenario: Focused path resolves no intended tests

- GIVEN a documented focused command resolves no tests or the wrong suite
- WHEN release evidence is evaluated
- THEN the gate MUST fail even if the command exits successfully

#### Scenario: Typecheck is skipped or exhausted

- GIVEN typecheck is skipped, narrowed, killed, or ends with OOM
- WHEN release readiness is evaluated
- THEN the gate MUST fail

### Requirement: Backend, tenant-negative, PDF, and accessibility evidence

Backend E2E MUST exercise the real financial report endpoint or action against isolated tenant data without intercepting the operation under test. E2E MUST cover unsupported history, approved v2, v3, comparison unavailable and available, reversal idempotency, and tenant-negative guessed-ID flows. PDF evidence MUST assert signature, parseability, required content, metadata, and canonical values. Impeccable and WCAG evidence MUST cover keyboard, focus, semantics, contrast, announcements, loading, stale or partial, warning, unavailable, error, telemetry, comparison, and export states.

#### Scenario: Report response is intercepted

- GIVEN E2E replaces or intercepts the financial report endpoint or action under test
- WHEN audit evidence is reviewed
- THEN that run MUST NOT satisfy the backend E2E gate

#### Scenario: Tenant-negative E2E

- GIVEN isolated tenant A and B fixtures with known accounting records
- WHEN tenant A reads, compares, exports, reverses, mutates, or guesses tenant B identifiers
- THEN every attempt MUST produce a non-disclosing denial
- AND no tenant B data or financial effect MUST be observed

#### Scenario: PDF assertion checks only download

- GIVEN an E2E confirms only that a download occurred
- WHEN PDF evidence is reviewed
- THEN the PDF gate MUST fail until signature, parsing, required text and metadata, warnings, coverage, and canonical values are asserted

## Traceability

| Capability | Proposal measurable outcomes covered |
| --- | --- |
| `financial-report-availability` | 1 Historical truthfulness; 4 Snapshot integrity; 11 Boundary consistency |
| `accounting-fx-evidence` | 2 FX evidence; 7 Foreign balances; 8 Coverage support; 16 Copy quality where surfaced |
| `canonical-financial-contracts` | 5 Canonical parity; 6 Cash semantics; 8 Coverage; 11 Boundary consistency |
| `accounting-tenant-safety-and-reversals` | 9 Lifecycle; 10 Tenant isolation; 16 Copy quality |
| `financial-report-experience` | 4 v2 warning propagation; 8 user-visible coverage; 12 Product commitments; 15 PDF and accessibility; 16 Copy quality |
| `accounting-audit-rollout` | 3 Conservative migration; 13 Automated release gates; 14 End-to-end evidence; 15 PDF and accessibility evidence |
