# PVE — Pedidos de venta con ciclo de estados

## Decisión ejecutiva

Se introduce un **ciclo de vida en la propia `Venta`** (`PEDIDO → ENTREGADA → FACTURADA`, más `ANULADA`)
en lugar de un modelo `PedidoVenta` separado. La creación de la venta deja de ejecutar todos los
efectos (stock, FIFO, factura, cobro) en una sola pasada y los difiere a transiciones explícitas;
el flujo actual de POS/mobile sigue funcionando **creando la venta y completando el ciclo dentro de
la misma transacción**, sin cambio de UX ni de API para los caminos existentes. Origen: verificación
Ventas vs Odoo (2026-09-14, memoria `ventas-vs-odoo-verificacion`, gap 1: "la venta existe o está
anulada, sin estados intermedios").

## Problema

Hoy `VentaMutationService.create` (`src/features/ventas/services/venta-mutation-service.ts:97`)
hace todo en una transacción: valida, crea la venta, descuenta stock (`upsertStockUbicacion`),
aplica FIFO (`allocateFifoForSale`), y opcionalmente crea `Factura` + CxC
(`applyFacturacionCobroWorkflow`). Consecuencias:

- No hay forma de registrar un **pedido confirmado pendiente de entrega** (encargo, mayorista,
  venta con entrega posterior): el sistema obliga a entregar y cobrar al instante.
- No hay forma de **entregar sin facturar** ni de facturar después.
- La anulación es la única "transición" y asume siempre el escenario completo (reintegra stock,
  revierte FIFO, anula factura/CxC), rechazando si el turno está cerrado
  (`venta-mutation-service.ts:576-585`).
- Frente a Odoo (cotización → pedido confirmado → entrega → factura), TCP tiene la cotización
  (`Oferta` con estados) pero le falta todo lo que va entre cotización aceptada e historial.

## Propuesta

1. **Enum `EstadoVenta`** en `prisma/schema.prisma`: `PEDIDO`, `ENTREGADA`, `FACTURADA`, `ANULADA`;
   campo `estado EstadoVenta @default(ENTREGADA)` en `Venta`. `ENTREGADA` como default preserva
   la semántica histórica ("venta efectuada") para toda fila nueva creada por el flujo clásico.
2. **Servicio de ciclo de vida** `src/features/ventas/services/venta-lifecycle-service.ts` con una
   función por transición (`entregarVenta`, `facturarVenta`, `anularVentaPorEstado`), cada una con
   guardas de estado y efectos idempotentes. Los efectos se **extraen** de
   `VentaMutationService.create` sin cambiar su lógica:
   - crear (`PEDIDO`): validación completa + persistencia, **sin** stock/FIFO/factura;
   - `PEDIDO → ENTREGADA`: validación de stock en el momento de entrega + descuento
     (`upsertStockUbicacion`) + `allocateFifoForSale` + kardex;
   - `ENTREGADA → FACTURADA`: creación de `Factura` con serie (gate `ventas-factura` vigente) +
     cobro/CxC por `applyFacturacionCobroWorkflow`;
   - `* → ANULADA`: efectos según estado origen — desde `PEDIDO` solo se marca (nada que revertir);
     desde `ENTREGADA`/`FACTURADA` se reutiliza la lógica de anulación actual. Se mantiene la
     guarda de turno cerrado y `deletedAt` se sigue escribiendo (es el mecanismo de exclusión que
     ya consumen reportes, cuadre y CxC); `estado = ANULADA` y `deletedAt` se escriben en la misma
     transacción.
3. **`create` se vuelve orquestador**: crea en `PEDIDO` y, según la entrada, encadena las
   transiciones hasta el estado objetivo **dentro de la misma transacción**. El comportamiento
   observable del POS y del API mobile queda idéntico (venta `ENTREGADA`/`FACTURADA` al finalizar).
4. **Permiso nuevo** `ventas.pedido.gestionar` (categoría `ventas`, default = mismos roles que
   `ventas.venta.registrar`) para las transiciones del ciclo fuera del POS; anulación sigue bajo
   `ventas.venta.anular`. Fixture de paridad actualizado.
5. **Feature de plan** `ventas-pedidos` en `feature-registry.ts` ("Pedidos de venta": encargos y
   entregas diferidas) gateando la UI nueva; el flujo clásico no se gatea.
6. **UI de pedidos** (lista en ventas con badge/filtro de estado, acciones de transición en
   detalle, formulario de pedido sin cobro inmediato) detrás del flag.
7. **Integración Ofertas**: acción nueva "Convertir a pedido" (`PENDIENTE/ACEPTADA →` venta
   `PEDIDO`). La acción actual de facturar oferta mantiene su comportamiento (ciclo completo).
8. **Migración con backfill**: `deletedAt != null → ANULADA`; con factura → `FACTURADA`;
   resto → `ENTREGADA`.

## Alternativas evaluadas

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| (a) Ciclo de estados en `Venta` | Un solo modelo; anulación/reportes/CxC siguen sobre la misma fila; POS intacto | Hay que refactorizar `create` con cuidado | **Elegida** |
| (b) Modelo `PedidoVenta` separado que convierte a `Venta` | No toca `Venta` | Duplica ~90% del modelo y su lógica (items, precios LP-0, anticipos); doble contabilidad de stock; otro punto de conversión | Descartada |
| (c) Reusar `Oferta` como pedido | Cero schema nuevo | Mezcla cotización (comercial) con pedido (operativo); `Oferta` no lleva turno/PV ni pagos | Descartada |

## No-goals

- Sin **reserva dura de stock** al confirmar el pedido: la validación de disponibilidad ocurre al
  crear (advertencia) y de forma vinculante al entregar. La reserva con stock comprometido es un
  change futuro.
- Sin devoluciones parciales ni notas de crédito (Gap 2, plan aparte).
- Sin edición de pedido confirmado: el camino admitido es anular y recrear (la edición queda como
  fast-follow si el uso real lo pide).
- Sin cambios en la app mobile: sigue creando ventas completas en una llamada.
- Sin cambios en precios (LP-0 sigue siendo la única fuente de verdad) ni en anticipos
  (cobro con anticipo ocurre en la transición de facturación/cobro, como hoy).
- Sin estados de pago separados: el pago/crédito se expresa vía `Factura` + `CuentaPorCobrar`,
  como hoy.

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Schema | `prisma/schema.prisma` + migración | `EstadoVenta`, `Venta.estado`, backfill |
| Ciclo de vida | `src/features/ventas/services/venta-lifecycle-service.ts` (nuevo) | Transiciones con guardas e idempotencia |
| Creación | `src/features/ventas/services/venta-mutation-service.ts` | `create` orquesta transiciones; extracción de efectos |
| Anulación | `venta-mutation-service.ts` (anular) | Delega por estado; escribe `estado` + `deletedAt` |
| Permisos | `src/lib/auth/permission-registry.ts` + fixture paridad | `ventas.pedido.gestionar` |
| Plan comercial | `src/features/planes/feature-registry.ts` | Feature `ventas-pedidos` |
| UI | `src/app/busy/sales/`, `src/features/ventas/components/` | Badge/filtro de estado, acciones, form pedido |
| Ofertas | `src/features/ofertas/actions.ts` + service | "Convertir a pedido" |
| Mobile/legacy | `src/app/api/mobile/*` (ventas) | Sin cambio funcional (verificación de regresión) |
| Tests | `src/features/ventas/__tests__/venta-lifecycle*.test.ts` (nuevos) + mocks existentes | RED→GREEN |

## Criterios de aceptación

1. Existe `Venta.estado` con backfill correcto: toda venta preexistente queda `ANULADA`,
   `FACTURADA` o `ENTREGADA` según regla documentada; `prisma migrate deploy` aplica limpio.
2. Crear pedido (`PEDIDO`) no descuenta stock, no genera FIFO/kardex ni factura; listarlo muestra
   badge y no altera cuadre ni reportes de ventas efectivas.
3. `PEDIDO → ENTREGADA` descuenta stock y aplica FIFO exactamente como hoy lo hace `create`;
   si el stock ya no alcanza al entregar, la transición se rechaza sin efectos parciales.
4. `ENTREGADA → FACTURADA` crea la factura con serie con la misma numeración y CxC/cobro de hoy;
   una venta de POS creada por el flujo clásico termina en `FACTURADA` (o `ENTREGADA` si el plan
   no incluye factura) en una sola operación, sin que el cajero perciba diferencia.
5. Anular desde `PEDIDO` no toca stock; desde `ENTREGADA`/`FACTURADA` ejecuta la reversión actual
   completa; en ambos casos `estado=ANULADA` y `deletedAt` quedan escritos en una transacción.
6. Mobile/legacy y POS pasan la regresión sin cambios de contrato; suites scoped de ventas verdes,
   `tsc --noEmit` y eslint limpios en archivos tocados.
