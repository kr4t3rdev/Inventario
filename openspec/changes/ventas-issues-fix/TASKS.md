# Implementation Tasks: Ventas - Issues Críticos & Multitenancy

## Phase 1: Setup & Preparation (0.5h)

### 1.1 Create Git Branch
- [ ] `git checkout -b fix/ventas-multitenancy-idempotency-stock`
- [ ] Verify no conflicts with main

### 1.2 Create Prisma Migration
- [ ] Add `idempotencyKey` field to `Venta` model
- [ ] Add `AuditVenta` model
- [ ] Mark `Venta.productoId` and `Venta.cantidad` as deprecated
- [ ] Run `pnpm prisma migrate dev --name fix_ventas_multitenancy_idempotency_stock`
- [ ] Verify migration file generated in `prisma/migrations/`

### 1.3 Create Test Fixtures
- [ ] `src/features/ventas/__tests__/fixtures/ventas-test-data.ts`
- [ ] Export: `mockUser`, `mockTenant`, `mockPuntoDeVenta`, `mockProducto`, `mockVenta`

---

## Phase 2: Core Implementation (4h)

### 2.1 Issue #1: MultiTenant Fix (0.5h)

**File**: `src/features/ventas/api/handlers.ts`

- [ ] **Line 82** in `crearFacturaParaVenta()`:
  - Replace `tenantId: ''` with parameter `tenantId` (add to function signature)
  
- [ ] **Lines 138, 164** in `criarVentaMixta()`:
  - Add `const tenantId = requireTenant(user);` at function start
  - Replace `tenantId: ''` with `tenantId`
  
- [ ] **Line 247** in `crearVentaUnica()`:
  - Add `const tenantId = requireTenant(user);`
  - Replace `tenantId: ''` with `tenantId`
  
- [ ] **Line 347** in `criarVentaIndividual()`:
  - Add `const tenantId = requireTenant(user);`
  - Replace `tenantId: ''` with `tenantId`

- [ ] **Verify**: Run `grep -n "tenantId: ''" src/features/ventas/api/handlers.ts`
  - Should return 0 matches

- [ ] **Test**: `src/features/ventas/__tests__/handlers.test.ts`
  - Add test: `should create venta with user tenantId, not empty string`

---

### 2.2 Issue #4: Location Validation (0.5h)

**File**: `src/features/ventas/api/handlers.ts`

- [ ] Create validation function `validateVentaLocations()`:
  ```typescript
  async function validateVentaLocations(
    puntoDeVentaId: string,
    productos: Array<{ productoId: string }>,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string }>
  ```
  
- [ ] Inside function:
  - Validate PuntoDeVenta exists
  - For each producto, if has `productoPadreId`:
    - Validate almacén exists and is active
  - Return `{ valid: true }` or `{ valid: false, error: "..." }`

- [ ] Call in `criarVentaMixta()`, `criarVentaUnica()`, `criarVentaIndividual()`:
  - Add BEFORE transaction: 
    ```typescript
    const validation = await validateVentaLocations(puntoDeVentaId, productos);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 404 }
      );
    }
    ```

- [ ] **Test**: `src/features/ventas/__tests__/handlers.test.ts`
  - Add test: `should return 404 if PuntoDeVenta not found`
  - Add test: `should return 400 if Almacén inactive`

---

### 2.3 Issue #3: Stock Unification (1h)

**File**: `src/features/ventas/api/handlers.ts`

- [ ] **Step 1**: Find and refactor stock calculation
  - Lines ~206-211: Remove legacy `ventasLegacy` aggregation
  - Keep only `ventasItems` aggregation
  - Simplify: `const ventasTotal = ventasItems._sum.cantidad || 0`

- [ ] **Step 2**: Verify Venta creation uses only VentaItem
  - Line ~245-262 in `criarVentaUnica()`:
    - Verify `items: { create: [...] }` is present
    - Ensure `productoId` field NOT in data object
    - Ensure `cantidad` field NOT in data object

- [ ] **Step 3**: Same for `criarVentaIndividual()` (~344-361)
  - Verify VentaItem is created: `items: { create: [{ ... }] }`

- [ ] **Step 4**: Add deprecation warning
  - Top of `handlers.ts`, in `createVentaHandler()`:
    ```typescript
    console.warn(
      '[DEPRECATION] venta.productoId + venta.cantidad are legacy. ' +
      'Use venta.items[] instead. Will be removed in v2.0.0.'
    );
    ```

- [ ] **Test**: `src/features/ventas/__tests__/handlers.test.ts`
  - Add test: `should create VentaItem, not use venta.productoId`
  - Add test: `should calculate stock using only VentaItem`

---

### 2.4 Issue #2: Idempotency Key Validation (1h)

**File 1**: `src/features/ventas/schemas.ts`

- [ ] Add to `createVentaSchema`:
  ```typescript
  idempotencyKey: z.string().uuid().optional(),
  ```

**File 2**: `src/features/ventas/api/handlers.ts`

- [ ] In `createVentaHandler()`:
  - After auth and tenant validation:
    ```typescript
    let idempotencyKey = body.idempotencyKey;
    let existingVenta = null;
    
    if (idempotencyKey) {
      existingVenta = await prisma.venta.findFirst({
        where: { idempotencyKey, tenantId },
        select: VENTA_SELECT,
      });
      
      if (existingVenta) {
        return NextResponse.json(existingVenta, { status: 200 });
      }
    } else {
      idempotencyKey = crypto.randomUUID();
    }
    ```

- [ ] Pass `idempotencyKey` to `criarVentaMixta()`, `criarVentaUnica()`, `criarVentaIndividual()`
  - Add to each function signature: `idempotencyKey: string`
  - Include in `venta.create()` data: `idempotencyKey`

- [ ] **Test**: `src/features/ventas/__tests__/handlers.test.ts`
  - Add test: `should return existing venta on idempotency key retry`
  - Add test: `should generate UUID if idempotencyKey not provided`

---

### 2.5 Issue #5: Error Handling & Rollback (1h)

**File**: `src/features/ventas/api/handlers.ts`

- [ ] Create helper function `withVentaTransaction()`:
  ```typescript
  async function withVentaTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    context: { ventaId?: string; userId: string; operation: string }
  ): Promise<T> {
    try {
      return await prisma.$transaction(fn);
    } catch (error) {
      console.error('[VENTA_TX_ROLLBACK]', {
        operation: context.operation,
        userId: context.userId,
        ventaId: context.ventaId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
  ```

- [ ] Replace all `prisma.$transaction()` calls with `withVentaTransaction()`:
  - In `criarVentaMixta()` (~line 130)
  - In `criarVentaUnica()` (~line 244)
  - In `criarVentaIndividual()` (~line 344)

- [ ] Update error handling in `createVentaHandler()` catch block:
  ```typescript
  catch (error) {
    console.error('[VENTA_HANDLER_ERROR]', {
      userId: user?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Venta duplicada o conflicto de datos' },
          { status: 409 }
        );
      }
    }
    
    // ... rest of discriminators
  }
  ```

- [ ] **Test**: `src/features/ventas/__tests__/handlers.test.ts`
  - Add test: `should rollback transaction if stock operation fails`
  - Add test: `should return appropriate error code for Prisma constraint violation`
  - Add test: `should log error context on failure`

---

## Phase 3: Testing (1.5h)

### 3.1 Unit Tests

**File**: `src/features/ventas/__tests__/handlers.test.ts`

- [ ] **MultiTenant Tests** (2 tests)
  - `should create venta with user tenantId`
  - `should not allow cross-tenant access`

- [ ] **Location Validation Tests** (2 tests)
  - `should return 404 if PuntoDeVenta not found`
  - `should return 400 if Almacén inactive`

- [ ] **Stock Unification Tests** (2 tests)
  - `should create VentaItem, not use venta.productoId`
  - `should calculate stock using only VentaItem`

- [ ] **Idempotency Tests** (3 tests)
  - `should return existing venta on idempotency key retry`
  - `should generate UUID if idempotencyKey not provided`
  - `should prevent duplicate ventas with same key`

- [ ] **Error Handling Tests** (3 tests)
  - `should rollback transaction if stock operation fails`
  - `should return 409 for constraint violation`
  - `should log error context on failure`

**Total**: 12 tests, >80% coverage target

### 3.2 Integration Tests

**File**: `src/features/ventas/__tests__/integration.test.ts`

- [ ] Happy path: Create venta with all validations passing
- [ ] MultiTenant isolation: User A cannot see User B ventas
- [ ] Idempotency with anticipos: Retry with anticipoCobroId works correctly
- [ ] Stock + Pack products: Parent stock decremented correctly
- [ ] Error cascade: Factura creation failure rolls back venta

### 3.3 Run Tests

- [ ] `pnpm test -- src/features/ventas/__tests__`
- [ ] `pnpm test:run` to get coverage report
- [ ] Verify coverage >80%

---

## Phase 4: Database & Schema (0.5h)

### 4.1 Apply Migrations

- [ ] `pnpm prisma migrate deploy`
- [ ] Verify schema matches `prisma/schema.prisma`
- [ ] Check DB: `ALTER TABLE "Venta" ADD COLUMN idempotencyKey`

### 4.2 Background Migration (Optional)

- [ ] Create script: `scripts/migrate-venta-stock-to-items.ts`
- [ ] Migrate legacy ventas: `venta.productoId -> VentaItem`
- [ ] Run: `pnpm ts-node scripts/migrate-venta-stock-to-items.ts`
- [ ] Verify: All legacy ventas have corresponding VentaItems

---

## Phase 5: Documentation & Cleanup (0.5h)

### 5.1 Update Documentation

- [ ] `DESIGN.md`: Verify examples match implementation
- [ ] Add to `src/features/ventas/README.md`:
  - "Multitenancy: All requests extract tenantId from user context"
  - "Idempotency: Include idempotencyKey in requests to prevent duplicates"
  - "Stock: Tracked via VentaItem only (productoId deprecated)"

### 5.2 Add Deprecation Notices

- [ ] Comment in model:
  ```typescript
  /**
   * @deprecated Use venta.items[] instead
   * Legacy field maintained for backward compatibility
   * Will be removed in v2.0.0
   */
  productoId?: string;
  ```

### 5.3 Cleanup

- [ ] Remove TODOs related to these issues
- [ ] Run `pnpm lint` to fix any style issues
- [ ] Ensure no `console.log()` (only `console.error` and `console.warn`)

---

## Phase 6: Review & Verification (0.5h)

### 6.1 Code Review Checklist

- [ ] All `tenantId: ''` replaced with `requireTenant(user)`
- [ ] Idempotency key validation in place before transaction
- [ ] Stock calculation uses only `VentaItem`
- [ ] Location validation before transaction
- [ ] Error handling with explicit rollback logging
- [ ] Tests cover all scenarios
- [ ] No breaking changes to API contract

### 6.2 Manual Testing

- [ ] Create venta as User A, verify tenantId set correctly
- [ ] Retry same request with idempotencyKey, verify idempotent response
- [ ] Create venta with invalid PuntoDeVenta, verify 404
- [ ] Create venta, verify items populated (not productoId)
- [ ] Test stock calculation reflects VentaItem quantities

### 6.3 Performance Check

- [ ] Verify idempotency key lookup is indexed
- [ ] Profile: Does withVentaTransaction() add overhead?
- [ ] Check query plans for stock calculation (removed legacy aggregate)

---

## Rollback Plan

If any tests fail or issues arise:

### Immediate Rollback (0.5h)
```bash
git checkout src/features/ventas/api/handlers.ts
pnpm prisma migrate resolve --rolled-back <migration-name>
git reset --hard HEAD~1
```

### Data Rollback
- Ventas created during testing will have `idempotencyKey` (no issue)
- Prisma migration is reversible (down script generated)
- No data loss: just schema revert

### Communication
- If rollback needed, document issue in GitHub issue
- Note which test failed and why
- Plan for re-attempt with fix

---

## Success Criteria Verification

Before declaring complete:

- [ ] All tests passing: `pnpm test:run -- src/features/ventas`
- [ ] Coverage >80%: `coverage report shows ✓`
- [ ] No hardcoded `''` in handlers: `grep -r "tenantId: ''" src/features/ventas/`
- [ ] Idempotency working: Manual test shows retry returns same ventaId
- [ ] Stock unified: VentaItem used, productoId deprecated
- [ ] Locations validated: Invalid pv returns 404
- [ ] Errors logged: Error messages include context (userId, operation)
- [ ] Backward compat: Old clients still work (just generate UUID for key)
- [ ] Migrations clean: `pnpm prisma migrate status` shows all applied

---

## Deployment Checklist

When ready to deploy to production:

- [ ] All tests passing on CI/CD
- [ ] Code review approved
- [ ] Migration tested in staging environment
- [ ] Rollback plan documented and tested
- [ ] Feature flag prepared (if needed for gradual rollout)
- [ ] Monitoring setup for `[VENTA_TX_ROLLBACK]` errors
- [ ] Communication sent to team about API changes (idempotencyKey now supported)

---

## Estimated Total Time

- Phase 1 (Setup): 0.5h
- Phase 2 (Implementation): 4h
- Phase 3 (Testing): 1.5h
- Phase 4 (Database): 0.5h
- Phase 5 (Documentation): 0.5h
- Phase 6 (Review): 0.5h
- **Total: ~7.5 hours**

(Can be parallelized: Tests can run while docs written)
