# Correcciones Urgentes 2 — Datos (Sesión A)

## Why

La re-auditoría de 2026-09-26 (14 módulos vs Odoo) confirmó 6 defectos de
integridad de datos de prioridad alta que hoy:

1. **Destruyen catálogo**: borrar un Punto de Venta elimina en cascada sus
   productos (`Producto.puntoDeVenta onDelete: Cascade` +
   `deletePuntoDeVentaAction` sin guard), y las cascadas de
   `Producto.categoria` / `Categoria.parent` permiten destruir el catálogo por
   vías que se saltan el guard de `deleteCategoriaAction`.
2. **Corrompen inventario**: la merma registrada desde la app móvil
   (`POST /api/mobile/mermas`) no escribe `creadoPorId`, ni kardex
   (`StockMoveLine`), ni el espejo `AjusteInventario`, ni notifica — el
   inventario móvil queda invisible para trazabilidad y reconciliación.
3. **Bloquean flujos con 500**: anular una venta vinculada a oferta no limpia
   `Venta.ofertaId` (unique); la re conversión/facturación de la oferta choca
   con `P2002` sin capturar y la oferta queda en limbo para siempre.
4. **Distorsionan stock**: `getStockDisponibleEnPuntoVenta` (BUG-3 del change
   `fix-transferencias-bugs`, único BUG-1..5 no aplicado) suma transferencias
   CANCELADA/RECHAZADA y eliminadas, bloqueando transferencias legítimas.
5. **Asimetría de permisos**: `completarTransferenciaAction` no exige
   `requirePermission` mientras aprobar/rechazar sí lo hacen.
6. **Validación evadible**: el período contable cerrado solo se valida
   client-side en gastos (`usePeriodLock` en `GastoDEForm`); la API móvil de
   gastos y las server actions de `gastosDE` aceptan escrituras sobre
   períodos cerrados.

## What Changes

- **F-1 (catálogo)**: guard de borrado en `deletePuntoDeVentaAction` (bloquea
  con conteos si tiene productos/ventas/turnos/arqueos/transferencias, patrón
  `deleteAlmacenAction`) + endurecimiento de cascadas destructivas en
  `prisma/schema.prisma`: `Producto.puntoDeVenta` Cascade→SetNull,
  `Producto.categoria` Cascade→Restrict, `Categoria.parent`
  Cascade→Restrict.
- **F-2 (mermas)**: extracción del alta de merma a un servicio compartido
  (`registrarMermaEnTransaccion`) usado por `createMermaAction` y por
  `POST /api/mobile/mermas`; la ruta móvil pasa a escribir `creadoPorId`,
  kardex `SALIDA-0`, espejo `AjusteInventario` y a notificar. El evento
  contable de CTA engancha en ese punto único cuando la rama de contabilidad
  se integre.
- **F-3 (ofertas)**: `anularVentaPorEstado` limpia `ofertaId` y restaura la
  oferta a `ACEPTADA`; guarda de venta vinculada activa en
  `convertirOfertaAPedido` y `facturarOfertaWorkflow`; captura de `P2002` con
  error amigable como red de seguridad.
- **F-4 (transferencias)**: `getStockDisponibleEnPuntoVenta` excluye
  `deletedAt` y estados `CANCELADA`/`RECHAZADA` en ambos aggregates (BUG-3);
  `completarTransferenciaAction` exige `inventario.transferencias.gestionar`.
- **F-5 (gastos)**: enforcement server del período cerrado en
  `createGastosDEAction`, `updateGastosDEAction`, `deleteGastosDEAction`,
  `deleteGastosDEBulkAction`, `aprobarGastoDEAction`, `rechazarGastoDEAction`
  (vía `withPeriodValidation` / `PeriodoGuard.assertWritable` sobre el campo
  `periodo` YYYY-MM) y en `POST /api/mobile/expenses` (vía
  `validarEscrituraPeriodo`).

## Impact

- **Specs afectadas**: `catalogo`, `mermas`, `ventas-ofertas`,
  `transferencias`, `gastos-periodos` (deltas en `specs/`).
- **Código**: `src/features/puntos-venta/actions.ts`,
  `src/features/categorias/actions.ts` (solo si el guard necesita ajuste),
  `prisma/schema.prisma`, `src/features/mermas/*` (nuevo servicio + action +
  route móvil), `src/features/ventas/services/venta-lifecycle-service.ts`,
  `src/features/ofertas/services/convertir-oferta-pedido.ts`,
  `src/features/ofertas/services/facturar-oferta-workflow.ts`,
  `src/features/transferencias/actions.ts`, `src/features/gastosDE/actions.ts`,
  `src/app/api/mobile/expenses/route.ts`.
- **Base de datos**: sin migración SQL manual; los cambios de `onDelete` se
  aplican con `db-push` en el deploy de Railway (convención del proyecto).
  No hay cambios de columnas ni backfills.
- **Fuera de alcance (sesiones B+)**: estado PARCIAL real de transferencias,
  EN_TRANSITO, logs de auditoría de transferencias; evento contable de merma
  (vive en la rama `feat/contabilidad-capa-formal`); enforcement de período en
  flujos de `GastoCompra` de compras-productos; estados VENCIDA de ofertas.
