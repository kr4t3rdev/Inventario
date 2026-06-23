# SDD Spec: Empleados — desbloquear rutas en plan Básico

> **Stack**: Next.js 15, Server Actions, Prisma, Vitest
> **Mode**: Auto (no chaining required)
> **Test runner**: `pnpm test:run --config vitest.api.config.mjs <path>`

---

## Fix A — `/busy/empleados` no depende de `nomina`

### File: `src/app/busy/empleados/page.tsx`

**Current behavior** (BUG):
```typescript
export default async function EmpleadosPage() {
  const [empleadosResult, pagosResult] = await Promise.all([
    getEmpleadosAction(),
    getPagoSalariosAction(),  // ❌ requiere nomina, falla en Básico
  ])
  // ...
}
```

**Required behavior**:
La página principal de Empleados es agnóstica al feature `nomina`. Sólo
carga empleados. Los pagos viven en `/busy/empleados/nomina`.

```typescript
export default async function EmpleadosPage() {
  const result = await getEmpleadosAction()
  const initialEmpleados = result.success ? result.data ?? [] : []
  return <EmpleadosListContent initialEmpleados={initialEmpleados} />
}
```

### Acceptance

```typescript
// Given un usuario con plan Básico
// When navega a /busy/empleados
// Then la página renderiza con la lista de empleados
//   y NO llama a getPagoSalariosAction (verificable por spy)
// And no hay error FEATURE_NOT_AVAILABLE en consola
```

---

## Fix B — Mover "Historial de Pagos" a `/busy/empleados/nomina`

### File: `src/app/busy/empleados/nomina/page.tsx`

**Current behavior**:
La página de nómina sólo renderiza `<NominaClient />` después de pasar el
gate de `planFeatures.nomina`. No tiene acceso a la lista de empleados
porque el `NominaClient` la carga internamente.

**Required behavior**:
La página de nómina pasa a ser el "hub" de pagos + empleados para
planes con feature `nomina`. Carga ambos recursos y los entrega al
componente cliente.

```typescript
export default async function NominaPage() {
  const user = await getCurrentUser()
  if (user?.planFeatures?.['nomina'] !== true) {
    redirect("/busy/empleados")
  }
  const [empleadosResult, pagosResult] = await Promise.all([
    getEmpleadosAction(),
    getPagoSalariosAction(),
  ])
  return (
    <NominaEmpleadoSection
      initialEmpleados={empleadosResult.success ? empleadosResult.data ?? [] : []}
      initialPagos={pagosResult.success ? pagosResult.data ?? [] : []}
    />
  )
}
```

### File: `src/app/busy/empleados/nomina/nomina-client.tsx`

**Current behavior**:
Renderiza la UI de pagos pero NO incluye la lista de empleados ni el
CRUD. El usuario tenía que volver a `/busy/empleados` para editar un
empleado.

**Required behavior**:
Reemplazar el contenido del cliente para que sea la unión de la lista
de empleados + el historial de pagos (lo que hoy está en
`EmpleadosNominaContent`).

### Acceptance

```typescript
// Given un usuario con plan Empresarial
// When navega a /busy/empleados/nomina
// Then ve la lista de empleados Y el historial de pagos
//   Y puede registrar un pago de salario
// And el botón "Editar" navega a /busy/empleados/update/[id]
```

---

## Fix C — Renombrar /拆分 `EmpleadosNominaContent`

### Files
- `src/features/empleados/components/empleados-nomina-content.tsx`
- `src/features/empleados/components/empleados-list-content.tsx` (nuevo)
- `src/features/empleados/components/nomina-empleado-section.tsx` (nuevo)

**Current behavior**:
`EmpleadosNominaContent` mezcla lista de empleados + historial de
pagos + botón "Realizar Pago" en un solo componente de ~620 líneas.

**Required behavior**:

1. **`EmpleadosListContent`** (nuevo, ~250 líneas)
   - Recibe `initialEmpleados: Empleado[]`
   - Renderiza cards de empleados con botones "Editar" y "Eliminar"
   - Botón "Nuevo Empleado" → `/busy/empleados/new`
   - Si `user.planFeatures.nomina === true` → muestra link "Ver historial de pagos → /busy/empleados/nomina"
   - Si NO → oculta el link

2. **`NominaEmpleadoSection`** (nuevo, reemplaza al actual `nomina-client.tsx`)
   - Recibe `initialEmpleados: Empleado[]` e `initialPagos: Pagosalario[]`
   - Renderiza la lista de empleados (reutiliza sub-componente de cards)
   - Renderiza los tabs Historial Detallado / Resumen
   - Botón "Realizar Pago" en cada card
   - Mantiene el `AlertDialog` de eliminación y el `Dialog` de pago

3. **`EmpleadosNominaContent`** se elimina
   (o se mantiene como wrapper deprecado que re-exporta
   `NominaEmpleadoSection` durante 1 release).

### Acceptance

```typescript
// Given un usuario con plan Básico
// When renderiza EmpleadosListContent
// Then ve cards de empleados
//   Y NO ve botón "Realizar Pago"
//   Y NO ve tabs de historial
//   Y NO ve link a /busy/empleados/nomina (porque no tiene acceso)
// And puede hacer click en "Editar" / "Eliminar" / "Nuevo Empleado"
```

---

## Fix D — Backfill de licencias para tenants sin licencia activa

### New file: `scripts/backfill-empleados-licenses.ts`

**Logic** (idempotente, corre una vez):
1. Buscar el plan con menor precio (`orderBy: { precio: 'asc' }`) — el
   Básico. Si no existe, abortar con error claro.
2. Buscar tenants sin licencia activa:
   ```typescript
   const tenantsSinLicencia = await prisma.tenant.findMany({
     where: { licencias: { none: { activa: true } } },
     include: { memberships: { where: { isActive: true } } },
   })
   ```
3. Filtrar tenants que tengan al menos una `membership` activa (no
   queremos licenciar tenants fantasma).
4. Para cada uno, en una transacción:
   - Crear `TenantLicense` con `planId = defaultPlan.planId`
   - Setear `features = defaultPlan.features` (JSON)
   - `expiracion: now + 365 días`
   - `maxUsuarios`, `maxAlmacenes`, `maxProductos` del plan
5. Reporte final:
   ```
   ✅ 23 licencias creadas
   ⏭️ 0 tenants omitidos (sin memberships activas)
   ```

### Add to `package.json`:
```json
"backfill:empleados-licenses": "npx tsx scripts/backfill-empleados-licenses.ts"
```

### Acceptance

```typescript
// Given 23 tenants sin licencia activa
// When corro `pnpm backfill:empleados-licenses`
// Then los 23 tenants tienen una TenantLicense activa
//   y la cantidad de tenants sin licencia es 0
// And al volver a correr, no se crean licencias duplicadas (idempotente)
```

---

## Fix E — Tests del refactor

### File: `src/features/empleados/__tests__/actions.test.ts` (extender)

Agregar test que cubre el caso específico del bug:

```typescript
it('getEmpleadosAction funciona en plan Básico (empleados:true, nomina:false)', async () => {
  const basicPlanUser: AuthenticatedUser = {
    ...mockUser,
    role: 'user',
    tenantRole: 'manager',
    planFeatures: {
      empleados: true,
      nomina: false,
      asistencia: false,
      vacaciones: false,
    },
  };
  vi.mocked(getCurrentUser).mockResolvedValue(basicPlanUser);
  vi.mocked(prisma.empleado.findMany).mockResolvedValue([
    { empleadoId: 'emp-1', nombre: 'Juan' } as any,
  ]);
  const result = await getEmpleadosAction();
  expect(result.success).toBe(true);
  expect(result.data).toHaveLength(1);
  // Y NO debe lanzar FEATURE_NOT_AVAILABLE
});

it('getPagoSalariosAction rechaza en plan Básico', async () => {
  const basicPlanUser: AuthenticatedUser = {
    ...mockUser,
    role: 'user',
    tenantRole: 'manager',
    planFeatures: { empleados: true, nomina: false },
  };
  vi.mocked(getCurrentUser).mockResolvedValue(basicPlanUser);
  const result = await getPagoSalariosAction();
  expect(result.success).toBe(false);
  expect(result.error!.code).toBe('FEATURE_NOT_AVAILABLE');
});
```

### File: nuevo `src/app/busy/empleados/__tests__/page.test.tsx` (recomendado)

Verificar que el Server Component de la página NO llama
`getPagoSalariosAction` (sólo `getEmpleadosAction`).

### Acceptance

```typescript
// Given los tests
// When corro `pnpm test:run --config vitest.api.config.mjs src/features/empleados/`
// Then todos los tests pasan, incluyendo los 2 nuevos
```

---

## Dependency Graph

```
Fix A (page.tsx) ──┬── Fix C (split componentes) ── Fix E (tests)
                   │
Fix B (nomina page) ┘

Fix D (backfill)  ── independiente, puede correr antes o después

Fix E (tests)     ── depende de A, B, C
```

## Order of Implementation

| Order | Fix | Risk | Por qué en este orden |
|-------|-----|------|---------------------|
| 1 | D (backfill) | 🟢 | Independiente. Crea licencias faltantes. Se puede correr y verificar antes de tocar código. |
| 2 | A (page.tsx) | 🟡 | Saca la dependencia de `nomina` del main page. |
| 3 | B (nomina page) | 🟡 | Mueve la carga de pagos a su subruta natural. |
| 4 | C (split componentes) | 🟡 | Refactor de los 2 componentes cliente. |
| 5 | E (tests) | 🟢 | Cubre el comportamiento esperado. |

> **Recomendación**: Correr Fix D en producción ANTES de mergear el
> código, para que los 23 tenants tengan licencia y el sidebar + acciones
> se comporten consistente apenas se despliegue el refactor.
