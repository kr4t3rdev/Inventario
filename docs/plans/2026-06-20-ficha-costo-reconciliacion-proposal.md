# Propuesta: Reconciliación historial ↔ compras reales (Ficha de Costo)

**Change**: `ficha-costo-reconciliacion-historial`
**Fecha**: 2026-06-20
**Basado en**: `docs/plans/2026-06-18-ficha-de-costo-propose.md` (módulo base ya implementado, 56 tests pasando)

---

## Intent

El historial de compras de `getHistorialCostosAction` (`src/features/ficha-costo/actions-historial.ts`) hoy muestra líneas de compra pero **NO** revela la relación entre cada línea y el cálculo del CPP ni agrega inteligencia por proveedor. El usuario ve una lista plana y debe reconstruir mentalmente qué compras entraron en la ventana de 12 meses, cuánto se les imputó como gasto proporcional, o qué proveedor pesa más en el costo. Esto rompe la confianza en el CPP porque el número mostrado no se puede auditar línea por línea.

**Problema concreto**: en la vista actual, si un usuario ve "CPP = 5.43 CUP" y pregunta "¿por qué?", no tiene cómo responder. Tampoco detecta errores obvios como "ninguna compra entró en la ventana" o "el 80% del costo viene de un solo proveedor".

**Solución propuesta**: enriquecer el historial para que cada línea declare su rol en el CPP, agregar un resumen agrupado por proveedor y un banner de estado del cálculo. Sin nuevos modelos, reusando `calcularCostoSimpleInterno` y la normalización de moneda existentes.

---

## Scope

### In Scope

- **Calculador puro nuevo** en `src/features/ficha-costo/lib/cost-reconciler.ts` que, dada una lista de items + gastos + ventana de meses, devuelve por cada item: `enVentanaCPP`, `gastoProporcional`, `participacionEnVentana`. Y un `resumenPorProveedor[]` con cantidad, monto total, % participación y precio promedio.
- **Server Action nueva** `getHistorialReconciliadoAction` en `src/features/ficha-costo/actions-reconciliacion.ts` que consulta `CompraDocumentoItem` + `GastoCompra` (mismo set de datos que el historial actual, ya filtrando `deletedAt: null`) y aplica el calculador puro. Retorna items reconciliados + resumen por proveedor + estado del CPP.
- **`getHistorialCostosAction` intacto**: la firma y el retorno no cambian. No se rompe ningún consumer existente.
- **UI**: el componente `historial-costos.tsx` se actualiza para:
  - Mostrar badge "Incluida en CPP" / "Fuera de ventana" por fila.
  - Mostrar columna "Gasto proporcional" (ocultable si no hay `GastoCompra` asociado).
  - Renderizar una sección "Resumen por proveedor" (cards o tabla) sobre la lista.
  - Mostrar un banner con estado del CPP: `CALCULADO` / `SIN_DATOS` / `CON_ADVERTENCIAS` (reusar `advertencias[]` que ya devuelve el calculador).
- **Tests TDD strict** (RED→GREEN→REFACTOR):
  - Unit tests del calculador puro (casos: ventana, gastos, resumen por proveedor, advertencias).
  - Integration tests de la nueva Server Action (multi-tenant, producto inexistente, filtros).
  - Component tests de `historial-costos.tsx` (render con/sin ventana, con/sin advertencias, render del resumen).

### Out of Scope

- Persistir la reconciliación como snapshot o modelo nuevo (`ProductoCostSnapshot`, etc.). Es on-demand, igual que el resto del módulo.
- Modificar la firma de `getHistorialCostosAction` o de `getFichaCostoAction`. Esta propuesta **no** las toca.
- Re-correr la lógica de composición (productos compuestos) — la reconciliación se aplica solo al CPP de productos simples. Productos compuestos ya tienen su propio flujo en `calcularCostoCompuestoServer`.
- Cambios al schema Prisma.
- Nuevas dependencias npm.
- Filtros adicionales en el resumen por proveedor (rango de fechas, moneda). Se reutilizan los filtros existentes de `getHistorialCostosAction` como base, pero el resumen cubre el set completo de la ventana de CPP (no la página actual).
- Internacionalización de los textos del banner/badge (se mantienen en español como el resto del módulo).

---

## Approach

**Arquitectura**: misma vista calculada on-demand del módulo base. Se agrega una capa pura nueva (`cost-reconciler.ts`) que el action wrapper llama. La UI consume la nueva action y mantiene el resto de tabs intactas.

**Punto crítico de diseño**: `calcularCostoSimpleInterno` (`src/features/ficha-costo/lib/cost-calc-server.ts:35-132`) ya calcula `gastoProp` por línea pero lo descarta después del cálculo del promedio. **No refactorizamos esa función**: en lugar de eso, extraemos su lógica de "gasto proporcional por línea + agrupado por proveedor" a una función pura nueva que **comparte** el patrón de cálculo pero opera sobre un set de datos ya materializado. `calcularCostoSimpleInterno` sigue calculando el CPP como hoy; `cost-reconciler` arma la vista por línea y por proveedor.

```
src/features/ficha-costo/
├── actions-reconciliacion.ts          # Nuevo: getHistorialReconciliadoAction
├── lib/
│   ├── cost-calculator.ts             # (sin cambios)
│   ├── cost-calc-server.ts            # (sin cambios)
│   └── cost-reconciler.ts             # Nuevo: funciones puras
├── components/
│   └── historial-costos.tsx           # Modificado: badges, columna, resumen, banner
├── types.ts                           # Modificado: nuevos tipos HistorialReconciliado*
└── __tests__/
    ├── cost-reconciler.test.ts        # Nuevo
    ├── actions-reconciliacion.test.ts # Nuevo
    └── historial-costos.test.tsx      # Nuevo (o extendido si ya cubre UI)
```

**Firma del calculador puro** (pseudocódigo, no implementar todavía):

```typescript
// cost-reconciler.ts
export interface ItemCompra {
  compraDocumentoItemId: string
  fecha: Date
  proveedorId: string
  proveedorNombre: string
  numeroFactura: string
  cantidad: number
  precioUnitario: number
  totalLinea: number
  gastoCompraId: string | null
}

export interface ItemReconciliado extends ItemCompra {
  enVentanaCPP: boolean
  gastoProporcional: number
  participacionEnVentana: number  // % del total de la ventana
}

export interface ResumenProveedor {
  proveedorId: string
  proveedorNombre: string
  cantidadTotal: number
  montoTotal: number
  precioPromedio: number
  participacionPorcentaje: number
}

export interface ResultadoReconciliacion {
  items: ItemReconciliado[]
  resumenPorProveedor: ResumenProveedor[]
  ventana: { desde: Date; hasta: Date; meses: number }
  totalCantidadEnVentana: number
  totalMontoEnVentana: number
  advertencias: string[]
}

export function reconciliarHistorial(
  items: ItemCompra[],
  gastos: Map<string, { total: number; cantidad: number }>,
  ventanaMeses: number,
  fechaReferencia?: Date,
): ResultadoReconciliacion
```

**Flujo de la Server Action**:

1. `requireTenant(user)` + `requireFeature(user, 'productos', ...)` (igual que `getHistorialCostosAction`).
2. Verificar producto (`prisma.producto.findFirst` con `tenantId`).
3. Calcular `hace12Meses = new Date(); setMonth(month - 12)`.
4. Query única: `prisma.compraDocumentoItem.findMany` con `productoId`, `tenantId`, `compraDocumento.deletedAt: null`, `select` ampliado para incluir `proveedorId` y `gastoCompraId` en `compraDocumento`.
5. Query de gastos: `prisma.gastoCompra.findMany` para los `gastoCompraId` distintos (mismo patrón que `calcularCostoSimpleInterno`).
6. Llamar a `reconciliarHistorial(items, gastosMap, 12)`.
7. Retornar `{ items, resumenPorProveedor, estadoCPP, ventana }`.

**Estado del CPP** (computado en el action, no en el calculador puro):

- `CALCULADO`: hay al menos 1 compra en la ventana y `advertencias.length === 0`.
- `CON_ADVERTENCIAS`: hay compras en ventana pero `advertencias.length > 0` (tasa aproximada, gastos parciales, etc.).
- `SIN_DATOS`: ninguna compra cae en la ventana. El banner sugiere ampliar el rango o revisar el registro de compras.

**UI (cambios en `historial-costos.tsx`)**:

- Reemplazar la llamada a `getHistorialCostosAction` por `getHistorialReconciliadoAction` (mantener los mismos filtros/paginación para que la tabla no cambie de forma).
- Banner arriba de la tabla con el `estadoCPP` + lista de advertencias colapsable.
- Sección "Resumen por proveedor" entre el banner y la tabla: cards en mobile, tabla compacta en desktop, con `% participación` formateado a 1 decimal.
- Badge en cada fila: verde "Incluida en CPP" si `enVentanaCPP`, gris "Fuera de ventana" si no.
- Columna "Gasto prop.": muestra `gastoProporcional` formateado a 2 decimales; si `gastoCompraId === null`, se oculta.
- Tooltip explicando el cálculo al pasar el mouse sobre el badge o sobre "Gasto prop.".

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/ficha-costo/lib/cost-reconciler.ts` | **New** | Calculador puro (sin imports de Prisma). |
| `src/features/ficha-costo/actions-reconciliacion.ts` | **New** | `getHistorialReconciliadoAction` con `withAction` + `requireTenant`. |
| `src/features/ficha-costo/components/historial-costos.tsx` | **Modified** | Badges, columna, banner, sección de resumen. |
| `src/features/ficha-costo/types.ts` | **Modified** | `ItemReconciliado`, `ResumenProveedor`, `HistorialReconciliadoData`, `EstadoCPP`. |
| `src/features/ficha-costo/__tests__/cost-reconciler.test.ts` | **New** | Tests del calculador puro. |
| `src/features/ficha-costo/__tests__/actions-reconciliacion.test.ts` | **New** | Tests de la Server Action (multi-tenant, errores). |
| `src/features/ficha-costo/__tests__/historial-costos.test.tsx` | **New / Extended** | Tests del componente. |
| `src/features/ficha-costo/actions.ts` | **None** | `getHistorialCostosAction` se mantiene sin cambios. |
| `src/features/ficha-costo/actions-historial.ts` | **None** | No se toca. Otros consumers siguen funcionando. |
| `src/features/ficha-costo/lib/cost-calc-server.ts` | **None** | `calcularCostoSimpleInterno` no se modifica. |
| `src/features/ficha-costo/lib/cost-calculator.ts` | **None** | Funciones puras intactas. |
| `prisma/schema.prisma` | **None** | 0 nuevos modelos. |
| `package.json` | **None** | 0 nuevas dependencias. |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Doble query a `CompraDocumentoItem` (historial actual + reconciliación) si la UI termina llamando a ambos | Medium | `getHistorialCostosAction` queda como legacy/back-compat; la UI migra a la nueva action. Documentar en el spec que la nueva action **reemplaza** la anterior para la ficha. |
| `gastoProporcional` por línea con valores raros cuando hay 1 sola compra en la ventana (gasto total asignado a 1 línea) | Medium | Tests explícitos del caso edge en `cost-reconciler.test.ts`. La UI no hace asserts sobre el valor, solo lo muestra. |
| El resumen por proveedor se desactualiza al paginar (la página actual muestra 20 items pero el resumen cubre el set completo) | Low | El resumen se calcula del set completo (no de la página). Documentar en el spec y mostrar en UI un texto "Resumen sobre {N} compras en ventana" para que el usuario entienda la diferencia. |
| `setMonth` con meses negativos rompe el cálculo de ventana cuando la fecha actual es enero | Low | Mismo bug latente en `calcularCostoSimpleInterno` — no se introduce nuevo, se hereda el patrón. Considerar PR futuro de fix. |
| Tests flaky por mocks de Prisma con `select` complejos | Low | Reusar el patrón de mock de `actions.test.ts` y `historial.test.ts` existentes. Mocks por spy en `prisma.compraDocumentoItem.findMany`. |
| Performance con +1000 items en historial | Low | La query ya está paginada en `getHistorialCostosAction`; la nueva action respeta la misma paginación. El resumen se calcula sobre la página actual, no sobre el set completo (verificar si es deseable o si conviene calcular sobre la ventana completa — decisión en spec). |
| Cambio de UI rompe tests visuales existentes (snapshot tests, etc.) | Low | No hay snapshot tests del módulo (verificado: solo `ficha-costo-view.test.tsx` y `historial.test.ts` son unitarios, no visuales). TDD: actualizar tests de UI **antes** de cambiar la implementación. |

---

## Rollback Plan

Cambio **100% aditivo**:
- 1 archivo nuevo de lógica pura (`cost-reconciler.ts`).
- 1 archivo nuevo de Server Action (`actions-reconciliacion.ts`).
- 1 archivo nuevo o extendido de tests.
- 1 archivo de UI modificado (`historial-costos.tsx`) — el cambio es contenido y reversible.

**Rollback**:
1. Revertir el commit que introduce el calculador puro y la nueva action.
2. Revertir el commit que modifica `historial-costos.tsx`.
3. La UI vuelve a llamar a `getHistorialCostosAction` y muestra el comportamiento previo.

**No hay** migración de datos, cambios de schema ni efectos sobre otras features. Cero riesgo de regresión en otros módulos.

---

## Success Criteria

- [ ] `reconciliarHistorial` (función pura) tiene ≥8 tests unitarios cubriendo: ventana inclusiva, ventana exclusiva, gastos proporcionales, sin gastos, un solo proveedor, múltiples proveedores, advertencias por tasa aproximada, edge case de gasto con cantidad 0.
- [ ] `getHistorialReconciliadoAction` rechaza productos de otro tenant (test de integración).
- [ ] `getHistorialReconciliadoAction` retorna `ActionError` `NOT_FOUND` si el producto no existe.
- [ ] La UI muestra badge "Incluida en CPP" para items dentro de la ventana y "Fuera de ventana" para los que no.
- [ ] La UI muestra la sección "Resumen por proveedor" con cantidad, monto, precio promedio y % participación para cada proveedor.
- [ ] El banner de estado CPP muestra `CALCULADO` / `CON_ADVERTENCIAS` / `SIN_DATOS` según corresponda, y lista las advertencias en un bloque colapsable.
- [ ] `getHistorialCostosAction` sigue funcionando sin cambios y sus tests existentes siguen pasando.
- [ ] Todos los tests existentes (56) + los nuevos pasan: `pnpm run test:run`.
- [ ] Lint y typecheck pasan: `pnpm run lint` y `pnpm run typecheck`.
- [ ] Multi-tenant: un usuario del tenant A no puede ver items de productos del tenant B ni siquiera si conoce el `productoId`.
- [ ] El cálculo de `gastoProporcional` por línea es numéricamente estable: la suma de gastos proporcionales sobre la ventana es ≤ 0.01 del `gastoTotal` original (test de invariante).

---

## Notes

- Esta propuesta es la **Feature 2 de 7** del plan de enriquecimiento del módulo ficha-costo (ver `exploration.md`).
- Decisión de mantener `getHistorialCostosAction` intacta: prioriza compatibilidad sobre DRY. Migrar consumers es trabajo de la spec, no de la propuesta.
- El calculador puro se testea con datos sintéticos (sin Prisma), permitiendo que la spec pueda iterar sobre reglas de ventana o distribución de gastos sin tocar la action.
- El resumen por proveedor es un derivado: si más adelante se quiere filtrar por rango de fechas, moneda o estado, se hace en la spec/design, no en esta propuesta.
