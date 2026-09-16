# DNC — Devoluciones parciales y nota de crédito formal

## Decisión ejecutiva

Se introduce un flujo de **devolución parcial** sobre ventas activas: documento operativo
`DevolucionVenta` + `DevolucionVentaItem` (montos en centavos `Int`, mundo venta) vinculado a
una `Factura` con `tipoDocumento = NOTA_CREDITO` y serie propia `NC-`. La NC no reasigna una
etiqueta: nace numerada, con la `tasaCambio` histórica de la venta y tratamiento financiero en
cascada — primero reduce la CxC pendiente de la venta, el excedente va a **saldo a favor del
cliente** (un `Anticipo` de tipo COBRO sin contrato, vía ledger existente) o a **reembolso en
efectivo** (permiso sensitive + turno abierto, impacta el esperado del arqueo del turno en
curso). La venta original queda activa; una venta con devoluciones ya no puede anularse en
bloque (la devolución total cubre ese caso). Origen: comparativa Ventas vs Odoo, Gap 2
(2026-09-14).

## Problema

Hoy la única corrección posible sobre una venta es la anulación total
(`VentaMutationService.cancel`, `src/features/ventas/services/venta-mutation-service.ts:479`),
que además se bloquea si el turno está cerrado o tiene arqueo. No existe forma de registrar
que un cliente devolvió 2 de 10 unidades: ni reintegro parcial de stock, ni documento fiscal
que respalde el crédito otorgado, ni rastro del dinero devuelto. El enum
`TipoDocumento.NOTA_CREDITO` (`prisma/schema.prisma:3209`) solo sirve como etiqueta manual
reasignable en `src/features/facturas/actions.ts` — sin numeración propia, sin efectos y sin
vínculo con la mercancía devuelta. En la operación cubana real la devolución parcial con
saldo a favor o reintegro es un caso semanal; su ausencia fuerza anulaciones destructivas o
ajustes manuales fuera del sistema.

## Propuesta

1. **Modelo de datos** (`prisma/schema.prisma`): `DevolucionVenta` (cabecera con montos,
   tratamiento, `idempotencyKey`, vínculos a NC / anticipo / turno de reembolso) +
   `DevolucionVentaItem` (cantidad ≤ disponible del `VentaItem`, costo FIFO restaurado,
   ubicación destino). `Anticipo.contratoId` pasa a opcional para soportar saldos a favor
   originados en NC; `ContextoAnticipo` gana `NOTA_CREDITO`. No se añade valor al enum
   `TipoOrigenMovimiento`: el kardex de la devolución se registra como `tipoOrigen: 'VENTA'`
   con `origenId = devolucionId` (neteo natural en reportes; justificación en design.md).
2. **Motor de dominio puro** (`devolucion-calculo.ts`): disponibles por ítem (vendido −
   devuelto acumulado), montos con prorrateo determinista del descuento de la venta, y la
   política financiera en cascada (CxC → saldo a favor / reembolso).
3. **Servicio transaccional** `DevolucionVentaService.registrar`: misma disciplina de la
   anulación (lock `FOR UPDATE` sobre la venta, `Serializable`, claim idempotente) y efectos
   en una sola tx: stock de vuelta a la ubicación origen (`upsertStockUbicacion` delta +),
   línea de kardex con costo histórico FIFO (restauración parcial de `PurchaseAllocation`,
   costo ponderado), serie `NC-`, NC como `Factura` hija de la devolución, cascada financiera
   y `AuditLog`.
4. **Cascada financiera** (decisión central): si la venta tiene CxC con saldo pendiente, la NC
   se aplica primero ahí (`montoPagado += aplicado`, recálculo de estado). El excedente va por
   defecto a saldo a favor (`Anticipo` COBRO sin contrato, usable desde el POS como hoy) o,
   si el usuario tiene `ventas.devolucion.reembolso` y hay turno abierto en el PV, a reembolso
   en efectivo que queda amarrado al turno en curso (`turnoReembolsoId`) y descuenta el
   esperado del arqueo.
5. **Actions + UI**: `getDevolucionContextoAction`, `registrarDevolucionAction`,
   `getDevolucionesAction`; wizard "Devolver…" desde el detalle de la venta, vista de NC
   emitidas en el módulo de facturas, badge "con devoluciones" en la venta y bloqueo
   explícito de la anulación total cuando existen devoluciones activas.

## No-goals

- No hay reversión/anulación de una devolución ya registrada (su inverso exigiría volver a
  descontar stock posiblemente ya revendido; fast-follow con decisión propia).
- No se redirige el stock devuelto a una ubicación distinta de la origen (para mercancía
  dañada: transferencia posterior con el flujo existente).
- No se reintegran ingredientes de productos compuestos: la venta descuenta el producto
  terminado y la devolución lo reintegra tal cual (consistente con `esCompuesto`).
- No hay reembolsos en USD ni en moneda distinta de la venta (el esperado USD del arqueo ya
  es un stub hoy).
- No se devuelve `cargoTransporte`; el prorrateo solo considera el descuento de la venta.
- No se toca el relabeling manual de `tipoDocumento` en facturas (queda como legacy; la NC
  formal del sistema es la emitida por este flujo).
- No hay guarda de período contable cerrado (la anulación tampoco la tiene; criterio único
  si se introduce después para ambos).
- Sin E2E automatizado: smoke manual post-deploy (ver tasks).

## Dependencia con PVE (`pedidos-venta-ciclo-estados`)

PVE introduce `EstadoVenta` (PEDIDO→ENTREGADA→FACTURADA) y extrae los efectos a
`venta-lifecycle-service.ts`. **Las devoluciones operan sobre ventas con efectos ya
aplicados**: con PVE desplegado, solo `ENTREGADA`/`FACTURADA` admiten devolución. Si al
ejecutar DNC el PVE aún no está desplegado (verificado 2026-09-14: no existe
`venta-lifecycle-service.ts`), la guarda se implementa sobre `deletedAt == null` (venta
activa, igual que hoy) y se deja el punto de extensión documentado para añadir el filtro de
`estado` cuando PVE aterrice. DNC no modifica el ciclo de vida: una venta con devolución
total sigue activa (no pasa a ANULADA).

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Schema | `prisma/schema.prisma` + migración | `DevolucionVenta`, `DevolucionVentaItem`, `EstadoDevolucion`, `ContextoAnticipo.NOTA_CREDITO`, `Anticipo.contratoId` opcional, back-relations |
| Permisos | `src/lib/auth/permission-registry.ts`, fixture paridad | `ventas.devolucion.registrar` (manager/economico), `ventas.devolucion.reembolso` (manager, sensitive) |
| Dominio | `src/features/ventas/services/devolucion-calculo.ts` (nuevo) | Disponibles, montos, cascada financiera (puro) |
| Servicio | `src/features/ventas/services/devolucion-venta-service.ts` (nuevo), `src/lib/services/fifo-allocation.ts`, `src/lib/services/anticipos-workflow.ts` | Registro transaccional + helper FIFO parcial + `createAnticipoDevolucion` |
| Kardex | `src/features/inventario/movimientos.ts` | Sin enum nuevo; reutiliza `registrarMovimiento` con `origenId` = devolución |
| Anulación | `src/features/ventas/services/venta-mutation-service.ts` | Guarda `VENTA_CON_DEVOLUCIONES` en `cancel` |
| Arqueo | `src/features/arqueo-caja/actions.ts`, `/api/mobile/pos/turnos/esperados/route.ts` | El esperado resta reembolsos del turno |
| Actions/UI | `src/features/ventas/actions-devoluciones.ts`, `components/devolucion-wizard.tsx`, `ventas-table.tsx`, vista NC en facturas | Wizard + listados + badge |
| Reportes | `src/features/reportes`, cuadre diario/turno | Línea "Devoluciones" y neteo (alcance T5) |
| Tests | `src/features/ventas/__tests__/devolucion-*.test.ts`, `src/features/ventas/__integration__/devolucion-fifo.test.ts` | Unitarios con prisma mockeado + 1 integración real |

## Criterios de aceptación

1. Devolución parcial de 2 ítems sobre una venta de 3 ítems: stock reintegrado en la
   ubicación origen, kardex con entrada positiva a costo FIFO histórico ponderado,
   allocations reducidos (sin borrar los que quedan), NC `NC-000xxx` emitida y venta activa.
2. Doble submit con el mismo `idempotencyKey` → una sola devolución; intento de devolver más
   de lo vendido (incluyendo devoluciones previas) → rechazo `CANTIDAD_EXCEDIDA` sin efectos
   parciales. Venta anulada → rechazo. Sin permiso → rechazo.
3. Venta a crédito con CxC pendiente de 100 y devolución de 150: CxC queda PAGADA
   (montoPagado += 100) y los 50 restantes van a saldo a favor (o reembolso autorizado).
4. Reembolso en efectivo con turno abierto: el esperado de efectivo del arqueo de ese turno
   descuenta el monto; sin turno abierto o sin `ventas.devolucion.reembolso` → solo saldo a
   favor.
5. Venta con devoluciones activas → anulación total rechazada con `VENTA_CON_DEVOLUCIONES` y
   mensaje que orienta a completar la devolución al 100%.
6. Suite scoped verde, test de integración FIFO parcial verde con DB real, `lint` limpio en
   archivos tocados, paridad de permisos sin regresiones.
