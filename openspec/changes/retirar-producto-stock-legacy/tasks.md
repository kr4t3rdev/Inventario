# Tasks: Retirar `producto.stock` del flujo operativo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 mutaciones → PR 2 lecturas agregadas/reportes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Cortar escrituras y validaciones operativas | PR 1 | ventas, transferencias, mermas, producción, compras |
| 2 | Migrar stock total derivado y lecturas agregadas | PR 2 | dashboard, productos-ubicacion, acciones de stock |

## Phase 1: Baseline TDD

- [ ] 1.1 `src/features/ventas/__tests__/actions.test.ts`: escribir test rojo para venta sin PV validando almacén vía `StockUbicacion`, no `producto.stock`.
- [ ] 1.2 `src/features/transferencias/__tests__/actions.test.ts`: escribir test rojo para transferencia desde almacén validando stock del origen en `StockUbicacion`.
- [ ] 1.3 `src/features/mermas/__tests__/actions.test.ts` y/o tests nuevos: cubrir merma contra stock de almacén materializado.
- [ ] 1.4 `src/features/produccion/__tests__/actions.test.ts` y/o tests nuevos: cubrir consumo/materialización sin leer `producto.stock`.
- [ ] 1.5 `src/features/compras-productos/__tests__/actions.test.ts` y/o tests nuevos: cubrir costo ponderado usando stock total derivado.

## Phase 2: Query foundation

- [ ] 2.1 `src/lib/services/__tests__/stock-ubicacion-queries.test.ts`: escribir tests rojos para `getStockTotalProducto` y `getStockTotalProductosBatch`.
- [ ] 2.2 `src/lib/services/stock-ubicacion-queries.ts`: implementar mínimo los helpers de stock total derivado (`SUM(StockUbicacion.cantidad)`).
- [ ] 2.3 `src/lib/services/stock-ubicacion-service.ts`: eliminar comentarios/contrato que exigen sincronizar `producto.stock` manualmente.

## Phase 3: Mutations migration

- [ ] 3.1 `src/features/ventas/actions.ts`: reemplazar validación de almacén basada en `producto.stock`; eliminar decremento a `Producto.stock`.
- [ ] 3.2 `src/features/transferencias/actions.ts`: reemplazar validación legacy; eliminar todos los `tx.producto.update({ stock: ... })` en create/update/delete/completar.
- [ ] 3.3 `src/features/mermas/actions.ts`: migrar create/update/delete a `StockUbicacion` y total derivado donde aplique.
- [ ] 3.4 `src/features/produccion/actions.ts`: migrar aprobación/completado a `StockUbicacion`; quitar increment/decrement a `Producto.stock`.
- [ ] 3.5 `src/features/compras-productos/actions.ts`: recalcular costo ponderado con stock total derivado; quitar incrementos a `Producto.stock`.

## Phase 4: Read migration

- [ ] 4.1 `src/lib/api/productos-ubicacion.ts`: reemplazar chequeo de inconsistencia basado en `producto.stock` por total derivado o por existencia materializada.
- [ ] 4.2 `src/features/productos/actions-stock.ts`: migrar `stockTotal` para que use helper derivado y no `r.producto.stock`.
- [ ] 4.3 `src/features/dashboard/api/stats.ts`: eliminar fórmulas `producto.stock ± transferencias ± ventas`; usar stock total derivado explícito.

## Phase 5: Verification and cleanup

- [ ] 5.1 Buscar `producto.update({ stock` y `producto.stock <` en `src/`; dejar solo usos permitidos en UI legacy no migrada y tests.
- [ ] 5.2 Ejecutar Vitest focalizado de los slices tocados y confirmar verde.
- [ ] 5.3 Ejecutar ESLint de archivos tocados.
- [ ] 5.4 Ejecutar `tsc --noEmit --pretty false` filtrado a la slice y corregir errores atribuibles.
- [ ] 5.5 Documentar qué usos de `producto.stock` quedan solo como legacy visual para una futura eliminación de columna.
