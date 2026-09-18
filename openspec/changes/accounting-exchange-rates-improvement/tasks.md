# Tasks: Accounting Exchange Rates Improvement

## Phase 1: Foundation — domain contracts and failing tests

- [x] 1.1 Add RED unit tests in `src/lib/services/__tests__/currency-conversion-service.test.ts` for same-currency pass-through, direct rate lookup, latest-rate selection, principal-currency routing, inactive currency rejection, missing principal rejection, missing-path failure, and positive-amount validation.
- [x] 1.2 Add RED contract tests in `src/features/contabilidad/services/__tests__/exchange-rate-provider.test.ts` and `src/features/contabilidad/services/__tests__/exchange-rate-read-service.test.ts` for provider lookup, current-rate ordering, history shaping, and deterministic quote fields (`ruta`, `tasaAplicada`, `effectiveAt`, `tasaId`).
- [x] 1.3 Create `src/features/contabilidad/services/exchange-types.ts` plus `src/features/contabilidad/services/exchange-rate-provider.ts` and `src/features/contabilidad/services/exchange-rate-read-service.ts` to define the shared exchange-rate contract before wiring any callers.
- [x] 1.4 Refactor `src/lib/services/currency-conversion-service.ts` into a deterministic conversion kernel that delegates rate lookup to the provider boundary and returns explicit quote/error data instead of ad hoc Prisma access.

## Phase 2: Core implementation — actions and persistence

- [x] 2.1 Add RED action tests in `src/features/contabilidad/__tests__/actions-exchange.test.ts` for `getMonedasAction`, `getTasasActualesAction`, `convertMoneyAction`, `updateTasaCambioAction`, and `getHistorialTasasAction`, covering success, invalid amount, missing rate, inactive currency, and missing principal scenarios.
- [x] 2.2 Refactor `src/features/contabilidad/actions-exchange.ts` to call the shared conversion/read services, map domain failures to `withAction` results, and persist successful conversions to `TransaccionMoneda` with original amount, applied rate, converted amount, currency, and reference fields.
- [x] 2.3 Add RED compatibility tests in `src/features/contabilidad/api/__tests__/exchange-handlers.test.ts` for the legacy handler path to prove parity with the Server Action contract on same-currency, direct-path, principal-path, and missing-rate cases.
- [x] 2.4 Reduce `src/features/contabilidad/api/exchange-handlers.ts` to a compatibility wrapper that delegates to the same shared domain logic, preserves current error codes, and removes duplicated conversion math.

## Phase 3: Integration and wiring — UI/workspace updates

- [x] 3.1 Add RED component tests in `src/features/contabilidad/components/__tests__/conversion-dialog.test.tsx` for quote rendering, swap behavior, disabled submit states, inactive currency handling, and failure messaging based on the new quote DTO.
- [x] 3.2 Update `src/features/contabilidad/components/conversion-dialog.tsx` to consume the deterministic quote/result DTO, show rate provenance and route, and stop collecting user-entered exchange math.
- [x] 3.3 Add RED component tests in `src/features/contabilidad/components/__tests__/tasa-cambio-form.test.tsx` and `src/features/contabilidad/components/__tests__/historial-tasas-table.test.tsx` for principal-currency context, historical overwrite warnings, audit columns, provenance badges, empty states, and pagination.
- [x] 3.4 Update `src/features/contabilidad/components/tasa-cambio-form.tsx` and `src/features/contabilidad/components/historial-tasas-table.tsx` to surface the new audit/provenance fields and deterministic history ordering.
- [x] 3.5 Update `src/features/contabilidad/components/exchange-manager.tsx` and `src/app/busy/contabilidad/exchange/page.tsx` to keep orchestration-only state, pass refresh callbacks consistently, and preserve the route shell/accessibility behavior.

## Phase 4: Testing and verification — parity and scenario coverage

- [x] 4.1 Add E2E coverage in `src/__tests__/exchange-rates-e2e.spec.ts` for `/busy/contabilidad/exchange` that exercises the page flow, conversion success, missing-rate failure, and historized rate display.
- [x] 4.2 Run the focused Vitest slice for `src/lib/services/__tests__/currency-conversion-service.test.ts`, `src/features/contabilidad/__tests__/actions-exchange.test.ts`, and the new component tests; fix any mismatches in error codes, DTO fields, or rendering assumptions.
- [x] 4.3 Run `pnpm exec eslint` on touched files and `pnpm run typecheck` to catch contract drift across `actions-exchange.ts`, `exchange-handlers.ts`, and the exchange components.

## Phase 5: Cleanup

- [x] 5.1 Remove any remaining duplicate exchange-rate math or direct Prisma lookup paths from `src/features/contabilidad/actions-exchange.ts`, `src/features/contabilidad/api/exchange-handlers.ts`, and `src/lib/services/currency-conversion-service.ts`.
- [x] 5.2 Tighten comments and JSDoc in the touched exchange files so the shared domain boundary, provider abstraction, and legacy-wrapper status are explicit.
