# R0.5 — Matriz canónica de writers formales

**Fecha de corte:** 2026-11-10
**Alcance:** inventario estático verificado del checkout local (`src/`), sin
observación de entornos remotos.
**Regresión:** `src/features/contabilidad-formal/__tests__/writers-matrix.test.ts`
**Estado:** cobertura documentada; **no es un acta de aceptación**.
`R0.5-ACCEPT` sigue sin firma y depende de `R6`/`R7`/`R7.4` (ver
`docs/ct1-cierre-integracion-capa-formal.md` §6).

Este documento reemplaza al inventario histórico
(`openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md`, corte
2026-10-11) como fuente vigente del conteo. No borra su historia: la conserva
como línea base del crosswalk de la sección 6.

## 1. Reconciliación de denominadores

Los tres conteos que circulan en la documentación **no son la misma unidad** y
no deben compararse entre sí. La confusión histórica provino de tratarlos como
equivalentes.

| Denominador | Qué cuenta | Valor | Fuente | Corte |
|---|---|---|---|---|
| 31 callsites en 19 archivos | invocaciones técnicas de `postEvento()` del writer histórico | 31 | rama `feat/contabilidad-capa-formal` | 2026-10-11 |
| 25 filas | agrupamientos por **writer de negocio** (una fila puede cubrir varios tipos de evento) | 25 | `docs/ct1-cierre-integracion-capa-formal.md` §4 | 2026-11-04 |
| 40 tipos | tipos de evento del contrato formal (`TipoEventoClave`) | 40 | `src/features/contabilidad-formal/services/replay-source-manifest.ts` | vigente |
| **24 callsites en 13 archivos** | **invocaciones técnicas de `postEvento()` en el árbol actual** | **24** | este documento | 2026-11-11 |

Reglas de lectura:

- **31 → 23 no es una pérdida de cobertura.** El posting se movió de las rutas y
  writers de negocio a servicios `*-posting-service.ts`. De los 19 archivos
  históricos, **18 dejaron de invocar `postEvento()` directamente**: 16 delegan
  en un emisor y 2 dejaron de emitir sin delegar (§6.1). El restante
  (`accounting-cash-operations-mutation-service.ts`) conserva 4 callsites
  propios. La sección 6 documenta archivo por archivo.
- **La matriz histórica no está en esta rama.** El inventario de 2026-10-11 vive
  en `feat/contabilidad-capa-formal`
  (`openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md`). Aquí
  solo se cita como línea base del crosswalk; no se edita desde este checkout.
- **25 filas no son 25 tipos.** Una fila de negocio puede emitir dos o más
  tipos (por ejemplo `anticipos-workflow.ts` cubre los ocho tipos de anticipo
  en cuatro invocaciones; las liquidaciones cubren `COBRO_CXC`, `COBRO_SERVICIO`
  y `PAGO_CXP` con un solo emisor).
- **40 tipos no son 40 writers.** La sección 4 resuelve cada tipo: 30 `replay`,
  2 programáticos y 8 solo plantilla. De los 30 `replay`, uno
  (`TRANSFERENCIA_BANCARIA`) no tiene writer vivo.

## 2. Definiciones y dimensiones

**Writer de negocio:** el flujo que decide la operación y abre la transacción
(por ejemplo `facturacion-workflow.ts`). Es el dueño de la atomicidad.

**Emisor (emitter) técnico:** el módulo que construye el evento y llama a
`postEvento()` (por ejemplo `sale-posting-service.ts`). Puede agrupar varios
tipos y varios writers.

**Callsite:** cada invocación textual de `postEvento()` contada por la
regresión. Es la unidad de los conteos 31 y 23.

Dimensiones (idénticas a la matriz de negocio de
`docs/ct1-cierre-integracion-capa-formal.md` §4):

- **(a)** actor/permiso del adaptador
- **(b)** aislamiento por tenant
- **(c)** origen único del asiento
- **(d)** moneda/FX con evidencia persistida
- **(e)** misma transacción que la escritura operativa
- **(f)** idempotencia y reintento
- **(g)** posteo del asiento y auditoría
- **(h)** rollback físico demostrado

Leyenda: **✅** evidencia explícita en el código o prueba citada; **⚠️**
evidencia estructural o indirecta (no un failpoint físico); **➖** no aplica por
diseño, o no hay writer que lo dispare.

Las dimensiones describen la **familia del writer**, no el módulo emisor: el
emisor se ejecuta dentro de la transacción del writer, por lo que hereda su
atomicidad y su aislamiento. Las filas sin writer vivo no heredan nada y se
marcan **➖** en las ocho columnas.

## 3. Matriz canónica de callsites (23 filas)

<!-- R0.5-CALLSITES:START -->

| # | Emisor (callsite) | Función emisora | Writer de negocio (invocador vivo) | Evento(s) | `origenTipo` | Familia | Manifiesto | a | b | c | d | e | f | g | h | Evidencia focal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L56` | `emitirAplicacionAnticipo` | `src/lib/services/anticipos-workflow.ts` (`applyAnticipoAllocations`, L1093) | `ANTICIPO_CLIENTE_APLICADO`, `ANTICIPO_PROVEEDOR_APLICADO` | `anticipo_movimiento` | Anticipos (aplicación) | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/lib/services/__tests__/anticipos-workflow.test.ts`, `src/features/contabilidad-formal/services/__tests__/advance-formal-posting-service.test.ts`, `src/features/contabilidad/__integration__/anticipo-aplicacion-formal-rollback-postgres.test.ts` |
| 2 | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L102` | `emitirReversionAplicacionAnticipo` | `src/lib/services/anticipos-workflow.ts` (`reverseAnticipo`, L864) | `ANTICIPO_CLIENTE_APLICACION_REVERSADA`, `ANTICIPO_PROVEEDOR_APLICACION_REVERSADA` | `anticipo_movimiento` | Anticipos (reversa de aplicación) | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/lib/services/__tests__/anticipos-workflow.test.ts`, `src/features/contabilidad-formal/services/__tests__/advance-formal-posting-service.test.ts`, `src/features/contabilidad/__integration__/anticipo-aplicacion-formal-rollback-postgres.test.ts` |
| 3 | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L149` | `emitirDevolucionAnticipo` | **sin invocador productivo** (la devolución real usa la fila 4) | `ANTICIPO_CLIENTE_DEVUELTO`, `ANTICIPO_PROVEEDOR_REINTEGRADO` | `anticipo_movimiento` | Anticipos (devolución, emisor especializado) | replay | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | `src/features/contabilidad-formal/services/__tests__/advance-formal-posting-service.test.ts` (solo prueba del emisor) |
| 4 | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L181` | `emitirEventoAnticipo` | `src/lib/services/anticipos-workflow.ts` (`registrarMovimientoEfectivoAnticipo`, L349; `devolverFondosAnticipo`, L637) | `ANTICIPO_CLIENTE_RECIBIDO`, `ANTICIPO_PROVEEDOR_ENTREGADO`, `ANTICIPO_CLIENTE_DEVUELTO`, `ANTICIPO_PROVEEDOR_REINTEGRADO` | `anticipo_movimiento` | Anticipos (origen y devolución) | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/lib/services/__tests__/anticipos-workflow.test.ts`, `src/features/contabilidad/__integration__/anticipo-formal-rollback-postgres.test.ts` |
| 5 | `src/features/contabilidad-formal/services/advance-posting-service.ts#L28` | `emitirEventoAnticipo` (variante con gate no Cash) | **sin importadores productivos** | los 8 tipos de anticipo (misma unión de `buildAnticipoEvent`) | `anticipo_movimiento` | Anticipos (emisor alterno inerte) | replay | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | módulo huérfano: sin test dedicado ni invocador; no participa del rollout |
| 6 | `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts#L198` | `emitirAjusteBancario` | `src/features/contabilidad/services/accounting-operations-mutation-service.ts` (`createBankAdjustment`) | `AJUSTE_BANCARIO_ABONO`, `AJUSTE_BANCARIO_CARGO` | `ajuste_bancario` | Ajustes bancarios | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/capital-adjustment-posting-service.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-idempotency-postgres.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-formal-rollback-postgres.test.ts` |
| 7 | `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts#L227` | `emitirInyeccionCapital` | `src/features/contabilidad/services/accounting-operations-mutation-service.ts` (`createCapitalInjection`) | `INYECCION_CAPITAL`, `DEUDA_RECIBIDA` | `inyeccion_capital` | Inyección de capital | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/capital-adjustment-posting-service.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-idempotency-postgres.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-formal-rollback-postgres.test.ts` |
| 8 | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L109` | `emitirReconocimientoMerma` | `src/features/mermas/actions.ts` (L318), `src/features/mermas/services/registrar-merma-service.ts` (L128) | `MERMA_INVENTARIO` | `ajuste_merma` | Mermas | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/mermas/__tests__/registrar-merma-service.test.ts`, `src/features/mermas/__tests__/actions.test.ts`, `src/features/mermas/__integration__/merma-formal-rollback-postgres.test.ts` |
| 9 | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L176` | `emitirReversionMermaSiContabilizada` | invocación interna: `revertirMermaContableEnTransaccion` (L241), llamada por `src/features/mermas/actions.ts` y `src/app/api/mobile/mermas/[id]/route.ts` | `MERMA_INVENTARIO_REVERSADA` | `ajuste_merma_reversado` | Reversa de merma | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/inventory-adjustment-posting-service.test.ts`, `src/features/mermas/__integration__/merma-formal-rollback-postgres.test.ts` |
| 10 | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L285` | `emitirProduccionInventario` | `src/features/produccion/actions.ts` (L768) | `PRODUCCION_SALIDA` | `orden_produccion` | Producción | replay | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | `src/features/produccion/__tests__/actions.test.ts`, `src/features/produccion/__integration__/produccion-formal-rollback-postgres.test.ts` |
| 11 | `src/features/contabilidad-formal/services/purchase-posting-service.ts#L45` | `emitirReconocimientoCompra` | `src/features/compras-productos/actions.ts` | `COMPRA_CREDITO` | `compra_documento` | Compras de producto | replay | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | `src/features/compras-productos/__tests__/actions.test.ts`, `src/features/compras-productos/__integration__/compra-formal-rollback-postgres.test.ts` |
| 12 | `src/features/contabilidad-formal/services/sale-posting-service.ts#L107` | `emitirVentaCredito` | `src/features/ventas/services/facturacion-workflow.ts` (L413) | `VENTA_CREDITO` | `factura` | Ventas a crédito | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/lib/services/__tests__/facturacion-ventas-workflow.test.ts`, `src/features/contabilidad-formal/services/__tests__/sale-posting-service.test.ts`, `src/features/ventas/__integration__/venta-formal-rollback-postgres.test.ts` |
| 13 | `src/features/contabilidad-formal/services/sale-posting-service.ts#L140` | `emitirVentaContado` | `src/features/ventas/services/facturacion-workflow.ts` (L357) | `VENTA_CONTADO` | `reconciliacion_venta` | Ventas al contado | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/lib/services/__tests__/facturacion-ventas-workflow.test.ts`, `src/features/contabilidad-formal/services/__tests__/sale-posting-service.test.ts`, `src/features/ventas/__integration__/venta-formal-rollback-postgres.test.ts` |
| 14 | `src/features/contabilidad-formal/services/sale-posting-service.ts#L196` | `emitirCostoVenta` | `src/features/ventas/services/venta-mutation-service.ts` (L628), `src/features/ventas/services/venta-lifecycle-service.ts` (L240) | `COSTO_VENTA_DEVENGADO` | `venta_costo` | Costo de venta FIFO | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/ventas/__tests__/venta-create-orquestacion.test.ts`, `src/features/ventas/__integration__/venta-formal-rollback-postgres.test.ts` |
| 15 | `src/features/contabilidad-formal/services/sale-return-posting-service.ts#L192` | `emitirDevolucionVenta` | `src/features/ventas/services/devolucion-venta-service.ts` | `DEVOLUCION_VENTA` | `devolucion_venta` | Devolución de venta | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/sale-return-posting-service.test.ts`, `src/features/ventas/__tests__/devolucion-service.test.ts`, `src/features/ventas/__integration__/devolucion-formal-rollback-postgres.test.ts` |
| 16 | `src/features/contabilidad-formal/services/service-purchase-posting-service.ts#L54` | `emitirReconocimientoCompraServicio` | `src/features/compras-servicios/actions.ts` (L134) | `GASTO_CREDITO` | `compra_servicio` | Compras de servicios | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/compras-servicios/__tests__/actions.test.ts`, `src/features/compras-servicios/__integration__/servicio-formal-rollback-postgres.test.ts` |
| 17 | `src/features/contabilidad-formal/services/service-sale-posting-service.ts#L63` | `emitirVentaServicio` | `src/features/venta-servicios/actions.ts` (L15 importa; emisión en la action) | `VENTA_SERVICIO_CREDITO` | `venta_servicio` | Ventas de servicios | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/venta-servicios/__tests__/reconocimiento-formal.test.ts`, `src/features/compras-servicios/__integration__/servicio-formal-rollback-postgres.test.ts` |
| 18 | `src/features/contabilidad-formal/services/settlement-formal-posting-service.ts#L45` | `emitirLiquidacionFormal` | **sin invocador productivo** (solo test) | `COBRO_CXC`, `PAGO_CXP`, `COBRO_SERVICIO` | `reconciliacion_venta`, `reconciliacion_gasto`, `reconciliacion_servicio` | Liquidaciones (emisor formal global) | replay | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | `src/features/contabilidad-formal/services/__tests__/settlement-formal-posting-service.test.ts` (solo prueba del emisor) |
| 19 | `src/features/contabilidad-formal/services/settlement-posting-service.ts#L170` | `emitirEventoLiquidacion` | `src/app/api/contabilidad/reconciliacion/ventas/route.ts`, `src/app/api/contabilidad/reconciliacion/servicios/route.ts`, `src/features/contabilidad/actions-reconciliacion.ts`, `src/features/contabilidad/services/accounting-reconciliation-service.ts`, `src/features/productos/actions-restock.ts`, `src/lib/services/pago-gastos-workflow.ts` | `COBRO_CXC`, `COBRO_SERVICIO`, `PAGO_CXP` | `reconciliacion_venta`, `reconciliacion_servicio`, `reconciliacion_gasto` | Liquidaciones (emisor no Cash) | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/__tests__/settlement-posting-service.test.ts`, `src/features/contabilidad/services/__tests__/accounting-reconciliation-fx.test.ts`, `src/features/contabilidad/__tests__/reconcile-service-cierre-factura.test.ts`, `src/lib/services/__tests__/pago-gastos-workflow.test.ts`, `src/features/contabilidad/__integration__/liquidacion-formal-rollback-postgres.test.ts` |
| 20 | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L495` | `createCashLoan` | `src/features/contabilidad/actions-prestamos-cash.ts` (L111) y `src/app/api/mobile/v1/accounting/cash-loans/route.ts` (L125); la ruta web `/api/contabilidad/prestamos-cash` **no delega** (§6.1) | `PRESTAMO_OTORGADO` | `prestamo_cash` | Préstamos cash | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__tests__/cash-loan-create-idempotency.test.ts`, `src/features/contabilidad/services/__integration__/cash-loan-create-postgres.test.ts` |
| 21 | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L881` | `registerCashLoanPayment` | actions y rutas web/móvil de pago de préstamos | `COBRO_PRESTAMO` | `reconciliacion_venta` | Cobro de préstamo | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 22 | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L1197` | `createCashDebt` | actions y rutas web/móvil de deudas (`actions-deudas-cash.ts`, `/api/contabilidad/deudas-cash`, `/api/mobile/v1/accounting/cash-debts`) | `DEUDA_RECIBIDA` | `deuda_cash` | Deudas cash | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 23 | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L1571` | `registerCashDebtPayment` | actions y rutas web/móvil de pago de deudas | `PAGO_DEUDA` | `reconciliacion_gasto` | Pago de deuda | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 24 | `src/features/contabilidad-formal/services/supplier-return-posting-service.ts#L90` | `emitirDevolucionCompra` | `src/features/compras-productos/devoluciones.ts` (L354) | `DEVOLUCION_COMPRA` | `devolucion_compra` | Devoluciones a proveedores | replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/supplier-return-posting-service.test.ts`, `src/features/contabilidad-formal/services/__tests__/replay-source-collector.test.ts`, `src/features/compras-productos/__tests__/devoluciones.test.ts` |

<!-- R0.5-CALLSITES:END -->

Notas de la matriz:

- **Filas 3, 5 y 18** son emisores sin writer vivo: no participan del rollout y
  no acreditan ninguna dimensión. La sección 5 fija su invariante.
- **Fila 9**: el emisor no se invoca desde fuera del servicio; lo invoca
  `revertirMermaContableEnTransaccion`, que sí tiene writers productivos. Por
  eso hereda las ocho dimensiones de la reversa de merma.
- **Fila 10 (d)**: producción no requiere conversión FX; sus importes son
  funcionales por construcción.
- **Fila 11 (d)**: la compra de productos no persiste la tasa de cambio; en
  moneda extranjera el motor falla cerrado en vez de inventar una equivalencia.
- Las rutas `src/app/api/contabilidad/**` de reconciliación ya no invocan
  `postEvento()`: delegan en `settlement-posting-service.ts` (fila 19). Las de
  deudas y pago de deudas delegan en las filas 22-23. La de préstamos es la
  excepción: crea el documento sin emisor (brecha en §6.1).

## 4. Resolución de los 40 tipos del manifiesto

La columna **Disposición** es exactamente la que declara
`REPLAY_SOURCE_MANIFEST` y la verifica la regresión. **Writer vivo** indica si
existe un flujo productivo que emita el tipo hoy.

<!-- R0.5-MANIFEST:START -->

| Tipo | Disposición | Writer vivo | Callsite canónico | Resolución |
|---|---|---|---|---|
| `VENTA_CONTADO` | replay | sí | `src/features/contabilidad-formal/services/sale-posting-service.ts#L140` | Cubierto (fila 13) |
| `VENTA_CREDITO` | replay | sí | `src/features/contabilidad-formal/services/sale-posting-service.ts#L107` | Cubierto (fila 12) |
| `COBRO_CXC` | replay | sí | `src/features/contabilidad-formal/services/settlement-posting-service.ts#L170` | Cubierto (fila 19) |
| `COSTO_VENTA_DEVENGADO` | replay | sí | `src/features/contabilidad-formal/services/sale-posting-service.ts#L196` | Cubierto (fila 14) |
| `DEVOLUCION_VENTA` | replay | sí | `src/features/contabilidad-formal/services/sale-return-posting-service.ts#L192` | Cubierto (fila 15) |
| `DEVOLUCION_COMPRA` | replay | sí | `src/features/contabilidad-formal/services/supplier-return-posting-service.ts#L90` | Cubierto (fila 24); reconstrucción desde la devolución y la tasa persistidas |
| `VENTA_SERVICIO` | template-only | no | — | Solo plantilla; el flujo real emite `VENTA_SERVICIO_CREDITO` |
| `VENTA_SERVICIO_CREDITO` | replay | sí | `src/features/contabilidad-formal/services/service-sale-posting-service.ts#L63` | Cubierto (fila 17) |
| `COBRO_SERVICIO` | replay | sí | `src/features/contabilidad-formal/services/settlement-posting-service.ts#L170` | Cubierto (fila 19) |
| `COMPRA_CONTADO` | template-only | no | — | Solo plantilla; el restock emite `PAGO_CXP` |
| `COMPRA_CREDITO` | replay | sí | `src/features/contabilidad-formal/services/purchase-posting-service.ts#L45` | Cubierto (fila 11) |
| `PAGO_CXP` | replay | sí | `src/features/contabilidad-formal/services/settlement-posting-service.ts#L170` | Cubierto (fila 19) |
| `GASTO_CONTADO` | template-only | no | — | Solo plantilla |
| `GASTO_CREDITO` | replay | sí | `src/features/contabilidad-formal/services/service-purchase-posting-service.ts#L54` | Cubierto (fila 16) |
| `PAGO_GASTO_CREDITO` | template-only | no | — | Solo plantilla |
| `PAGO_NOMINA` | template-only | no | — | Solo plantilla; la nómina se anula con asiento inverso, no con este tipo |
| `ANTICIPO_CLIENTE_RECIBIDO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L181` | Cubierto (fila 4) |
| `ANTICIPO_CLIENTE_APLICADO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L56` | Cubierto (fila 1) |
| `ANTICIPO_CLIENTE_APLICACION_REVERSADA` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L102` | Cubierto (fila 2) |
| `ANTICIPO_CLIENTE_DEVUELTO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L181` | Cubierto (fila 4); el emisor especializado de la fila 3 no tiene invocador |
| `ANTICIPO_PROVEEDOR_ENTREGADO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L181` | Cubierto (fila 4) |
| `ANTICIPO_PROVEEDOR_APLICADO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L56` | Cubierto (fila 1) |
| `ANTICIPO_PROVEEDOR_APLICACION_REVERSADA` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L102` | Cubierto (fila 2) |
| `ANTICIPO_PROVEEDOR_REINTEGRADO` | replay | sí | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts#L181` | Cubierto (fila 4); el emisor especializado de la fila 3 no tiene invocador |
| `PRESTAMO_OTORGADO` | replay | sí | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L495` | Cubierto (fila 20) |
| `COBRO_PRESTAMO` | replay | sí | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L881` | Cubierto (fila 21) |
| `DEUDA_RECIBIDA` | replay | sí | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L1197` | Cubierto (fila 22) y por inyección de capital (fila 7) |
| `PAGO_DEUDA` | replay | sí | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts#L1571` | Cubierto (fila 23) |
| `AJUSTE_BANCARIO_CARGO` | replay | sí | `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts#L198` | Cubierto (fila 6) |
| `AJUSTE_BANCARIO_ABONO` | replay | sí | `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts#L198` | Cubierto (fila 6) |
| `TRANSFERENCIA_BANCARIA` | replay | no | — | Replay sin writer: `createBankTransfer` mueve tesorería pero no emite asiento formal |
| `INYECCION_CAPITAL` | replay | sí | `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts#L227` | Cubierto (fila 7) |
| `PAGO_DEUDA_CAPITAL` | template-only | no | — | Solo plantilla; `registerCapitalPayment` no emite asiento |
| `MERMA_INVENTARIO` | replay | sí | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L109` | Cubierto (fila 8) |
| `MERMA_INVENTARIO_REVERSADA` | replay | sí | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L176` | Cubierto (fila 9) |
| `PRODUCCION_SALIDA` | replay | sí | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts#L285` | Cubierto (fila 10) |
| `GASTO_CON_ANTICIPO_PROVEEDOR` | template-only | no | — | Solo plantilla; el flujo real emite `GASTO_CREDITO` |
| `DIFERENCIA_CAMBIARIA` | template-only | no | — | Solo plantilla |
| `APERTURA_PERIODO` | programmatic | programático | `src/features/contabilidad/actions-periodos.ts` (insert directo de `Asiento`, `origenTipo: apertura_manual`) | Programático: no pasa por `postEvento()` ni por el collector |
| `CIERRE_PERIODO` | programmatic | programático | `src/features/contabilidad-formal/services/cierre-formal-service.ts` (insert directo, `origenTipo: cierre_periodo`) | Programático: no pasa por `postEvento()` ni por el collector |

<!-- R0.5-MANIFEST:END -->

Resumen de resolución: **30 replay** (29 con writer vivo + `TRANSFERENCIA_BANCARIA`),
**8 template-only** y **2 programáticos** = 40 tipos.

## 5. Emisores huérfanos e invariantes

Un emisor huérfano es código que construye eventos formales pero que ningún
flujo productivo invoca. No es cobertura: es deuda que puede activarse por
error si alguien lo cablea.

<!-- R0.5-ORPHANS:START -->

| Clasificación | Archivo | Símbolo | Estado verificado | Consecuencia |
|---|---|---|---|---|
| modulo-huerfano | `src/features/contabilidad-formal/services/advance-posting-service.ts` | `emitirEventoAnticipo` | Sin importadores productivos; la variante viva es la de `advance-formal-posting-service.ts` | No participa del rollout; si se cablea, la regresión falla y exige actualizar esta matriz |
| modulo-huerfano | `src/features/contabilidad-formal/services/settlement-formal-posting-service.ts` | `emitirLiquidacionFormal` | Solo lo importa su test; el emisor vivo es `settlement-posting-service.ts` | No participa del rollout; misma regla de actualización |
| funcion-sin-invocador | `src/features/contabilidad-formal/services/advance-formal-posting-service.ts` | `emitirDevolucionAnticipo` | Se importa en `anticipos-workflow.ts` pero no se llama; la devolución real usa `emitirEventoAnticipo` | La fila 3 queda ➖; si se cablea, la regresión falla |
| invocacion-interna | `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts` | `emitirReversionMermaSiContabilizada` | Solo la invoca `revertirMermaContableEnTransaccion` dentro del mismo módulo | Es la fila 9; no es huérfana porque la reversa tiene writers productivos |

<!-- R0.5-ORPHANS:END -->

Invariantes que sostiene la regresión:

1. Un `postEvento()` nuevo en `src/` que no esté en la sección 3 rompe el test.
2. Un callsite eliminado o movido rompe el test (el mapa declarado debe igualar
   al escaneado, archivo por archivo y conteo por conteo).
3. Un tipo del manifiesto sin fila en la sección 4, o con disposición distinta a
   la del código, rompe el test.
4. Cablear un módulo huérfano o invocar `emitirDevolucionAnticipo` rompe el
   test: obliga a decidir entre retirarlo o inventariarlo.

## 6. Crosswalk 31 histórico → 23 actual

De los 19 archivos del corte 2026-10-11, **18 ya no invocan `postEvento()`
directamente** (16 delegan en un emisor y 2 dejaron de emitir sin delegar);
`accounting-cash-operations-mutation-service.ts` sigue siendo emisor técnico con
sus 4 callsites. La tabla muestra dónde vive hoy cada emisión y marca las dos
rutas que **no** delegan (§6.1).

| Archivo histórico (callsites) | Emisión hoy | Fila vigente |
|---|---|---|
| `src/app/api/contabilidad/deudas-cash/[id]/pagar/route.ts` (1) | delega en `accounting-cash-operations-mutation-service.ts` | 23 |
| `src/app/api/contabilidad/deudas-cash/route.ts` (1) | delega en `accounting-cash-operations-mutation-service.ts` | 22 |
| `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.ts` (1) | delega en `accounting-cash-operations-mutation-service.ts` | 21 |
| `src/app/api/contabilidad/prestamos-cash/route.ts` (1) | **no delega**: crea el préstamo y su `reconciliacionVenta` inline, sin emisor formal (§6.1) | — |
| `src/app/api/contabilidad/reconciliacion/ventas/route.ts` (1) | delega en `settlement-posting-service.ts` | 19 |
| `src/app/api/produccion/ordenes/[id]/completar/route.ts` (1) | **no delega**: la ruta alternativa completa la orden sin emisión ni `fechaContabilizacion`; la ruta con emisión es `produccion/actions.ts` → `inventory-adjustment-posting-service.ts` (§6.1) | 10 |
| `src/features/compras-productos/actions.ts` (1) | delega en `purchase-posting-service.ts` | 11 |
| `src/features/compras-servicios/actions.ts` (1) | delega en `service-purchase-posting-service.ts`; emite `GASTO_CREDITO` (el histórico `GASTO_CON_ANTICIPO_PROVEEDOR` quedó solo plantilla) | 16 |
| `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts` (4) | sigue siendo el emisor técnico | 20-23 |
| `src/features/contabilidad/services/accounting-operations-mutation-service.ts` (4) | delega en `capital-adjustment-posting-service.ts`; `TRANSFERENCIA_BANCARIA` y `PAGO_DEUDA_CAPITAL` quedan sin writer | 6-7 |
| `src/features/contabilidad/services/accounting-reconciliation-service.ts` (2) | delega en `settlement-posting-service.ts` | 19 |
| `src/features/mermas/actions.ts` (1) | delega en `inventory-adjustment-posting-service.ts` | 8 |
| `src/features/productos/actions-restock.ts` (1) | delega en `settlement-posting-service.ts`; emite `PAGO_CXP` (el histórico `COMPRA_CONTADO` quedó solo plantilla) | 19 |
| `src/features/venta-servicios/actions.ts` (2) | delega en `service-sale-posting-service.ts` | 17 |
| `src/features/ventas/services/devolucion-venta-service.ts` (1) | delega en `sale-return-posting-service.ts` | 15 |
| `src/features/ventas/services/facturacion-workflow.ts` (3) | delega en `sale-posting-service.ts` | 12-13 |
| `src/features/ventas/services/venta-mutation-service.ts` (2) | delega en `sale-posting-service.ts` | 14 |
| `src/lib/services/anticipos-workflow.ts` (2) | delega en `advance-formal-posting-service.ts` | 1-4 |
| `src/lib/services/pago-gastos-workflow.ts` (1) | delega en `settlement-posting-service.ts` | 19 |

Archivo nuevo que **no** era callsite directo en el corte histórico:
`src/features/ventas/services/venta-lifecycle-service.ts` emite
`COSTO_VENTA_DEVENGADO` a través de `sale-posting-service.ts` (fila 14).

Diferencia de conteo: 31 − 23 = 8. De los 31 callsites históricos, **27
dejaron de postear inline** y **4 siguen vivos** en
`accounting-cash-operations-mutation-service.ts`. En su lugar aparecieron **19
callsites nuevos** en los servicios emisores. La aritmética es
`31 − 27 + 19 = 23`, es decir, una caída neta de 8 invocaciones: la cobertura
de familias se conserva porque cada emisión histórica tiene un emisor
equivalente en la sección 3, salvo las dos brechas de §6.1 y los dos tipos
históricos que quedaron sin writer (`TRANSFERENCIA_BANCARIA` y
`PAGO_DEUDA_CAPITAL`).

### 6.1 Brechas de adaptadores (rutas que no delegan)

Estas dos rutas son callsites históricos que **no** sustituyeron su emisión
inline por un servicio formal. No son emisores huérfanos (§5) ni callsites
vigentes (§3): son adaptadores que crean documentos operativos sin asiento
formal. Se documentan porque el crosswalk no puede presentarlas como
delegación.

| Ruta | Qué hace hoy | Qué falta | Consecuencia contable |
|---|---|---|---|
| `src/app/api/contabilidad/prestamos-cash/route.ts` | Crea `PrestamoCash` y `reconciliacionVenta` (`tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO'`, `prestamoCashId: null`) en una transacción L188-259; valida período en L153 y audita en L261, después del commit. No importa el servicio de caja | Delegar en `AccountingCashOperationsMutationService.createCashLoan` (fila 20), como ya hacen `actions-prestamos-cash.ts:111` y `/api/mobile/v1/accounting/cash-loans/route.ts:125` | No genera asiento. El collector sí lo enumera como candidato **omitido** (`desembolso_prestamo_no_verificado`, causa `DESEMBOLSO_NO_VERIFICABLE`) porque el desembolso no queda ligado al préstamo; no aporta cobertura ni idempotencia del servicio |
| `src/app/api/produccion/ordenes/[id]/completar/route.ts` | Completa la orden (`ordenProduccion.update`, L94) y registra `reconciliacionGasto` con `estado: 'PENDIENTE'` (L150-162); no emite evento formal ni persiste `fechaContabilizacion` | Emitir `PRODUCCION_SALIDA` en la misma transacción, como `src/features/produccion/actions.ts:768` (fila 10), o retirar la ruta alternativa | No genera asiento. El collector descarta las conciliaciones `PENDIENTE`, así que hoy no entra al replay; si alguien la concilia, entraría como `PAGO_CXP` |

**Riesgo preexistente en la ruta de préstamos (no corregido aquí).**
`cuentaBancaria.findUnique` (L166) y `cuentaBancaria.update` (L189) filtran solo
por `cuentaId`, sin `tenantId`, y `clienteId` no se valida contra el tenant: con
la sesión de un tenant se puede debitar la cuenta bancaria de otro. Corregirlo
exige autorización explícita y prueba de integración propia; delegar en el
servicio de la fila 20 lo cierra de raíz, porque ese servicio sí valida la
titularidad por tenant (`cash-loan-create-idempotency.test.ts`, caso «scopes
both bank account and client ownership»).

Alcance: la regresión de este documento **no** detecta estas brechas. Verifica
callsites de `postEvento()` y tipos del manifiesto; una ruta que crea
documentos sin pasar por el motor es invisible para ella. Cerrarlas requiere
decisión de Finanzas/operaciones (delegar o retirar) y una prueba de
integración equivalente a las de las filas 10 y 20.

## 7. Límites de esta matriz

- **No es aceptación operativa.** No verifica flags remotos, licencias por
  tenant, baseline de saldos ni la ventana `shadow`/`enforce`.
- **No prueba ausencia de familias no inventariadas.** La regresión detecta
  callsites de `postEvento()` y tipos del manifiesto; no detecta un writer que
  inserte `Asiento` directamente sin pasar por el motor (los dos programáticos
  son conocidos y están declarados), ni una ruta que cree documentos sin emitir
  (las dos brechas de §6.1).
- **Alcance del escaneo de la regresión.** Cuenta líneas que invocan
  `postEvento()` en archivos `.ts`/`.tsx` bajo `src/`, excluyendo
  `posting-engine.ts`, `__tests__/`, `__integration__/` y `*.test.ts(x)`.
  Ignora líneas cuyo primer carácter no blanco es `//` o `*`, pero no un
  `postEvento(` dentro de un comentario al final de una línea de código.
  Resuelve importadores e invocadores con coincidencia estática de texto, no
  con el grafo de tipos: un reexport dinámico o un alias podría escapar. No
  sigue barriles de reexport y una invocación partida en dos líneas no se
  detecta.
- **Alcance de la verificación de anclas.** La regresión comprueba que cada
  `archivo#Lnn` de las tablas de las secciones 3 y 4 apunta a una línea que
  invoca `postEvento(`. No verifica las demás rutas citadas (evidencia,
  invocadores, crosswalk), que se revisaron a mano en el corte.
- **No reemplaza los rollback físicos.** Las dimensiones (h) se apoyan en las
  pruebas de integración citadas, con el alcance que cada una declara.
- **Los conteos son de este checkout.** Un cambio de rama o de worktree exige
  volver a ejecutar la regresión.

## 8. Referencias

- `docs/ct1-cierre-integracion-capa-formal.md` §4 (matriz de negocio), §6 (gates)
- `src/features/contabilidad-formal/services/replay-source-manifest.ts` (40 tipos)
- `src/features/contabilidad-formal/lib/plan-default.ts` (`TipoEventoClave`)
- `src/features/contabilidad-formal/services/posting-engine.ts` (`postEvento`, `replayEvento`)
- `src/features/contabilidad-formal/__tests__/writers-matrix.test.ts` (regresión)
- `odd/tasks/cobertura-familias-contables.md` (handoff operativo)
