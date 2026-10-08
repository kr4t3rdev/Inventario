# Auditoría de rendimiento — desglose de cuellos de botella (2026-09-21)

Auditoría estática del codebase (3 barridos: N+1/secuencialidad, agregaciones en memoria vs SQL, índices del schema). Los hallazgos P0 y el de `VentaItem` están **verificados a mano**; el resto viene de lectura de código (confianza alta, sin medición de runtime — la medición con `EXPLAIN ANALYZE` / `pg_stat_statements` es el primer paso de la sesión de remediación).

**TL;DR**: el cuello de botella es PostgreSQL, no Node. El índice que más falta hace es el de la tabla más grande (`VentaItem`, cero índices), y los reportes cargan históricos completos para agregarlos en JS. Todo eso es corregible **sin** cambiar de framework, y además es exactamente el trabajo que habría que hacer antes de portar a Go.

---

## P0 — Seguridad / aislamiento (hacer primero, es rápido)

### F-1. Fuga cross-tenant en reporte de facturas vencidas — VERIFICADO
`src/features/contabilidad/services/accounting-reports-service.ts:1795` (`getOverdueInvoicesReport`)
- Recibe `params.tenantId` y **nunca lo usa**: `where: { estado: { not: 'PAGADA' } }`.
- Devuelve las CxC de **todos los tenants** con 4 niveles de include (`cliente → factura → venta → reconciliaciones`).
- Expuesto en: `GET /api/mobile/v1/accounting/reports/overdue-invoices` y `GET /api/sugerencias/ingresos-por-edades`.
- Fix: añadir `tenantId` al where + agregación SQL (es también A-11 de rendimiento).

### F-2. Endpoints de stats sin tenant ni índice utilizable
- `src/app/api/contabilidad/prestamos-cash/stats/route.ts:43` — `cuentaPorCobrar.findMany` con `where: { tipoCuenta, estado }`, sin `tenantId`.
- `src/app/api/contabilidad/deudas-cash/stats/route.ts:46` — patrón idéntico con `cuentaPorPagar`.

---

## Frente 1 — Índices de base de datos (mayor ratio impacto/esfuerzo de todo el informe)

Contexto: 148 modelos, 234 `@@index`, cobertura de índice tenant-líder en 109/112 modelos multi-tenant (97% — la disciplina existe). El problema son las FKs: **113 de 289 FKs (39%) no tienen ningún índice que empiece por ellas** (Prisma no las indexa automáticamente).

### Top críticos
| Tabla / FK | Ubicación schema | Impacto |
|---|---|---|
| **`VentaItem` — CERO índices** (ni `ventaId` ni `productoId`; tampoco tiene `tenantId`) | `prisma/schema.prisma:725-741` | Todo `include: { items }`, join a producto y cuadre de turno = full-scan de la tabla de mayor crecimiento. **VERIFICADO** |
| `Venta`: `clienteId`, `empleadoId`, `puntoDeVentaId`, `productoId` | :709-713 | Filtros "ventas por cliente/PDV/empleado" = scan+filtro |
| `ReconciliacionVenta.ventaId` + `tipoPagoId` | :1958-1959 | Golpeado por reconciliación de ventas |
| `ReconciliacionGasto`: 6 FKs sin índice | :2033-2039 | Cuadres |
| `Producto.almacenId` (única FK de Producto sin ninguna cobertura) | :528 | Listados por almacén |
| `CuentaPorCobrar.clienteId`; `Factura.clienteId`/`serieId`/`[tenantId, createdAt]` | :2462, :2379-2381 | Reportes financieros y fiscales |
| Cadena reparaciones (`OrdenReparacion*` 5 FKs) y compras (`OrdenCompraItem`, `Recepcion*`) | :2644-2707, :1488-1525 | `include` anidados de 4-5 niveles en `/api/reparaciones/ordenes` |
| `PrecioProducto.productoId` (lookup inverso producto→precios) | :2854 | Motor de precios LP-0 |

### Campos en `where` frecuente sin índice
`deletedAt` (87 usos) sin índice en `deudaCash`, `prestamoCash`, `transferencia`, `venta`; `factura.createdAt` sin `[tenantId, createdAt]` (reportes fiscales por rango).

### Nota
Existe `prisma/accounting-report-indexes.test.ts` que blinda índices de reportes contables — el patrón de enforcement ya existe; hay que extenderlo a Venta/VentaItem/reparaciones.

---

## Frente 2 — Hot path transaccional: creación de venta POS

La tx de `createVentaAction` (`src/features/ventas/services/venta-mutation-service.ts:352-508`) ejecuta **~15 + 6·N queries** para N ítems. Hallazgos:

1. **N+1 inventario** (`venta-mutation-service.ts:52-163`): por ítem, `producto.findUnique` + `stockUbicacion.findUnique` + upsert + movimiento (4+ queries secuenciales). Agravante: los productos **ya fueron cargados** con `findMany({ in: })` antes de la tx (:236-244) — la lectura por ítem es redundante.
2. **N+1 FIFO** (`src/lib/services/fifo-allocation.ts:185-192`): por VentaItem, `compraDocumentoItem.findMany` + `purchaseAllocation.groupBy` — consolidables en 2 queries para toda la venta.
3. **Secuencialidad pre-tx** (:202-299): turno → PDV → cliente → productos → CxC en cadena; 3-4 son independientes → `Promise.all`.
4. **N+1 cuenta bancaria** en facturación (`facturacion-workflow.ts:123-146`): `findFirst` por tipo de pago dentro de la tx.

### Ranking de transacciones largas (locks de conexión, medir en sesión)
1. `cerrarPeriodoAction` (`contabilidad/actions-periodos.ts:453-632`) — Serializable + tenant-lock + decenas de lecturas.
2. Create venta (arriba) — ~15 + 6N queries.
3. Devolución (`devolucion-venta-service.ts:148-429`) — Serializable + FOR UPDATE + loops FIFO/CxC.
4. Anulación (`venta-lifecycle-service.ts:484-684`) — Serializable + FOR UPDATE + reversión kardex con upsert por línea.
5. Crear compra (`compras-productos/actions.ts:126-375`) — ~12 + 5N queries.

---

## Frente 3 — Reportes: agregación en memoria que crece con el histórico

Todos cargan el histórico completo y agregan en JS → **cada mes que pasa son más lentos**. Ordenados por severidad:

| # | Hallazgo | Ubicación | Volumen |
|---|---|---|---|
| A-1 | `getVentasAction` / `VentaReadService.list`: todas las ventas + items + **allocations FIFO** + devoluciones, sin paginar | `venta-read-service.ts:112-118` | Histórico completo; alimenta /busy/sales, invoice, venta-diaria, API móvil |
| A-2 | Reporte Venta Diaria agrega 100% en el navegador (~15 reduces sobre todo el histórico) | `reporte-venta-diaria.tsx` | Todo vía `useVentas()` |
| A-3 | Dashboard: **12 tablas completas** sin límite temporal + `datosPorMes` con 6 pasadas × tabla + `ventasDiarias` O(60·ventas) | `dashboard/queries.ts:146-658` | Histórico completo, pantalla principal |
| A-4 | Resumen contable: 7 tablas de reconciliación × 2 (período y período anterior) + agregación JS | `accounting-reports-service.ts:469-536, 639-679` | Doble histórico |
| A-5 | Cuadres: 3 funciones cargan todo el período y "paginan" con `.slice()` en JS (el `pageSize` nunca llega a la DB) | `cuadre-queries.ts:288, 919, 1063` | Todo el período del cuadre |
| A-6 | Estado de Resultados anual: reconciliaciones + CxC con `venta.items.allocations` anidadas | `reconciled-result-service.ts:238-459` | Año completo con FIFO anidado |
| A-7 | Balance general: todas las capas de compra históricas con allocations | `current-balance-service.ts:115-128` | Histórico de compras |
| A-8 | Valoración FIFO de reportes: todas las líneas de compra + groupBy | `reportes-financieros/actions.ts:45-82` | Histórico de compras |
| A-9 | `getVentaServiciosAction` / `getMermasAction` sin límite | `venta-servicios/actions.ts:63-71`, `mermas/actions.ts:32-36` | Histórico |
| A-10 | Reporte Movimientos filtra fecha/producto **en cliente** sobre histórico (+1000 transferencias precargadas) | `reporte-movimientos.tsx:41-79`, `busy/reportes/page.tsx:29-31` | Histórico |
| A-11 | Anticipos: 3 reportes con reduce en memoria | `accounting-reports-service.ts:2015-2170` | Histórico de anticipos |

**La solución estructural es la misma para todos**: mover agregaciones a SQL (`groupBy`, `SUM`, `GROUP BY date_trunc`) con filtro de tenant y rango obligatorios. Ya existe el precedente bien hecho: `movements-report-query.ts` (SQL parametrizado con CTEs) y la ruta de reconciliación de ventas (`GROUP BY + HAVING + LIMIT`).

---

## Frente 4 — Paginación ausente

- **86% de findMany en API routes legacy sin `take`**: 59 de 69 (`src/app/api/**/route.ts`). Top: cuadre de turno móvil (`mobile/pos/turnos/cuadre/route.ts:47` — encima pega a `VentaItem` sin índices), stats préstamos/deudas (P0), reparaciones, clientes móvil.
- En actions: `venta-read-service.ts:112` (A-1), `producto-service.ts:133` (catálogo completo al POS), `cuadre-diario/actions.ts` devuelve arrays completos del día.
- 28 archivos con `count()+findMany()` sin transacción (todos usan `Promise.all`; riesgo bajo: página/total pueden desincronizarse bajo escritura).

---

## Frente 5 — Consistencia de cálculo (deuda estructural, bloquea el port a Go)

**12 implementaciones divergentes** de costo de venta / valoración / rentabilidad:

| # | Ubicación | Método |
|---|---|---|
| 1 | `src/lib/services/fifo-allocation.ts` | Escritura FIFO (canónica, bien hecha) |
| 2 | `reportes-financieros/lib/valoracion-fifo.ts:60` | Valoración inventario (excluye ANULADAS) |
| 3 | `contabilidad/.../current-balance-service.ts:288` | Valoración balance (**NO excluye ANULADAS** → diverge de #2) |
| 4 | `contabilidad/utils/venta-costo.ts:59` | COGS FIFO con tope por cantidad + traza |
| 5 | `src/lib/ventas-utils.ts:72` | `costoFifo` sin tope, regla devolución→0 |
| 6 | `reportes-financieros/lib/venta-diaria-stats.ts:82` | Suma costoFifo/fallback del día |
| 7 | `actions-rentabilidad-compra.ts:224` | Ingreso sin descuentos ni neteo devoluciones |
| 8 | `ficha-costo/actions-ventas.ts` | COGS FIFO (JS y SQL, dos variantes) |
| 9 | `ficha-costo/lib/cost-calculator.ts` | **CPP** (método distinto a FIFO) |
| 10 | `src/lib/inventory-cost-utils.ts:22` | Ponderado al comprar (escritura `precioCosto`) |
| 11 | `dashboard/queries.ts:299-331` | Costo con `precioCosto` ACTUAL (ni FIFO ni CPP) |
| 12 | `lib/api/reportes-financieros.ts:87` + duplicado | Ingreso recalculado con precio de venta ACTUAL |

Solo la escritura FIFO está centralizada. Esto explica la historia de bugs de rentabilidad (memorias: venta-diaria, valoración) y **debe resolverse antes o durante el port a Go**: portar 12 reglas divergentes es portar los bugs.

---

## Plan propuesto para la sesión de remediación

| Fase | Contenido | Esfuerzo est. | Verificación |
|---|---|---|---|
| **R-0** | P0: fix tenant en los 3 endpoints + test de aislamiento | Horas | Test unitario con 2 tenants |
| **R-1** | Migración de índices: VentaItem completo, FKs críticas Frente 1 (~20 índices, `CREATE INDEX CONCURRENTLY` manual en prod) + extender `accounting-report-indexes.test.ts` | 1 sesión | `EXPLAIN ANALYZE` antes/después en queries de A-1 |
| **R-2** | Hot path venta: batch de inventario/FIFO, `Promise.all` pre-tx, sacar lecturas de la tx | 1-2 sesiones | Tests de venta existentes + medir latencia |
| **R-3** | Reportes a SQL: A-1..A-5 primero (mayor tráfico), con contrato de respuesta idéntico | 3-4 sesiones, uno por reporte | Snapshot tests de payload + comparación de totales |
| **R-4** | Servicio canónico de costo/valoración (una regla, usada por los 12 puntos); decisión FIFO vs CPP documentada | 2 sesiones + migración de consumidores | Suite de oro con datos fijos comparando los 12 puntos |
| **R-5** | Instrumentación: habilitar `pg_stat_statements` en Railway + log de queries >200ms, para validar con datos reales el orden de R-2..R-4 | Horas | Dashboard de queries |

Notas:
- R-1 y R-2 son independientes del framework y **reducen la latencia percibida más que cualquier migración a Go**.
- R-4 es prerrequisito del backend Go (o se portan los bugs).
- No tocar este branch (`feat/contabilidad-capa-formal`): la remediación va en rama propia.

---

## Anexo — números globales de la auditoría

- N+1 evitables (lectura en loop con alternativa `in:`/batch): **12** · Loops de escritura con alternativa `createMany`/batch: **9** · Secuencialidades para `Promise.all`: **10** · `findMany` sin `take` que devuelven todo al cliente (actions): **8** · transacciones largas prioritarias: **6**.
- Agregaciones en memoria críticas/altas: **12 superficies** · $queryRaw: ~30 usos, todos parametrizados (1 `queryRawUnsafe` justificado en admin).
- Schema: 148 modelos · 234 índices + 50 uniques · 113/289 FKs sin índice (39%).
- `prisma/schema.prisma-2` es un duplicado obsoleto de 1171 líneas, no referenciado (candidato a borrar para evitar confusiones).
