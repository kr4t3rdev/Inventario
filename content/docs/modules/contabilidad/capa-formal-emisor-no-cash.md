# Emisor formal no Cash (CxC/CxP, servicios y anticipos)

La capa formal contable exige que todo movimiento de tesorería tenga su asiento
con partida doble, hash encadenado y evidencia de auditoría. La primera
integración tenía tres emisores de operaciones Cash (cobro de préstamo, pago
de deuda y desembolso de deuda); esta capa añade cobros de ventas, servicios y
pagos de gastos.

Los writers conectados traducen cada conciliación operativa persistida en un
evento formal: cobro de venta (`COBRO_CXC`), pago de gasto (`PAGO_CXP`), cobro
de servicios (`COBRO_SERVICIO`), reconocimiento de compra a crédito
(`COMPRA_CREDITO`) y recepción, entrega o aplicación de anticipos.

## Qué emite

| Evento | Plantilla | Diario | Contrapartida |
|---|---|---|---|
| `COBRO_CXC` | 6 líneas (3 ramas FX + 2 de diferencia + tesorería) | `VENTAS` | `CXC_CLIENTES` |
| `PAGO_CXP` | 6 líneas (espejo del anterior) | `COMPRAS` | `CXP_PROVEEDORES` |
| `COBRO_SERVICIO` | Plantilla de cobro de servicios con ramas FX | `VENTAS` | `CXC_CLIENTES` |
| `COMPRA_CREDITO` | Inventario contra cuentas por pagar | `COMPRAS` | `CXP_PROVEEDORES` |
| `GASTO_CREDITO` | Gasto operativo contra cuentas por pagar (servicios recibidos) | `COMPRAS` | `CXP_PROVEEDORES` |
| `ANTICIPO_CLIENTE_RECIBIDO` | Tesorería contra anticipos de clientes | `VENTAS` | `ANTICIPOS_CLIENTES` |
| `ANTICIPO_CLIENTE_APLICADO` | Anticipos de clientes contra CxC, con ramas FX | `VENTAS` | `CXC_CLIENTES` |
| `ANTICIPO_PROVEEDOR_ENTREGADO` | Anticipos a proveedores contra tesorería | `COMPRAS` | `ANTICIPOS_PROVEEDORES` |
| `ANTICIPO_PROVEEDOR_APLICADO` | CxP contra anticipos de proveedores, con ramas FX | `COMPRAS` | `CXP_PROVEEDORES` |
| `ANTICIPO_CLIENTE_APLICACION_REVERSADA` | Asiento compensatorio de la aplicación | `VENTAS` | `CXC_CLIENTES` / `ANTICIPOS_CLIENTES` |
| `ANTICIPO_CLIENTE_DEVUELTO` | Devolución de fondos disponibles al cliente, con diferencia FX | `VENTAS` | `ANTICIPOS_CLIENTES` / `CAJA_PRINCIPAL` |
| `ANTICIPO_PROVEEDOR_APLICACION_REVERSADA` | Asiento compensatorio de la aplicación | `COMPRAS` | `ANTICIPOS_PROVEEDORES` / `CXP_PROVEEDORES` |
| `ANTICIPO_PROVEEDOR_REINTEGRADO` | Reintegro de fondos disponibles por el proveedor, con diferencia FX | `COMPRAS` | `CAJA_PRINCIPAL` / `ANTICIPOS_PROVEEDORES` |
| `MERMA_INVENTARIO` | Merma contra inventarios | `AJUSTES` | `INVENTARIOS` |
| `MERMA_INVENTARIO_REVERSADA` | Asiento compensatorio de una merma | `AJUSTES` | `INVENTARIOS` / `MERMAS` |
| `PRODUCCION_SALIDA` | Reclasificación de materias primas a producto terminado | `AJUSTES` | `INVENTARIOS` (ambas líneas) |

Las plantillas de CxC/CxP, servicios y anticipos ya existían en
`src/features/contabilidad-formal/lib/plan-default.ts`; lo nuevo es el **emisor**:
el punto que traduce una conciliación operativa persistida en un evento formal.
La plantilla compensatoria `MERMA_INVENTARIO_REVERSADA` se añadió con el emisor
de inventario y se siembra en la migración para bases existentes.

## Reglas de valoración

El emisor **no recalcula** moneda ni tipo de cambio: consume la valoración que
la conciliación dejó persistida (`monto`, `moneda`, `montoConvertido`,
`functionalCurrency`, `tasaCambio`, `fxEvidenceFingerprint`), igual que hace el
builder de pagos Cash.

- Si la moneda de la operación difiere de la funcional, el motor exige tasa **y**
  huella de evidencia FX (`VALORACION_FX_INCOMPLETA` si falta alguna).
- Si la operación va en la moneda funcional y no hay conversión persistida, el
  importe funcional es el propio monto.
- Si la operación va en otra moneda y no hay conversión persistida, el importe
  funcional queda nulo y el motor falla cerrado.
- `medioCobro` se deriva del tipo de la cuenta bancaria: `EFECTIVO` → `CAJA`,
  cualquier otro → `BANCOS` (sustituye el rol `CAJA_PRINCIPAL` por `BANCOS`).
- La diferencia FX residual se emite en cero: la conciliación ya contiene el
  valor funcional valuado con la tasa persistida, por lo que aplica la rama
  `SIN_DIFERENCIA_FX`.

## Writers conectados

| Writer | Evento | Nota |
|---|---|---|
| `src/features/contabilidad/actions-reconciliacion.ts` → `reconciliarVentaAction` | `COBRO_CXC` | Ya persistía la evidencia FX |
| `src/features/contabilidad/services/accounting-reconciliation-service.ts` → `reconcileSale` | `COBRO_CXC` | Ahora persiste la evidencia FX |
| `src/features/contabilidad/services/accounting-reconciliation-service.ts` → `reconcileService` | `COBRO_SERVICIO` | Un asiento por distribución, basado en su valoración persistida; comparte la transacción operativa |
| `src/app/api/contabilidad/reconciliacion/servicios/route.ts` (POST) | `COBRO_SERVICIO` | Conserva el cobro individual legacy; persiste la valoración funcional y emite en la misma transacción |
| `src/features/ventas/services/facturacion-workflow.ts` → `applyFacturacionCobroWorkflow` | `COBRO_CXC` | `contra_pago` persiste valoración funcional y emite en la misma transacción; requiere tasa vigente para moneda extranjera |
| `src/app/api/contabilidad/reconciliacion/ventas/route.ts` (POST) | `COBRO_CXC` | Ruta legacy: el valor funcional se toma del importe en CUP de la operación, porque ahí `montoConvertido` guarda el importe en la moneda del banco |
| `src/lib/services/pago-gastos-workflow.ts` → `applyPagoGastoWorkflow` | `PAGO_CXP` | Solo cuando la conciliación no queda `PENDIENTE` (una conciliación pendiente no mueve la tesorería) |
| `src/features/productos/actions-restock.ts` → `handlePaymentInTransaction` | `PAGO_CXP` | Solo `PAGO_COMPLETO`; persiste evidencia FX y emite dentro de la transacción que registra el pago y descuenta la cuenta |
| `src/features/compras-productos/actions.ts` → `createCompraProductoAction` | `COMPRA_CREDITO` | Reconoce compras a crédito, anticipadas y contado antes de liquidar cualquier pago; comparte la transacción |
| `src/features/compras-servicios/actions.ts` → `createCompraServicioAction` | `GASTO_CREDITO` | Devenga el gasto operativo contra CxP al recibir el servicio; comparte la transacción y la valoración con la vía de anticipos |
| `src/features/mermas/services/registrar-merma-service.ts` → `registrarMermaEnTransaccion` | `MERMA_INVENTARIO` | Punto único de escritorio y móvil; ancla el asiento a la versión persistida de `AjusteInventario` |
| `src/features/mermas/actions.ts` → `updateMermaAction` / `deleteMermaAction` | `MERMA_INVENTARIO_REVERSADA` + `MERMA_INVENTARIO` | Editar revierte la versión anterior y reconoce la nueva; eliminar solo revierte |
| `src/app/api/mobile/mermas/[id]/route.ts` → `DELETE` | `MERMA_INVENTARIO_REVERSADA` | Mismo criterio que la eliminación de escritorio |
| `src/features/produccion/actions.ts` → `completarOrdenProduccionAction` | `PRODUCCION_SALIDA` | Emite al completar, con el costo histórico de las líneas `ING-*` del kardex |

`PAGO_COMPLETO` exige cuenta bancaria y tipo de pago explícitos. La compra se
reconoce contra CxP y `applyPagoGastoWorkflow` registra la conciliación, valida
y descuenta el saldo, liquida la CxP y emite `PAGO_CXP` dentro de la misma
transacción. Así el pago se representa con dos eventos enlazados, sin acreditar
tesorería sin evidencia. `ANTICIPO_PAGO` también se reconoce contra CxP antes de
aplicar el anticipo. Para monedas distintas de CUP, el formulario exige tasa y
el evento de compra persiste la evidencia FX construida para la fecha de compra;
el motor no inventa una valoración funcional cuando falta. Este reconocimiento
usa el modo global `CONTABILIDAD_FORMAL_MODE`; no cambia los gates de emisor no
Cash.

Las compras de servicios devengan `GASTO_CREDITO` (gasto operativo contra CxP)
en la misma transacción de creación, reconocidas antes de aplicar cualquier
anticipo; la aplicación del anticipo ya emite `ANTICIPO_PROVEEDOR_APLICADO` desde
el workflow de anticipos y el pago posterior desde Contabilidad emite `PAGO_CXP`
por el workflow de gastos. La valoración reutiliza la tasa publicada del catálogo
(vigencia e id de tasa quedan en la evidencia FX); si el servicio va en moneda
extranjera y no hay tasa publicada, el reconocimiento queda sin valoración
funcional y el motor falla cerrado — la vía de anticipos, además, rechaza la
conciliación, igual que antes.

Las mermas y la producción usan el modo global `CONTABILIDAD_FORMAL_MODE`, no el
gate `CONTABILIDAD_FORMAL_NO_CASH_MODE`. La merma se ancla a la fila concreta de
`AjusteInventario` que la representa: crear emite `MERMA_INVENTARIO`; editar
emite `MERMA_INVENTARIO_REVERSADA` sobre la versión anterior y reconoce la nueva
versión con su propio `AjusteInventario`; eliminar solo revierte. La reversión se
emite únicamente si el reconocimiento original quedó contabilizado (o simulado en
la outbox cuando el modo es `shadow`), de modo que los datos legacy sin asiento
no generan compensaciones huérfanas. Un monto de costo cero se omite sin romper
la operación.

La producción emite `PRODUCCION_SALIDA` al **completar** la orden, no al
aprobarla. El importe sale de las líneas `ING-*` ya persistidas en el kardex al
consumir las materias primas, que conservan el costo histórico real; las órdenes
antiguas sin esas líneas caen al cálculo histórico por receta para no completar
con costo cero. La plantilla reclasifica inventario de materias primas contra
inventario de producto terminado, por lo que ambas líneas usan el rol
`INVENTARIOS`.

## Rollout

El emisor tiene su propio modo, independiente del modo global de la capa:

```bash
CONTABILIDAD_FORMAL_NO_CASH_MODE=off     # por defecto: no se emite nada
CONTABILIDAD_FORMAL_NO_CASH_MODE=shadow  # evidencia simulada en la outbox, sin asientos
CONTABILIDAD_FORMAL_NO_CASH_MODE=enforce # se exige el asiento formal
```

Procedimiento recomendado:

1. **off** (estado por defecto tras el despliegue): no cambia el comportamiento.
2. **shadow**: se observa la outbox (`ShadowOutbox`) en los tenants con tráfico:
   `SIMULADO` = el asiento se habría contabilizado; `ERROR_SHADOW` = la causa
   exacta del rechazo.
3. **enforce**: se exige el asiento. Si el motor rechaza (periodo cerrado, rol
   sin mapear, plantilla ausente, evidencia FX incompleta), la escritura
   operativa falla cerrada.

El flag global `contabilidad-formal` (habilitado para todos los planes) sigue
siendo condición necesaria dentro del motor: sin él no se contabiliza ningún
evento, aunque el emisor no Cash esté en `enforce`.

## Precondiciones por tenant

La capa falla cerrado; para que el emisor funcione, el tenant necesita:

- plan de cuentas sembrado (35 cuentas + 7 diarios + 25 roles) y las
  plantillas globales activas;
- `TenantAccountingPolicy.functionalCurrencyCode` configurada;
- un período contable **abierto** para la fecha de la operación.

El alta contractual de un anticipo es solo una reserva y no emite asiento. La
recepción/entrega explícita persiste el movimiento de tesorería y la valoración
FX; cada aplicación posterior usa el costo funcional promedio de los fondos
financiados y se ancla a su movimiento de aplicación. Ambos momentos usan el
mismo gate `off/shadow/enforce`, que permanece `off` por defecto.
Al eliminar un gasto o servicio, las aplicaciones de anticipos financiados se
restituyen con un movimiento `REVERSO` y un asiento compensatorio anclado a ese
movimiento; esta operación no representa una devolución de efectivo.
La devolución de financiación sí registra la tesorería: el anticipo se reduce
por su valor funcional histórico proporcional, la cuenta se valora a la tasa
vigente y cualquier diferencia se contabiliza como resultado cambiario. Solo se
admiten importes disponibles que no se hayan aplicado a documentos.
La decisión y sus consecuencias están registradas en
[`ADR-0002`](../../../../docs/adr/0002-ciclo-formal-de-anticipos.md).

## Pendiente (slices siguientes)

- Los handlers legacy `handlers-deudas-cash.ts`, `handlers-prestamos-cash.ts` y
  `handlers-reconciliacion-servicios.ts` no tienen callers detectados en `src`;
  los endpoints activos delegan en servicios de mutación o emiten desde sus
  rutas actuales. No se consideran writers activos pendientes de integración.
- El modo `enforce` por tenant (hoy el modo es global): permitir un flag de
  licencia para activar el emisor tenant a tenant.

## Referencias

- Motor: `src/features/contabilidad-formal/services/posting-engine.ts`
- Builder: `src/features/contabilidad-formal/lib/settlement-event-builder.ts`
- Anticipos: `src/features/contabilidad-formal/lib/advance-event-builder.ts` y
  `src/features/contabilidad-formal/services/advance-posting-service.ts`
- Servicio de emisión: `src/features/contabilidad-formal/services/settlement-posting-service.ts`
- Inventario (merma y producción): `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts`
- Gate de rollout: `src/features/contabilidad-formal/services/non-cash-emitter-gate.ts`
- Plan de integración por slices: `docs/plan-ct1-integracion-capa-formal-2026-10-27.md`
