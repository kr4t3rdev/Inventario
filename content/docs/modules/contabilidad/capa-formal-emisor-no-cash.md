# Emisor formal no Cash (CxC/CxP, servicios y anticipos)

La capa formal contable exige que todo movimiento de tesorería tenga su asiento
con partida doble, hash encadenado y evidencia de auditoría. La primera
integración tenía tres emisores de operaciones Cash (cobro de préstamo, pago
de deuda y desembolso de deuda); esta capa añade cobros de ventas, servicios y
pagos de gastos.

Los writers conectados traducen cada conciliación operativa persistida en un
evento formal: cobro de venta (`COBRO_CXC`), pago de gasto (`PAGO_CXP`), cobro
de servicios (`COBRO_SERVICIO`), reconocimiento de compra a crédito
(`COMPRA_CREDITO`) y recepción, entrega o aplicación de anticipos. Los
reconocimientos de ingreso y gasto que no dependen de una conciliación
—merma, producción, compra, gasto de servicio y venta de servicios— emiten
desde el propio writer operativo, en su misma transacción.

## Qué emite

| Evento | Plantilla | Diario | Contrapartida |
|---|---|---|---|
| `COBRO_CXC` | 6 líneas (3 ramas FX + 2 de diferencia + tesorería) | `VENTAS` | `CXC_CLIENTES` |
| `PAGO_CXP` | 6 líneas (espejo del anterior) | `COMPRAS` | `CXP_PROVEEDORES` |
| `COBRO_SERVICIO` | Plantilla de cobro de servicios con ramas FX | `VENTAS` | `CXC_CLIENTES` |
| `VENTA_SERVICIO_CREDITO` | Ingreso por servicios contra cuenta por cobrar | `VENTAS` | `CXC_CLIENTES` / `VENTAS_SERVICIOS` |
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

Los emisores de reconocimiento que no nacen de una conciliación (merma,
producción, compra, gasto de servicio y venta de servicios) sí valoran el
importe: toman la moneda funcional de `TenantAccountingPolicy` y la tasa
publicada vigente en la fecha de la operación (`exchangeRateProvider`), y
persisten la huella de esa evidencia. Si la moneda de la operación difiere de
la funcional y no hay tasa publicada, el importe funcional queda nulo y el motor
falla cerrado, sin inventar conversión.

## Writers conectados

| Writer | Evento | Nota |
|---|---|---|
| `src/features/contabilidad/actions-reconciliacion.ts` → `reconciliarVentaAction` | `COBRO_CXC` | Ya persistía la evidencia FX |
| `src/features/contabilidad/services/accounting-reconciliation-service.ts` → `reconcileSale` | `COBRO_CXC` | Ahora persiste la evidencia FX |
| `src/features/contabilidad/services/accounting-reconciliation-service.ts` → `reconcileService` | `COBRO_SERVICIO` | Un asiento por distribución, basado en su valoración persistida; comparte la transacción operativa |
| `src/app/api/contabilidad/reconciliacion/servicios/route.ts` (POST) | `COBRO_SERVICIO` | Conserva el cobro individual legacy; persiste la valoración funcional y emite en la misma transacción |
| `src/features/ventas/services/facturacion-workflow.ts` → `applyFacturacionCobroWorkflow` | `VENTA_CONTADO` / `VENTA_CREDITO` | Reconoce el ingreso de la venta de productos: al contado debita la tesorería; a plazo abre la cuenta por cobrar que después liquida `COBRO_CXC` |
| `src/app/api/contabilidad/reconciliacion/ventas/route.ts` (POST) | `COBRO_CXC` | Ruta legacy: el valor funcional se toma del importe en CUP de la operación, porque ahí `montoConvertido` guarda el importe en la moneda del banco |
| `src/lib/services/pago-gastos-workflow.ts` → `applyPagoGastoWorkflow` | `PAGO_CXP` | Solo cuando la conciliación no queda `PENDIENTE` (una conciliación pendiente no mueve la tesorería) |
| `src/features/productos/actions-restock.ts` → `handlePaymentInTransaction` | `PAGO_CXP` | Solo `PAGO_COMPLETO`; persiste evidencia FX y emite dentro de la transacción que registra el pago y descuenta la cuenta |
| `src/features/compras-productos/actions.ts` → `createCompraProductoAction` | `COMPRA_CREDITO` | Reconoce compras a crédito, anticipadas y contado antes de liquidar cualquier pago; comparte la transacción |
| `src/features/compras-servicios/actions.ts` → `createCompraServicioAction` | `GASTO_CREDITO` | Devenga el gasto operativo contra CxP al recibir el servicio; comparte la transacción y la valoración con la vía de anticipos |
| `src/features/mermas/services/registrar-merma-service.ts` → `registrarMermaEnTransaccion` | `MERMA_INVENTARIO` | Punto único de escritorio y móvil; ancla el asiento a la versión persistida de `AjusteInventario` |
| `src/features/mermas/actions.ts` → `updateMermaAction` / `deleteMermaAction` | `MERMA_INVENTARIO_REVERSADA` + `MERMA_INVENTARIO` | Editar revierte la versión anterior y reconoce la nueva; eliminar solo revierte |
| `src/app/api/mobile/mermas/[id]/route.ts` → `DELETE` | `MERMA_INVENTARIO_REVERSADA` | Mismo criterio que la eliminación de escritorio |
| `src/features/produccion/actions.ts` → `completarOrdenProduccionAction` | `PRODUCCION_SALIDA` | Emite al completar, con el costo histórico de las líneas `ING-*` del kardex |
| `src/features/venta-servicios/actions.ts` → `createVentaServicioAction` | `VENTA_SERVICIO_CREDITO` | Reconoce el ingreso y la cuenta por cobrar al crear la venta (modo legacy y mixto), en la misma transacción |
| `src/features/ventas/services/venta-mutation-service.ts` → `VentaMutationService.create` | `COSTO_VENTA_DEVENGADO` | Devenga el costo FIFO de la mercadería que sale del inventario, en la misma transacción de la venta |
| `src/features/ventas/services/venta-lifecycle-service.ts` → `VentaLifecycleService.entregarPedido` | `COSTO_VENTA_DEVENGADO` | Devenga el costo FIFO cuando el pedido se entrega y la mercadería sale del inventario |
| `src/features/ventas/services/venta-lifecycle-service.ts` → `VentaLifecycleService.anularVentaPorEstado` | `REVERSO_ASIENTO` | Anula con su contraasiento los asientos de la venta anulada (ingreso, costo y cobro al contado) |
| `src/features/compras-productos/actions.ts` → `anularCompraProductoAction` | `REVERSO_ASIENTO` | Anula con su contraasiento el reconocimiento de la compra anulada |
| `src/features/gastosDE/reversal.ts` → `reverseExpenseEffects` | `REVERSO_ASIENTO` | Al eliminar un gasto o una compra de servicio, anula sus asientos formales (conciliación pagada, compra de servicio y aplicación del anticipo) |
| `src/features/empleados/payroll-reversal.ts` → `reversePayrollReconciliations` | `REVERSO_ASIENTO` | Al eliminar un pago de nómina, anula el asiento formal de la conciliación pagada |
| `src/features/contabilidad/actions-periodos.ts` → `aprobarPeriodoAction` | `CIERRE_PERIODO` | Al aprobar el período, vacía sus cuentas de resultado contra la cuenta de resultado del período, en la misma transacción |
| `src/features/contabilidad/actions-periodos.ts` → `cerrarPeriodoAction` (auto-aprobación de managers) | `CIERRE_PERIODO` | Cuando el cierre deja el período aprobado, genera el mismo asiento de cierre formal |
| `src/features/contabilidad/services/accounting-operations-mutation-service.ts` → `createBankAdjustment` | `AJUSTE_BANCARIO_ABONO` / `AJUSTE_BANCARIO_CARGO` | El ajuste no liquida cuentas: el ingreso acredita otros ingresos y el egreso debita gastos financieros, con la valoración que el writer ya decidió |
| `src/features/contabilidad/services/accounting-operations-mutation-service.ts` → `createCapitalInjection` | `INYECCION_CAPITAL` / `DEUDA_RECIBIDA` | La inyección entra a la tesorería: el capital propio acredita el capital social y la deuda externa las deudas recibidas |

Las rutas móviles de contabilidad (`src/app/api/mobile/v1/accounting/`) llegan a
las mismas operaciones: los ajustes de banco y las inyecciones de capital
delegan en `AccountingOperationsMutationService`, y los préstamos y deudas en
efectivo en `AccountingCashOperationsMutationService` (que ya emitía
`PRESTAMO_OTORGADO`, `DEUDA_RECIBIDA` y sus cobros y pagos). La capa formal
alcanza por igual a escritorio y móvil porque ambos caminos comparten el
servicio de mutación.

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

La venta de productos reconoce el ingreso **al facturar**, con dos eventos
distintos según cómo se cobre la factura:

- `contra_pago` (cobro en el mismo instante): `VENTA_CONTADO`, que debita la
  tesorería (caja o bancos según el tipo de la cuenta bancaria) y acredita el
  ingreso por ventas. No hay cuenta por cobrar que liquidar, porque la venta
  nunca fue a plazo; el emisor consume la valoración ya persistida en la
  conciliación de caja, sin recalcular moneda ni tipo de cambio.
- `fecha` o `plazo` (factura a plazo): `VENTA_CREDITO`, que debita la cuenta por
  cobrar y acredita el ingreso por ventas. El cobro posterior de esa factura
  emite `COBRO_CXC` (DEBE tesorería / HABER cuenta por cobrar), de modo que el
  ingreso se reconoce una sola vez y la cuenta por cobrar queda cerrada.

El ancla idempotente es el documento: `factura:<idFactura>` para la venta a
plazo y `reconciliacion_venta:<id>` para la venta al contado. La fecha del
asiento es la fecha de emisión de la factura (no la del proceso), para que el
corte de período use la fecha del documento. El importe de la factura está
expresado en la moneda operativa (CUP): si la moneda funcional del tenant es
distinta, el emisor valora con la tasa publicada vigente en la fecha de
emisión y, si no hay tasa, deja la valoración funcional ausente para que el
motor falle cerrado en vez de inventar una conversión. Este reconocimiento usa
el modo global `CONTABILIDAD_FORMAL_MODE`; no cambia los gates de emisor no
Cash.

La venta de servicios reconoce `VENTA_SERVICIO_CREDITO` al **crear** la venta,
tanto en modo legacy (un servicio) como en modo mixto (una línea por venta): el
importe es el total de la venta y el ancla idempotente es la fila de
`VentaServicios` (`venta_servicio:<id>`), de modo que cada línea genera su
propio evento y el replay de una venta idempotente no lo duplica. El
reconocimiento usa el modo global `CONTABILIDAD_FORMAL_MODE`.

La cuenta por cobrar que abre el asiento es la misma que liquida después el
cobro (`COBRO_SERVICIO`): la venta no mueve tesorería al crearse, porque el
importe se recibe en la conciliación posterior, también para las ventas al
contado. Cuando la venta aplica anticipos, la parte cubierta por el anticipo
queda compensada por `ANTICIPO_CLIENTE_APLICADO` (que acredita la cuenta por
cobrar) y el remanente coincide con la cuenta por cobrar operativa que crea el
writer; así el ingreso se reconoce una sola vez y la caja no se duplica. La
plantilla `VENTA_SERVICIO` (cobro en el mismo instante) no se usa: el flujo
operativo actual no cobra el servicio al crear la venta.

La eliminación de una venta de servicios no emite todavía asiento
compensatorio: la plantilla `DEVOLUCION_VENTA` está diseñada para ventas de
productos (inventario y costo FIFO) y no aplica a servicios. Queda pendiente un
evento de reverso propio para este writer.

El costo de la mercadería vendida se devenga con `COSTO_VENTA_DEVENGADO`
(DEBE costo de ventas / HABER inventarios) cuando la mercadería sale del
inventario: al crear una venta en el punto de venta y al entregar un pedido.
El importe es el **costo FIFO real** de los lotes consumidos, tomado de las
asignaciones persistidas (`costoUnitarioSnapshot` para las recepciones y el
precio del ítem de compra para las compras), no del precio de venta ni de un
costo promedio estimado.

El costo se expresa en la moneda funcional del tenant: cada porción del FIFO se
valora con la tasa publicada vigente en la fecha de su fuente (la fecha de la
compra o de la recepción). Si alguna porción no tiene tasa publicada, el costo
funcional queda sin completar: el asiento no se emite con una tasa inferida y
el motor falla cerrado en modo `enforce` (en `shadow` registra la causa). El
ancla idempotente es la venta (`venta_costo:<id>`), de modo que el replay de la
entrega no duplica el devengo. La devolución de la venta repone el inventario
con su propio evento (`DEVOLUCION_VENTA`), que todavía no está conectado.

Cuando un documento se anula, sus asientos formales no se borran ni se editan:
se anulan con un **asiento inverso inmutable**, que conserva las líneas y la
evidencia FX del original cambiando únicamente debe/haber. El original queda en
estado `ANULADO` apuntando al inverso (`revertidoPorId`), de modo que la traza
forense conserva ambos documentos. La reversa es idempotente: si el inverso ya
existe y está contabilizado, la anulación lo reutiliza en lugar de duplicarlo;
si el enlace no es consistente, la operación falla en lugar de ocultar la
inconsistencia. El asiento inverso se fecha en el día de la anulación y se
registra en el período abierto vigente; si el período original está cerrado, la
reversa se asienta en el período actual. Hoy la reversa está conectada al
anular una venta (ingreso reconocido, costo devengado y cobro al contado), al
anular una compra (reconocimiento), al eliminar un gasto o una compra de
servicio (conciliación pagada, compra de servicio y aplicación del anticipo) y
al eliminar un pago de nómina (conciliación pagada).

Cuando un período contable queda **aprobado**, se genera su **asiento de cierre
formal**: cada cuenta de resultado (ingreso, costo y gasto) del período vacía su
saldo neto y la utilidad —o la pérdida— del período queda en la cuenta de
resultado del período (`RESULTADO_PERIODO`). El asiento se construye
programáticamente (las plantillas del plan no cubren `CIERRE_PERIODO`) y lleva
el origen idempotente `cierre_periodo:<id>`, de modo que un segundo cierre del
mismo período devuelve el asiento existente en lugar de duplicarlo. Se fecha el
último día del período cuando la aprobación ocurre después de su cierre. La
aprobación y el cierre se escriben en la misma transacción: el período no queda
aprobado sin su asiento de cierre. En modo `enforce` el cierre falla cerrado
(sin rol contable, sin diario de apertura/cierre o descuadre, la aprobación se
rechaza); con la capa apagada o en modo `shadow` no se escribe nada.

Cuando la capa formal se enciende, los periodos historicos que quedaron sin
asiento se recuperan con el **replay historico**, que es un proceso gobernado
en tres pasos que no pueden ocurrir por separado:

1. **Preflight**: se construye un snapshot canonico de las fuentes del periodo
   (identidad, fecha, descripcion y valoracion funcional) y se persiste su
   digest SHA-256. El snapshot congela la valoracion; no es una nueva
   estimacion. El preflight vive 24 horas.
2. **Aprobacion independiente**: otro responsable contable activo aprueba ese
   digest. El solicitante no puede aprobar su propio preflight, y si las
   fuentes cambiaron entre los dos pasos, la aprobacion se rechaza.
3. **Ejecucion**: se contabiliza exactamente el periodo aprobado (el motor
   omite el bloqueo de periodo cerrado, porque el origen ya es deliberado) y
   el **verificador forense** confronta el resultado con el snapshot
   aprobado: cada fuente debe tener un unico asiento contabilizado en el
   periodo, con las lineas cuadradas y la valoracion aprobada.

La ejecucion es idempotente por origen: repetir el replay con un preflight
nuevo no duplica asientos, los reconoce como ya posteados. El alcance del
recolector es deliberado y conservador: reconstruye las fuentes que el writer
vigente ya formaliza y de las que se puede reconstruir el mismo evento con la
misma evidencia persistida:

| Fuente operativa | Evento formal | Origen |
| --- | --- | --- |
| Factura de una venta a plazo | `VENTA_CREDITO` | `factura` |
| Conciliacion de una venta a plazo | `COBRO_CXC` | `reconciliacion_venta` |
| Conciliacion de una venta cobrada al contado | `VENTA_CONTADO` | `reconciliacion_venta` |
| Conciliacion de gasto que movio la tesoreria | `PAGO_CXP` | `reconciliacion_gasto` |
| Documento de compra a plazo o a anticipo | `COMPRA_CREDITO` | `compra_documento` |
| Compra de servicio | `GASTO_CREDITO` | `compra_servicio` |
| Venta de servicio | `VENTA_SERVICIO_CREDITO` | `venta_servicio` |
| Movimiento de anticipo (recepción, entrega, aplicación, reverso y devolución) | `ANTICIPO_CLIENTE_*` / `ANTICIPO_PROVEEDOR_*` | `anticipo_movimiento` |

Cualquier fuente que no se puede reconstruir sin ambiguedad se omite dejando su
causa (identidad ambigua, documento anulado, valoracion funcional no
verificable o tasa de cambio no persistida) en vez de contabilizar algo que el
writer no habria escrito.

El replay no depende del modo global `CONTABILIDAD_FORMAL_MODE`: es una
operacion explicita y autorizada. Exige licencia con la funcion
`contabilidad-formal`, un responsable contable activo y el permiso
`financiero.contabilidad.acceder`.

## Rollout

El emisor tiene su propio modo, independiente del modo global de la capa:

```bash
CONTABILIDAD_FORMAL_NO_CASH_MODE=off     # por defecto: no se emite nada
CONTABILIDAD_FORMAL_NO_CASH_MODE=shadow  # evidencia simulada en la outbox, sin asientos
CONTABILIDAD_FORMAL_NO_CASH_MODE=enforce # se exige el asiento formal
```

Los emisores de reconocimiento (compras, gastos de servicio, mermas,
producción, anticipos, venta de servicios y venta de productos —ingreso y costo
FIFO—, y el cierre formal del período) no usan ese gate: respetan el modo global
`CONTABILIDAD_FORMAL_MODE`, que sigue `off` por defecto. Las liquidaciones (`COBRO_CXC`, `COBRO_SERVICIO`,
`PAGO_CXP`) conservan el gate no Cash. Para la convergencia futura existe
`emitirLiquidacionFormal`
(`src/features/contabilidad-formal/services/settlement-formal-posting-service.ts`):
comparte con el emisor no Cash la resolución de la valoración, de modo que
cambiar de emisor no altera el asiento y solo cambia el gate que lo gobierna.

Procedimiento recomendado:

1. **off** (estado por defecto tras el despliegue): no cambia el comportamiento.
2. **shadow**: se observa la outbox (`ShadowOutbox`) en los tenants con tráfico:
   `SIMULADO` = el asiento se habría contabilizado; `ERROR_SHADOW` = la causa
   exacta del rechazo. La acción `getMetricasShadowAction`
   (`src/features/contabilidad-formal/actions-metricas-shadow.ts`) resume la
   outbox del tenant por evento, resultado y causa (conteo y latencia p95); la
   exige la licencia de contabilidad formal y el permiso
   `financiero.auditoria.ver`, y nunca acepta un tenant por parámetro.
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

- La devolución de una venta de productos todavía no tiene asiento formal: la
  plantilla `DEVOLUCION_VENTA` (DEBE ventas / HABER tesorería, más el reintegro
  del inventario y la reversión del costo FIFO) existe en el plan, pero ningún
  writer la emite. El costo devengado se repone con ese evento, no con un
  ajuste del asiento original.
- La apertura formal por traspaso (rollover) todavía no está conectada: el
  asiento de apertura que hoy se genera al abrir un período es el de cuadre
  manual aprobado (`apertura_manual`), y la derivación automática de los saldos
  iniciales sigue bloqueada a propósito (`APERTURA_SALDOS_NO_VERIFICABLES`),
  porque la evidencia disponible no permite verificar todos los rubros ni su
  moneda. El cierre formal del período sí está conectado; su contrapartida de
  apertura requiere primero esa evidencia verificable.
- Los handlers legacy `handlers-deudas-cash.ts`, `handlers-prestamos-cash.ts` y
  `handlers-reconciliacion-servicios.ts` no tienen callers detectados en `src`;
  los endpoints activos delegan en servicios de mutación o emiten desde sus
  rutas actuales. No se consideran writers activos pendientes de integración.
- El modo `enforce` por tenant (hoy el modo es global): permitir un flag de
  licencia para activar el emisor tenant a tenant.
- El recolector del replay todavía no cubre los ajustes de banco ni las
  inyecciones de capital: el ajuste persiste su tasa (reconstruible ✓), pero la
  inyección de capital no persiste la tasa ni el importe funcional, así que su
  valoracion en moneda extranjera no se puede reconstruir con fidelidad.
- Los movimientos de anticipo sí se reconstruyen (el movimiento persiste el
  importe, la moneda, la tasa aplicada, la huella FX y los valores funcionales),
  pero el anticipo nacido de una nota de crédito no genera asiento de
  aplicación: el writer lo omite y el recolector también.
- La compra de productos en moneda extranjera no se puede reconstruir con
  fidelidad: el documento no persiste la tasa que aplicó el writer (la cuenta
  por pagar tampoco), así que esas fuentes se omiten con la causa
  `TASA_CAMBIO_NO_PERSISTIDA` hasta que el documento persista esa evidencia.
- La venta de servicios cobrada al contado no tiene cuenta por cobrar
  operativa, pero el writer vigente sí emite `VENTA_SERVICIO_CREDITO`: el
  asiento formal debita la cuenta por cobrar sin contrapartida operativa. El
  replay reproduce el comportamiento del writer; la corrección del flujo
  pertenece a la capa operativa.

## Referencias

- Motor: `src/features/contabilidad-formal/services/posting-engine.ts`
- Builder: `src/features/contabilidad-formal/lib/settlement-event-builder.ts`
- Anticipos: `src/features/contabilidad-formal/lib/advance-event-builder.ts` y
  `src/features/contabilidad-formal/services/advance-posting-service.ts`
- Servicio de emisión: `src/features/contabilidad-formal/services/settlement-posting-service.ts`
- Inventario (merma y producción): `src/features/contabilidad-formal/services/inventory-adjustment-posting-service.ts`
- Venta de productos: `src/features/contabilidad-formal/services/sale-posting-service.ts`
- Valoración operativa compartida: `src/features/contabilidad-formal/lib/functional-valuation-resolver.ts`
- Valoración del costo FIFO: `src/lib/services/fifo-allocation.ts` → `getCostoFifoVentaValorado`
- Reversa formal (asiento inverso): `src/features/contabilidad-formal/services/reversal-service.ts`
- Cierre formal del período: `src/features/contabilidad-formal/services/cierre-formal-service.ts`
- Replay histórico (orquestador): `src/features/contabilidad-formal/services/replay-backfill-service.ts`
- Replay histórico (recolector de fuentes): `src/features/contabilidad-formal/services/replay-source-collector.ts`
- Verificador forense del replay: `src/features/contabilidad-formal/services/replay-reconciliation.ts`
- Métricas del outbox shadow: `src/features/contabilidad-formal/actions-metricas-shadow.ts`
- Emisor de ajustes bancarios e inyecciones de capital: `src/features/contabilidad-formal/services/capital-adjustment-posting-service.ts`
- Gate de rollout: `src/features/contabilidad-formal/services/non-cash-emitter-gate.ts`
- Plan de integración por slices: `docs/plan-ct1-integracion-capa-formal-2026-10-27.md`
