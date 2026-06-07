# Design: Retirar `producto.stock` del flujo operativo

## 1. Decisión central

`StockUbicacion` será la única fuente de verdad operativa.

`producto.stock` deja de ser:
- input para validaciones,
- destino de escrituras de negocio,
- base de agregaciones de inventario.

Durante la transición, el campo puede permanecer en Prisma como dato legacy/read-only.

## 2. Nueva capa de consulta

Extender `src/lib/services/stock-ubicacion-queries.ts` con dos niveles:

1. **Stock por ubicación**
   - `getStockPorUbicacion(...)`
   - `getStockPorUbicacionBatch(...)`
2. **Stock total derivado**
   - `getStockTotalProducto(...)`
   - `getStockTotalProductosBatch(...)`

La implementación del stock total debe derivar de `SUM(cantidad)` en `StockUbicacion`, no de `Producto.stock`.

## 3. Estrategia de migración

### Fase A — Cortar escrituras

Eliminar `tx.producto.update({ stock: increment/decrement })` de:
- ventas,
- transferencias,
- mermas,
- producción,
- compras.

Una vez hecho eso, `producto.stock` deja de divergir por nuevas operaciones.

### Fase B — Cortar validaciones

Reemplazar validaciones tipo:
- `producto.stock < cantidad`

por lecturas explícitas a:
- almacén del producto,
- PV correspondiente,
- o total derivado si el caso realmente necesita agregado global.

### Fase C — Cortar agregaciones/reportes

Migrar:
- `src/features/dashboard/api/stats.ts`
- `src/features/productos/actions-stock.ts`
- `src/lib/api/productos-ubicacion.ts`

para que consuman helpers derivados desde `StockUbicacion`.

## 4. Riesgos

### Riesgo 1 — Flujos sin ubicación explícita
Algunas operaciones legacy asumen almacén implícito (`producto.almacenId`).

**Mitigación:** usar `producto.almacenId` solo para localizar la ubicación a consultar/mutar, no para leer `producto.stock`.

### Riesgo 2 — Costo ponderado en compras/restock
Hoy el promedio ponderado usa `producto.stock`.

**Mitigación:** reemplazarlo por stock total derivado antes de recalcular costo.

### Riesgo 3 — Reportes con fórmulas manuales
Hay reportes/dashboard que mezclan `producto.stock`, ventas y transferencias.

**Mitigación:** migrarlos a consultas agregadas explícitas y cubrir con tests de regresión.

## 5. Criterio de cierre

La change se considera cerrada cuando:

1. no quedan escrituras operativas a `Producto.stock`,
2. no quedan validaciones operativas basadas en `producto.stock`,
3. dashboard/reportes migrados dejan de usar fórmulas con `producto.stock`,
4. tests focalizados pasan,
5. `tsc` de los archivos tocados queda limpio.
