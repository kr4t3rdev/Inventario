# Remediate reconciled balance audit blockers with truthful, canonical accounting evidence

## Executive decision

Adopt a snapshot-first remediation: the product will support the current live state and approved immutable period snapshots. Any historical live cutoff that cannot be proven from cutoff-safe evidence MUST return an explicit unavailable state; it MUST NOT be labeled as historical while reading later mutable balances. This change will not introduce arbitrary event sourcing.

The remediation will establish immutable FX evidence, canonical accounting calculations, complete coverage reporting, tenant-safe access, enforceable reconciled-sale reversal rules, and versioned v3 snapshots. Existing approved v2 snapshots will remain immutable and viewable with a legacy warning. After those accounting contracts stabilize, the same change will deliver real PDF export, previous-period comparison, split balance/result loading, and user-facing coverage telemetry.

## Problem

The reconciled balance and result experience can currently present confidence that the stored evidence does not justify:

- Reconciliation services reuse the reconciliation date as the exchange-rate effective date because persistence lacks actual provenance.
- A live `asOf` report reads mutable current bank, inventory, receivable, and payable summaries, so a past label can contain later state.
- Legacy inclusive-range formulas still execute on snapshot and closing write paths alongside the canonical domain.
- Closing output treats COGS plus OPEX as cash egress even though result recognition is not gross cash movement.
- `AccountingReportsService` independently classifies, converts, signs, and aggregates data, with inconsistent tenant predicates and date boundaries.
- Foreign bank balances are omitted when conversion evidence is missing, understating assets without a sufficiently prominent unresolved contract.
- Reconciled service sales can be updated or hard-deleted rather than corrected through an auditable reversal.
- Result coverage does not prove how many candidate movements were normalized, classified, linked, included, estimated, or unresolved.
- Existing automated checks do not yet constitute an audit release gate: coverage is not enforced, typecheck has encountered OOM, backend E2E can intercept the report under test, and PDF/accessibility evidence is incomplete.

These gaps create audit, tenant-isolation, operational-support, and user-trust risk even when existing tests are green.

## Intent

Make every reported accounting value traceable to tenant-scoped source data, a canonical calculation contract, a truthful time boundary, and explicit coverage evidence. Fail closed when historical or conversion evidence is unavailable rather than fabricating precision.

## Approved product and accounting rules

| Topic | Rule |
| --- | --- |
| Historical availability | Current live state and approved immutable snapshots are supported. Unsupported historical live cutoffs MUST return an explicit unavailable result. |
| Snapshot versions | Existing v2 snapshots remain immutable and viewable. New snapshots use v3 provenance and coverage evidence. Legacy warnings MUST appear in UI, API/action responses, exports, and PDFs. |
| Snapshot time | `cutoffAt` is the exact semi-open accounting boundary; truthful `capturedAt` and `approvedAt` record later real instants separately. Snapshot creation MUST fail if cutoff-safe evidence is unavailable. |
| Currency governance | Functional currency is tenant-owned. Exchange rates come from a governed global catalog, while every applied conversion persists immutable values, source evidence, and actual effective time. |
| Foreign bank translation | A balance is translated only with governed evidence effective no later than the cutoff. Otherwise it remains explicitly unresolved in coverage. |
| Reconciled service corrections | Reconciled service sales cannot be mutated or hard-deleted. Corrections use a dated reversal with mandatory reason and authorized actor. The exact permission mapping is deferred to specification, but server enforcement is mandatory. |
| Date ranges | Accounting queries and calculators use semi-open ranges `[gte, lt)` consistently. |
| Comparison | Previous-period comparison uses an approved snapshot. If none exists, comparison is explicitly unavailable; it never falls back to reconstruction or a current-state estimate. |
| UI language | All user-facing copy remains neutral international Spanish. |

## Goals

1. Persist and consume real, immutable conversion provenance without inventing ambiguous history.
2. Prevent cutoff-unsafe historical reporting and snapshot capture.
3. Make the canonical domain the single source of classification, normalization, consolidation, coverage, and financial totals for reports, snapshots, closing, API/actions, and exports.
4. Distinguish gross cash inflow/outflow from COGS, OPEX, and other accrual result concepts.
5. Enforce tenant isolation and reconciled-service lifecycle rules at server and database boundaries.
6. Preserve approved snapshot immutability while introducing v3 provenance, coverage, and truthful timestamps.
7. Deliver real PDF export, approved previous-period comparison, split balance/result loading, and coverage telemetry after accounting contracts stabilize.
8. Establish measurable release gates for TDD, coverage, type safety, backend E2E, PDF output, and accessibility.

## Non-goals

- Supporting arbitrary historical live cutoffs without proven source history.
- Event-sourcing the whole application or speculatively introducing an auxiliary event ledger.
- Rewriting, deleting, or silently upgrading approved v2 snapshots.
- Inventing FX effective dates, rate identifiers, sources, or tenant policy during backfill.
- Using current or future exchange rates as historical evidence.
- Creating another financial calculator or retaining duplicate formulas as an accepted fallback.
- Changing the accounting basis or redefining recognition policy beyond the identified blockers.
- Broad visual redesign or non-neutral regional Spanish copy.
- Starting implementation, specs, design, or tasks during this proposal phase.

## Scope

### 1. FX provenance and tenant currency policy

- Extend reconciliation persistence additively and nullable-first so new records can retain tenant, operation time, original currency/amount, tenant functional currency, applied rate/value, converted amount, actual rate effective time, provenance kind/source, and optional global catalog rate identifier.
- Treat persisted applied values and timestamps as immutable evidence even when they reference a mutable global catalog row.
- Update writers before readers become strict. A conversion without complete evidence MUST be represented as unresolved, not normalized with a synthetic timestamp.
- Add indexes for tenant plus operation time and tenant plus provenance lookup where the final design demonstrates query need.
- Apply an as-of rate no later than the cutoff to foreign bank balances; missing evidence MUST remain visible in coverage and MUST NOT silently become zero, disappear, or use a later rate.

### 2. Cutoff-safe reports and snapshots

- Make the availability resolver distinguish current live reports, approved snapshots, and unsupported historical live cutoffs.
- Reject unsupported cutoffs before querying mutable current auxiliaries.
- Create v3 snapshots only from canonical, cutoff-safe inputs, with separate `cutoffAt`, `capturedAt`, and `approvedAt` timestamps.
- Preserve v2 payloads byte-for-byte and show a legacy evidence warning across every consumer.
- Keep approved snapshots immutable. Any future correction requires an explicit audited reopen/re-close lifecycle that preserves prior versions; defining that broader lifecycle is not required unless needed by the accepted reversal contract.

### 3. Canonical accounting consolidation

- Use `src/features/contabilidad/domain/` and its canonical service adapters as the only calculation source.
- Retire active legacy calculations in `periodo-snapshot-service.ts` and closing actions; compatibility reads may remain only for immutable legacy rows.
- Replace independent summary calculations in `AccountingReportsService` with canonical outputs or thin projections. Detail/export formatting MAY differ, but financial classification, sign, conversion, range, and aggregation rules MUST not.
- Require all reports, v3 snapshots, closing, API routes, server actions, comparison, telemetry, and export/PDF consumers to use the same canonical contracts.
- Extend the canonical cash-flow contract to expose gross inflows and gross outflows separately. COGS and OPEX remain result concepts and MUST NOT be relabeled as gross cash egress.
- Add report-level coverage that combines balance and result coverage without treating an estimate as equivalent to an unresolved omission.

### 4. Security and reconciled service lifecycle

- Require explicit `tenantId` predicates on every tenant-owned reconciliation, report, snapshot, reversal, and export query; authentication or RLS alone is not sufficient.
- Validate tenant ownership and authorization before reads or state changes, including catalog-to-tenant conversion usage.
- Reject updates and hard deletes for reconciled service sales at the server domain boundary.
- Provide a dated reversal operation with original-record link, tenant, effective time, mandatory reason, authorized actor, and idempotency/audit protection. Permission details will be specified without weakening these invariants.
- Return typed, non-sensitive unavailable/validation/authorization/conflict results. UI feedback MUST use neutral international Spanish and MUST not expose internal errors or cross-tenant existence.

### 5. Product commitments

After canonical contracts and persistence are stable, this same change includes:

1. **Real PDF export:** generate an actual parseable PDF from the canonical report, including tenant/report identity, cutoff or snapshot version, coverage state, comparison availability, and any v2 legacy warning.
2. **Previous-period comparison:** compare against the appropriate approved immutable snapshot; report explicit unavailability when no eligible snapshot exists.
3. **Split balance/result loading:** expose independent loading and failure states so one section does not conceal or block the other, while preserving a coherent report-level coverage state.
4. **Coverage telemetry:** show users whether data is complete, estimated, unresolved, or legacy and expose operational aggregates without leaking sensitive source details.

## Affected capabilities and modules

| Capability | Primary affected areas |
| --- | --- |
| Canonical amounts, result, balance, and cash flow | `src/features/contabilidad/domain/` calculators, policies, types, and focused tests |
| Reconciliation reads/writes | `src/features/contabilidad/services/reconciled-result-service.ts` and sale/service/expense reconciliation adapters |
| Live and historical resolution | `balance-results-report-service.ts`, `historical-financial-report-service.ts`, `current-balance-service.ts` |
| Duplicate reporting adapters | `accounting-reports-service.ts` and its API/action/export consumers |
| Closing and snapshots | `src/features/contabilidad/actions-periodos.ts`, `src/lib/services/periodo-snapshot-service.ts`, `cierreContableService.ts` |
| Service sale lifecycle | `src/features/venta-servicios/actions.ts` and server-side domain/persistence guards |
| Persistence | `prisma/schema.prisma`, reviewed migrations, indexes, and backfill tooling/report artifacts |
| Product presentation | Balance/result report UI, state management, comparison, telemetry, export/PDF, and neutral Spanish messages |
| Verification | Vitest unit/integration, Playwright backend E2E, coverage enforcement, typecheck, PDF inspection, and Impeccable/WCAG evidence |

Exact file-level changes belong in design and tasks; this table identifies proposal-level impact rather than prescribing implementation prematurely.

## Validation boundaries

### Persistence and migration boundary

- Schema changes MUST be additive and nullable-first.
- Database constraints, uniqueness/idempotency keys, and transactions MUST preserve snapshot/provenance/reversal immutability where enforceable.
- Backfill MUST never infer evidence from `createdAt`, `updatedAt`, reconciliation date, current rates, or approximate amount matches.

### Server domain boundary

- Zod or equivalent schemas validate identifiers, currency pairs, finite decimal amounts, timestamps, ranges, reversal reasons, and requested report mode.
- Canonical domain rules enforce semi-open ranges, no-future-rate selection, complete conversion evidence, gross cash semantics, snapshot availability, and reconciled-sale immutability.
- Expected failures use typed results/errors so unsupported history, missing evidence, validation, authorization, and conflict states remain distinguishable.

### Data-access and authorization boundary

- Every tenant-owned query includes an explicit tenant predicate and source ownership verification.
- Global exchange-rate lookup is governed reference access; its application is allowed only within a tenant context and is persisted as immutable tenant report/reconciliation evidence.
- Tenant-negative tests MUST prove that IDs, reconciliation records, snapshots, reversals, comparisons, telemetry, and exports from tenant B are neither readable nor mutable by tenant A.

### API/action and consumer boundary

- API routes and server actions MUST propagate canonical availability and coverage states rather than converting them into empty success payloads.
- Reports, snapshots, closing, API/actions, comparison, telemetry, exports, and PDFs MUST consume canonical totals and evidence contracts; no consumer may recompute financial formulas.
- User-facing errors and warnings remain neutral international Spanish, while logs use structured, redacted diagnostic context.

### UI boundary

- Client validation improves feedback but never substitutes for server authorization or accounting enforcement.
- Balance and result may load independently, but stale, partial, unresolved, legacy, and unavailable states MUST remain explicit.
- Accessibility validation covers loading, failure, warning, comparison, telemetry, and export interactions, not only the happy path.

## Data migration and backfill policy

1. Add nullable provenance, v3 snapshot, coverage, and reversal-support fields/tables with reviewed indexes and no strict-read behavior change.
2. Deploy writers that persist complete evidence for new conversions and reversals; measure writer completeness before tightening readers.
3. Run a read-only dry-run backfill that classifies every legacy row as uniquely provable, ambiguous, or missing and reports counts by tenant/source without exposing sensitive values.
4. Backfill only rows with one uniquely provable match: compatible currency pair, persisted rate and converted value, and a governed rate effective no later than the operation time. The final design MUST define exact decimal tolerance and uniqueness rules before execution.
5. Leave ambiguous or missing rows nullable and unresolved. Never set `rateEffectiveAt = operationAt` unless independent immutable evidence proves that fact.
6. Enable strict reads only after writer telemetry and dry-run results meet an approved threshold and unresolved behavior is verified.
7. Create only v3 snapshots after activation. Existing v2 snapshots and their payloads are never rewritten, regenerated, or silently backfilled.
8. Keep migration execution separately reviewable and reversible at the application-read level; do not use destructive down migrations against audit evidence.

## Phased rollout

### Phase 0 — Contract and red-test gate

Encode failing behavior tests for unsupported cutoffs, semi-open boundaries, real FX evidence, future-rate rejection, tenant isolation, gross cash flow, coverage aggregates, foreign-bank handling, snapshot immutability/versioning, and reconciled-sale reversal rules. Expectations come from the approved contracts, not legacy outputs.

### Phase 1 — Fail closed and add nullable foundations

Reject unsupported historical live cutoffs before mutable reads. Add nullable provenance and versioning foundations without fabricating backfill or enabling strict readers.

### Phase 2 — Provenance writers and conservative backfill

Update reconciliation writers source by source, add completeness telemetry, run the dry-run report, and execute a separately approved backfill only for uniquely proven records.

### Phase 3 — Canonical readers and consolidation

Make result/balance coverage first-class, translate foreign balances when evidence exists, expose gross cash movements, correct closing semantics, and replace duplicate report calculations with canonical projections. Adopt semi-open ranges and explicit tenant predicates throughout.

### Phase 4 — v3 snapshots and lifecycle enforcement

Activate cutoff-safe canonical v3 snapshot creation, remove legacy formulas from active write paths, surface v2 warnings everywhere, and enforce immutable reconciled services plus authorized dated reversal.

### Phase 5 — Product commitments

Deliver split loading, snapshot-backed previous-period comparison, user-facing coverage telemetry, and real PDF export using the stabilized canonical contract.

### Phase 6 — Release evidence

Enforce coverage thresholds, complete a successful non-skipped typecheck without OOM, run full backend E2E without report interception, verify real PDF bytes/content, and capture Impeccable/WCAG evidence.

This proposal forecasts a multi-slice change. No apply phase may begin until tasks forecast and slice boundaries are reviewed against the 400 changed-line review budget. Schema/generated output and migrations may require separately reviewed slices; no slice should hide unrelated accounting and product work to appear under budget.

## Operational observability

Emit structured, redacted metrics/logs with tenant-safe identifiers for:

- Report resolution by current live, approved v2, approved v3, and unsupported historical cutoff.
- Conversion writer completeness and unresolved provenance by source and reason.
- Dry-run/backfill totals: scanned, uniquely provable, ambiguous, missing, updated, and unchanged.
- Foreign-bank translated and unresolved counts/amount coverage, without logging sensitive raw account data.
- Result and balance candidate, normalized, classified, linked, included, estimated, unresolved, and excluded totals.
- Legacy v2 views/exports, v3 snapshot creation failures, comparison unavailability, reversal attempts/outcomes, and tenant-denied operations.
- Balance/result load latency and failures, PDF generation failures, and canonical-consumer mismatch assertions during rollout.

Alerts SHOULD focus on invariant breaches: synthetic/future provenance, cross-tenant denial anomalies, incomplete new-writer evidence, canonical mismatch, attempted approved-snapshot mutation, and unexpected growth in unresolved coverage. Expected user-level unavailability should be observable without being logged as an internal exception storm.

## Rollback plan

- Roll out by bounded dependency slices and retain the previous application version while additive nullable schema changes remain compatible.
- If a new writer fails, disable that writer path or roll back application code; preserve already written evidence and do not null or delete it.
- If strict readers cause unexpected unavailability, roll back strict-read activation while retaining fail-closed historical cutoff protection and telemetry. Do not restore fabricated provenance or cutoff-unsafe historical labels.
- If v3 snapshot creation fails, stop new closure approval and keep existing immutable v2/v3 snapshots viewable; never regenerate or mutate approved snapshots during rollback.
- If canonical consumer migration reveals a mismatch, stop the affected rollout slice and use captured comparison diagnostics. Legacy formulas may remain available only for immutable legacy reads, not as a new write fallback.
- If product presentation or PDF rollout fails, disable only that consumer while canonical APIs remain authoritative and explicit about availability/coverage.
- Database rollback is forward-compatible: nullable additions and indexes may remain. Destructive down migrations, reversal of audit evidence, and ambiguous provenance cleanup are prohibited.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Multi-module workload exceeds review capacity | Accounting and UI regressions become difficult to review | Keep dependency-ordered slices near or below 400 changed lines and require task forecast review before apply. |
| Legacy records lack provable FX evidence | Reports become explicitly incomplete | Nullable-first schema, dry-run classification, unique-match-only backfill, and visible unresolved coverage. |
| Canonical consolidation changes established totals | Users may see explainable differences from legacy formulas | Contract-first tests, dual diagnostics during rollout, source-level coverage, and no legacy formula fallback for new writes. |
| Functional currency and global rates are applied across tenant boundaries | Financial data or policy may leak | Tenant context on every application, explicit predicates, immutable applied evidence, and tenant-negative tests. |
| Snapshot capture uses mutable state after cutoff | Approved history becomes misleading | Separate cutoff/capture/approval times and reject snapshot creation without cutoff-safe evidence. |
| Reversal authorization is underspecified | Overly broad or unusable correction flow | Specify an explicit permission mapping before implementation while preserving actor, reason, tenant, date, and immutability invariants. |
| Product commitments delay accounting stabilization | Correctness and release scope compete | Gate product slices after canonical contracts, but retain all four commitments in this change. |
| Typecheck or E2E infrastructure remains unreliable | Audit evidence cannot be reproduced | Treat OOM resolution, full backend E2E, and enforceable coverage as release blockers rather than optional cleanup. |
| Rollback reintroduces known false precision | Operational recovery causes audit regression | Preserve fail-closed cutoff behavior, immutable evidence, and snapshot immutability in every rollback mode. |

## Measurable acceptance outcomes

The change is acceptable only when all of the following are demonstrated:

1. **Historical truthfulness:** 100% of unsupported historical live cutoff requests return the explicit unavailable contract before current mutable auxiliary reads; no response labels current state as historical.
2. **FX evidence:** 100% of newly converted reconciliation records persist complete immutable applied evidence and actual effective time; no service synthesizes `rateEffectiveAt` from operation or reconciliation time.
3. **Conservative migration:** Dry-run counts reconcile with scanned legacy rows, execution updates only uniquely provable rows, and ambiguous/missing rows remain unchanged and explicitly unresolved.
4. **Snapshot integrity:** Existing approved v2 snapshots remain unchanged and viewable with a legacy warning in UI, API/actions, exports, and PDF. Every new approved snapshot is v3, immutable, cutoff-safe, and records truthful cutoff/capture/approval times.
5. **Canonical parity:** Reports, snapshots, closing, API/actions, comparisons, telemetry, exports, and PDF obtain all financial totals from the canonical domain. Contract fixtures show no duplicate calculator path.
6. **Cash semantics:** Canonical output exposes gross cash inflow and gross cash outflow independently; closing never derives gross egress from COGS plus OPEX.
7. **Foreign balances:** Every foreign bank balance is either converted with evidence effective at or before cutoff or included in explicit unresolved coverage; none is silently omitted or assigned a future/current fallback rate.
8. **Coverage:** Report contracts expose candidate, normalized, classified, linked, included, estimated, unresolved, and excluded evidence sufficient to reconcile balance and result coverage without conflating estimates with omissions.
9. **Lifecycle:** Attempts to mutate or hard-delete reconciled service sales fail server-side. Authorized reversal records are tenant-scoped, dated, linked, reasoned, auditable, and idempotent.
10. **Tenant isolation:** Tenant-negative unit/integration/E2E cases prove tenant A cannot read, compare, export, reverse, mutate, or infer tenant B accounting records, including through guessed identifiers.
11. **Boundary consistency:** Tests cover exact lower and upper boundaries and prove all accounting ranges are semi-open `[gte, lt)` across canonical and consumer paths.
12. **Product commitments:** Balance and result show independent loading/failure states; previous-period comparison is snapshot-backed or explicitly unavailable; coverage telemetry is user-visible; and export produces a real PDF containing canonical values and required legacy/coverage evidence.
13. **Automated release gates:** Enforceable coverage thresholds fail CI when unmet; focused test paths resolve and run; strict TDD evidence is retained for each slice; and `pnpm run typecheck` succeeds without skip or OOM.
14. **End-to-end evidence:** Full backend E2E runs against isolated tenant data without intercepting the financial report endpoint or action under test and verifies unavailable, legacy, v3, comparison, reversal, and tenant-negative flows.
15. **PDF and accessibility evidence:** PDF verification checks signature, parseability, required text/metadata, and values rather than only a download event. Impeccable review and WCAG evidence cover keyboard use, focus, semantics, contrast, announcements, loading, partial, warning, unavailable, error, and export states.
16. **Copy quality:** All new user-visible warnings, errors, status labels, telemetry, and PDF text use neutral international Spanish.

## Proposal question round outcome

The main product questions were approved before this proposal. A final bounded round confirmed that closure separates cutoff, capture, and approval times; missing previous snapshots yield explicit comparison unavailability; and v2 legacy warnings propagate through all consumers. The exact role-to-permission mapping for service-sale reversal remains a specification decision, constrained by mandatory server authorization, actor identity, reason, tenant ownership, and auditability. No second question round is required.

## Next phase gate

The next recommended phase is specification, only after explicit user approval. Specification should turn these commitments into RFC 2119 behavior and Given/When/Then scenarios without starting implementation. Apply remains blocked until design/tasks exist and the multi-slice workload forecast has been reviewed against the 400 changed-line budget.
