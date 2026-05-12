# Proposal: Fix 5 Critical Issues in Ventas System

## Problem

The Ventas system has 5 critical issues identified during architectural audit:

### Issue #1 — MultiTenant Violation (Security)
Handler `createVentaHandler` uses `tenantId: ''` (empty string) instead of extracting the tenant from the authenticated user. This means ALL ventas are created without a valid tenant, breaking multi-tenant isolation. Other handlers (getVentaById, updateVenta, deleteVenta, getVentasStats) also lack tenant scoping.

### Issue #2 — No Idempotency Protection (Reliability)
There is no `idempotencyKey` mechanism. Network retries or double-clicks can create duplicate ventas. Frontend has no way to safely retry failed requests.

### Issue #3 — Dual Stock Calculation Strategy (Maintenance)
Stock is calculated from BOTH `Venta.productoId` + `Venta.cantidad` (legacy) AND `VentaItem.productoId` + `VentaItem.cantidad` (current). This dual strategy produces inconsistent stock counts and confuses developers.

### Issue #4 — No Location Validation Before Transaction (Data Integrity)
Transactions proceed without validating that `puntoDeVentaId` and `almacenId` exist. If they reference deleted records, Prisma throws a foreign key constraint error (500) instead of a 400 with a clear message.

### Issue #5 — Weak Error Handling (Observability)
All handlers use generic try-catch with `console.error("Error al crear/obtener/actualizar Venta")`. There's no transactional logging, no Prisma error code discrimination, and no structured error response.

## Solution

Implement each issue in dependency order: #1 → #4 → #3 → #2 → #5

1. Replace `tenantId: ''` with `requireTenant(user)` across ALL handlers
2. Add `validateVentaLocations()` to verify foreign keys before transaction
3. Remove legacy `ventasLegacy` aggregate from stock calculation
4. Add `idempotencyKey` to schema, auto-generate UUID if not provided, return 200 on retry
5. Add `withVentaTransaction` wrapper with structured logging + Prisma error discrimination

## Affected Areas

- `src/features/ventas/api/handlers.ts` — Core business logic
- `src/features/ventas/schemas.ts` — Add idempotencyKey to schema
- `src/app/api/ventas/[id]/route.ts` — Add withAuth wrapper
- `src/app/api/ventas/stats/route.ts` — Add withAuth wrapper
- `prisma/schema.prisma` — Add idempotencyKey index, AuditVenta table
- `src/features/ventas/__tests__/` — New test fixtures + issue-specific tests

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing clients without idempotencyKey | Medium | Auto-generate UUID if not provided |
| Legacy stock queries break | Medium | Keep backward compat, log deprecation warning |
| Transaction logging overhead | Low | Log-only wrapper, no external side effects |
| Migration conflicts with shadow DB | Medium | Manual migration via `$executeRawUnsafe` |
