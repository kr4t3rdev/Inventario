# Tasks: Remediate reconciled balance audit blockers

OpenSpec is authoritative. This plan is strict-TDD, tenant-safe, snapshot-first, and intentionally split into reviewable work units. The delivery decision is recorded below; apply remains phase-gated.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Approximately 13,860 total: 5,780 handwritten production, 6,470 tests, 880 schema/generated, and 730 documentation/configuration |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | WU-01 → WU-02 … → WU-40, with each work unit independently reviewed and tests kept with production changes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Requirement identifiers

| Prefix | Specification |
|---|---|
| FRA | `specs/financial-report-availability/spec.md` |
| FX | `specs/accounting-fx-evidence/spec.md` |
| CFC | `specs/canonical-financial-contracts/spec.md` |
| ATS | `specs/accounting-tenant-safety-and-reversals/spec.md` |
| FRE | `specs/financial-report-experience/spec.md` |
| AAR | `specs/accounting-audit-rollout/spec.md` |

Requirement numbers follow their order in each specification. Scenario names below are exact specification headings.

## Implementation work units

### Foundation and fail-closed contracts

- [ ] **WU-01 — Reconcile the shared FX contract and make the verification harness enforceable.** <!-- sdd-owner: implementation -->
  - Files: `openspec/changes/accounting-exchange-rates-improvement/{design.md,tasks.md,specs/contabilidad/exchange/spec.md}`, `src/features/contabilidad/services/{exchange-types.ts,exchange-rate-provider.ts}`, `src/features/contabilidad/services/__tests__/exchange-rate-provider.test.ts`, `package.json`, `vitest.config.mjs`, `tsconfig.json`, `tsconfig.test.json`, `.github/workflows/accounting-audit.yml` (planned), and `docs/inventario/accounting-audit/tdd-evidence.md` (planned).
  - Satisfies: AAR R4 “Strict TDD and coverage release gate” (both scenarios) and AAR R5 “Reproducible static and focused test gate” (both scenarios); records that the active exchange-rate change owns catalog/provider mechanics while this change owns as-of eligibility and applied evidence.
  - Prerequisites/unlocks: delivery decision parent gate; unlocks WU-02 through WU-40. Do not modify the provider until the overlap contract test proves compatibility.
  - RED: add a contract test that fails because `getRateAsOf` and per-dimension thresholds are absent; run `pnpm run test:run -- src/features/contabilidad/services/__tests__/exchange-rate-provider.test.ts` and retain the intended assertion failure.
  - GREEN: add only harness/configuration and contract declarations needed to collect the focused suite and enforce 80% new-code/90% pure-calculator dimensions; rerun the focused command and `pnpm exec vitest run --coverage` with passing collection evidence.
  - TRIANGULATE: prove a deliberately under-covered fixture fails each threshold independently and a nonexistent focused path fails the gate; remove the fixture afterward.
  - REFACTOR: centralize audit test globs and TDD evidence format, then run `pnpm exec eslint package.json vitest.config.mjs` where supported and `pnpm run typecheck` without narrowing scope.
  - Finish/rollback: finish with no provider behavior change and reproducible commands; rollback removes only the new audit harness/workflow. Estimate: production 80, tests 180, schema/generated 0, documentation/configuration 40 changed lines.

- [ ] **WU-02 — Add canonical range, decimal, typed-error, coverage, and report contracts.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/domain/{accounting-range.ts,accounting-amount.ts,financial-errors.ts,report-coverage.ts,financial-report-contract.ts}` (new except `accounting-amount.ts`) and colocated `*.test.ts` files.
  - Satisfies: CFC R2 scenarios “Exact lower and upper boundaries” and “Adjacent periods”; CFC R4 all scenarios; FX R3 all scenarios; AAR R2 unique-proof decimal rule.
  - Prerequisites/unlocks: WU-01; unlocks WU-03, WU-05, WU-10, WU-12, WU-15, and WU-23.
  - RED: add failing tests for `[gte, lt)`, invalid ranges, 2-place `ROUND_HALF_UP` money, exact 12-place rates, no synthetic/future evidence, disposition reconciliation, estimated-versus-unresolved, and typed codes; run `pnpm run test:run -- src/features/contabilidad/domain/accounting-range.test.ts src/features/contabilidad/domain/accounting-amount.test.ts src/features/contabilidad/domain/report-coverage.test.ts src/features/contabilidad/domain/financial-report-contract.test.ts`.
  - GREEN: implement immutable Decimal-based values and discriminated contracts without I/O; rerun the same command expecting all cases green.
  - TRIANGULATE: add property/boundary cases for adjacent periods, exact boundary rates, unknown native currencies, and unreconciled coverage, then require 90% in all four dimensions.
  - REFACTOR: remove duplicate primitives and `number` math from touched domain files; run focused coverage, `pnpm exec eslint` on the listed files, and `pnpm run typecheck`.
  - Finish/rollback: finish with pure APIs and no consumer wiring; rollback removes the new modules and restores the prior `accounting-amount.ts`. Estimate: production 180, tests 180, schema/generated 0, documentation/configuration 20.

- [ ] **WU-03 — Resolve live, v2, v3, and unsupported history before mutable reads.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{financial-availability-resolver.ts,financial-availability-resolver.test.ts}` (new), `historical-financial-report-service.{ts,test.ts}`, and `balance-results-report-service.{ts,test.ts}`.
  - Satisfies: FRA R1 all scenarios; ATS R1 “Tenant-owned read”; ATS R2 “Guessed identifier”; AAR R3 “Strict-reader rollback”.
  - Prerequisites/unlocks: WU-02; unlocks WU-15, WU-25, WU-30, WU-32, WU-34, and WU-35.
  - RED: write spies proving unsupported cutoffs fail before bank/inventory/CxC/CxP callbacks, approved snapshots are stored-payload-only, cross-tenant IDs are non-disclosing, and current live uses server evaluation time; run `pnpm run test:run -- src/features/contabilidad/services/financial-availability-resolver.test.ts src/features/contabilidad/services/historical-financial-report-service.test.ts src/features/contabilidad/services/balance-results-report-service.test.ts`.
  - GREEN: implement explicit request modes and typed resolution with tenant predicates; make no mutable auxiliary call for unsupported history.
  - TRIANGULATE: cover exact snapshot cutoff matching, supplied current-year cutoff, corrupt/missing snapshot, v2/v3, and rollback with strict readers disabled.
  - REFACTOR: reduce legacy year/cutoff adapters to thin mappings and run focused tests, ESLint, and full typecheck.
  - Finish/rollback: fail-closed history remains enabled even if later slices roll back; rollback may restore only compatible request adapters. Estimate: production 170, tests 180, schema/generated 0, documentation/configuration 15.

### Tenant policy and immutable FX evidence

- [x] **WU-04 — Add nullable tenant accounting policy and guarded service access.** <!-- sdd-owner: implementation -->
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260824090000_add_tenant_accounting_policy/migration.sql` (planned), `src/features/contabilidad/services/{tenant-accounting-policy-service.ts,tenant-accounting-policy-service.test.ts}` (new), and `docs/inventario/accounting-audit/tenant-policy-rollout.md` (planned).
  - Satisfies: FX R1 both scenarios; ATS R1 “Catalog application ownership”; AAR R1 “Nullable foundation deployment”.
  - Prerequisites/unlocks: WU-01 and WU-02; nullable migration deployment hold; unlocks WU-07 through WU-10 and WU-14.
  - RED: add service/schema tests for different tenant currencies, absent independently proven policy, cross-tenant denial, global default non-inference, and blocked policy mutation after evidence/snapshot use; run `pnpm run test:run -- src/features/contabilidad/services/tenant-accounting-policy-service.test.ts`.
  - GREEN: add the nullable `TenantAccountingPolicy` relation and explicit tenant-scoped service; do not seed from `Moneda.esPrincipal` without independent proof.
  - TRIANGULATE: test same currency across two tenants, missing policy, concurrent create, and attempted post-evidence change.
  - REFACTOR: consolidate ownership checks and run focused tests, `pnpm exec prisma validate`, Prisma migration review, ESLint, and typecheck.
  - Finish/rollback: schema remains additive and unresolved tenants stay blocked; application rollback leaves nullable policy rows intact. Estimate: production 140, tests 120, schema/generated 120, documentation/configuration 15.

- [ ] **WU-05 — Extend the existing provider with deterministic as-of selection.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{exchange-types.ts,exchange-rate-provider.ts}`, `src/features/contabilidad/services/__tests__/exchange-rate-provider.test.ts`, and `src/lib/services/currency-conversion-service.ts` only if its kernel contract requires adaptation.
  - Satisfies: FX R3 “Future rate rejected at boundary” and “Rate effective exactly at boundary”; FX R4 “Eligible as-of translation” and “Catalog changes during report generation”; preserves the active exchange-rate change’s deterministic conversion and history requirements.
  - Prerequisites/unlocks: WU-01 overlap contract and WU-02 decimals; unlocks WU-07 through WU-11 and WU-14.
  - RED: add failing provider tests for `fechaVigencia <= boundaryAt`, deterministic `fechaVigencia DESC, createdAt DESC, tasaId DESC`, direct/path legs, fingerprint, exact boundary, future rejection, and transactional value/provenance consistency; run the provider test file.
  - GREEN: add `getRateAsOf` to the existing provider; do not create a second provider or change latest-rate UI behavior.
  - TRIANGULATE: cover duplicate effective times, path leg ordering, governed inverse behavior only when provider-supported, and a catalog race fixture.
  - REFACTOR: share ordering/fingerprint helpers with the existing latest selector and run focused tests, ESLint, and typecheck.
  - Finish/rollback: existing exchange callers remain compatible; rollback removes only the as-of method after dependent readers are disabled. Estimate: production 140, tests 170, schema/generated 0, documentation/configuration 15.

- [ ] **WU-06 — Add nullable reconciliation FX fields, indexes, and immutability triggers.** <!-- sdd-owner: implementation -->
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260824100000_add_reconciliation_fx_evidence/migration.sql` (planned), `src/features/contabilidad/services/__tests__/reconciliation-fx-schema.test.ts` (planned), and `docs/inventario/accounting-audit/fx-schema-rollback.md` (planned).
  - Satisfies: FX R2 both scenarios; AAR R1 “Nullable foundation deployment”; AAR R3 “Writer rollback”.
  - Prerequisites/unlocks: WU-02; nullable migration deployment hold; unlocks WU-07 through WU-11. No reader becomes strict here.
  - RED: add migration integration tests proving legacy null rows remain readable, complete evidence becomes immutable at version 1, catalog references do not cascade, and tenant/time and provenance indexes exist; run `pnpm run test:run -- src/features/contabilidad/services/__tests__/reconciliation-fx-schema.test.ts`.
  - GREEN: add nullable fields to `ReconciliacionVenta`, `ReconciliacionServicio`, and `ReconciliacionGasto`, plus reviewed PostgreSQL triggers/indexes; avoid economic deduplication.
  - TRIANGULATE: exercise same-currency evidence, nullable legacy rows, update/delete attempts, and transaction rollback.
  - REFACTOR: minimize trigger duplication without weakening table-specific enforcement; run focused tests, `pnpm exec prisma validate`, migration SQL review, and typecheck.
  - Finish/rollback: down operations never delete evidence; rollback disables writers/readers while columns and triggers remain. Estimate: production 50, tests 90, schema/generated 220, documentation/configuration 20.

- [ ] **WU-07 — Activate complete FX evidence for sales reconciliation only.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reconciliation-service.ts`, `src/app/api/contabilidad/reconciliacion/ventas/route.ts`, `src/app/api/contabilidad/reconciliacion/ventas/__tests__/route.test.ts` (planned if absent), and corresponding mobile route `src/app/api/mobile/v1/accounting/reconciliation/sales/route.ts` with its existing test.
  - Satisfies: FX R1 “Global catalog used in tenant context”; FX R2 both scenarios; FX R3 “Missing timestamp is not inferred”; AAR R1 “Incomplete writer blocks strict reader”.
  - Prerequisites/unlocks: WU-04 through WU-06; unlocks sales source eligibility for WU-10 and WU-12.
  - RED: add failures for complete foreign evidence, same-currency rate 1, missing effective time rejection/unresolved result, tenant-B source/account denial, transaction rollback, and 100% completeness metric; run the two focused route/service test paths.
  - GREEN: update only the sales writer to copy immutable provider evidence in the tenant transaction.
  - TRIANGULATE: test exact-boundary rate, future-only rate, catalog mutation after commit, duplicate request, and writer failure rollback.
  - REFACTOR: extract shared evidence builder without activating service/expense callers; run focused tests, ESLint, and typecheck.
  - Finish/rollback: source allowlist keeps strict sales reader off until approved; disabling the writer preserves completed evidence. Estimate: production 140, tests 150, schema/generated 0, documentation/configuration 15.

- [ ] **WU-08 — Activate complete FX evidence for service reconciliation only.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reconciliation-service.ts`, `src/app/api/contabilidad/reconciliacion/servicios/route.ts`, `src/app/api/mobile/v1/accounting/reconciliation/services/route.ts`, and their focused `__tests__/route.test.ts` files.
  - Satisfies: FX R2 both scenarios; FX R3 “Missing timestamp is not inferred”; AAR R1 both scenarios; ATS R1 “Catalog application ownership”.
  - Prerequisites/unlocks: WU-07 shared builder; unlocks service source eligibility for WU-10, WU-12, and reversal work.
  - RED: add failing service-writer cases for tenant/account ownership, complete/same-currency evidence, missing/future evidence, transactional bank failure, and completeness telemetry; run the web/mobile service reconciliation tests.
  - GREEN: activate the shared builder only for service reconciliation and persist evidence atomically with the bank effect.
  - TRIANGULATE: cover retries, partial write rollback, catalog changes after commit, and tenant-negative guessed IDs.
  - REFACTOR: keep web/mobile handlers as thin adapters and run focused tests, ESLint, and typecheck.
  - Finish/rollback: disabling this source writer preserves committed evidence and does not affect sales. Estimate: production 140, tests 150, schema/generated 0, documentation/configuration 15.

- [ ] **WU-09 — Activate complete FX evidence for expense reconciliation only.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reconciliation-service.ts`, `src/app/api/contabilidad/reconciliacion/gastos/route.ts`, `src/app/api/mobile/v1/accounting/reconciliation/expenses/route.ts`, and their existing focused tests.
  - Satisfies: FX R2 both scenarios; FX R3 all scenarios; AAR R1 both scenarios.
  - Prerequisites/unlocks: WU-07 shared builder; unlocks all-source WU-10 dry-run and strict-reader gate.
  - RED: add failing expense-writer cases for complete/same-currency evidence, exact/future boundary, unresolved legacy input, tenant-negative ownership, and transaction rollback; run the web/mobile expense reconciliation tests.
  - GREEN: activate evidence persistence only for expenses and emit source completeness telemetry.
  - TRIANGULATE: cover duplicate attempts, catalog race, missing policy, and partial persistence failure.
  - REFACTOR: remove source-specific conversion duplication and run focused tests, ESLint, and typecheck.
  - Finish/rollback: the expense switch can be disabled independently without deleting evidence. Estimate: production 140, tests 150, schema/generated 0, documentation/configuration 15.

- [ ] **WU-10 — Build the read-only conservative FX dry-run classifier.** <!-- sdd-owner: implementation -->
  - Files: `scripts/accounting/fx-evidence-backfill.ts` (planned), `scripts/accounting/fx-evidence-backfill.test.ts` (planned), and `docs/inventario/accounting-audit/fx-backfill-runbook.md` (planned).
  - Satisfies: AAR R2 “Dry-run counts reconcile”, “Unique match is backfilled” proof classification, and “Ambiguous or missing match”; FX R3 “Missing timestamp is not inferred”.
  - Prerequisites/unlocks: WU-04 through WU-09; unlocks WU-11 and the strict-reader decision gate.
  - RED: add fixtures for unique/zero/multiple candidates, same-currency exactness, rate/value mismatch, future candidate, missing tenant policy, and redacted counts; run `pnpm run test:run -- scripts/accounting/fx-evidence-backfill.test.ts`.
  - GREEN: implement `--dry-run` only with explicit tenant predicates and `scanned = unique + ambiguous + missing`; never log raw values/IDs.
  - TRIANGULATE: cover duplicate equal-rate candidates as ambiguous, 2/12-place rounding boundaries, already-complete rows, and multi-tenant aggregation.
  - REFACTOR: separate pure classifier from Prisma scan/report adapters; rerun focused tests, ESLint, and typecheck.
  - Finish/rollback: finish with no update code reachable in dry-run mode; rollback removes the script and leaves data untouched. Estimate: production 180, tests 170, schema/generated 0, documentation/configuration 25.

- [ ] **WU-11 — Add separately gated idempotent backfill execution without running it.** <!-- sdd-owner: implementation -->
  - Files: `scripts/accounting/fx-evidence-backfill.ts`, `scripts/accounting/fx-evidence-backfill.test.ts`, and `docs/inventario/accounting-audit/fx-backfill-runbook.md`.
  - Satisfies: AAR R2 “Unique match is backfilled”, “Ambiguous or missing match”, and “Repeated or concurrent execution”; AAR R3 all rollback scenarios.
  - Prerequisites/unlocks: WU-10 and separate parent approval after reviewed dry-run evidence; unlocks strict-reader activation eligibility. This task adds execution code but MUST NOT execute it against an environment.
  - RED: add failing compare-and-set, retry, concurrent worker, stale-fingerprint, rollback, unchanged economic fields, and updated/already-complete counters; run the backfill test file.
  - GREEN: add an explicit `--execute --approval-token` path that re-evaluates the fingerprint transactionally and updates only still-null uniquely provable rows.
  - TRIANGULATE: race two workers, mutate a candidate between scan/update, retry after partial failure, and prove ambiguous/missing rows remain byte-equivalent.
  - REFACTOR: share classifier/report code with dry-run while preserving a hard read-only default; run focused tests, ESLint, and typecheck.
  - Finish/rollback: execution remains dormant until the migration execution hold; rollback is application-level only and never nulls populated evidence. Estimate: production 130, tests 150, schema/generated 0, documentation/configuration 25.

### Canonical calculations and consumers

- [ ] **WU-12 — Make strict normalization, result coverage, and reversal policy canonical.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/domain/{reconciliation-policy.ts,reconciliation-policy.test.ts,reconciled-result-calculator.ts,reconciled-result-calculator.test.ts,report-coverage.ts}`, `src/features/contabilidad/services/{reconciled-result-service.ts,reconciled-result-service.test.ts}`.
  - Satisfies: CFC R1 all scenarios; CFC R4 all scenarios; FX R2 “Incomplete evidence”; FX R3 “Missing timestamp is not inferred”; ATS R5 “Valid reversal”.
  - Prerequisites/unlocks: WU-02 and WU-07 through WU-11; strict-reader parent gate for each source; unlocks WU-13, WU-15, WU-25, and WU-28.
  - RED: add failures for synthetic dates, legacy unresolved rows, candidate/stage/disposition counts, estimates versus omissions, equal-opposite `SERVICE_SALE_REVERSAL`, tenant predicates, and invariant publication failure; run the domain and service test files.
  - GREEN: consume persisted evidence only, expose canonical result/coverage, and remove CUP/default timestamp normalization.
  - TRIANGULATE: include partial source allowlists, exact boundaries, mixed currencies, excluded candidates, and reversal lines.
  - REFACTOR: delete duplicate sign/classification paths in touched services and run focused coverage at 90%, ESLint, and typecheck.
  - Finish/rollback: source allowlists can revert strict activation but cannot restore synthetic provenance. Estimate: production 170, tests 190, schema/generated 0, documentation/configuration 20.

- [ ] **WU-13 — Expose gross cash paths and adapt closing without COGS/OPEX cash inference.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/domain/{reconciled-result-calculator.ts,reconciled-result-calculator.test.ts,financial-report-contract.ts}`, `src/lib/services/{cierreContableService.ts,__tests__/cierre-contable-service.test.ts}`, and `src/features/contabilidad/actions-cierres.ts`.
  - Satisfies: CFC R3 both scenarios; CFC R1 “Same evidence across consumers”; CFC R2 both boundary scenarios.
  - Prerequisites/unlocks: WU-12; unlocks WU-15 and closing publication migration.
  - RED: add accrual-without-cash, operating/financial gross inflow/outflow/net, boundary, transaction failure, and closing parity tests; run the calculator and closing test files.
  - GREEN: produce non-negative gross movements and a canonical closing projection; remove COGS+OPEX gross-egress inference.
  - TRIANGULATE: cover mixed cash/accrual events, reversal cash effects, zero activity, and rollback of a failed close.
  - REFACTOR: eliminate extra closing aggregates and run 90% calculator coverage, focused tests, ESLint, and typecheck.
  - Finish/rollback: stop closing publication if canonical projection fails; never restore the known cash mislabel. Estimate: production 170, tests 180, schema/generated 0, documentation/configuration 20.

- [ ] **WU-14 — Translate foreign bank balances as of cutoff or report them unresolved.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/current-balance-service.{ts,test.ts}`, `src/features/contabilidad/domain/balance-calculator.{ts,test.ts}`, and `src/features/contabilidad/domain/report-coverage.ts`.
  - Satisfies: FX R4 all scenarios; FX R3 boundary scenarios; CFC R4 “Estimated and unresolved candidates coexist”; ATS R1 both scenarios.
  - Prerequisites/unlocks: WU-02, WU-04, and WU-05; unlocks WU-15 and WU-24.
  - RED: add tenant A/B banks, same-currency, exact/future as-of, one translated plus one unresolved balance, native-only coverage, and catalog race tests; run current-balance and balance-calculator tests.
  - GREEN: select and copy evidence transactionally, include translated assets, and retain missing evidence as unresolved instead of zero/omission.
  - TRIANGULATE: cover direct/path evidence, negative bank balance policy, no tenant policy, and mutation during selection.
  - REFACTOR: keep conversion in the canonical adapter and run focused coverage, ESLint, and typecheck.
  - Finish/rollback: kill switch may disable foreign translation but must display unresolved coverage. Estimate: production 170, tests 190, schema/generated 0, documentation/configuration 20.

- [ ] **WU-15 — Assemble the one canonical full report service and tenant-safe projections.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{canonical-financial-report-service.ts,canonical-financial-report-service.test.ts,balance-results-report-service.ts,balance-results-report-service.test.ts}` and `src/features/contabilidad/domain/financial-report-contract.ts`.
  - Satisfies: CFC R1 all scenarios; CFC R2 both scenarios; CFC R4 all scenarios; ATS R1 and R2 all scenarios.
  - Prerequisites/unlocks: WU-03 and WU-12 through WU-14; unlocks WU-16 through WU-25 and WU-30 through WU-35.
  - RED: add shared-evidence parity, tenant-negative, range, full/partial coverage, typed failure, and rollback tests; run the new service and balance-results tests.
  - GREEN: assemble result, balance, gross cash, provenance, and coverage once; consumers receive typed projections only.
  - TRIANGULATE: cover current live, unresolved source, no policy, invariant failure, and cross-tenant guessed source IDs.
  - REFACTOR: prohibit consumer calculators through contract fixtures/static search assertions and run focused tests, ESLint, and typecheck.
  - Finish/rollback: canonical consumer flag may halt downstream publication while fail-closed availability remains. Estimate: production 180, tests 180, schema/generated 0, documentation/configuration 15.

- [ ] **WU-16 — Adapt the summary endpoint family to canonical outputs.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, its two existing tests, `src/app/api/contabilidad/reportes/resumen/route.ts` and tests, `src/app/api/mobile/v1/accounting/reports/summary/route.ts` and tests, and `src/features/contabilidad/actions-resumen-financiero.ts` plus tests.
  - Satisfies: CFC R1 “Same evidence across consumers” and “Duplicate formula path is detected”; CFC R2 both scenarios; ATS R1 “Tenant-owned read”.
  - Prerequisites/unlocks: WU-15; unlocks WU-17 and summary-family canonical activation.
  - RED: add report/service/action parity, tenant-negative, boundary, partial coverage, v2 compatibility, and rollback tests; run the named summary test files.
  - GREEN: replace summary formulas with canonical projections while preserving compatible DTO fields.
  - TRIANGULATE: compare web/mobile/action outputs for one fixture and prove no raw aggregate can publish a total.
  - REFACTOR: delete only summary-owned duplicate helpers; run focused tests, ESLint, and typecheck.
  - Finish/rollback: disable only summary canonical activation; immutable legacy payload reads remain. Estimate: production 120, tests 160, schema/generated 0, documentation/configuration 10.

- [ ] **WU-17 — Adapt the movements endpoint family to canonical evidence projections.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/contabilidad/reportes/movimientos/route.ts` and tests, `src/app/api/mobile/v1/accounting/reports/movements/route.ts` and tests, and `src/features/contabilidad/actions.ts` plus tests.
  - Satisfies: CFC R1 first two scenarios; CFC R2 both scenarios; ATS R1 and R2 tenant/non-disclosing scenarios.
  - Prerequisites/unlocks: WU-16 pattern; unlocks WU-18.
  - RED: add canonical subtotal, `[gte, lt)`, pagination without recomputation, tenant-negative detail, typed error, and web/mobile/action parity tests; run focused movements suites.
  - GREEN: retain detail/sort/pagination shaping but source every subtotal/sign/conversion from canonical evidence.
  - TRIANGULATE: cover boundary duplicates, unresolved movement, guessed source, and old compatible DTO.
  - REFACTOR: remove movements-only CASE/reduce formulas; run focused tests, ESLint, and typecheck.
  - Finish/rollback: endpoint-family flag isolates rollback without reviving formulas for other families. Estimate: production 130, tests 170, schema/generated 0, documentation/configuration 10.

- [ ] **WU-18 — Adapt the exchange report endpoint family to canonical evidence.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/contabilidad/reportes/exchange/route.ts` and tests, and `src/app/api/mobile/v1/accounting/reports/exchange/route.ts` and tests.
  - Satisfies: CFC R1 first two scenarios; FX R1 “Global catalog used in tenant context”; FX R2 “Complete new conversion”; ATS R1 all scenarios.
  - Prerequisites/unlocks: WU-15 and WU-17; unlocks WU-19.
  - RED: add provenance parity, immutable applied-value, tenant-negative, missing-evidence, boundary, and web/mobile parity tests; run focused exchange report suites.
  - GREEN: project persisted canonical evidence; do not reselect a current rate for completed conversions.
  - TRIANGULATE: cover direct/path/same-currency/legacy unresolved and catalog changes.
  - REFACTOR: remove exchange-family conversion helpers and run focused tests, ESLint, and typecheck.
  - Finish/rollback: keep prior compatible shape only over stored evidence; never return to latest-rate recalculation. Estimate: production 120, tests 160, schema/generated 0, documentation/configuration 10.

- [ ] **WU-19 — Adapt the exchange-impact endpoint family to canonical outputs.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/contabilidad/reportes/exchange-impact/route.ts` and tests, `src/app/api/mobile/v1/accounting/reports/exchange-impact/route.ts` and tests, and `src/features/contabilidad/api/handlers.ts`.
  - Satisfies: CFC R1 first two scenarios; CFC R4 all scenarios; ATS R1 “Tenant-owned read”.
  - Prerequisites/unlocks: WU-18; unlocks WU-20.
  - RED: add canonical impact/coverage, tenant-negative, boundary, unresolved native amount, and handler/web/mobile parity tests; run focused impact suites.
  - GREEN: derive presentation from canonical evidence fields without service-owned conversion or totals.
  - TRIANGULATE: cover estimated and unresolved coexistence, no FX evidence, and v2 compatibility.
  - REFACTOR: delete impact-only formulas and run focused tests, ESLint, and typecheck.
  - Finish/rollback: isolate via endpoint-family activation; legacy rows remain explicit unresolved. Estimate: production 120, tests 160, schema/generated 0, documentation/configuration 10.

- [ ] **WU-20 — Adapt the transfers endpoint family to canonical outputs.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/contabilidad/reportes/transferencias/route.ts` and tests, and `src/app/api/mobile/v1/accounting/reports/transfers/route.ts` and tests.
  - Satisfies: CFC R1 first two scenarios; CFC R2 both scenarios; ATS R1/R2 tenant-negative behavior.
  - Prerequisites/unlocks: WU-19; unlocks WU-21.
  - RED: add transfer subtotal parity, adjacent-period boundary, dual-account tenant ownership, guessed ID, and web/mobile tests; run focused transfer suites.
  - GREEN: project canonical transfer effects while preserving endpoint-specific details.
  - TRIANGULATE: cover cross-currency transfer evidence, one-sided ownership mismatch, and partial coverage.
  - REFACTOR: remove transfer-family totals and run focused tests, ESLint, and typecheck.
  - Finish/rollback: family rollback cannot re-enable noncanonical totals. Estimate: production 120, tests 160, schema/generated 0, documentation/configuration 10.

- [ ] **WU-21 — Adapt overdue and client-account endpoint families without shared formula drift.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/mobile/v1/accounting/reports/{overdue-invoices,client-account-analysis}/route.ts` and tests, and `src/app/api/sugerencias/ingresos-por-edades/route.ts` plus tests.
  - Satisfies: CFC R1 first two scenarios; CFC R2 both scenarios; ATS R1/R2 all scenarios applicable to source details.
  - Prerequisites/unlocks: WU-20; unlocks WU-22 and consumer-retirement gate.
  - RED: add separate canonical subtotal, tenant-negative guessed customer/invoice, boundary, unresolved, suggestion adapter, and rollback tests; run the three route suites and accounting report service tests.
  - GREEN: adapt one receivables projection interface while keeping endpoint-specific pagination/details.
  - TRIANGULATE: cover overdue-at-boundary, customer with mixed evidence, and inaccessible identifiers.
  - REFACTOR: remove receivables calculators only after static conformance proves callers migrated; run focused tests, ESLint, and typecheck.
  - Finish/rollback: disable receivables projection publication as one family; do not restore formulas. Estimate: production 150, tests 180, schema/generated 0, documentation/configuration 10.

- [ ] **WU-22 — Adapt customer, provider, and summary advances endpoint families.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/accounting-reports-service.ts`, `src/app/api/contabilidad/anticipos/reportes/{cliente,proveedor,resumen}/route.ts` and tests, and matching `src/app/api/mobile/v1/accounting/advances/reports/{customers,providers,summary}/route.ts` tests.
  - Satisfies: CFC R1 first two scenarios; CFC R2 both scenarios; ATS R1/R2 tenant and non-disclosure scenarios.
  - Prerequisites/unlocks: WU-21; unlocks the canonical-consumer retirement proof in WU-40.
  - RED: add per-family parity, tenant-negative, boundary, unresolved coverage, web/mobile compatibility, and rollback tests; run all six focused route suites plus accounting report service tests.
  - GREEN: adapt each advances method sequentially to one canonical evidence projection, never in a schema/domain/UI batch.
  - TRIANGULATE: cover customer/provider mixed evidence, summary reconciliation, and guessed identifiers.
  - REFACTOR: delete only proven-unused advances formulas and run focused tests, ESLint, typecheck, and a caller search.
  - Finish/rollback: each route adapter is independently reversible while canonical values remain authoritative. Estimate: production 150, tests 180, schema/generated 0, documentation/configuration 10.

### V3 snapshots and immutable checkpoints

- [x] **WU-23 — Add nullable v3 snapshot schema, chronology, hashing, and approved immutability.** <!-- sdd-owner: implementation -->
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260824110000_add_financial_snapshot_v3/migration.sql` (planned), `src/features/contabilidad/services/{financial-snapshot-v3-service.ts,financial-snapshot-v3-service.test.ts}` (planned), and `docs/inventario/accounting-audit/snapshot-v3-rollback.md`.
  - Satisfies: FRA R2 both scenarios; FRA R4 “Attempt to mutate approved snapshot” and “Rollback after v3 failure”; AAR R1 nullable foundation; AAR R3 rollback.
  - Prerequisites/unlocks: WU-02 and nullable migration hold; unlocks WU-24 and WU-25.
  - RED: add chronology, final canonical JSON/hash, capture-versus-approval, approved update/delete, retry, v2 byte-hash, and rollback tests; run the snapshot v3 test file.
  - GREEN: add nullable v3 metadata/status and immutable approved trigger; keep row sequence `version` separate from `schemaVersion`.
  - TRIANGULATE: auto-approval transaction, corrupt hash, approval race, invalid chronology, and v2 untouched fixture.
  - REFACTOR: isolate canonical serializer/hash logic and run focused tests, Prisma validation/migration review, ESLint, and typecheck.
  - Finish/rollback: stop new approvals on failure; never down-migrate approved evidence. Estimate: production 60, tests 100, schema/generated 210, documentation/configuration 20.

- [ ] **WU-24 — Capture immutable tenant auxiliary checkpoints under the shared accounting lock.** <!-- sdd-owner: implementation -->
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260824120000_add_financial_auxiliary_checkpoint/migration.sql` (planned), `src/features/contabilidad/services/{financial-auxiliary-checkpoint-service.ts,financial-auxiliary-checkpoint-service.test.ts}` (planned), and `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts`.
  - Satisfies: FRA R3 both scenarios; FRA R2 “Capture then approval”; FX R4 “Catalog changes during report generation”; ATS R1 tenant ownership.
  - Prerequisites/unlocks: WU-14, WU-15, and WU-23; unlocks WU-25 and v3 activation gate.
  - RED: add shared advisory-lock race, post-cutoff mutation exclusion, missed boundary, tenant-negative, transaction rollback, native/FX evidence fingerprint, and immutable hash tests; run the checkpoint test file.
  - GREEN: capture current-boundary checkpoint in a serializable transaction using transaction time; never backdate a missed boundary.
  - TRIANGULATE: race each known accounting mutation adapter, catalog update, capture retry, and one unresolved foreign bank.
  - REFACTOR: centralize tenant accounting lock acquisition and run focused tests, Prisma validation, ESLint, and typecheck.
  - Finish/rollback: disable checkpoint writer and stop v3 capture; preserve committed checkpoints. Estimate: production 180, tests 190, schema/generated 0, documentation/configuration 20.

- [x] **WU-25 — Activate v3 capture/approval and freeze legacy snapshot formulas.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/financial-snapshot-v3-service.{ts,test.ts}`, `src/features/contabilidad/actions-periodos.ts`, `src/features/contabilidad/__tests__/actions-periodos.test.ts`, `src/lib/services/{periodo-snapshot-service.ts,periodo-contable-service.ts}`, and focused period tests.
  - Satisfies: FRA R3 all scenarios; FRA R4 all scenarios; CFC R1 “Legacy compatibility read” and “Same evidence across consumers”; CFC R4 “Coverage totals do not reconcile”.
  - Prerequisites/unlocks: WU-15 and WU-23/WU-24 plus v3 activation parent gate; unlocks WU-30 through WU-37.
  - RED: add v3-only new write, cutoff checkpoint, coverage invariant, capture/approve chronology, v2 byte-for-byte read/warning, approved immutability, close rollback, and no `SnapshotService` calculator-call tests; run focused period/snapshot suites.
  - GREEN: wire capture and one-time approval to canonical payloads; freeze `periodo-snapshot-service.ts` as legacy read-only compatibility.
  - TRIANGULATE: missed checkpoint, concurrent approvals, hash mismatch, v2 consumer, and app rollback.
  - REFACTOR: deprecate/remove new-write formula entry points and run focused tests, caller search, ESLint, and typecheck.
  - Finish/rollback: v3 switch stops new capture/approval while existing v2/v3 remain viewable; legacy formulas never resume for new writes. Estimate: production 180, tests 180, schema/generated 0, documentation/configuration 25.

### Reconciled service-sale immutability and reversal

- [ ] **WU-26 — Add named tenant operation permission and mutation/delete guards.** <!-- sdd-owner: implementation -->
  - Files: `src/lib/permissions.ts`, `src/lib/permissions.test.ts` (planned), `src/features/contabilidad/services/{accounting-operation-permission-service.ts,accounting-operation-permission-service.test.ts}` (planned), and `src/features/venta-servicios/{actions.ts,__tests__/actions.test.ts}`.
  - Satisfies: ATS R3 both scenarios; ATS R4 all scenarios; ATS R2 both scenarios.
  - Prerequisites/unlocks: WU-01; unlocks WU-27 through WU-29.
  - RED: add manager/economico grants, dependiente denial, platform-admin-without-membership denial, wildcard insufficiency, tenant-B/nonexistent equivalence, reconciled update/delete rejection, unreconciled legacy behavior, and persistence-bypass tests; run the permission and venta-servicios tests.
  - GREEN: add `accounting.reconciled-service-sale.reverse`, active-membership helper, and server/persistence guards.
  - TRIANGULATE: inactive membership, broad route access, guessed sale, concurrent reconciliation before mutation, and safe Spanish conflict mapping.
  - REFACTOR: separate route permissions from named operations and run focused tests, ESLint, and typecheck.
  - Finish/rollback: reconciled immutability guard remains even if reversal UI/service is disabled. Estimate: production 130, tests 150, schema/generated 0, documentation/configuration 15.

- [ ] **WU-27 — Add reversal, line, audit, idempotency, and race-safe schema.** <!-- sdd-owner: implementation -->
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260824130000_add_service_sale_reversal/migration.sql` (planned), `src/features/contabilidad/services/__tests__/service-sale-reversal-schema.test.ts` (planned), and `docs/inventario/accounting-audit/reversal-rollback.md`.
  - Satisfies: ATS R5 all scenarios at persistence boundary; ATS R3 “Mutation and hard delete rejected”; AAR R3 non-destructive rollback.
  - Prerequisites/unlocks: WU-26 and nullable migration hold; unlocks WU-28.
  - RED: add unique original/idempotency, immutable line/evidence/audit, tenant indexes, cascade restriction, concurrent insert, and transaction rollback tests; run the schema test file.
  - GREEN: add `VentaServicioReversal`, lines, and transactional immutable audit constraints without changing existing rows.
  - TRIANGULATE: same key/different hash, two keys/one original, cross-tenant FK attempts, and delete/update attempts.
  - REFACTOR: keep database constraints complementary to service checks; run focused tests, Prisma validation/migration review, ESLint, and typecheck.
  - Finish/rollback: schema remains additive and audit rows are never destructively rolled back. Estimate: production 60, tests 100, schema/generated 210, documentation/configuration 20.

- [ ] **WU-28 — Implement the serializable equal-and-opposite reversal service.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{reconciled-service-sale-reversal-service.ts,reconciled-service-sale-reversal-service.test.ts}` (planned), `accounting-operation-permission-service.ts`, `src/features/contabilidad/domain/{reconciliation-policy.ts,reconciled-result-calculator.ts}`, and `src/lib/services/periodo-contable-guard.ts`.
  - Satisfies: ATS R5 all five scenarios; ATS R1/R2 all scenarios; CFC R1 canonical source; AAR R3 rollback.
  - Prerequisites/unlocks: WU-12, WU-26, and WU-27; reversal activation gate; unlocks WU-29 and WU-37.
  - RED: add valid equal-opposite effect, same-key replay, changed-payload conflict, concurrent different-key race, closed/invalid period, tenant-B/nonexistent equivalence, bank failure rollback, approved snapshot unchanged, and transactional audit tests; run the reversal service test file.
  - GREEN: implement the ten-step serializable/advisory-lock transaction with explicit tenant predicates and typed results.
  - TRIANGULATE: multiple reconciliation lines/accounts, actor mismatch, retry after response loss, reversal race, and exact-boundary effective date.
  - REFACTOR: keep locking/idempotency helpers local to accounting mutations and run focused tests, ESLint, and typecheck.
  - Finish/rollback: kill switch blocks new reversals but preserves originals, reversal effects, and audit rows. Estimate: production 180, tests 190, schema/generated 0, documentation/configuration 20.

- [ ] **WU-29 — Add reversal action/API and neutral-Spanish UI feedback.** <!-- sdd-owner: implementation -->
  - Files: `src/features/venta-servicios/{schemas.ts,types.ts,actions.ts,__tests__/actions.test.ts}`, `src/features/venta-servicios/components/reversal-dialog.tsx` and `.test.tsx` (planned), and `src/app/api/contabilidad/reconciliacion/servicios/[id]/reversal/route.ts` with `route.test.ts` (planned).
  - Satisfies: ATS R3/R4/R5 all UI/transport scenarios; ATS R2 “Operational diagnostics”; FRE R5 “New localized copy review”.
  - Prerequisites/unlocks: WU-28 and reversal activation gate; unlocks E2E WU-37.
  - RED: add client/server validation, permission/tenant denial, idempotency conflict, immutable edit/delete toast, reversal success toast, closed-period error, keyboard/focus, and safe generic failure tests; run focused action/route/component tests.
  - GREEN: add thin transport over the reversal service and persistent inline state plus exact neutral-Spanish toasts from design.
  - TRIANGULATE: stale double submit, response retry, dependiente/admin denial, guessed ID, and server failure with no leaked details.
  - REFACTOR: share Zod schema and typed error mapping, then run focused tests, `pnpm exec eslint` on touched files, and typecheck.
  - Finish/rollback: hide/disable UI and route via switch while server immutability remains. Estimate: production 170, tests 170, schema/generated 0, documentation/configuration 15.

### Report experience, comparison, telemetry, and exports

- [ ] **WU-30 — Expose independent canonical balance/result section APIs.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/actions-balance-results.{ts,test.ts}`, planned `src/app/api/contabilidad/balance-resultados/{balance,result}/route.ts` and tests, and `src/features/contabilidad/components/balance-resultados/types.ts`.
  - Satisfies: FRE R1 all scenarios at transport/state-contract boundary; FRA R1 all modes; ATS R1/R2 tenant-safe failures.
  - Prerequisites/unlocks: WU-03, WU-15, and WU-25; unlocks WU-31.
  - RED: add independent success/failure, request IDs, evidence times, partial balance with unavailable result, out-of-order identifiers, stale eligibility, unsupported history, and tenant-negative tests; run action and new route tests.
  - GREEN: implement thin Node server routes/actions over shared resolution; exports/snapshots must not merge client sections.
  - TRIANGULATE: one section partial, one failed, mismatched range/mode, old response, and v2 warning.
  - REFACTOR: share validation/error projection and run focused tests, ESLint, and typecheck.
  - Finish/rollback: section routes can be disabled while full canonical report remains available. Estimate: production 160, tests 180, schema/generated 0, documentation/configuration 15.

- [ ] **WU-31 — Render independent loading/ready/stale/error and coherent coverage states.** <!-- sdd-owner: implementation -->
  - Files: `src/app/busy/contabilidad/balance-resultados/{page.tsx,page.test.tsx}`, `src/features/contabilidad/components/balance-resultados/{types.ts,report-states.tsx,balance-results-view.tsx,balance-results-header.tsx}` and colocated tests.
  - Satisfies: FRE R1 all scenarios; FRE R3 “Partial coverage is visible”; FRE R5 “Non-happy-path announcement” and localized copy.
  - Prerequisites/unlocks: WU-30; unlocks WU-32 through WU-35 and accessibility WU-38.
  - RED: add section-local loading, retained stale timestamp, independent error, partial badge, out-of-order response, `aria-busy`/live region/focus, exact Spanish copy, and stale refresh tests; run the page and component tests.
  - GREEN: implement request-ID guarded independent state without client financial math.
  - TRIANGULATE: overlap refreshes, one ready/one partial, v2 warning, unsupported history, generic error, and keyboard-only operation.
  - REFACTOR: extract state reducer/view primitives and run focused tests, jest-axe/vitest-axe where existing, ESLint, and typecheck.
  - Finish/rollback: page can revert to full-report rendering while typed availability and warnings remain explicit. Estimate: production 180, tests 190, schema/generated 0, documentation/configuration 20.

- [ ] **WU-32 — Add same-tenant approved-snapshot-only previous comparison.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{financial-comparison-service.ts,financial-comparison-service.test.ts}` (planned), `src/features/contabilidad/actions-balance-results.ts`, and balance-results component tests.
  - Satisfies: FRE R2 all scenarios; FRA R4 “View approved v2”; ATS R1/R2 tenant and guessed-ID behavior.
  - Prerequisites/unlocks: WU-25 and WU-31; unlocks WU-34/WU-35 comparison export evidence and E2E.
  - RED: add eligible prior v3, no snapshot without mutable reads/zero delta, v2 warning, cross-tenant snapshot, corrupt hash, and boundary identity tests; run the comparison and action/component tests.
  - GREEN: select the adjacent approved same-tenant snapshot and compare stored canonical/legacy projection only.
  - TRIANGULATE: multiple versions, unapproved snapshot, missing prior period, v2 current/prior combinations, and guessed IDs.
  - REFACTOR: centralize snapshot compatibility projection and run focused tests, ESLint, and typecheck.
  - Finish/rollback: comparison can be disabled to explicit unavailable; never reconstruct history. Estimate: production 160, tests 170, schema/generated 0, documentation/configuration 15.

- [ ] **WU-33 — Emit redacted canonical coverage and rollout telemetry.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/services/{financial-report-telemetry.ts,financial-report-telemetry.test.ts}` (planned), `src/features/contabilidad/services/accounting-audit-logs-service.ts`, `src/app/api/contabilidad/balance-resultados/telemetry/route.ts` and test (planned), and balance-results telemetry component/test (planned).
  - Satisfies: FRE R3 both scenarios; ATS R1/R2 both operational scenarios; AAR R1 writer telemetry and AAR R2 redacted dry-run counts.
  - Prerequisites/unlocks: WU-15, WU-25, WU-28, and WU-31; unlocks WU-39/WU-40.
  - RED: add canonical aggregate-only, redacted keyed tenant ID, no raw amount/account payload in logs, cross-tenant denial, writer completeness, unsupported/v2/v3/reversal/PDF counters, and alert classification tests; run telemetry tests.
  - GREEN: derive metrics from canonical resolution/coverage and typed outcomes without source re-query.
  - TRIANGULATE: expected unavailability versus invariant breach, missing tenant context, partial report, and tenant B guessed telemetry ID.
  - REFACTOR: share redaction/correlation helpers and run focused tests, ESLint, and typecheck.
  - Finish/rollback: telemetry consumer may be disabled, but writer completeness and invariant-breach logs remain. Estimate: production 150, tests 160, schema/generated 0, documentation/configuration 20.

- [ ] **WU-34 — Serialize canonical CSV without recalculation.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/exports/{financial-report-csv.ts,financial-report-csv.test.ts}` (planned), `src/app/api/contabilidad/balance-resultados/export/route.ts` and test (planned), and `src/features/contabilidad/actions-balance-results.ts`.
  - Satisfies: FRE R4 “Export canonical current report”; FRA R4 “View approved v2”; CFC R1 all scenarios; ATS R1/R2 export isolation.
  - Prerequisites/unlocks: WU-03, WU-15, WU-25, and WU-32; unlocks E2E WU-36/WU-37.
  - RED: add canonical value/coverage/comparison/version/warning parity, machine-readable numeric fields, neutral-Spanish labels, unsupported resolution, cross-tenant export, and no-formula contract tests; run CSV and export route tests.
  - GREEN: add a pure serializer and tenant-safe route over one canonical resolution.
  - TRIANGULATE: current/v2/v3, partial native currency, comparison unavailable, delimiter escaping, and generation failure.
  - REFACTOR: separate formatting from values and run focused tests, ESLint, and typecheck.
  - Finish/rollback: CSV switch disables only export; canonical API remains authoritative. Estimate: production 120, tests 160, schema/generated 0, documentation/configuration 15.

- [ ] **WU-35 — Generate and parse a real canonical PDF.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/exports/{financial-report-pdf.ts,financial-report-pdf.test.ts}` (planned), `src/app/api/contabilidad/balance-resultados/export/route.ts` and test, `package.json`, `pnpm-lock.yaml`, and `docs/inventario/accounting-audit/pdf-proof.md` (planned).
  - Satisfies: FRE R4 all scenarios; FRE R5 localized copy; FRA R4 v2 warning; ATS R1/R2 export isolation; AAR R6 “PDF assertion checks only download”.
  - Prerequisites/unlocks: WU-34 and WU-32; unlocks WU-36 through WU-38. Use existing `pdfkit`; add `pdfjs-dist` only as test parser if no already-approved parser suffices.
  - RED: add failing `%PDF-`, parser, metadata, identity, range/version, canonical values, coverage, comparison, v2 warning, neutral-Spanish, failure-with-no-placeholder, and tenant-negative tests; run PDF and export route tests.
  - GREEN: render deterministic Node-runtime bytes from one canonical report and return typed failure before emitting corrupt bytes.
  - TRIANGULATE: current/v2/v3, partial coverage, no comparison, special characters, generator stream failure, and large report pagination.
  - REFACTOR: isolate pure layout/text mapping, pin test parser dependency, and run focused tests, ESLint, typecheck, and package lock review.
  - Finish/rollback: PDF switch disables only PDF while CSV/API stay canonical. Estimate: production 145, tests 170, schema/generated 50, documentation/configuration 15 changed lines.

### Real-backend release evidence and rollout

- [ ] **WU-36 — Add non-intercepted real-backend financial-report E2E fixtures and flows.** <!-- sdd-owner: implementation -->
  - Files: `e2e/fixtures/accounting-audit.ts`, `e2e/accounting-audit/financial-report.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts`, and `docs/inventario/accounting-audit/e2e-proof.md` (planned).
  - Satisfies: AAR R6 “Report response is intercepted”; FRA R1 current/unsupported/v2/v3 scenarios; FRE R1/R2 states; AAR R5 no skip/todo.
  - Prerequisites/unlocks: WU-25 and WU-30 through WU-35; unlocks WU-37 and WU-40.
  - RED: seed isolated real backend data and retain failing acceptance evidence for current live, unsupported cutoff before mutable effect, approved v2/v3, comparison unavailable/available, section states, CSV, and PDF; run `pnpm exec playwright test e2e/accounting-audit/financial-report.spec.ts --project=chromium` with no interception of report/export operations.
  - GREEN: fix only fixture/app seams necessary for deterministic backend execution; rerun expecting all flows green.
  - TRIANGULATE: repeat the file, test out-of-order UI refresh through real requests, and inspect database effects/artifacts.
  - REFACTOR: centralize isolated tenant cleanup and evidence attachments; run the focused Playwright file and no-skip/todo search.
  - Finish/rollback: fixtures clean their own data and do not affect production seeds; rollback removes only E2E scaffolding. Estimate: production 60, tests 260, schema/generated 0, documentation/configuration 20.

- [ ] **WU-37 — Prove tenant-negative and reversal behavior end to end.** <!-- sdd-owner: implementation -->
  - Files: `e2e/accounting-audit/{tenant-isolation.spec.ts,reversal.spec.ts}`, `e2e/fixtures/accounting-audit.ts`, and `docs/inventario/accounting-audit/e2e-proof.md` (planned).
  - Satisfies: ATS R1 through R5 all tenant/reversal scenarios; AAR R6 “Tenant-negative E2E”; FRE R3 “Telemetry access across tenants”.
  - Prerequisites/unlocks: WU-28/WU-29 and WU-36; unlocks publication proof WU-40.
  - RED: retain failures for tenant A reading/comparing/exporting/telemetry/guessing/reversing/mutating tenant B, dependiente/admin denial, valid reversal, same-key retry, changed payload, race, and closed period; run both Playwright files against real operations without interception.
  - GREEN: correct only discovered server/fixture defects until every denial is non-disclosing and only one race effect exists.
  - TRIANGULATE: repeat race/idempotency flows, inspect original/snapshot immutability and audit rows, and test guessed nonexistent IDs for identical outcomes.
  - REFACTOR: share assertions that detect data/timing/status leaks; rerun focused E2E and no-skip/todo gate.
  - Finish/rollback: no production switch is changed by tests; cleanup verifies zero cross-tenant effects. Estimate: production 40, tests 300, schema/generated 0, documentation/configuration 20.

- [ ] **WU-38 — Complete accessible/Impeccable evidence for all report and reversal states.** <!-- sdd-owner: implementation -->
  - Files: balance-results and reversal component files/tests from WU-29/WU-31, `e2e/accounting-audit/accessibility.spec.ts` (planned), and `docs/inventario/accounting-audit/impeccable-wcag-evidence.md` (planned).
  - Satisfies: FRE R5 both scenarios; FRE R1 non-happy states; FRE R3 partial state; AAR R6 accessibility requirement.
  - Prerequisites/unlocks: WU-29, WU-31, and WU-35; unlocks WU-40.
  - RED: add keyboard/focus, semantics, contrast tooling, announcements, loading/stale/partial/legacy/unavailable/error/telemetry/comparison/export/reversal tests; run focused component suites and `pnpm exec playwright test e2e/accounting-audit/accessibility.spec.ts --project=chromium`.
  - GREEN: correct labels, live regions, focus handling, contrast, disabled explanations, and neutral-Spanish actionable messages.
  - TRIANGULATE: keyboard-only, reduced motion, screen-size stress, rapid state transitions, and PDF/CSV controls.
  - REFACTOR: consolidate accessible state components without hiding section independence; rerun axe/component/E2E, ESLint, and typecheck.
  - Finish/rollback: accessibility fixes remain even if product consumers are disabled. Estimate: production 120, tests 210, schema/generated 0, documentation/configuration 30.

- [ ] **WU-39 — Add typed rollout switches, observability, and safe rollback controls.** <!-- sdd-owner: implementation -->
  - Files: `src/features/contabilidad/config/accounting-audit-flags.ts` and test (planned), `src/features/contabilidad/services/financial-report-telemetry.ts`, `src/instrumentation.ts`, `.env.example`, and `docs/inventario/accounting-audit/rollout-runbook.md` (planned).
  - Satisfies: AAR R1 both scenarios; AAR R3 all scenarios; AAR R2 observable counts; FRA R4 “Rollback after v3 failure”.
  - Prerequisites/unlocks: WU-07 through WU-35; unlocks WU-40 and publication gate.
  - RED: add source allowlist, `FINANCIAL_CANONICAL_CONSUMERS`, `FINANCIAL_V3_CAPTURE`, `RECONCILED_SERVICE_REVERSAL`, `FINANCIAL_PDF_EXPORT`, forbidden fail-closed disable, redaction, rollback, and invariant-alert tests; run the flag and telemetry tests.
  - GREEN: implement typed server-only switches and structured metrics while making unsupported-cutoff protection/snapshot/evidence immutability non-disableable.
  - TRIANGULATE: malformed config, partial source activation, switch changes during request, each rollback mode, and alert threshold boundaries.
  - REFACTOR: centralize config parsing and rollback documentation; run focused tests, ESLint, and typecheck.
  - Finish/rollback: flags stop new writers/consumers independently but never delete evidence or revive legacy formulas. Estimate: production 170, tests 180, schema/generated 0, documentation/configuration 25.

- [ ] **WU-40 — Produce the complete no-skip/no-OOM/canonical-consumer release proof.** <!-- sdd-owner: implementation -->
  - Files: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.mjs`, `.github/workflows/accounting-audit.yml`, `scripts/accounting/verify-canonical-consumers.ts` and test (planned), and `docs/inventario/accounting-audit/final-proof.md` (planned).
  - Satisfies: AAR R4 all scenarios; AAR R5 all scenarios; AAR R6 all scenarios; CFC R1 “Duplicate formula path is detected”; proposal measurable outcomes 1–16.
  - Prerequisites/unlocks: WU-01 through WU-39 and every activation hold; unlocks publication parent gate only.
  - RED: make the gate fail on one duplicate formula fixture, one `.skip`/`.todo`, one wrong focused path, one coverage dimension below threshold, one intercepted E2E marker, one download-only PDF assertion, and a deliberately constrained typecheck heap; run each gate and retain intended failures.
  - GREEN: remove fixtures, configure measured full-scope `pnpm run typecheck` without OOM/skip, and make `pnpm run test:run`, focused coverage, real-backend Playwright, PDF parsing, accessibility, Prisma validation, lint, and canonical-consumer scan pass.
  - TRIANGULATE: execute gates from a clean checkout/CI environment, verify generated/schema volume separately, inspect migrations and rollback commands, and reconcile proof counts with all traceability rows.
  - REFACTOR: reduce duplicate scripts while preserving independent failure signals; record commands, versions, counts, coverage dimensions, E2E/PDF/accessibility artifacts, and no-skip search in `final-proof.md`.
  - Finish/rollback: no publication occurs in this task; a failed gate leaves release blocked and does not mutate evidence. Estimate: production 70, tests 210, schema/generated 0, documentation/configuration 60.

## Parent-owned hold points and lifecycle gates

- [x] **P-01 — Before any apply batch, obtain the user’s delivery decision for chained delivery and select either `stacked-to-main` or `feature-branch-chain` without mixing strategies. Decision: `stacked-to-main`.** <!-- sdd-owner: parent -->
- [ ] **P-02 — Before deploying each nullable Prisma migration from WU-04, WU-06, WU-23, WU-24, or WU-27, review migration SQL, generated/schema volume, backups, forward-compatible rollback, and the affected standalone work unit.** <!-- sdd-owner: parent -->
- [ ] **P-03 — After WU-10, review tenant-safe dry-run counts and separately approve or reject actual WU-11 backfill execution; approval of code is not approval to execute migration/backfill.** <!-- sdd-owner: parent -->
- [ ] **P-04 — After WU-07 through WU-11, approve strict-reader activation source-by-source only when successful new conversions show 100% complete evidence and ambiguous/missing legacy rows are verified unresolved.** <!-- sdd-owner: parent -->
- [ ] **P-05 — After WU-23 through WU-25, approve v3 activation only when checkpoint locking, chronology, hash, coverage, v2 byte immutability, and stop-new-approval rollback evidence pass.** <!-- sdd-owner: parent -->
- [ ] **P-06 — After WU-26 through WU-29, approve reversal activation only when named permission, membership, period guard, idempotency/race, tenant-negative, audit, and kill-switch evidence pass.** <!-- sdd-owner: parent -->
- [ ] **P-07 — After WU-40, start or reuse bounded post-apply review per approved delivery strategy; publication remains blocked until every review unit and final proof passes.** <!-- sdd-owner: parent -->
- [ ] **P-08 — Approve publication only after rollout/rollback owners, observability thresholds, migration status, strict readers, v3, reversal, canonical consumers, CSV/PDF, E2E, accessibility, coverage, typecheck, and no-skip evidence are signed off.** <!-- sdd-owner: parent -->

## Traceability matrix

| Spec requirement | Exact scenarios | Assigned work units |
|---|---|---|
| FRA R1 Truthful report mode resolution | Current live request; Approved snapshot request; Unsupported historical cutoff fails before mutable reads | WU-03, WU-15, WU-30, WU-36 |
| FRA R2 Distinct snapshot timestamps | Capture then approval; Invalid timestamp chronology | WU-23, WU-24, WU-25 |
| FRA R3 Cutoff-safe v3 creation | Later mutation cannot enter snapshot; Cutoff evidence unavailable | WU-24, WU-25, WU-36 |
| FRA R4 Immutable approved snapshots and warned v2 compatibility | View approved v2; Attempt to mutate approved snapshot; Rollback after v3 failure | WU-23, WU-25, WU-32, WU-34, WU-35, WU-39 |
| FX R1 Tenant-owned functional currency and governed rates | Tenant-specific functional currencies; Global catalog used in tenant context | WU-04, WU-07, WU-18 |
| FX R2 Complete immutable applied FX evidence | Complete new conversion; Incomplete evidence | WU-06 through WU-09, WU-12, WU-18 |
| FX R3 No synthetic, current, or future evidence | Future rate rejected at boundary; Rate effective exactly at boundary; Missing timestamp is not inferred | WU-02, WU-05, WU-07 through WU-12, WU-14 |
| FX R4 Cutoff-safe foreign bank translation | Eligible as-of translation; Partial foreign-balance coverage; Catalog changes during report generation | WU-05, WU-14, WU-24 |
| CFC R1 One canonical financial source | Same evidence across consumers; Duplicate formula path is detected; Legacy compatibility read | WU-12, WU-15 through WU-22, WU-25, WU-34, WU-35, WU-40 |
| CFC R2 Semi-open accounting ranges | Exact lower and upper boundaries; Adjacent periods | WU-02, WU-13, WU-15 through WU-22 |
| CFC R3 Correct gross cash semantics | Accrual expense without cash movement; Gross and net cash reconcile | WU-13 |
| CFC R4 Reconciled report coverage | Complete coverage; Estimated and unresolved candidates coexist; Coverage totals do not reconcile | WU-02, WU-12, WU-14, WU-15, WU-19, WU-25 |
| ATS R1 Explicit tenant scoping and ownership | Tenant-owned read; Catalog application ownership | WU-03 through WU-05, WU-07 through WU-10, WU-14 through WU-22, WU-24, WU-28 through WU-35, WU-37 |
| ATS R2 Typed non-disclosing failures | Guessed identifier; Operational diagnostics | WU-03, WU-15 through WU-22, WU-26, WU-28 through WU-35, WU-37 |
| ATS R3 Reconciled service sale immutability | Mutation and hard delete rejected; Legacy unreconciled sale | WU-26, WU-27, WU-29, WU-37 |
| ATS R4 Explicit accounting reversal permission | Economic actor reverses own-tenant sale; Broad privilege without explicit permission; Dependent role attempts reversal | WU-26, WU-29, WU-37 |
| ATS R5 Dated, linked, auditable, idempotent reversal | Valid reversal; Same-key retry; Same key with different payload; Concurrent reversal race; Invalid or closed effective date | WU-27, WU-28, WU-29, WU-37 |
| FRE R1 Independent balance and result states | Result fails while balance succeeds; Failed refresh retains prior data; Concurrent responses arrive out of order | WU-30, WU-31, WU-36, WU-38 |
| FRE R2 Snapshot-backed previous-period comparison | Eligible approved comparison; No eligible snapshot; Prior snapshot is v2 | WU-32, WU-34 through WU-36 |
| FRE R3 User-visible coverage telemetry | Partial coverage is visible; Telemetry access across tenants | WU-31, WU-33, WU-37, WU-38 |
| FRE R4 Canonical CSV and real PDF exports | Export canonical current report; Parse v2 PDF; Export generation fails | WU-34, WU-35, WU-36 |
| FRE R5 Neutral Spanish and accessible report states | Non-happy-path announcement; New localized copy review | WU-29, WU-31, WU-35, WU-38 |
| AAR R1 Nullable-first writer-before-reader activation | Nullable foundation deployment; Incomplete writer blocks strict reader | WU-04, WU-06 through WU-09, WU-33, WU-39, P-02, P-04 |
| AAR R2 Observable conservative dry-run and backfill | Dry-run counts reconcile; Unique match is backfilled; Ambiguous or missing match; Repeated or concurrent execution | WU-02, WU-10, WU-11, WU-33, P-03 |
| AAR R3 Non-destructive rollback | Writer rollback; Strict-reader rollback; Product consumer rollback | WU-03, WU-06 through WU-11, WU-23 through WU-28, WU-39 |
| AAR R4 Strict TDD and coverage release gate | Threshold missed in one dimension; Missing red evidence | WU-01, WU-40 |
| AAR R5 Reproducible static and focused test gate | Focused path resolves no intended tests; Typecheck is skipped or exhausted | WU-01, WU-36 through WU-40 |
| AAR R6 Backend, tenant-negative, PDF, and accessibility evidence | Report response is intercepted; Tenant-negative E2E; PDF assertion checks only download | WU-35 through WU-38, WU-40 |

## Final Review Workload Forecast

### Human-readable decision record

| Decision field | Value |
|---|---|
| Estimated changed lines: total and by proposed review slice | Approximately 13,860 total. WU-01 300; WU-02 380; WU-03 365; WU-04 395; WU-05 325; WU-06 380; WU-07 305; WU-08 305; WU-09 305; WU-10 375; WU-11 305; WU-12 380; WU-13 370; WU-14 380; WU-15 375; WU-16 290; WU-17 310; WU-18 290; WU-19 290; WU-20 290; WU-21 340; WU-22 340; WU-23 390; WU-24 390; WU-25 385; WU-26 295; WU-27 390; WU-28 390; WU-29 355; WU-30 355; WU-31 390; WU-32 345; WU-33 330; WU-34 295; WU-35 380; WU-36 340; WU-37 360; WU-38 360; WU-39 375; WU-40 340. Estimates include additions plus deletions. |
| Chained PRs recommended: Yes or No | Yes |
| 400-line budget risk: Low, Medium, or High | High |
| Decision needed before apply: Yes or No | Yes |
| Proposed PR/work-unit boundaries and dependency chain | Forty autonomous review units in numbered dependency order: harness/contracts → availability/policy/provider/schema → writer-by-writer FX → dry-run/execution → canonical domain/consumer families → v3 schema/checkpoint/activation → reversal permission/schema/service/UI → section UI/comparison/telemetry/CSV/PDF → real-backend proof/rollout gates. The user selected `stacked-to-main` before apply. |
| Generated/schema volume called out separately from handwritten lines | Approximately 880 schema/generated lines are isolated mainly in WU-04, WU-06, WU-23, WU-27, and WU-35. Remaining estimate is approximately 12,980 handwritten lines: 5,780 production, 6,470 tests, and 730 documentation/configuration. |

### Machine-readable decision record

```yaml
Estimated changed lines: total 13860; WU-01 300, WU-02 380, WU-03 365, WU-04 395, WU-05 325, WU-06 380, WU-07 305, WU-08 305, WU-09 305, WU-10 375, WU-11 305, WU-12 380, WU-13 370, WU-14 380, WU-15 375, WU-16 290, WU-17 310, WU-18 290, WU-19 290, WU-20 290, WU-21 340, WU-22 340, WU-23 390, WU-24 390, WU-25 385, WU-26 295, WU-27 390, WU-28 390, WU-29 355, WU-30 355, WU-31 390, WU-32 345, WU-33 330, WU-34 295, WU-35 380, WU-36 340, WU-37 360, WU-38 360, WU-39 375, WU-40 340
Chained PRs recommended: Yes
400-line budget risk: High
Decision needed before apply: Yes
Proposed PR/work-unit boundaries and dependency chain: WU-01 -> WU-02 -> WU-03/WU-04/WU-05/WU-06 -> WU-07 -> WU-08 -> WU-09 -> WU-10 -> WU-11 -> WU-12 -> WU-13/WU-14 -> WU-15 -> WU-16 -> WU-17 -> WU-18 -> WU-19 -> WU-20 -> WU-21 -> WU-22 -> WU-23 -> WU-24 -> WU-25 -> WU-26 -> WU-27 -> WU-28 -> WU-29 -> WU-30 -> WU-31 -> WU-32/WU-33/WU-34 -> WU-35 -> WU-36 -> WU-37/WU-38 -> WU-39 -> WU-40; chain strategy stacked-to-main
Generated/schema volume called out separately from handwritten lines: schema/generated 880; handwritten production 5780; tests 6470; documentation/configuration 730
```
