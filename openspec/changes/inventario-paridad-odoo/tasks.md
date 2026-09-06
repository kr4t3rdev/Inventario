# Tasks: Paridad de Inventario vs Odoo por Planes

> TDD obligatorio (`strict_tdd: true`). Cada tarea de lógica empieza en
> ROJO (test que falla) y luego GREEN. Unitarios mockean `@/lib/prisma`.
> Solo `src/**/__integration__/` usa BD real con `DATABASE_URL_TEST`.
> Texto visible en español neutro.

## Fase 0 — Registry, gating y base ✅

* [x] 0.1 11 claves en `feature-registry.ts` + test
  `inventario-paridad-odoo.test.ts`.
* [x] 0.2 Seed por tier en `prisma/seed/plans-seed.ts` +
  migración `20260905130001_inventario_flags_plans` para planes y
  licencias existentes + test estático `inventario-flags-migration.test.ts`.
* [x] 0.3 `requireFeature` con claves nuevas en `tenant-scope.test.ts`.
* [x] 0.4 Entradas en `SIDEBAR_FEATURE_MAP`
  (`src/features/sidebar/sidebar-config.ts`). Las páginas se crean en Fase 1.6.

## Fase 1 — P0 Kardex ✅ (con hardening post-review)

* [x] 1.1 Migración `20260905130000_add_stock_move_lines`: enum
  `TipoOrigenMovimiento`, FK compuesta `(productoTenantId, productoId)`,
  `ON DELETE RESTRICT` para producto, FK a `User` con `SetNull`,
  clave única `eventoKey` y triggers `BEFORE UPDATE/DELETE`.
* [x] 1.2 `src/features/inventario/movimientos.ts`:
  `registrarMovimiento` con upsert idempotente, `getKardex` con saldo
  de apertura y paginación, `getMovimientosDeOrigen`,
  `revertirMovimientosDeOrigen` con costo histórico.
* [x] 1.3 `getKardexAction` (producto requerido; paginado).
* [x] 1.4 Doble escritura: ventas (crear/anular con costo histórico),
  compras, transferencias (crear/completar + compensación en
  editar/eliminar), mermas (crear/editar/eliminar), producción
  (aprobar consumo/completar ingreso/cancelar reposición+compensación).
  Vales de salida no mueven stock hoy → sin kardex (cubiertos en Fase 2).
* [x] 1.5 Backfill idempotente `prisma/scripts/backfill-stock-move.ts` +
  test de integración `src/lib/__integration__/kardex-backfill.test.ts`
  (incluye paridad kardex↔StockUbicacion e inmutabilidad; requiere PG).
* [x] 1.5b Scoping por tenant en validación de origen/destino de
  transferencias (`findFirst` con tenantId).
* [x] 1.6 UI lectura: `src/app/busy/inventario/kardex/page.tsx` + tabla
  + exportación CSV (flag `kardex`).

## Fase 2 — P0 Ajuste unificado + Conteo ✅ (7d633cfd)

* [x] 2.1 Migración `20260906090000_ajuste_conteo_inventario`:
  `AjusteInventario` + `ConteoInventario` + `ConteoLinea`.
* [x] 2.2 Schemas Zod en `src/features/inventario/schemas.ts`
  (motivo catálogo, doble captura, conciliación).
* [x] 2.3 `actions-ajustes.ts`: `createAjusteAction` (teórico de
  `StockUbicacion`, valoriza a CPP, kardex AJUSTE, bloquea con conteo
  activo), `anularAjusteAction` (compensa con costo histórico),
  `getAjustesAction`.
* [x] 2.4 Puente legacy: `createMermaAction` crea su ajuste espejo con
  `mapearMotivoLegacy`; `updateMermaAction` anula y recrea;
  `deleteMermaAction` anula el espejo. Vales de salida siguen sin
  mover stock (entran al ajuste unificado en una fase posterior).
* [x] 2.5 `actions-conteos.ts`: iniciar (líneas desde StockUbicacion),
  registrar captura 1/2 (usuario distinto en la segunda), conciliar
  (ajustes con motivo ERROR_CONTEO + kardex + stock por varianza),
  cancelar (solo estados pre-ajuste) + `getConteosAction`.
* [x] 2.6 UI: `/busy/inventario/ajustes` y `/busy/inventario/conteos` +
  sidebar (`SIDEBAR_FEATURE_MAP` + permisos), con tests de componente.

## Fase 3 — P1 Compras y reabastecimiento (Profesional) ✅ Backend/UI (E2E pendiente)

* [x] 3.1 Migración `20260906120000_ordenes_compra_recepciones_reabastecimiento`:
  `OrdenCompra`, `OrdenCompraItem`, `Recepcion`, `RecepcionItem`,
  `ReglaReabastecimiento`; `CompraDocumento.ordenCompraId?` nullable.
* [x] 3.2 `src/features/compras-productos/actions-oc.ts`:
  crear/confirmar OC, registrar recepción (descuenta pendiente,
  transiciona `PARCIAL/RECIBIDA`), cancelar con validación.
  - RED/GREEN: recepción 60/100 deja `PARCIAL`; 40 restantes cierran;
    exceso rechazado.
* [x] 3.3 Vincular factura: `createCompraProductoAction` valida proveedor,
  estado y cantidades contra recepciones; genera movimiento solo para
  compra directa, nunca duplica el `StockMoveLine` ya creado por recepción.
* [x] 3.4 `sugerirReabastecimientoAction` (flag `reabastecimiento`):
  disponible < min propone `max - disponible`; con receta propone
  fabricación, sin receta propone OC. Incluye CRUD de reglas.
* [x] 3.5 UI: `/busy/compras/ordenes`, `/busy/compras/recepciones` y
  `/busy/compras/reabastecimiento`; backorder visible en líneas y sidebar.
* [ ] 3.6 E2E Playwright (plan Profesional): OC → recepción parcial →
  recepción total → factura → kardex cuadra.

<!-- Diseño original de Fase 3:
* [ ] 3.1 Migración: `OrdenCompra`, `OrdenCompraItem`,
  `Recepcion`, `RecepcionItem`, `ReglaReabastecimiento`.
  `CompraDocumento.ordenCompraId?` nullable.
* [ ] 3.2 `src/features/inventario/actions-oc.ts` con
  `requireFeature(user, 'ordenes-compra', ...)`:
  crear/confirmar OC, registrar recepción (descuenta pendiente,
  transiciona `PARCIAL/RECIBIDA`), cancelar con validación.
  - RED: recepción 60/100 deja `PARCIAL`; 40 restantes cierran;
    exceso rechazado.
* [ ] 3.3 Vincular factura: al crear `CompraDocumento` con `ordenCompraId`,
  validar proveedor y cantidades contra recepciones; genera
  `StockMoveLine` de entrada por recepción (no duplicar con factura).
* [ ] 3.4 `sugerirReabastecimientoAction` (flag `reabastecimiento`):
  disponible < min propone `max - disponible`; con receta propone
  fabricación, sin receta propone OC.
* [ ] 3.5 UI OC: `src/app/busy/compras/ordenes/*` + recepciones +
  backorder visible; compra directa intacta.
* [ ] 3.6 E2E Playwright (plan Profesional): OC → recepción parcial →
  recepción total → factura → kardex cuadra.
-->

## Fase 4 — P1 UdM con factor (Profesional)

* [ ] 4.1 Migración: `Unidad.factorAStock Float @default(1)` +
  `tipoUso String @default("STOCK")`.
* [ ] 4.2 Helper `aUnidadStock(cantidad, unidadId)` +
  `costoPorUnidadStock()` en `src/lib/inventory-cost-utils.ts`.
  - RED: 2 cajas x12 a 120/caja = 24 u. a 10/u.
* [ ] 4.3 Aplicar conversión en formularios de compra/venta/producción
  antes de persistir y antes de `allocateFifoForVentaItem`
  (`src/lib/services/fifo-allocation.ts`).
* [ ] 4.4 Ajustar `cost-calculator.ts` y `venta-costo.ts` al costo por
  unidad stock; test FIFO con factor.

## Fase 5 — P1 Lotes/FEFO + Ubicaciones (Profesional)

* [ ] 5.1 Migración: `Lote` + `PurchaseAllocation.loteId?` +
  `Ubicacion` (parentId, tipo).
* [ ] 5.2 Entradas crean lote (código = factura + fecha o manual);
  `cantidadDisponible` por lote.
  - RED: `lotes.test.ts`: entrada 10 crea lote con 10 disponibles.
* [ ] 5.3 FEFO en `allocateFifoForVentaItem`: ordenar por
  `fechaVencimiento` NULLS LAST dentro del FIFO.
  - RED: A(10 días,5) + B(60 días,5), venta 6 → 5 de A + 1 de B.
* [ ] 5.4 `getAlertasVencimientoAction` (≤30 días, configurable) +
  badge en inventario.
* [ ] 5.5 Kardex y conteo filtran por `Ubicacion` hija; migración de
  `StockUbicacion` plano a hoja de la jerarquía sin pérdida.
* [ ] 5.6 Seed demo Profesional (`professional-seed.ts`): lotes con
  vencimientos y ubicaciones hijas.

## Fase 6 — P1 Variantes (Profesional)

* [ ] 6.1 Migración: `ProductoPlantilla` + columnas en `Producto`:
  `plantillaId?`, `atributoJson?`, `sku?`, `esVariante @default(false)`.
* [ ] 6.2 `actions-variantes.ts` (flag `variantes`): crear plantilla,
  generar variantes (producto cartesiano validado), bloquear venta de
  plantilla.
  - RED: plantilla no vende; variante M descuenta solo su stock.
* [ ] 6.3 Precios/costos/stock independientes por variante; listas de
  precios resuelven por `varianteId`.
* [ ] 6.4 UI: `src/app/busy/inventario/variantes/*` (plantilla →
  matriz de variantes con SKU/stock/precio).

## Fase 7 — P2 Empresarial (MRP + trazabilidad + forecast)

* [ ] 7.1 BOM multinivel: `RecetaIngrediente.recetaIngredienteId?`
  (ingrediente = producto o subreceta) + validación anti-ciclos.
  - RED: ciclo A→B→A rechazado; explosión 10 P = 20 S = 60 I.
* [ ] 7.2 `planificarNecesidadesAction` (flag `mrp-avanzado`):
  explosión vs disponible + lotes reservados → sugiere OC y órdenes.
* [ ] 7.3 Trazabilidad lote → documentos: `getTrazabilidadLoteAction`
  (compras origen → ventas destino) + UI.
* [ ] 7.4 Putaway simple: `ReglaPutaway { productoId?, categoriaId?,
  ubicacionId }` + sugerencia de ubicación en recepción.
* [ ] 7.5 Reportes: valorizado oficial (CPP/FIFO a fecha), rotación y
  forecast de quiebre; exportables. Reutiliza kardex, no reconstruye.

## Fase 8 — Verificación y archivo

* [ ] 8.1 `pnpm run test:run` por feature + `test-isolation-contract`
  en verde (0 offenders); integración solo con `DATABASE_URL_TEST`.
* [ ] 8.2 `pnpm run lint` y `tsc --noEmit` en archivos tocados.
* [ ] 8.3 Matriz manual por plan: Básico no ve OC/lotes/variantes/MRP
  (toast upgrade); Profesional ve P1; Empresarial ve todo.
* [ ] 8.4 Actualizar `PLANES-SUSCRIPCION.md` y demo seeds
  (`base-seed.ts`, `professional-seed.ts`, `enterprise-seed.ts`).
