# Exploration: remediate-reconciled-balance-audit-blockers

## Scope and invariants

Exploration only. The remediation must retain tenant isolation, semi-open ranges `[gte, lt)`, immutable approved snapshots, strict TDD, neutral Spanish UI copy, and the existing canonical domain in `src/features/contabilidad/domain/` plus its service adapters. Existing green tests are evidence of regression safety, not proof that legacy formulas are correct.

## Refined root-cause map

### 1. Conversion provenance is represented by a fabricated date

`reconciled-result-service.ts` passes `fechaReconciliacion` as both `operationAt` and `rateEffectiveAt`. The pure normalizer correctly requires a real effective date and rejects future rates, but the persistence models for sale/service/expense reconciliations contain only `tasaCambio` and `montoConvertido`; they do not contain the applied rate row, effective instant, destination/functional currency, or provenance source. The service therefore makes incomplete rows look proven.

`TasaCambio` and `Moneda` are global models, and `getPrincipalCurrency` does not accept a tenant. This is an additional isolation/policy decision: either rates and functional currency are intentionally global, or the data model currently cannot prove tenant-specific accounting currency policy.

### 2. `asOf` is mostly a label, not a database cutoff

`getBalanceResultsReport` passes a cutoff into `getCurrentBalance`, but that service reads current bank balances, current stock locations, all surviving FIFO purchase layers, and current CxC/CxP states and paid balances. Only capital injections and closures are meaningfully filtered by `asOf`. Consequently a past cutoff in the current accounting year can receive today's auxiliary balances while being labeled with the past cutoff.

Approved v2 snapshots avoid this leak because `resolveFinancialReport` returns the stored payload without live balance queries. Past years without an approved valid snapshot are already rejected. The unsafe case is live arbitrary/past cutoff calculation, plus creation of a closure snapshot from mutable current auxiliaries.

The present schema does not provide sufficient history for arbitrary reconstruction:

- `CuentaBancaria.saldo`, `StockUbicacion.cantidad`, CxC `montoPagado/estado`, and CxP `saldoPendiente/estado` are mutable summaries.
- `createdAt/updatedAt` cannot reconstruct earlier values or state transitions.
- Bank movements can partially reconstruct balances, but correctness depends on a complete opening balance and every movement/reversal source.
- Inventory needs immutable quantity/cost movements or checkpoints; current stock plus purchase allocations is not an as-of ledger.
- CxC/CxP need issuance, payment, cancellation/reversal, and deletion history or trustworthy checkpoints.

### 3. Legacy snapshot formulas remain on the write path

`actions-periodos.ts` still calls `SnapshotService.generarSnapshot` and `generarResumenSnapshot` before creating the canonical annual v2 snapshot. `periodo-snapshot-service.ts` uses inclusive `lte` ranges, raw aggregate formulas, and reverse-from-current historical balance logic. Thus the formulas are not merely dead compatibility code: they persist `SaldoSnapshot`, feed snapshot counts/base JSON, and remain active for nonannual periods.

### 4. Cash egress is inferred from accrual expense presentation

`cierreContableService.ts` sets `egresosCaja` to COGS plus operating expenses. COGS recognition and operating expenses are result concepts, not gross cash outflows. The canonical calculator currently exposes only net operating/financial cash flow, so a correct gross egress cannot be taken from an explicit canonical field. The domain should expose gross inflow/outflow totals (or a canonical cash-flow movement summary) before closure presentation is corrected.

### 5. A second reporting engine remains active

`accounting-reports-service.ts` independently queries, classifies, converts, signs, and aggregates reconciliation and banking sources. Its `buildDateFilter` uses inclusive end-of-day ranges. Aggregate summary behavior therefore can diverge from `reconciliation-policy`, `normalizeAccountingAmount`, and `calculateReconciledResult`.

A security-adjacent finding raises its priority: inspected exchange and exchange-impact queries use the supplied date/currency filters without consistently applying `tenantId` to reconciliation queries; global rate/transaction models also cannot be tenant-filtered. Consolidation must not preserve this omission.

### 6. Foreign bank balances are knowingly omitted

`current-balance-service.ts` records `MISSING_CONVERSION` then excludes every foreign-currency bank balance from assets. Coverage becomes incomplete, but the headline total is understated. Correct behavior requires a defined balance-sheet translation policy, an as-of rate no later than the cutoff, and provenance in the returned/snapshotted evidence. Missing rates must remain explicit unresolved coverage, not be silently valued or assigned a current/future rate.

### 7. Reconciled service sales can still be mutated or hard-deleted

`VentaServicios` has no cancellation/deletion lifecycle fields. Its actions allow update and hard delete after a tenant-scoped lookup; no explicit reconciliation or approved-period guard is applied. A database foreign key may accidentally block some hard deletes, but updates remain possible and callers do not receive intentional domain enforcement. Cancellation should be a server-enforced transition or reversal, not mutation/removal of recognized history.

### 8. Result coverage is not a first-class aggregate

The canonical result returns incidents and estimates, but no total/normalized/unresolved aggregate by issue/source/amount. Snapshot coverage merely counts result incidents and estimates. That cannot answer whether all candidate movements were classified, normalized, linked to documents, and included. Balance coverage is richer but still separate. A report-level coverage contract must combine balance and result coverage without equating an estimate with an unresolved omission.

## Schema and migration implications

### Historical conversion evidence

A safe reconciliation conversion record needs, at minimum:

- original currency and amount (already present),
- destination/functional currency at operation time,
- persisted applied rate and converted amount (already partial),
- actual rate effective instant,
- provenance kind/source and preferably the applied rate identifier,
- operation instant and tenant ownership.

A foreign key to `TasaCambio` alone is insufficient because the referenced row is mutable and lacks tenant ownership. Persist the applied values as immutable evidence even if an optional FK is retained for traceability. Add indexes supporting tenant + operation date and tenant + provenance lookup. Decide whether rates/currencies become tenant-scoped or are explicitly governed global reference data.

Backfill must be two-stage and conservative: dry-run/report first, then update only uniquely provable records (matching currency pair, persisted rate/value, and an effective rate not later than the operation). Ambiguous/missing matches stay unresolved. Never backfill `rateEffectiveAt = operationAt`. Migration fields should initially be nullable; readers become strict after writer coverage and backfill telemetry are verified.

### Cutoff-safe auxiliaries

There are three viable storage shapes:

1. append-only bank/inventory/receivable/payable events with periodic checkpoints;
2. immutable auxiliary snapshots at supported cutoffs plus append-only deltas;
3. snapshot-only historical reporting with arbitrary past live cutoffs rejected.

If arbitrary live cutoffs remain a requirement, option 1 or 2 needs migration tables carrying `tenantId`, source ID, effective instant, native amount/quantity, currency/cost, event kind, reversal link, and uniqueness/idempotency keys. RLS/authorization is not a substitute for explicit tenant predicates in Prisma. If only approved historical periods are required, option 3 avoids a large speculative ledger migration and is safer immediately.

Snapshot payloads should be versioned rather than rewriting approved v2 evidence. New coverage/provenance fields likely justify v3. Existing approved snapshots remain immutable; corrections require an explicit reopen/re-close flow that preserves prior versions and audit history.

## Remediation approaches

### Approach A — Patch each existing service in place

Add missing filters, date changes, conversions, and guards directly to each service.

- Advantage: smallest apparent diff and fastest local fixes.
- Disadvantages: preserves multiple aggregation engines, cannot solve missing historical state, and invites tests that bless divergent formulas.
- Verdict: not recommended except for immediate fail-closed security/cutoff guards.

### Approach B — Snapshot-only truthful history

Use the canonical domain for current live reports and annual closure snapshots; serve approved immutable snapshots for historical periods; reject past live cutoffs without sufficient evidence. Retire active legacy snapshot formulas and add strict provenance/coverage.

- Advantages: smallest correct model, compatible with the existing historical resolver, reviewable in bounded slices, and fails closed rather than fabricating history.
- Disadvantages: arbitrary intra-period historical cutoffs remain unavailable; previous-period UX depends on approved snapshots.
- Best fit if the product only promises current live plus approved historical reports.

### Approach C — Canonical as-of ledger/checkpoint model

Introduce append-only auxiliary events/checkpoints, reconstruct native balances at any cutoff, translate foreign balances with an as-of rate, and feed only normalized inputs into the current canonical calculators.

- Advantages: supports arbitrary cutoffs, comparison, auditability, and future telemetry without a second calculator.
- Disadvantages: largest migration/backfill/concurrency risk; requires proving complete event capture for every mutation path.
- Best fit only if arbitrary cutoff reporting is a committed business capability.

### Recommendation

Adopt a staged hybrid led by Approach B: immediately make unsupported past live cutoffs unavailable, persist real conversion provenance, use only canonical calculations for live/current and new approved snapshots, and retire legacy formulas. Add Approach C later only if the business confirms arbitrary intra-period cutoffs are mandatory. This removes false precision now without forcing an incomplete event-sourcing rewrite. Regardless of that decision, canonical readers should accept an explicit semi-open range and all report adapters should reuse their classification, normalization, and coverage output.

## Dependency ordering

1. **Decision and contract gate:** confirm supported cutoff semantics, currency governance/translation policy, cancellation policy, and treatment of existing v2 snapshots.
2. **Canonical red tests:** encode semi-open boundaries, real rate provenance, gross cash-flow semantics, aggregate result coverage, foreign-bank behavior, service lifecycle guards, and tenant-negative cases. Do not derive expectations from legacy services.
3. **Persistence foundation:** nullable provenance fields and/or tenant-scoped rate policy; dry-run backfill and telemetry before strict reads.
4. **Canonical writer/reader adoption:** reconciliation writers persist evidence; canonical result and balance readers consume it and fail unresolved rather than synthesize it.
5. **Cutoff safety:** first reject unsupported live past cutoffs; if required, add auxiliary event/checkpoint infrastructure and only then enable arbitrary as-of calculation.
6. **Snapshot write path:** create versioned canonical snapshots from cutoff-safe inputs; remove `SnapshotService` formulas from active actions while preserving immutable old rows.
7. **Consumers:** correct closure cash labels and adapt/deprecate aggregate methods in `AccountingReportsService`; enforce semi-open ranges and tenant predicates.
8. **Service lifecycle enforcement:** guard update/delete/cancel in the server domain and add reversal semantics if cancellation after reconciliation is allowed.
9. **Presentation/product work:** loading separation, comparison, telemetry, export, and accessibility evidence after accounting contracts stabilize.
10. **Release verification:** enforced thresholds, focused paths, typecheck memory resolution, real backend E2E, and artifact evidence.

## Proposed bounded slices (not final tasks)

Each slice should target less than 400 changed lines including focused tests; schema/generated output may require a separately reviewed migration slice.

1. Fail-closed cutoff resolver tests and behavior for unsupported past live cutoffs.
2. Provenance schema migration plus indexes, with no reader behavior change.
3. Reconciliation writer provenance for one source, then parallel small slices for service and expense sources.
4. Dry-run provenance backfill/report; a separate reviewed execution migration only for uniquely proven rows.
5. Canonical normalizer/result reader strict provenance and result coverage aggregate.
6. Foreign-bank translation policy and canonical balance adapter, including missing-rate coverage.
7. Canonical gross cash-flow contract followed by `cierreContableService` mapping.
8. Remove annual legacy snapshot calculations from `cerrarPeriodoAction`; separately address nonannual snapshots.
9. Service update/delete/cancel server guards and neutral Spanish errors.
10. Semi-open range utility adoption in one `AccountingReportsService` endpoint family at a time.
11. Canonical summary adapter/deprecation path for duplicate aggregate reports; keep detail/export projection separate from financial calculation.
12. Snapshot v3 coverage/provenance and immutable resolution tests.
13. Product UI/API slices only after contract approval (loading, comparison, telemetry, PDF, accessibility).
14. Verification infrastructure slices (coverage thresholds, typecheck memory profile, real E2E fixtures, focused path correction).

## Mandatory remediation, conditional product scope, and non-goals

### Mandatory accounting/security blockers

- Real exchange-rate provenance with conservative unresolved handling.
- No report labeled with a cutoff while using later mutable auxiliary state; reject unsupported cutoffs if necessary.
- Removal of active legacy financial formulas from closure/snapshot paths.
- Correct cash-flow semantics in closure output.
- Canonical classification/conversion/aggregation, semi-open ranges, and explicit tenant predicates in accounting report adapters.
- As-of conversion of foreign bank balances when evidence exists; explicit unresolved coverage otherwise.
- Server-side enforcement for reconciled service mutation/deletion/cancellation.
- Complete, explainable result and report coverage aggregates.
- Immutable, versioned approved snapshots and strict TDD throughout.

### Mandatory release evidence for an audit pass

Enforced coverage thresholds, a successful non-skipped typecheck with the OOM cause addressed, a real backend E2E run (not route interception alone), corrected focused-test paths, and final accessibility/WCAG evidence are release gates rather than accounting features.

### Conditional product commitments

Separate balance/result loading, previous-period comparison, user-facing coverage telemetry, and real PDF export are enhancements unless they remain in the accepted product scope. If they were previously promised acceptance criteria, they must be delivered or explicitly descoped in the proposal; passing tests cannot silently replace them.

### Non-goals

- Creating another financial aggregation/calculator path.
- Silently rewriting approved snapshots or ambiguous historical conversions.
- Using current or future rates as historical evidence.
- Broad UI redesign or non-neutral Spanish copy changes.
- Changing accounting basis without an explicit business decision.
- Event-sourcing the entire application unless arbitrary cutoff reporting is confirmed.

## Product/business questions before proposal

1. Must users query any past instant in an open year, or is support limited to current live state plus approved period snapshots? Should unsupported cutoffs return an explicit unavailable state?
2. Is functional currency and exchange-rate governance global or tenant-specific? For foreign bank balances, should translation use the latest rate effective at or before cutoff, a closing rate entered by an accountant, or another policy?
3. What should happen to existing approved v2 snapshots that are internally valid but lack new provenance/coverage: remain viewable with a legacy warning, become unavailable, or require audited reopen/re-close to produce v3?
4. After a service sale is reconciled or included in an approved period, is cancellation forbidden, or must the system create a dated reversal/credit event? Who may perform it and is a reason required?
5. Are PDF export, previous-period comparison, split loading, and coverage telemetry still release acceptance criteria, or should they be proposed as follow-up enhancements after correctness remediation?
6. Should closure balance `cutoffAt` equal the exact period end, or the later capture/approval instant currently used by annual closing? This determines whether closure can read current auxiliary state.

## Verification strategy notes

Strict TDD should begin with behavior-level failures in pure domain and service integration tests. Add tenant A/tenant B negative fixtures, exact boundary events at `lt`, future-rate rejection, ambiguous-backfill cases, mutation-after-reconciliation cases, and snapshot immutability/version tests. Real Playwright/backend E2E should seed isolated tenant data and avoid intercepting the financial API under test. Coverage percentages are insufficient unless thresholds fail CI and the new migration/writer/error branches are included.
