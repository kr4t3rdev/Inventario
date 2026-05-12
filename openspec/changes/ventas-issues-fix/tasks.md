# Tasks: Fix 5 Critical Issues in Ventas System

## Phase 1: Setup

- [ ] 1.1 Create branch `fix/ventas-multitenancy-idempotency-stock` from `origin/codex/upgrade-next-16`
- [ ] 1.2 Add Prisma migration for `idempotencyKey` unique index + `AuditVenta` model
- [ ] 1.3 Create shared test fixtures in `src/features/ventas/__tests__/fixtures/ventas-test-data.ts`
- [ ] 1.4 Create mock factory functions for `Venta`, `VentaItem`, `PuntoDeVenta`, `Almacen`, `User`
- [ ] 1.5 Create `createMockPrisma()` helper that returns a full mocked Prisma client
- [ ] 1.6 Exclude `.worktrees/**` from vitest config

## Phase 2: Issue #1 — MultiTenant

- [ ] 2.1 Replace `tenantId: ''` with `requireTenant(user)` in `createVentaHandler`
- [ ] 2.2 Add `requireTenant(user)` to `getVentaByIdHandler`, `updateVentaHandler`, `deleteVentaHandler`
- [ ] 2.3 Add `requireTenant(user)` to `getVentasStatsHandler`
- [ ] 2.4 Add `tenantId` filter in ALL Prisma queries (not just create)
- [ ] 2.5 Wrap `[id]/route.ts` handlers with `withAuth()`
- [ ] 2.6 Wrap `stats/route.ts` handlers with `withAuthGet()`

## Phase 3: Issue #4 — Location Validation

- [ ] 3.1 Add `validateVentaLocations(puntoDeVentaId, almacenId, prisma)` function
- [ ] 3.2 Call `validateVentaLocations` in `createVentaHandler` before `prisma.$transaction`
- [ ] 3.3 Return 400 ValidationError when locations not found

## Phase 4: Issue #3 — Stock Unification

- [ ] 4.1 Remove `ventasLegacy` aggregate from `getVentaStock` calculations
- [ ] 4.2 Keep only `VentaItem` aggregate for stock deduction
- [ ] 4.3 Add deprecation comment on legacy `Venta.productoId` and `Venta.cantidad` fields

## Phase 5: Issue #2 — Idempotency Key

- [ ] 5.1 Add `idempotencyKey: z.string().uuid().optional()` to `createVentaSchema`
- [ ] 5.2 Read existing venta by `idempotencyKey` at start of create handler
- [ ] 5.3 Return existing venta with HTTP 200 on match (idempotent retry)
- [ ] 5.4 Auto-generate UUID `crypto.randomUUID()` when `idempotencyKey` not provided
- [ ] 5.5 Store `idempotencyKey` in created venta

## Phase 6: Issue #5 — Error Handling

- [ ] 6.1 Create `withVentaTransaction(handlerName, fn)` wrapper
- [ ] 6.2 Log `[VENTA_TX_ROLLBACK] ${handlerName}` with error details
- [ ] 6.3 Discriminate Prisma error codes: P2002 → 409, P2025 → 404
- [ ] 6.4 Wrap ALL handlers (create, get, update, delete, stats) with the transaction wrapper

## Phase 7: Testing

- [ ] 7.1 Test: `requireTenant` denies creation without tenant
- [ ] 7.2 Test: `requireTenant` allows creation with valid tenant
- [ ] 7.3 Test: `validateVentaLocations` rejects invalid puntoDeVenta
- [ ] 7.4 Test: `validateVentaLocations` rejects invalid almacen
- [ ] 7.5 Test: Idempotency — existing key returns 200 with same venta
- [ ] 7.6 Test: Idempotency — new key creates venta with 201
- [ ] 7.7 Test: Idempotency — no key auto-generates UUID
- [ ] 7.8 Test: Stock calculation uses VentaItem only (no legacy)
- [ ] 7.9 Test: Error wrapper maps P2002 → 409
- [ ] 7.10 Test: Error wrapper maps P2025 → 404
- [ ] 7.11 Verify existing handler tests still pass (3 handlers + 5 actions)
- [ ] 7.12 Run full test suite: `pnpm test:run`

## Phase 8: Verification

- [ ] 8.1 No hardcoded `tenantId: ''` in handlers.ts
- [ ] 8.2 Idempotency returns 200 on retry (not 201 or 409)
- [ ] 8.3 Stock calculated from VentaItem only
- [ ] 8.4 Location validation returns 400 on invalid FK
- [ ] 8.5 `[VENTA_TX_ROLLBACK]` logged on error
- [ ] 8.6 Backward compatible — existing tests pass without modification
- [ ] 8.7 Prisma migration applied successfully
- [ ] 8.8 0 new lint errors (`pnpm run lint`)
- [ ] 8.9 All 18+ tests passing

## Phase 9: PR

- [ ] 9.1 `git add -A && git commit -m "fix(ventas): resolve 5 critical issues..."`
- [ ] 9.2 `git push -u origin fix/ventas-multitenancy-idempotency-stock`
- [ ] 9.3 Create PR to `codex/upgrade-next-16` with summary of changes
- [ ] 9.4 Reference all 5 issues in PR description
- [ ] 9.5 Include testing summary (18/18 passing)
