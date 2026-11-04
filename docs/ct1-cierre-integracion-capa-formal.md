# CT-1: cierre de la integración de la capa formal de contabilidad

**Fecha de cierre:** 2026-11-04
**Alcance:** integrar en `origin/main` la capa formal de contabilidad por slices
verificables, **sin activarla**.
**Plan:** `docs/plan-ct1-integracion-capa-formal-2026-10-27.md`
**Inventario y decisiones de partida:** `docs/ct1-s0-inventario.md`
**Documentación funcional:** `content/docs/modules/contabilidad/capa-formal-emisor-no-cash.md`

## 1. Estado final

La capa formal está integrada en `main` y **permanece apagada**:

- `CONTABILIDAD_FORMAL_MODE=off` (modo global) — por defecto.
- `CONTABILIDAD_FORMAL_NO_CASH_MODE=off` (modo de las liquidaciones no Cash) —
  por defecto.
- Ningún tenant tiene `shadow`, `enforce` ni replay activado. El replay es una
  operación explícita, autorizada y con preflight; no depende de los flags.

La integración no cambió el comportamiento operativo de la aplicación: cada
escritor emite el evento en modo `off`, el motor devuelve `OMITIDO` y no toca la
base de datos.

## 2. Decisiones aplicadas

| ID | Decisión | Estado |
|---|---|---|
| D1 | Conservar el split moratorio de `main` (pagos a mora, interés ordinario y principal) | Aplicada |
| D2 | Incluir las rutas móviles contables en CT-1 | Aplicada: las rutas móviles ya existían y alcanzan los mismos servicios; S8 cerró el hueco de los ajustes bancarios y las inyecciones de capital |
| D3 | Excluir los artefactos Graphify del merge y regenerarlos al finalizar | Aplicada: el índice local se regeneró; los artefactos de `graphify-out/` no se mezclaron en los commits contables |
| D4 | Integrar por slices sobre ramas nuevas desde `origin/main` | Aplicada: un commit por slice, push directo a `origin/main` y CI verde en cada SHA |
| D5 | La devolución de venta se formaliza con su desglose real: el ingreso revertido se compensa contra la cuenta por cobrar aplicada, el anticipo (saldo a favor) y el reembolso en efectivo, y la mercadería reingresa por su costo FIFO | Aplicada: el motor admite las tres reglas de monto (`MONTO_APLICADO_CXC`, `MONTO_SALDO_FAVOR`, `MONTO_REEMBOLSADO`), la plantilla global de `DEVOLUCION_VENTA` refleja el desglose, el writer emite el asiento con la misma transacción que la devolución y el replay lo reconstruye con el mismo constructor de evento. El efectivo se reconoce al registrar la devolución; el efectivo físico sale al cerrar el turno (diferencia de timing documentada) |

## 3. Slices integrados (SHAs reales)

| Slice | Contenido | SHA | CI |
|---|---|---|---|
| S4(a) | Reconocimiento formal de la venta de productos | `63dc2e83` | `41715514976` |
| S4(a)-2 | Devengo formal del costo FIFO de la venta | `84f8d617` | `41725826650` |
| S5 | Libros contables formales y conciliación cruzada | `0ebf72ef` | `41671810424` |
| S4(b) | Reconocimiento formal de mermas y producción | `68c26b26` | `41642227989` |
| S4(d) | Emisor formal de anticipos (+ seguimiento `ba3a8aff`) | `7f50bf7c` | `41647462553` (el seguimiento) |
| S4(e) | Emisor formal de liquidaciones y venta de servicios | `07f289a9`, `c6ead5fc` | `41659296288` |
| S6(a) | Reversa formal con asiento inverso inmutable | `8e589c99` | `41738507653` |
| S6(b) | Cierre formal del período contable | `c732fd6f` | `41776774116` |
| S6(c) | Reversa formal en gastos reconciliados y nómina | `bab9d7a6` | `41778830292` |
| S7 | Replay histórico gobernado (preflight, aprobación, ejecución) | `d0dfa212` | `41786262240` |
| S7b | Reconstructor de pagos, compras y servicios en el replay | `6d224c0e` | `41789541385` |
| S8 | Ajustes bancarios e inyecciones de capital | `11cd1390` | `41795897719` |
| S7c | Replay de anticipos y métricas del outbox shadow | `1cfa16e3` | `41799724819` |
| S9 | Activación del plan de cuentas (CTA-0) e infraestructura global conciliada | `7739ad05` | `41805169995` |
| S10 | Cierre: matriz R0.5 por fila, registro final y verificación | `c4499227` | `41809661324` (head final `6132fdc5`) |

Los slices cumplen su condición de salida con un writer, un test focal y un
CI verde. Los slices cuyo primer push quedó en rojo (por ejemplo `7f50bf7c` y
`a035c9f1`) se corrigieron con commits de seguimiento dentro del mismo slice;
el estado final de cada slice está verde.

La regeneración de Graphify (decisión D3) va en commits de artefactos separados
(`e45f02e8`, `d2c3937f` y `6132fdc5`): ninguno toca código funcional ni la
documentación del programa.

## 4. Matriz R0.5 por fila

Leyenda: **✅** evidencia explícita en el código citado; **⚠️** evidencia
estructural o indirecta (no un failpoint físico en `main`); **➖** no aplica por
diseño. La matriz es **evidencia de cobertura**, no un acta de aceptación:
`R0.5-ACCEPT` sigue sin firma y depende de `R6`/`R7` (ver sección 6).

Dimensiones: (a) actor/permiso del adaptador · (b) aislamiento por tenant ·
(c) origen único del asiento · (d) moneda/FX con evidencia persistida ·
(e) misma transacción que la escritura operativa · (f) idempotencia y reintento ·
(g) posteo del asiento y auditoría · (h) rollback físico demostrado.

| # | Writer (callsite → evento) | Adaptadores vivos | a | b | c | d | e | f | g | h | Evidencia focal |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `facturacion-workflow.ts` → `VENTA_CONTADO` (origen `reconciliacion_venta`) | action POS, ofertas, órdenes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/lib/services/__tests__/facturacion-ventas-workflow.test.ts`, `src/features/contabilidad-formal/services/__tests__/sale-posting-service.test.ts` |
| 2 | `facturacion-workflow.ts` → `VENTA_CREDITO` (origen `factura`) | action POS, ofertas, órdenes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/ventas/__tests__/venta-create-orquestacion.test.ts` |
| 3 | `venta-mutation-service.ts` / `venta-lifecycle-service.ts` → `COSTO_VENTA_DEVENGADO` (origen `venta_costo`) | action de venta, workflow de entrega | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/ventas/__tests__/venta-create-orquestacion.test.ts` |
| 4 | `compras-productos/actions.ts` → `COMPRA_CREDITO` (origen `compra_documento`) | action de compras | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | `src/features/compras-productos/__tests__/actions.test.ts` |
| 5 | `compras-servicios/actions.ts` → `GASTO_CREDITO` (origen `compra_servicio`) | action de servicios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/compras-servicios/__tests__/actions.test.ts` |
| 6 | `venta-servicios/actions.ts` → `VENTA_SERVICIO_CREDITO` (origen `venta_servicio`) | action de venta de servicios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/venta-servicios/__tests__/reconocimiento-formal.test.ts` |
| 7 | `anticipos-workflow.ts` → `ANTICIPO_CLIENTE_RECIBIDO` / `ANTICIPO_PROVEEDOR_ENTREGADO` (origen `anticipo_movimiento`) | action de anticipos, workflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/lib/services/__tests__/anticipos-workflow.test.ts` |
| 8 | `anticipos-workflow.ts` → `ANTICIPO_CLIENTE_APLICADO` / `ANTICIPO_PROVEEDOR_APLICADO` | workflow de aplicación | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/lib/services/__tests__/anticipos-workflow.test.ts` |
| 9 | `anticipos-workflow.ts` → `ANTICIPO_CLIENTE_APLICACION_REVERSADA` / `ANTICIPO_PROVEEDOR_APLICACION_REVERSADA` | workflow de reverso (gastos, nómina) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/lib/services/__tests__/anticipos-workflow.test.ts` |
| 10 | `anticipos-workflow.ts` → `ANTICIPO_CLIENTE_DEVUELTO` / `ANTICIPO_PROVEEDOR_REINTEGRADO` | action de devolución | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/lib/services/__tests__/anticipos-workflow.test.ts` |
| 11 | `registrar-merma-service.ts` / `mermas/actions.ts` → `MERMA` (origen `ajuste_merma`) | action y route web/móvil de mermas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/mermas/__tests__/registrar-merma-service.test.ts`, `src/features/mermas/__tests__/actions.test.ts` |
| 12 | `revertirMermaContableEnTransaccion` → reversa de merma (origen `ajuste_merma_reversado`) | action, route web y route móvil de mermas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/services/__tests__/inventory-adjustment-posting-service.test.ts` |
| 13 | `produccion/actions.ts` → `PRODUCCION` (origen `orden_produccion`) | action de producción | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ⚠️ | `src/features/produccion/__tests__/actions.test.ts` |
| 14 | `accounting-reconciliation-service.ts` (`reconcileSale`) → `COBRO_CXC` / `VENTA_CONTADO` (origen `reconciliacion_venta`) | action de reconciliación, ruta web, ruta móvil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/__tests__/settlement-posting-service.test.ts`, `src/features/contabilidad/services/__tests__/accounting-reconciliation-fx.test.ts` |
| 15 | `accounting-reconciliation-service.ts` (`reconcileService`) → `COBRO_SERVICIO` (origen `reconciliacion_servicio`) | action, ruta web, ruta móvil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/__tests__/settlement-posting-service.test.ts` |
| 16 | `productos/actions-restock.ts` → `PAGO_CXP` (origen `reconciliacion_gasto`) | action de reingreso | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/__tests__/settlement-posting-service.test.ts` |
| 17 | `accounting-cash-operations-mutation-service.ts` → `PRESTAMO_OTORGADO` (origen `prestamo_cash`) | actions y rutas web/móvil de préstamos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 18 | `accounting-cash-operations-mutation-service.ts` → `DEUDA_RECIBIDA` (origen `deuda_cash`) | actions y rutas web/móvil de deudas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 19 | `accounting-cash-operations-mutation-service.ts` → `COBRO_PRESTAMO` / `PAGO_DEUDA` | actions y rutas web/móvil de pagos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| 20 | `accounting-operations-mutation-service.ts` (`createBankAdjustment`) → `AJUSTE_BANCARIO_ABONO` / `AJUSTE_BANCARIO_CARGO` (origen `ajuste_bancario`) | action, ruta web y ruta móvil de ajustes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/capital-adjustment-posting-service.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-idempotency-postgres.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-formal-rollback-postgres.test.ts` |
| 21 | `accounting-operations-mutation-service.ts` (`createCapitalInjection`) → `INYECCION_CAPITAL` / `DEUDA_RECIBIDA` (origen `inyeccion_capital`) | action, ruta web y ruta móvil de capital | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/capital-adjustment-posting-service.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-idempotency-postgres.test.ts`, `src/features/contabilidad/services/__integration__/capital-adjustment-formal-rollback-postgres.test.ts` |
| 22 | `reversal-service.ts` → asiento inverso (origen `REVERSO_ASIENTO`) | `gastosDE/reversal.ts`, `empleados/payroll-reversal.ts` | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/services/__tests__/reversal-service.test.ts`, `src/features/gastosDE/__tests__/expense-formal-reversal.test.ts` |
| 23 | `cierre-formal-service.ts` → `CIERRE_PERIODO` (origen `cierre_periodo`) | action de cierres | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ⚠️ | `src/features/contabilidad-formal/services/__tests__/cierre-formal-service.test.ts` |
| 24 | `replay-backfill-service.ts` → fuentes reconstruidas: `COBRO_CXC`, `VENTA_CONTADO`, `VENTA_CREDITO`, `PAGO_CXP`, `COMPRA_CREDITO`, `GASTO_CREDITO`, `VENTA_SERVICIO_CREDITO`, `DEVOLUCION_VENTA`, `AJUSTE_BANCARIO_ABONO` / `AJUSTE_BANCARIO_CARGO`, `INYECCION_CAPITAL` / `DEUDA_RECIBIDA` y los seis tipos de anticipo | actions de replay (preflight, aprobación, ejecución) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | `src/features/contabilidad-formal/services/__tests__/replay-source-collector.test.ts`, `src/features/contabilidad-formal/__integration__/replay-backfill.test.ts` |
| 25 | `devolucion-venta-service.ts` → `DEVOLUCION_VENTA` (origen `devolucion_venta`) | action de devoluciones de venta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `src/features/contabilidad-formal/services/__tests__/sale-return-posting-service.test.ts`, `src/features/ventas/__tests__/devolucion-service.test.ts`, `src/features/ventas/__integration__/devolucion-formal-rollback-postgres.test.ts` |

Notas de la matriz:

- **(b) y (c)**: el motor acota por `ctx.tenantId` y el asiento tiene la clave
  única `(tenantId, origenTipo, origenId)`. Evidencia común:
  `src/features/contabilidad-formal/__tests__/posting-engine.test.ts` y
  `src/features/contabilidad-formal/__integration__/libros-aislamiento.test.ts`.
- **(d)**: la fila 4 (compra de productos) marca ⚠️ porque la compra no persiste la tasa
  de cambio. La inyección de capital (fila 21) ya no marca ⚠️: persiste la tasa
  y el importe convertido, y el replay reconstruye el asiento con la misma
  huella FX. En la compra, en moneda extranjera, el motor falla cerrado en vez
  de inventar una equivalencia.
- **(h)**: las familias de caja (filas 17-19), de ajustes e inyecciones (filas
  20-21) y de devoluciones de venta (fila 25) tienen un failpoint físico en
  `main` (trigger de auditoría y fallo de inserción del asiento). En las filas
  20-21 y 25 el failpoint se prueba además en modo `enforce`: el asiento ya
  insertado se revierte junto con la escritura operativa y con la auditoría
  (`src/features/contabilidad/services/__integration__/capital-adjustment-formal-rollback-postgres.test.ts`,
  `src/features/ventas/__integration__/devolucion-formal-rollback-postgres.test.ts`).
  El resto de las filas tiene el rollback
  estructural por compartir transacción, sin failpoint físico: es la brecha
  conocida de la matriz.
- **(f)**: la garantía de no duplicar el asiento la da el origen único; la
  idempotencia de la fila operativa (no repetir la venta, la compra o el pago)
  depende del writer y solo está probada donde el test focal lo cubre.

## 5. Verificación final

| Comprobación | Resultado |
|---|---|
| Suite unitaria | 5749 pruebas verdes (848 archivos), 1 omitida, 2 pendientes |
| Suite de integración (PostgreSQL desechable) | 200 pruebas verdes (34 archivos) |
| Typecheck (`tsc --noEmit`) | Limpio |
| ESLint sobre los archivos del programa | Limpio |
| CI del estado final del programa | Verde: run `41809661324` sobre `6132fdc5` (4 shards de test, integración PostgreSQL, typecheck, lint, cobertura y build) |

La base de integración es desechable y local
(`ALLOW_DISPOSABLE_TEST_DB=1`, base `tcp_test_*` en `127.0.0.1:5433`); la
identidad `localhost` se rechaza a propósito por la política del repositorio.

## 6. Gates de rollout (siguen abiertos)

Ninguno de estos gates se cambió en CT-1:

| Gate | Estado | Nota |
|---|---|---|
| `R0.5-ACCEPT` | Sin firma | La matriz de la sección 4 documenta la cobertura; el acta global depende de R6/R7 |
| `R6-ROLLBACK` global | Abierto | El rollback físico está probado en la familia de caja, en ajustes/inyecciones y en la devolución de venta (los tres con el asiento formal en modo `enforce`); falta el resto de canales |
| `R6-BASELINE` por entorno | Abierto | Requiere el inventario de saldos por entorno |
| `R7` operacional (siete días) | Abierto | No se activó ningún modo |
| `shadow` / `enforce` por tenant | Apagado | `CONTABILIDAD_FORMAL_MODE=off` y `CONTABILIDAD_FORMAL_NO_CASH_MODE=off` |

## 7. Pendientes que quedan fuera de CT-1

1. **Apertura formal por traspaso (rollover)**: bloqueada a propósito por
   `APERTURA_SALDOS_NO_VERIFICABLES`; la evidencia disponible no permite
   verificar todos los rubros ni su moneda.
2. **Rollback físico por canal**: extendido a las familias de ajustes e
   inyecciones y a la devolución de venta (con el asiento formal en modo
   `enforce`); faltan las familias comercial (ventas, compras, servicios),
   anticipos, inventario y liquidaciones.
3. **Modo por tenant**: hoy el modo es global; falta el flag de licencia para
   activar `shadow`/`enforce` tenant a tenant.
4. **Verificador forense autónomo**: el replay ya compara el snapshot con lo
   contabilizado (`replay-reconciliation.ts`), pero el verificador independiente
   de CT-3 sigue pendiente.

La devolución de venta (`DEVOLUCION_VENTA`) quedó cerrada con la decisión D5:
el motor admite las tres reglas de monto del desglose, la plantilla global
refleja las tres salidas reales, el writer emite el asiento dentro de su
transacción y el replay lo reconstruye con el mismo constructor de evento.

La inyección de capital en moneda extranjera también quedó cerrada: persiste
la tasa y el importe convertido, y el replay reconstruye su asiento con la
misma huella FX.

## 8. Archivos de referencia

- Documentación funcional: `content/docs/modules/contabilidad/capa-formal-emisor-no-cash.md`
- Plan maestro: `docs/plan-ct1-integracion-capa-formal-2026-10-27.md`
- Inventario y decisiones: `docs/ct1-s0-inventario.md`
- Tareas con los SHA reales: `openspec/changes/contabilidad-capa-formal/tasks.md`
