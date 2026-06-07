# SDD Proposal: Unificación de Stock por Ubicación

## Executive Summary

Migrar el modelo de stock del sistema a `StockUbicacion` como **fuente de verdad única** para cálculos por ubicación, dejando `producto.stock` como campo derivado/legacy. Esto resuelve las inconsistencias actuales donde una venta POS descuenta 3 fuentes distintas, las transferencias editadas/canceladas no sincronizan `StockUbicacion`, y las consultas usan reglas de cómputo diferentes según la pantalla.

## Context

- **App**: Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL
- **Proyecto**: TCP — Sistema POS multi-tenant con almacenes y puntos de venta
- **Modelo clave**: `StockUbicacion` (ya existe en schema) con campos:
  - `cantidad` — stock físico total
  - `cantidadReservada` — stock reservado (pedidos, apartados)
  - `cantidadDisponible` — stock vendible (`cantidad - cantidadReservada`)
- **Ubicaciones**: `almacen` y `punto_venta`
- **TDD**: Strict mode activo (`openspec/config.yaml`) — test runner: `pnpm run test:run`

## Problem

### Problema 1: Venta POS descuenta stock de 3 fuentes distintas

En `src/features/ventas/actions.ts:183-247`, `createVentaAction` ejecuta:

```typescript
// 1. Descuenta el stock general del producto
await tx.producto.update({
  data: { stock: { decrement: item.cantidad } }
});

// 2. Descuenta StockUbicacion del almacén
await upsertStockUbicacion(tx, {
  tipoUbicacion: "almacen",
  ubicacionId: producto.almacenId,
  delta: -item.cantidad,
});

// 3. Descuenta StockUbicacion del punto de venta
await upsertStockUbicacion(tx, {
  tipoUbicacion: "punto_venta",
  ubicacionId: parsed.puntoDeVentaId,
  delta: -item.cantidad,
});
```

**Efecto**: Una venta en POS descuenta el almacén aunque la mercadería ya fue transferida al PV. El stock del almacén queda subcontado.

**Ejemplo concreto**:
- Stock inicial: 100 en almacén
- Transferencia de 20 al PV → almacén: 80, PV: 20
- Venta de 5 en PV → usando la lógica actual: PV baja a 15 (correcto), pero almacén también baja a 75 (debería ser 80)

### Problema 2: Cuadre POS usa inferencia inconsistente

En `src/features/turnos-pos/actions-cuadre.ts:142-196`:

- Si encuentra registros `StockUbicacion` del PV → asume que **todos** los productos provienen del PV y calcula `stockInicial = stockEnUbicacion` (sin sumar vendido)
- Si NO encuentra registros → cae al almacén asociado al POS y calcula `stockInicial = stockEnUbicacion + vendido`
- El fallback es **global**: no es por producto. Si algún producto tiene stock de PV, TODOS se leen del PV.

Esto produce resultados incorrectos en escenarios mixtos (productos que nunca se transfirieron al PV aparecen con stock 0).

### Problema 3: Update/Delete de transferencias no sincronizan StockUbicacion

En `src/features/transferencias/actions.ts`:

- `updateTransferenciaAction` (línea 280): solo ajusta `producto.stock` si cambió la cantidad, no toca `StockUbicacion` del origen ni el destino.
- `deleteTransferenciaAction` (línea 330): solo ajusta `producto.stock` invirtiendo el delta, no toca `StockUbicacion`.

**Efecto**: Después de editar o anular una transferencia, el stock por ubicación queda desfasado.

### Problema 4: Tres consultas de stock por ubicación — reglas distintas

| Archivo | Cómputo para PV | Cómputo para almacén |
|---------|----------------|---------------------|
| `src/lib/api/productos-ubicacion.ts:121-206` | StockUbicacion → fallback dinámico (transferencias - ventas) | `producto.stock` + transferencias entradas - salidas |
| `src/features/productos/actions-stock.ts:57-104` | StockUbicacion directo (con includeZero) | StockUbicacion directo o productos por almacénId |
| Cuadre POS | StockUbicacion PV → fallback almacén | — |

El mismo producto puede mostrar stock DISTINTO en cada pantalla.

### Problema 5: Se ignora cantidadReservada / cantidadDisponible

- El schema `StockUbicacion` ya modela `cantidadReservada` y `cantidadDisponible`
- `upsertStockUbicacion` service ya las mantiene correctamente
- Pero las validaciones de stock (venta, transferencia, merma) usan `cantidad` (stock total), no `cantidadDisponible`
- Las UI tampoco muestran stock reservado vs disponible

## Proposed Solution

### Fase 1 — Correcciones inmediatas (bugs agudos)

Estos cambios corrigen los bugs sin cambiar la arquitectura de fondo. Preceden a la Fase 2.

#### 1a. Venta POS: no descontar almacén si hay punto de venta

En `createVentaAction`, el descuento a `StockUbicacion` del almacén solo debe ocurrir cuando la venta NO tiene `puntoDeVentaId`. Si la venta es POS, solo se descuenta:
- `producto.stock` (legacy, se mantiene por ahora)
- `StockUbicacion` del punto de venta

#### 1b. Cuadre POS: stock por producto, no fallback global

En `getCuadreTurnoAction`, reemplazar el `stockEsDePuntoVenta` booleano global por una lógica **por producto**:
- Cada producto consulta su propio `StockUbicacion` del PV
- Si no tiene registro en PV, usa el stock del almacén asociado
- `stockInicial` siempre se calcula igual: stock actual + vendido en turno

#### 1c. Transferencias update/delete: sincronizar StockUbicacion

- `updateTransferenciaAction`: ajustar `StockUbicacion` del origen y destino según la diferencia entre cantidad anterior y nueva
- `deleteTransferenciaAction`: restaurar `StockUbicacion` del origen y restar del destino (invertir el movimiento original)

### Fase 2 — Solución arquitectónica de fondo

Migrar a `StockUbicacion` como fuente de verdad única para operaciones por ubicación.

#### 2a. Servicio unificado `stock-ubicacion-service`

Crear un único servicio transaccional que centralice TODAS las mutaciones de stock:

```typescript
// src/lib/services/stock-ubicacion-service.ts (extender el existente)

// Mover stock entre ubicaciones (transferencia)
async function transferirStock(tx, opts: {
  productoId: string;
  desde: { tipo: TipoUbicacion; id: string };
  hacia: { tipo: TipoUbicacion; id: string };
  cantidad: number;
  tenantId: string;
}): Promise<void>

// Descontar stock de una ubicación (venta, merma)
async function descontarStock(tx, opts: {
  productoId: string;
  ubicacion: { tipo: TipoUbicacion; id: string };
  cantidad: number;
  tenantId: string;
}): Promise<void>

// Incrementar stock en una ubicación (compra, restock, producción)
async function incrementarStock(tx, opts: {
  productoId: string;
  ubicacion: { tipo: TipoUbicacion; id: string };
  cantidad: number;
  tenantId: string;
}): Promise<void>

// Revertir una operación (anulación de venta, cancelación de transferencia)
async function revertirStock(tx, opts: {
  productoId: string;
  ubicacion: { tipo: TipoUbicacion; id: string };
  cantidad: number;
  tenantId: string;
}): Promise<void>
```

#### 2b. `producto.stock` como campo derivado

Implementar una migración de datos que compute `producto.stock` desde `StockUbicacion`:

```
producto.stock = SUM(StockUbicacion.cantidad) WHERE productoId = X
```

Opción A (recomendada): Triggers/eventos que sincronicen automáticamente `producto.stock` después de cada mutación de `StockUbicacion`.
Opción B (simplificada): Reemplazar lecturas de `producto.stock` por la suma agregada de `StockUbicacion`, mantener escritura dual durante transición.

#### 2c. Migrar todas las features al nuevo servicio

Cada feature que muta stock debe pasar por el servicio unificado:

| Feature | Archivo | Mutación actual | Migrar a |
|---------|---------|----------------|----------|
| Venta | `src/features/ventas/actions.ts` | Manual: 3 descuentos | `descontarStock()` |
| Anulación venta | `src/features/ventas/actions.ts` | Manual: 3 restauraciones | `revertirStock()` |
| Transferencia completada | `src/features/transferencias/actions.ts` | `upsertStockUbicacion` × 2 | `transferirStock()` |
| Transferencia editada | `src/features/transferencias/actions.ts` | Solo `producto.stock` | `transferirStock()` delta |
| Transferencia cancelada | `src/features/transferencias/actions.ts` | Solo `producto.stock` | `revertirStock()` × 2 |
| Compra/restock | `src/features/compras-productos/actions.ts` | `upsertStockUbicacion` | `incrementarStock()` |
| Merma | `src/features/mermas/actions.ts` | `upsertStockUbicacion` | `descontarStock()` |
| Editar merma | `src/features/mermas/actions.ts` | Manual + `producto.stock` | `revertirStock()` + `descontarStock()` |
| Producción | `src/features/produccion/actions.ts` | `upsertStockUbicacion` × N | `descontarStock()` + `incrementarStock()` |
| Create producto | `src/features/productos/actions-crud.ts` | `upsertStockUbicacion` | `incrementarStock()` |
| Update producto | `src/features/productos/actions-crud.ts` | `upsertStockUbicacion` manual | Servicio unificado |

#### 2d. Unificar consultas de stock por ubicación

Reemplazar las 3 implementaciones actuales por una única función:

```typescript
// src/lib/services/stock-ubicacion-queries.ts

/**
 * @description Obtiene el stock disponible (cantidadDisponible) de un producto
 * en una ubicación específica. Esta es la ÚNICA fuente de verdad.
 */
async function getStockDisponibleEnUbicacion(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string,
): Promise<number>

/**
 * @description Obtiene productos con stock disponible en una ubicación.
 * Unifica productos-ubicacion.ts y actions-stock.ts.
 */
async function getProductosConStockEnUbicacion(
  ubicacionId: string,
  tipoUbicacion: TipoUbicacion,
  opts?: { includeZero?: boolean; tenantId?: string }
): Promise<ProductoConStock[]>
```

#### 2e. Usar cantidadDisponible para validaciones

Todas las validaciones de stock (venta, transferencia, merma, producción) deben usar `cantidadDisponible` en lugar de `cantidad`:

```typescript
// Antes (bug): valida contra stock total
const stockPV = await tx.stockUbicacion.findUnique({ ... });
if (stockPV?.cantidad < item.cantidad) throw ...

// Después: valida contra stock disponible
if (stockPV?.cantidadDisponible < item.cantidad) throw ...
```

### Priorización de correcciones inmediatas (Fase 1)

Estos cambios se pueden aplicar sin migración de datos ni cambios de schema, y resuelven los bugs más graves:

1. **Venta POS no descuenta almacén** — Cambio de 3 líneas en `ventas/actions.ts`
2. **Cuadre POS lee stock por producto** — Reestructuración de `actions-cuadre.ts`
3. **Transferencias update/delete sincronizan StockUbicacion** — Agregar 4-6 líneas en cada acción

Orden: 1 → 3 → 2 (dependencia: el cuadre debe funcionar correctamente después de corregir ventas y transferencias)

### Non-goals

- **No se elimina `producto.stock`** del schema — demasiado riesgo de regresión. Se mantiene como legacy con escritura dual.
- **No se agregan triggers de base de datos** (Opción A) — preferimos lógica de aplicación consistente.
- **No se rediseña UI de cuadre POS** — solo se corrige el cómputo de stock.
- **No se agrega UI de `cantidadReservada`** — queda para otro SDD si el usuario lo solicita.
- **No se toca el dashboard** (`src/features/dashboard/api/stats.ts`) — sus consultas usan `producto.stock` directamente y no interfieren con el stock por ubicación.

## Alternatives Considered

1. **Solo parche corto (Fase 1, sin Fase 2)**: Menos riesgo inmediato pero las consultas seguirían siendo inconsistentes entre pantallas. Los bugs volverían a aparecer con nuevas features.

2. **Eliminar `producto.stock` del schema**: Riesgo alto de regresión — hay decenas de consultas, tests y validaciones que lo usan. Mejor mantenerlo como derivado.

3. **Trigger de PostgreSQL para mantener `producto.stock`**: Elegante pero difícil de versionar con Prisma Migrate, y opaco para debugging.

4. **Mantener 3 servicios de consulta separados**: Es el estado actual y es precisamente el problema. Rechazado.

## Impact Analysis

### Fase 1

| Archivo | Cambio | Riesgo |
|---------|--------|--------|
| `src/features/ventas/actions.ts` | No descontar almacén si hay PV | Bajo — la validación de stock y el descuento a PV se mantienen |
| `src/features/turnos-pos/actions-cuadre.ts` | Stock por producto en cuadre | Medio — cambia el resultado del cuadre existente, requiere verificación |
| `src/features/transferencias/actions.ts` | Agregar sincronización StockUbicacion en update/delete | Bajo — solo agrega operaciones faltantes |

### Fase 2

| Archivo | Cambio | Riesgo |
|---------|--------|--------|
| `src/lib/services/stock-ubicacion-service.ts` | Agregar funciones transferirStock, descontarStock, etc. | Bajo — extensiones del servicio existente |
| `src/features/ventas/actions.ts` | Migrar a servicio unificado | Medio — toca el flujo crítico de ventas |
| `src/features/transferencias/actions.ts` | Migrar a servicio unificado | Medio — toca el flujo de transferencias |
| `src/features/mermas/actions.ts` | Migrar a servicio unificado | Bajo |
| `src/features/compras-productos/actions.ts` | Migrar a servicio unificado | Bajo |
| `src/features/produccion/actions.ts` | Migrar a servicio unificado | Bajo |
| `src/features/productos/actions-crud.ts` | Migrar a servicio unificado | Bajo |
| `src/lib/api/productos-ubicacion.ts` | Reemplazar por servicio de consultas unificado | Medio — cambia el API público |
| `src/features/productos/actions-stock.ts` | Reemplazar por servicio de consultas unificado | Bajo |

### Riesgos generales

- **Datos históricos**: Productos sin registro `StockUbicacion` (porque se crearon antes de existir el modelo) deben tener migración de datos
- **Rendimiento**: La consulta unificada no debe ser más lenta que las 3 actuales — usar índices existentes en `StockUbicacion`
- **Rollback**: Cada cambio de Fase 1 es reversible individualmente. La Fase 2 requiere rollback de todo el lote.

### Plan de rollback (Fase 2)

1. Revertir commits de migración de cada feature
2. Restaurar `producto-ubicacion.ts` y `actions-stock.ts` originales
3. Ejecutar migración inversa: `producto.stock` se restaura desde el backup pre-migración

## Skill Resolution

Para la fase de Spec/Design/Apply, cargar:
- `AGENTS.md` (Server Action patterns, estructura de features, testing)
- Skill `error-handling-patterns` para las validaciones de stock
- Skill `next-best-practices` para Server Actions en Next.js

## Next

→ **Spec** (si se aprueba): Given/When/Then para cada acción corregida, escenarios de migración
→ **Design**: Árbol del servicio unificado, data flow, plan de migración de datos
→ **Tasks**: Fase 1 (3 tareas) + Fase 2 (5 tareas), ordenadas por dependencias
