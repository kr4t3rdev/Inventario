# Design: GastosDE Hardening — update, orden, cobertura y limpieza

## Technical Approach

Tres cambios mínimos, localizados y verificables:

1. `actions.ts`: cambiar el `orderBy` del listado y ampliar la whitelist de campos que `updateGastosDEAction` persiste. Reutilizar la misma validación concepto↔elemento que ya existe en `createGastosDEAction`.
2. `GastoDEForm.tsx`: remover el literal `CCZXXZ` y reformular la condición de visibilidad del resumen visual.
3. `actions.test.ts`: ampliar cobertura siguiendo TDD strict (RED → GREEN → REFACTOR por escenario).

Patrones del proyecto a respetar:
- `withAction` wrapper para server actions (de `src/lib/server-actions`).
- `requireTenant(user)` para tenant scoping.
- Mocks de Prisma en tests usando `vi.mock('@/lib/prisma', ...)` (igual que el test actual).
- Server actions retornan `{ success, data?, error? }`.

## Architecture Decisions

### Decision 1: orderBy por `createdAt: 'desc'`

**Choice**: Cambiar `orderBy: { monto: 'desc' }` → `orderBy: { createdAt: 'desc' }`.

**Alternatives considered**:
- `orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }]` (orden por período contable).
- `orderBy: { updatedAt: 'desc' }` (última modificación primero).

**Rationale**: La spec documenta "date descending (newest first)". El campo `createdAt` es el más estable y cercano a la intención literal de la spec. `periodo` agrega complejidad y semántica de negocio que no está en el contrato. `updatedAt` cambia con cada edit y haría "brincar" registros al editarlos.

### Decision 2: Update con whitelist explícita de campos

**Choice**: Reemplazar el `data: { ...(data.proveedor!==undefined&&{...}) }` por una construcción explícita de la whitelist. Cada campo se incluye solo si está definido en el payload.

**Alternatives considered**:
- `prisma.gastosDE.update({ data })` con `data` directamente (peligroso, permite sobreescribir `tenantId` o `gastosDEId`).
- `Object.fromEntries(Object.entries(data).filter(...))` (más conciso pero esconde la whitelist).

**Rationale**: La whitelist explícita es legible, auditable y previene que un payload malicioso sobreescriba campos sensibles como `tenantId`. Es el mismo patrón que ya usa el código actual, solo ampliado.

### Decision 3: Validación concepto↔elemento en update replicando la de create

**Choice**: Antes de aplicar el `update`, si el payload trae `conceptoId` y `elementoId`, verificar con `prisma.gastoElemento.findFirst({ where: { elementoId, conceptoId } })`. Si no existe, lanzar `ActionError('El elemento no pertenece al concepto', 'VALIDATION_ERROR')`.

**Alternatives considered**:
- Confiar en la FK constraint del schema.
- Hacer la validación solo en el form, no en server.

**Rationale**: La FK constraint no existe explícitamente para `elementoId` (el campo es opcional en `GastosDE`). Y validar solo en el form deja al server action expuesto a payloads arbitrarios. Replicar la validación es defensivo y consistente con `create`.

### Decision 4: Condición de visibilidad del resumen = `monto && (tipo || conceptoId || elementoId)`

**Choice**: Cambiar `{watchedValues.tipo && watchedValues.monto && (...)}` por `{watchedValues.monto && (watchedValues.tipo || watchedValues.conceptoId || watchedValues.elementoId) && (...)}`.

**Alternatives considered**:
- Mostrar el resumen siempre que haya `monto` (más simple pero muestra resumen con identificador vacío).
- Mover la lógica al server action y derivar un `displayLabel` (refactor más invasivo).

**Rationale**: La condición nueva refleja la intención real del modelo: un gasto se identifica por `tipo` (texto libre) o por el par `concepto+elemento`. Mostrar el resumen solo con `monto` mostraría una pantalla vacía con solo el monto — feo. Mantener la lógica en el form evita un cambio arquitectural.

### Decision 5: Test approach = mocks de Prisma

**Choice**: Extender el mock actual de `@/lib/prisma` con los métodos adicionales necesarios (`gastosDE.update`, `gastosDE.findFirst` para update y delete, ya están; falta asegurar que `gastosDE.update` está mockeado).

**Alternatives considered**:
- Test de integración con SQLite en memoria (más realista, más lento, requiere setup de Prisma en test).
- Tests e2e con Playwright (más lentos, fuera de scope).

**Rationale**: Mantiene el patrón actual del proyecto. El comportamiento que se valida es la lógica del action, no la persistencia real — los mocks son suficientes. La spec es a nivel de acción, no a nivel de DB.

## Data Flow

### Listar gastos (sin cambios estructurales)

```
Page server component
    └─→ getGastosDEAction({})
            ├─→ requireTenant(user)            # auth + scope
            ├─→ build where clause              # filtros opcionales
            └─→ prisma.gastosDE.findMany({ where, include, orderBy: { createdAt: 'desc' } })
```

### Editar gasto (cambio principal)

```
GastoDEForm.onSubmit
    └─→ updateGastosDEAction({ gastosDEId, ...formData })
            ├─→ gastosDEUpdateSchema.parse(input)
            ├─→ requireTenant(user)
            ├─→ prisma.gastosDE.findFirst({ where: { gastosDEId, tenantId } })   # tenant check
            │     └─ NOT_FOUND si cross-tenant
            ├─→ [NEW] if (conceptoId && elementoId)
            │     └─→ prisma.gastoElemento.findFirst({ where: { elementoId, conceptoId } })
            │           └─ VALIDATION_ERROR si no pertenece
            ├─→ build whitelist data
            │     {
            │       ...(tipo !== undefined && { tipo }),
            │       ...(conceptoId !== undefined && { conceptoId }),
            │       ...(elementoId !== undefined && { elementoId }),
            │       ...(periodo !== undefined && { periodo }),
            │       ...(proveedor !== undefined && { proveedor }),
            │       ...(monto !== undefined && { monto }),
            │       ...(descripcion !== undefined && { descripcion }),
            │       ...(numeroFactura !== undefined && { numeroFactura }),
            │     }
            └─→ prisma.gastosDE.update({ where: { gastosDEId }, data })
            └─→ revalidatePath('/busy/gastosDE')
```

### Eliminar gasto (con tenant check)

```
deleteGastosDEAction(id)
    ├─→ requireTenant(user)
    ├─→ prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId } })
    │     └─ NOT_FOUND si cross-tenant
    └─→ prisma.gastosDE.delete({ where: { gastosDEId: id } })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/gastosDE/actions.ts` | Modify | Línea 20: `orderBy`. Líneas 49-58: ampliar whitelist + validación concepto↔elemento. |
| `src/features/gastosDE/components/GastoDEForm.tsx` | Modify | Línea 115: eliminar `CCZXXZ`. Línea 175: reformular condición del resumen. |
| `src/features/gastosDE/__tests__/actions.test.ts` | Modify | Agregar mocks de `prisma.gastosDE.update`, `prisma.gastoElemento.findFirst` (ya hay `gastoElemento`). Ampliar la suite a ≥10 tests cubriendo: orden, tenant scope, update completo, validación concepto↔elemento. |

## Interfaces / Contracts

No hay cambios de tipos exportados. Las firmas de las server actions no cambian. El contrato Zod de `gastosDEUpdateSchema` ya incluye `tipo`, `conceptoId`, `elementoId`, `periodo` como opcionales — solo hay que empezar a persistirlos.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getGastosDEAction` orden por createdAt desc | Mock `prisma.gastosDE.findMany`, assert que el argumento del mock trae `orderBy: { createdAt: 'desc' }` |
| Unit | `getGastosDEAction` tenant scope | Mock `prisma.gastosDE.findMany`, assert que el `where` incluye `tenantId` del usuario |
| Unit | `updateGastosDEAction` persiste `tipo` | Mock `findFirst` → existing, `update` → returns. Submit con `tipo`. Assert `data.tipo` en la llamada a `update` |
| Unit | `updateGastosDEAction` persiste `conceptoId` | Ídem, assert `data.conceptoId` |
| Unit | `updateGastosDEAction` persiste `elementoId` | Ídem |
| Unit | `updateGastosDEAction` persiste `periodo` | Ídem |
| Unit | `updateGastosDEAction` rechaza concepto↔elemento inválido | Mock `gastoElemento.findFirst` → null. Submit con ambos. Assert `success === false`, código `VALIDATION_ERROR`, y que `update` NO se llamó |
| Unit | `updateGastosDEAction` cross-tenant → NOT_FOUND | Mock `findFirst` → null. Submit. Assert `success === false`, código `NOT_FOUND` |
| Unit | `updateGastosDEAction` partial update preserva otros campos | Submit solo con `monto`. Mock `findFirst` → existing con varios campos. Assert `data` solo trae `monto`, los demás no se tocan |
| Unit | `deleteGastosDEAction` cross-tenant → NOT_FOUND | Mock `findFirst` → null. Assert `success === false`, código `NOT_FOUND`, `delete` no se llamó |
| (Smoke) | `GastoDEForm.tsx` no contiene `CCZXXZ` | `grep -n 'CCZXXZ' src/features/gastosDE/components/GastoDEForm.tsx` retorna 0 |

Cada test se escribe **antes** de la implementación (RED), se corre y se verifica que falla por la razón correcta, después se hace el cambio mínimo para que pase (GREEN), después refactor si aplica.

## Migration / Rollout

No requiere migración. Los cambios son:
- Comportamiento del listado: cambia el orden visible, no la forma de los datos.
- Comportamiento del update: ahora persiste más campos, no rompe registros existentes.
- UI: aparece un card de resumen en más casos, no desaparece nada.

Si en producción hay UI o consumidores que dependan del orden por monto, ese consumidor estaba acoplado a un bug. La spec es la fuente de verdad y pide fecha desc.

## Open Questions

Ninguna. Las 3 decisiones de riesgo se consultaron al usuario antes de empezar:
- Schema `monto` Int → Decimal: **fuera de scope**.
- Cobertura: solo unit tests de actions.
- Backfill: no, solo arreglar el bug.
