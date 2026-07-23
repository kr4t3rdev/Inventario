# Tasks: Tenant Isolation — Configuración Contable

## Change

`tenant-isolation-tipos-pago-config-contable`

## STRICT TDD MODE

Test runner: `pnpm run test:run`

Follow RED → GREEN → TRIANGULATE → REFACTOR for all implementation tasks.

---

## Task 1 — Schema: Agregar tenantId a TipoPago

### Instructions

1. Agregar `tenantId String` al modelo `TipoPago` en `prisma/schema.prisma`.
2. Agregar relación `tenant Tenant @relation(fields: [tenantId], references: [tenantId])`.
3. Agregar `@@index([tenantId])`.
4. Crear migración de Prisma: `npx prisma migrate dev --name add-tenant-id-tipo-pago`.
5. Verificar que la migración genera SQL correcto y se aplica sin errores.
6. Editar migration.sql para que el campo sea nullable inicialmente:
   ```sql
   ALTER TABLE "TipoPago" ADD COLUMN "tenantId" TEXT;
   ```
7. La migración final hará NOT NULL después del backfill.

**TIP**: Para desarrollo local, usar `npx prisma db push` en vez de migración hasta tener el backfill listo.

### Files

- `prisma/schema.prisma`
- `prisma/migrations/*/add-tenant-id-tipo-pago/migration.sql`

### Testing

**TDD RED phase**: Verificar que los tests existentes de `actions-tipos-pago.ts` fallen porque ahora TipoPago requiere tenantId.

---

## Task 2 — Backfill script: Poblar tenantId en TipoPago existentes

### Instructions

Crear `prisma/seed/backfill-tipos-pago-tenant.ts` con:

```typescript
import { prisma } from '@/lib/prisma';

async function backfillTiposPagoTenant() {
  const tiposSinTenant = await prisma.tipoPago.findMany({
    where: { tenantId: null },
  });

  for (const tipo of tiposSinTenant) {
    // 1. Buscar tenantId desde reconciliaciones
    const reconciliaciones = await Promise.all([
      prisma.reconciliacionVenta.findFirst({ where: { tipoPagoId: tipo.tipoId }, select: { tenantId: true } }),
      prisma.reconciliacionServicio.findFirst({ where: { tipoPagoId: tipo.tipoId }, select: { tenantId: true } }),
      prisma.reconciliacionGasto.findFirst({ where: { tipoPagoId: tipo.tipoId }, select: { tenantId: true } }),
    ]);

    const tenants = reconciliaciones
      .filter(r => r !== null)
      .map(r => r!.tenantId);

    let tenantId: string | null = null;

    if (tenants.length > 0) {
      // Usar el tenant más frecuente
      const freq = tenants.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      tenantId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    } else {
      // Fallback: asignar al primer tenant de la tabla
      const firstTenant = await prisma.tenant.findFirst({ select: { tenantId: true } });
      if (firstTenant) tenantId = firstTenant.tenantId;
    }

    if (tenantId) {
      await prisma.tipoPago.update({
        where: { tipoId: tipo.tipoId },
        data: { tenantId },
      });
      console.log(`✓ TipoPago ${tipo.tipoId} asignado a tenant ${tenantId}`);
    } else {
      console.warn(`⚠ No se pudo resolver tenant para TipoPago ${tipo.tipoId}`);
    }
  }
}

backfillTiposPagoTenant()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Files

- `prisma/seed/backfill-tipos-pago-tenant.ts`

### Testing

Ejecutar manualmente: `npx tsx prisma/seed/backfill-tipos-pago-tenant.ts`

---

## Task 3 — Tests RED: Escribir tests que demuestren la falla de seguridad actual

### Instructions

Escribir tests en `src/features/contabilidad/__tests__/actions-tipos-pago.test.ts` que demuestren:

1. Un usuario del Tenant A NO puede ver tipos de pago del Tenant B (escenario multi-tenant)
2. Un usuario del Tenant A NO puede crear un tipo de pago con tenantId incorrecto
3. Un usuario del Tenant A NO puede actualizar/eliminar un tipo de pago del Tenant B

Utilizar el mismo patrón de mocks que `actions-cuentas-bancarias.test.ts`.

### Files

- `src/features/contabilidad/__tests__/actions-tipos-pago.test.ts` (NUEVO)
- `src/features/contabilidad/__tests__/accounting-config-read-service.test.ts` (NUEVO)

### Estructura de tests

```typescript
// actions-tipos-pago.test.ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tipoPago: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    cuentaBancaria: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

// Test suite debe cubrir:
describe('getTiposPagoAction - tenant isolation', () => {
  it('debe retornar solo tipos de pago del tenant del usuario');
  it('debe incluir tenantId en el where de Prisma');
});

describe('getTipoPagoAction - tenant isolation', () => {
  it('debe retornar tipo de pago si pertenece al tenant');
  it('debe fallar con NOT_FOUND si el tipo pertenece a otro tenant');
  it('debe fallar con NOT_FOUND si no existe');
});

describe('createTipoPagoAction - tenant isolation', () => {
  it('debe crear con tenantId del usuario');
  it('debe validar nombre duplicado solo dentro del mismo tenant');
  it('debe permitir nombre duplicado si es de otro tenant');
  it('debe validar que cuentaDefecto pertenece al tenant');
  it('debe fallar si cuentaDefecto es de otro tenant');
});

describe('updateTipoPagoAction - tenant isolation', () => {
  it('debe actualizar si pertenece al tenant');
  it('debe fallar con NOT_FOUND si pertenece a otro tenant');
  it('debe validar cuentaDefecto contra el tenant');
});

describe('deleteTipoPagoAction - tenant isolation', () => {
  it('debe eliminar si pertenece al tenant');
  it('debe fallar con NOT_FOUND si pertenece a otro tenant');
});
```

### Acceptance criteria

RED: todos los tests fallan porque el código aún no filtra por tenantId.

---

## Task 4 — Implementar tenant isolation en actions-tipos-pago.ts

### Instructions

Aplicar `requireTenant(user)` y `scopedWhere(tenantId, ...)` en todas las Server Actions de `actions-tipos-pago.ts`:

- `getTiposPagoAction`:
  - Obtener `tenantId = requireTenant(user)`
  - Pasar `tenantId` al ReadService
  - ELIMINAR la ruta directa a `AccountingConfigReadService.getPaymentTypes()` → ahora debe aceptar tenantId

- `getTipoPagoAction`:
  - Agregar `const tenantId = requireTenant(user)`
  - Cambiar `findUnique` por `findFirst` con `where: { tipoId: id, tenantId }`
  - Mantener mismo error si no se encuentra

- `createTipoPagoAction`:
  - Agregar `const tenantId = requireTenant(user)`
  - Incluir `tenantId` en el `data` del `create`
  - Validar nombre duplicado con `where: { nombre: { equals: ... }, tenantId }`
  - Validar cuentaDefecto con `findFirst` incluyendo `tenantId`

- `updateTipoPagoAction`:
  - Agregar `const tenantId = requireTenant(user)`
  - Buscar existing con `where: { tipoId: id, tenantId }`
  - Validar cuentaDefecto contra tenant

- `deleteTipoPagoAction`:
  - Agregar `const tenantId = requireTenant(user)`
  - Buscar existing con `where: { tipoId: id, tenantId }` + `_count`
  - Eliminar con el mismo `tipoId` (no necesita tenantId porque ya verificamos acceso)

### Files

- `src/features/contabilidad/actions-tipos-pago.ts`

### Testing

GREEN phase: los tests de Task 3 deben pasar.

---

## Task 5 — Implementar tenant isolation en AccountingConfigReadService

### Instructions

1. Modificar `getPaymentTypes()` para aceptar `tenantId: string` como primer parámetro.
2. Modificar `getAvailableAccounts()` para aceptar `tenantId: string` como primer parámetro.
3. Actualizar firma y todas las queries para incluir filtro por tenantId.

```typescript
async getPaymentTypes(tenantId: string, filters: PaymentTypeFilters = {}) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.includeInactive !== true) where.isActive = true;
  if (filters.requiereCuenta !== undefined) where.requiereCuenta = filters.requiereCuenta;
  // ...
}

async getAvailableAccounts(tenantId: string, filters: AvailableAccountsFilters = {}) {
  const where: Record<string, unknown> = { isActive: true, tenantId };
  // ...
  // También filtrar estadísticas:
  const cuentasPorMoneda = await prisma.cuentaBancaria.groupBy({
    by: ['moneda'],
    where: { isActive: true, tenantId },
    _count: { cuentaId: true },
  });
  // ...
}
```

4. Actualizar `enrichPaymentTypes()` para recibir `tenantId` y validar cuentaDefecto contra el tenant.

### Files

- `src/features/contabilidad/services/accounting-config-read-service.ts`

### Testing

- Ejecutar tests del Task 3 actualizados para cubrir el ReadService.
- Verificar que `getAvailableAccounts()` filtra CuentaBancaria y estadísticas por tenant.

---

## Task 6 — Aislar endpoints mobile API

### Instructions

1. `src/app/api/mobile/v1/accounting/payment-types/route.ts`:
   - Extraer `tenantId` del `user` autenticado
   - Pasar `user.tenantId` a `AccountingConfigReadService.getPaymentTypes()`

2. `src/app/api/mobile/v1/accounting/payment-types/available-accounts/route.ts`:
   - Extraer `tenantId` del `user` autenticado
   - Pasar `user.tenantId` a `AccountingConfigReadService.getAvailableAccounts()`

### Files

- `src/app/api/mobile/v1/accounting/payment-types/route.ts`
- `src/app/api/mobile/v1/accounting/payment-types/available-accounts/route.ts`

### Testing

Actualizar tests existentes (`route.test.ts`) para verificar que se pasa `tenantId` al servicio.

---

## Task 7 — Migración final: Hacer tenantId NOT NULL

### Instructions

1. Después de ejecutar el backfill, crear segunda migración de Prisma que haga `tenantId` NOT NULL.
2. `npx prisma migrate dev --name make-tenant-id-required-tipo-pago`

Para entornos de producción:
1. Ejecutar backfill script.
2. Ejecutar `npx prisma migrate deploy`.

### Files

- `prisma/migrations/*/make-tenant-id-required-tipo-pago/migration.sql`

---

## Task 8 — Tests de integración multi-tenant (cross-tenant access)

### Instructions

Escribir tests de integración que simulen dos tenants y verifiquen que el aislamiento funciona end-to-end.

```typescript
describe('Cross-tenant access isolation', () => {
  const tenantA_user = { ...mockUser, tenantId: 'tenant-a' };
  const tenantB_user = { ...mockUser, userId: 'u2', tenantId: 'tenant-b' };
  const tipoPagoA = { tipoId: 'tp-a', nombre: 'Efectivo A', tenantId: 'tenant-a' };
  const tipoPagoB = { tipoId: 'tp-b', nombre: 'Efectivo B', tenantId: 'tenant-b' };

  // Escenarios que cubren acceso cruzado:
  // 1. Tenant A no ve el TipoPago de Tenant B
  // 2. Tenant A no puede actualizar TipoPago de Tenant B
  // 3. Tenant A no puede eliminar TipoPago de Tenant B
  // 4. Crear TipoPago con mismo nombre en ambos tenants es válido
  // 5. AvailableAccounts no muestra cuentas del otro tenant
  // 6. Estadísticas de AvailableAccounts solo incluyen cuentas del tenant
});
```

### Files

- `src/features/contabilidad/__tests__/actions-tipos-pago.test.ts` (ampliar suite)
- `src/features/contabilidad/__tests__/accounting-config-read-service.test.ts` (ampliar suite)

---

## Task 9 — Refactor y cleanup

### Instructions

1. Eliminar `cuentaBancaria.findUnique` en `enrichTiposPago()` y `enrichPaymentTypes()` → reemplazar con `findFirst` usando `cuentaId + tenantId`.
2. Verificar que no haya referencias no-tenantizadas a `TipoPago` en otros archivos.
3. Ejecutar type-check: `pnpm run typecheck` (si existe el script).
4. Ejecutar linter: `pnpm exec eslint src/features/contabilidad/ --fix`.

### Files

- `src/features/contabilidad/actions-tipos-pago.ts`
- `src/features/contabilidad/services/accounting-config-read-service.ts`

---

## Task Dependencies

```
Task 1 (Schema) ──→ Task 2 (Backfill) ──→ Task 7 (NOT NULL migration)
                    Task 1 ──→ Task 3 (Tests RED)
                                Task 3 ──→ Task 4 (Actions implementation)
                                Task 3 ──→ Task 5 (ReadService implementation)
                                Task 4 ──→ Task 6 (Mobile endpoints)
                                Task 5 ──→ Task 6
                    Task 6 ──→ Task 8 (Integration tests)
                    Task 8 ──→ Task 9 (Refactor)
```

Ordered execution: 1 → 2 → 3 → 4+5 (parallel) → 6 → 7 → 8 → 9

---

## Total Estimated Lines

~350-400 lines across all files (migration, backfill, actions, service, tests, routes).
