# Ventas Issues Fix

## Quick Reference

Resolver 5 issues críticos en el sistema de Ventas.

### Issues (orden de implementación)

| # | Issue | Archivo clave | Tests |
|---|-------|--------------|-------|
| 1 | MultiTenant — `tenantId: ''` hardcodeado | handlers.ts | 2 |
| 2 | Idempotency — sin protección contra duplicados | schemas.ts + handlers.ts | 3 |
| 3 | Stock Unification — dual strategy legacy/moderno | handlers.ts | 1 |
| 4 | Location Validation — sin validación de FK | handlers.ts | 2 |
| 5 | Error Handling — logging genérico | handlers.ts | 2 |

### Orden de Implementación

```
1. MultiTenant (seguridad primero)
  │
  ▼
4. Location Validation (necesita tenant para validar)
  │
  ▼
3. Stock Unification (independiente, pero limpia el modelo)
  │
  ▼
2. Idempotency Key (depende del flujo de creación)
  │
  ▼
5. Error Handling (envuelve todo)
```

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/features/ventas/api/handlers.ts` | Todos los 5 issues |
| `src/features/ventas/schemas.ts` | +idempotencyKey optional |
| `src/app/api/ventas/[id]/route.ts` | +withAuth wrapper |
| `src/app/api/ventas/stats/route.ts` | +withAuthGet wrapper |
| `prisma/schema.prisma` | +idempotencyKey index + AuditVenta |
| `vitest.config.mjs` | +exclude .worktrees |

### Testing

```bash
# Tests de ventas específicos
pnpm test:run -- src/features/ventas

# Tests de handlers existentes
pnpm test:run -- src/features/ventas/api/__tests__/handlers.test.ts

# Tests de issues nuevos
pnpm test:run -- src/features/ventas/__tests__/handlers-issues.test.ts

# Full suite (todos los tests del proyecto)
pnpm test:run
```

### Commit

```
fix(ventas): resolve 5 critical issues - multitenancy, idempotency, stock unification, location validation, error handling

Issue #1 (MultiTenant): Replace hardcoded tenantId '' with requireTenant(user) in all handlers, add withAuth wrappers to [id] and stats routes
Issue #2 (Idempotency): Add idempotencyKey validation - returns existing venta on retry, auto-generates UUID if not provided
Issue #3 (Stock Unification): Remove legacy venta.productoId+cantidad strategy, use VentaItem exclusively for stock tracking
Issue #4 (Location Validation): Add validateVentaLocations() - verifies PuntoDeVenta + Almacen before transaction
Issue #5 (Error Handling): Add withVentaTransaction wrapper with [VENTA_TX_ROLLBACK] logging + Prisma error code discrimination

DB: Add idempotencyKey unique index on Venta + AuditVenta table
Tests: 18 passing (3 existing + 5 actions + 10 new issue-specific tests)
```

### Rollback

```bash
# Si algo sale mal:
git checkout main
git branch -D fix/ventas-multitenancy-idempotency-stock
git push origin --delete fix/ventas-multitenancy-idempotency-stock 2>/dev/null || true
# Revertir migración (si ya se aplicó):
npx prisma migrate resolve --rolled-back "fix_ventas_multitenancy_idempotency_stock"
```

### Riesgos Conocidos

- **Shadow DB**: `prisma migrate dev` puede fallar con P3006. Usar `prisma migrate resolve --applied` + `$executeRawUnsafe` como fallback.
- **Test isolation**: Usar `vi.resetAllMocks()` en vez de `vi.clearAllMocks()` para evitar leaks entre tests.
- **Coverage**: Reporte de coverage puede fallar por timeout de instalación de herramientas. No bloqueante.
