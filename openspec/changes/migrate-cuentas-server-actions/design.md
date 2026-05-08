# Design: Migrar Cuentas por Pagar/Cobrar a Server Actions

## Technical Approach

Migrar CxC y CxP de RTK Query + API routes a Server Actions usando el patrón `withAction()` ya establecido en el proyecto. Al mismo tiempo, corregir bugs críticos (tenant isolation, paginación server-side, PK consistency en schemas). La migración sigue el patrón usado en ventas, productos y otras features ya migradas.

La estrategia es:
1. **Crear Server Actions nuevas** con `withAction()` + Zod schemas
2. **Migrar pages** a Server Components / hybrid (data fetch en server, interactividad en client)
3. **Eliminar componente muerto** (`PagarCuentaPorPagarDialog`)
4. **Preservar handlers API** como thin wrappers (compatibilidad)

## Architecture Decisions

### Decision: Server Actions con paginación server-side para CxP

**Choice**: Implementar paginación, búsqueda y filtros en la SA `getCuentasPorPagarAction` usando Prisma `where` + `skip`/`take`
**Alternatives considered**: 
- (a) Traer todo y filtrar client-side (estado actual) — no escala
- (b) Mantener API route con paginación — va contra la migración Server-First
**Rationale**: La SA permite usar Prisma directo con `requireTenant()`, eliminar el waterfall HTTP, y mantener la misma interfaz de paginación que la page actual espera (`{ cuentas, pagination }`).

### Decision: CxC como Server Component parcial con Client Component para interactividad

**Choice**: La page de CxC será un Server Component que hace el fetch inicial y pasa data como props al `CuentasPorCobrarTable` (Client Component). Estado de filtros y paginación via `useActionState` + `startTransition`.
**Alternatives considered**:
- (a) Todo Server Component sin interactividad — pierdes filtros en tiempo real
- (b) SWR/React Query client-side — no elimina la capa HTTP
**Rationale**: El patrón hybrid (Server para data, Client para UI interactiva) es el estándar de Next.js 15+ y ya se usa en otras features migradas.

### Decision: Eliminar `PagarCuentaPorPagarDialog` 

**Choice**: Borrar el componente completamente
**Alternatives considered**: (a) Mantenerlo como alternativa — confusión, duplicación
**Rationale**: La page de CxP ya usa `ReconciliacionGastosForm` directamente. El dialog es código muerto que confunde a los desarrolladores.

### Decision: Preservar handlers API como thin wrappers

**Choice**: Los handlers actuales en `handlers.ts` se mantienen pero delegan internamente a funciones compartidas que las Server Actions también usan
**Alternatives considered**: (a) Borrar handlers inmediatamente — rompe compatibilidad
**Rationale**: Las routes API se mantienen activas durante la transición. No hay prisa por borrarlas mientras los clientes aún puedan usarlas.

### Decision: No cambiar PKs de Prisma (por ahora)

**Choice**: Dejar `id` en CxC y `cuentaPorPagarId` en CxP como están
**Alternatives considered**: (a) Migrar CxC.id a CxC.cuentaPorCobrarId — requiere migración BD, riesgo alto
**Rationale**: Requiere una migración de BD con rename de columna + foreign keys. Es deuda técnica que se puede abordar en otro change cuando haya un buen momento (ej. antes de un deploy grande). No bloquea la migración a Server Actions.

## Data Flow

```
                      SERVER                                CLIENT
                      ───────                              ──────

getCuentasPorPagarAction()                    CuentasPorPagarPage (Server Component)
  ├─ requireTenant(user)                                │
  ├─ prisma.cuentaPorPagar.findMany({                  │
  │    where: { tenantId, ...filtros },                 │
  │    skip, take, include: [...]                       │
  │  })                                                 │
  └─ { cuentas, pagination }                            │
                                                        └──► CuentasPorPagarClient (Client Component)
                                                                  ├─ Muestra tabla + filtros
                                                                  ├─ Pagar → pagarCuentaPorPagarAction()
                                                                  └─ Re-fetch → startTransition(getCxPAction)

pagarCuentaPorPagarAction()                    ReconciliacionGastosForm (Client Component)
  ├─ requireTenant(user)                                │
  ├─ validate with Zod                                 │
  ├─ applyPagoGastoWorkflow(tx, input)                 │
  ├─ revalidatePath('/busy/contabilidad/cuentas-por-pagar')
  └─ { cuenta, pago }                                   └──► onSuccess → refetch data
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/contabilidad/actions/cuentas-por-pagar.ts` | Create | Server Actions para CxP: getCxP, createCxP, pagarCxP |
| `src/features/contabilidad/actions/cuentas-por-cobrar.ts` | Create | Server Actions para CxC: getCxC, createCxC, updateCxC |
| `src/features/contabilidad/actions/schemas.ts` | Create | Zod schemas para validación de inputs |
| `src/features/contabilidad/index.ts` | Modify | Agregar exports de nuevas actions |
| `src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx` | Modify | Convertir a hybrid: Server Component + Client |
| `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx` | Modify | Convertir a hybrid: Server Component + Client |
| `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx` | Modify | Recibir data por props, eliminar RTK Query |
| `src/features/contabilidad/components/pagar-cuenta-por-pagar-dialog.tsx` | Delete | Componente muerto |
| `src/lib/redux/services/cuentasPorCobrarApi.tsx` | Modify | Agregar `@deprecated` en exports |
| `src/lib/redux/services/cuentasPorPagarApi.tsx` | Modify | Agregar `@deprecated` en exports |
| `src/features/contabilidad/api/__tests__/cuentas-por-cobrar.test.ts` | Modify | Actualizar para testear SA |
| `src/features/contabilidad/api/__tests__/cuentas-por-pagar-pagar.test.ts` | Modify | Actualizar para testear SA |
| `src/features/contabilidad/api/__tests__/cuentas-por-cobrar-id.test.ts` | Modify | Actualizar para testear SA |

## Interfaces / Contracts

### Zod Schemas

```typescript
// src/features/contabilidad/actions/schemas.ts

export const getCuentasPorCobrarSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  clienteId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const getCuentasPorPagarSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  tipo: z.enum(['compra', 'servicio']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

export const pagarCuentaPorPagarSchema = z.object({
  numeroFactura: z.string().min(1),
  tipo: z.enum(['compra', 'servicio']),
  monto: z.number().positive('El monto debe ser mayor que 0'),
  numeroTransaccion: z.string().min(1),
  cuentaProveedor: z.string().min(1),
  observaciones: z.string().optional(),
});
```

### Server Action Return Types

```typescript
// Cuentas por Pagar
interface GetCuentasPorPagarResult {
  cuentas: CuentaPorPagar[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface PagarCuentaPorPagarResult {
  cuenta: CuentaPorPagar;
  pago: PagoCuentaPorPagar;
}

// Cuentas por Cobrar
interface GetCuentasPorCobrarResult {
  cuentas: CuentaPorCobrarConCalculo[];
}

interface CuentaPorCobrarConCalculo extends CuentaPorCobrar {
  totalFactura?: number;
  totalPagadoFactura?: number;
  saldoFactura?: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod schemas validation | Vitest: validar inputs válidos e inválidos |
| Unit | Server Actions (getCxC, getCxP, pagarCxP) | Vitest: mock prisma, verificar tenant isolation, paginación, filtros |
| Unit | pagarCuentaPorPagarAction con workflow | Vitest: mock `applyPagoGastoWorkflow`, verificar transacción |
| Integration | Tenant isolation | Verificar que `requireTenant()` filtra correctamente |
| Component | CxC Table con props | Testing Library: renderizar con data, verificar filtros client-side |
| Component | CxP Page con Server Actions | Testing Library: verificar que usa SA y no RTK Query |

## Migration / Rollout

No se requiere migración de base de datos. Los cambios son exclusivamente en la capa de transporte (API → Server Actions) y en componentes React.

**Fases de rollout:**
1. Crear Server Actions (sin tocar nada existente)
2. Migrar pages a usar Server Actions
3. Agregar `@deprecated` en RTK Query hooks
4. Eliminar componente muerto `PagarCuentaPorPagarDialog`
5. Verificar tests

## Open Questions

- [ ] ¿Deberíamos renombrar `CuentaPorCobrar.id` a `CuentaPorCobrar.cuentaPorCobrarId` en una future migration? (Decidido: NO en este change, es deuda técnica)
- [ ] ¿La page de CxP debería ser Server Component puro (sin interactividad) o hybrid como se diseñó? (Decidido: hybrid — filtros y paginación son interactivos)