# R0.5-ACCEPT — Matriz de aceptación writer × adaptador (Fase B, 2026-10-05)

> **Reconciliación de firma — 2026-10-11:** ver
> `reconciliacion-r05-g5-2026-10-11.md`. G5 firmado para identidad/reintento cash:
> 18 combinaciones verificadas; cuatro condiciones cerradas. Continuación PostgreSQL
> 78/78 y suite final ampliada 12/12, en corridas superpuestas. Replay action post-cierre
> reproducido y corregido. R0.5-ACCEPT sigue sin firma por R6/baseline/A9-R7.
> Los checks inferiores son históricos/focales.

> **ESTADO ACTUAL — 2026-10-09:** matriz de evidencia, **no acta de aceptación**.
> Correcciones locales no certifican `31/31` ni `31 × 8`; R0.5-ACCEPT sigue sin firma.
> R6-ROLLBACK global, R6-BASELINE por entorno y R7 operacional de siete días siguen
> abiertos. A10 tiene evidencia focal verificada de captura actual; reconstrucción
> histórica no es requisito de A10. Consultar la reconciliación A1–A10 enlazada abajo.

**Alcance:** los 31 callsites productivos en 19 archivos del inventario reproducible
(`writers-matrix.test.ts`), cruzados con sus adaptadores vivos y evaluados en 8
dimensiones de aceptación. No es certificación: es el mapa sistemático que alimenta
la Fase C (integración PostgreSQL por canal + rollback físico).

**Leyenda:** ✅ PASS con evidencia citada · ⚠️ PARCIAL (evidencia indirecta o de un
solo canal) · ❌ GAP (sin evidencia) · ➖ N/A por diseño.

**Adaptadores vivos confirmados (script `/tmp/writer_adapters2.py` + matriz):**
web = ruta Next.js propia · mobile = `/api/mobile/v1/**` · action = Server Action ·
workflow/service = caller intermedio (el adaptador real está un salto más arriba).

> **Corte de auditoría 2026-10-07 — ACEPTACIÓN REABIERTA:** las marcas por celda son
> evidencia focal registrada durante la Fase B; no constituyen un `31/31` PASS ni
> certifican todas las combinaciones writer × adaptador. R6-ROLLBACK/R6-BASELINE y la
> ventana operativa R7.3/R7.4 continúan pendientes; ver A8–A9 en
> `auditoria-correcciones-2026-10-07.md`.

> **Estado vigente 2026-10-11:** no hay aceptación global firmada. Los checks de las
> tablas son evidencia focal/documental por alcance, no `31 × 8` aprobaciones vigentes.
> R0.5-ACCEPT, R6-ROLLBACK global, R6-BASELINE por entorno heredado y R7 operacional
> permanecen abiertos. Ante la alternativa planteada por el usuario, A9 se conserva pendiente
> como opción conservadora: la ventana de siete días
> no inició; el Preview aislado terminó `ERROR/ENOENT` antes de completar validaciones, sin
> resultados de build/tests verificables. Esto no revoca ni satisface el gate R7. Ver la
> reconciliación A1–A10 en
> `auditoria-correcciones-2026-10-07.md` antes de interpretar cualquier check.

## 1. Ventas y facturación

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `facturacion-workflow.ts` (`reconciliarVentaDirecta`) | **RETIRADO (05-10, G4)** — sin callers productivos; función y rama eliminadas | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| `facturacion-workflow.ts:692` → VENTA_CONTADO (`contra_pago`, vía `applyFacturacionCobroWorkflow`) | action POS `createVentaAction` → `venta-lifecycle-service` / `venta-mutation-service`; workflow ofertas; `reparaciones/ordenes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (receipt web verificado; caller nativo focal verificado aparte, no todos los adaptadores) | ✅ | ✅ |
| `facturacion-workflow.ts:761` → VENTA_CONTADO (porción contado mixta) | mismos que :692 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (receipt web verificado; caller nativo focal verificado aparte, no todos los adaptadores) | ✅ | ✅ |
| `facturacion-workflow.ts:872` → VENTA_CREDITO | mismos que :692 + lifecycle/ofertas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (receipt web verificado; caller nativo focal verificado aparte, no todos los adaptadores) | ✅ | ✅ |
| `venta-mutation-service.ts:480` → COSTO_VENTA_DEVENGADO (valorado) | action `createVentaAction` (vía `aplicarEfectosInventario`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `venta-mutation-service.ts:498` → COSTO_VENTA_DEVENGADO (shadow sin valoración) | mismo | ✅ | ✅ | ✅ | ➖ (no postea a propósito; outbox con causa) | ✅ | ➖ | ➖ | ✅ |
| `devolucion-venta-service.ts:585` → DEVOLUCION_VENTA | service (caller: action/API devolución) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`idempotencyKey`) | ✅ | ✅ |
| `actions-reconciliacion.ts:307` → COBRO_CXC/VENTA_CONTADO (`reconciliarVentaAction`) | action → `AccountingReconciliationService.reconcileSale` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reconciliacion/ventas/route.ts:884` → COBRO_CXC/VENTA_CONTADO (POST web) | web (ruta propia) | ✅ (HTTP real 401/201) | ✅ | ✅ (`Idempotency-Key` + unique) | ✅ | ✅ | ✅ (reintento → mismo `reconciliacionId`, 409 conflicto) | ✅ | ✅ |

**Evidencia:** `formal-shadow-cash-sale.test.ts` 8/8 (filas contra_pago, COGS, VENTA_CREDITO:
asiento cuadrado, rollback por falta FX, shadow/outbox); `facturacion-workflow-gate.test.ts`
14/14; `devolucion-fifo.test.ts` 5/5 (rollback trigger SQL); `reconciliar-servicio-real.test.ts`
18/18 + `http-real-idempotencia.test.ts` 3/3 (fila ventas route).

**R6 focal — actualización 2026-10-09:** la validación independiente de cinco suites
cerró **57/57 PostgreSQL** y `typecheck:tests` PASS. La prueba de AuditLog de venta falla
en el gate `PRICE_OVERRIDE` anterior a FIFO; no prueba un AuditLog fallido después de los
efectos FIFO. La prueba separada de error SQL del asiento COGS sí verifica rollback
posterior a FIFO. Las cuatro suites adicionales demuestran failpoint físico de AuditLog
en sus writers respectivos. El bundle no cierra R6 global ni modifica R6-BASELINE,
R7 real, snapshots históricos o el estado de aceptación global.

**Reapertura focal 2026-10-09 — idempotencia de solicitud de venta:** el `✅` histórico
no demostraba deduplicación del POST lógico de creación. `createVentaSchema` no acepta
`idempotencyKey`; `VentaMutationService.create` inserta una nueva `Venta` con ID generado
por cada invocación, y `Venta` no persiste una clave única de request. La unicidad del
evento/origen formal evita repetir el mismo evento para un `ventaId` ya persistido, pero
un retry de la solicitud crea otro `ventaId` y por eso no acredita replay del request.
La marca histórica `⚠️` limitaba la afirmación a los callers/canales del `createVenta`; otros callers
de `applyFacturacionCobroWorkflow` requieren evaluar su propio contrato. Esto no invalida
las pruebas separadas de posting/rollback de COGS ni afirma que ya exista un bug de doble
venta en producción. El contrato de request y su prueba por adaptador quedan abiertos.

**Corte previo — 2026-10-09 (supersedido en parte):** ese hallazgo quedó supersedido para
el backend y los cinco callers web. La historia limpia de 145 migraciones y el receipt
PostgreSQL pasaron 5/5; seis suites HTTP/web pasaron 26/26 y regresiones enhanced/pedido
RTL 4/4. En ese corte el caller nativo se consideraba sin clave; la actualización focal
posterior verificó `mobile/src/SalesSurface.tsx` (505 PASS/4 omitidos en 109 archivos,
typecheck y cobertura del writer 14/14). La evidencia de persistencia tras recarga completa
y rotación post-éxito en el test de moneda continúa ausente. Las marcas de tabla reflejan
solo los scopes fechados de evidencia, no todos los adaptadores ni la aceptación global.

## 2. Cash: préstamos y deudas

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `prestamos-cash/route.ts:297` → PRESTAMO_OTORGADO (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (`prestamos-cash-pagar-real.test.ts` y `deudas-cash-real.test.ts`: reintento no duplica) | ✅ | ✅ |
| `prestamos-cash/[id]/pagar/route.ts:214` → COBRO_PRESTAMO (POST web) | web (ruta propia) | ✅ (Bearer real 401/403) | ✅ | ✅ | ✅ | ✅ | ✅ (`prestamos-cash-pagar-real.test.ts`: reintento no duplica) | ✅ | ✅ |
| `deudas-cash/route.ts:305` → DEUDA_RECIBIDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `deudas-cash/[id]/pagar/route.ts:203` → PAGO_DEUDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `accounting-cash-operations-mutation-service.ts` (4: `:208/:406/:560/:725`, anclas históricas) | actions `actions-prestamos-cash` / `actions-deudas-cash`; mobile `cash-loans/**`, `cash-debts/**` | ✅ (gates en servicio; Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (G5 identidad/reintento: 18 combinaciones; altas action reales, finales keyed y replay post-cierre; límites en acta 11-10) | ✅ | ✅ (alcance físico focal por writer) |

**Evidencia:** `cash-loans-http-real.test.ts` 3/3 + `cash-debts-http-real.test.ts` 3/3
(Bearer real, carreras); `prestamos-cash-pagar-real.test.ts` 11/11 y `deudas-cash-real.test.ts`
8/8 (rollback físico crear/pagar); `deudas-cash-auth-http-real.test.ts` 1/1.

## 3. Operaciones bancarias

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `accounting-operations-mutation-service.ts:307` → TRANSFERENCIA_BANCARIA | web `/contabilidad/transferencias`; mobile `/bank-transfers/**`; action `contabilidad/actions.ts` | ✅ (Bearer real web/móvil) | ✅ | ✅ | ✅ (FX-4 cross-quote + fingerprint) | ✅ | ✅ (`TRANSFERENCIA_DUPLICADA` 409; `ajuste-idempotency-real.test.ts` 2/2) | ✅ (strict en tx) | ✅ |
| `...:424` → AJUSTE_BANCARIO | web/mobile `/bank-adjustments` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `...:568` → DEUDA_RECIBIDA / INYECCION_CAPITAL | web/mobile `/capital-injections` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `...:698` → PAGO_DEUDA_CAPITAL | mobile `/capital-injections/[id]/payments` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (carrera 350+350 vs saldo 500) | ✅ | ✅ |

**Evidencia:** `accounting-bank-transfers-real.test.ts` 9/9 (rollback por error SQL de
auditoría); `operations-channels-http-real.test.ts` 4/4 (Bearer web/móvil, filas 17–20).

## 4. Reconciliación de servicios y gastos

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `accounting-reconciliation-service.ts:547` → COBRO_CXC/VENTA_CONTADO (`reconcileSale`) | action `actions-reconciliacion`; web `reconciliacion/ventas`; mobile `reconciliation/sales` | ✅ | ✅ | ✅ (clave idempotente + hash bajo lock) | ✅ | ✅ | ✅ (replay sec./concurrente, 409) | ✅ (AuditLog estricto) | ✅ |
| `...:1140` → COBRO_SERVICIO (`reconcileService`) | action; web `reconciliacion/servicios`; mobile `reconciliation/services` | ✅ (HTTP real 401/201 en servicios) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pago-gastos-workflow.ts:642` → PAGO_CXP / PAGO_NOMINA / COMPRA_CONTADO / GASTO_CONTADO | action `compras-productos/actions`, `contabilidad/actions-reconciliacion`; adapter `reconciliacion-gastos-adapter` | ✅ (permiso en ambos invocadores) | ✅ | ✅ | ✅ (v2 desde Fase A) | ✅ | ✅ (409 PAGO_DUPLICADO) | ✅ (`logStrict` en tx) | ✅ (trigger AuditLog revierte) |

**Evidencia:** `reconciliar-servicio-real.test.ts` 23/23 (rollback CxC y auditoría);
`service-cxc-pago-fx-real.test.ts` 4/4; `pago-gastos-workflow.test.ts` 15/15 (unitario).

## 5. Compras, inventario y producción

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `compras-productos/actions.ts:446` → COMPRA_CREDITO / COMPRA_CONTADO | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (debita una vez) | ✅ | ✅ |
| `compras-servicios/actions.ts:141` → GASTO_CON_ANTICIPO_PROVEEDOR | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`compra-servicios-retry-real.test.ts`: `COMPRA_SERVICIO_DUPLICADA` 409) | ✅ | ✅ |
| `mermas/actions.ts:180` → MERMA_INVENTARIO | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (reintento secuencial + 5 concurrentes P2002) | ✅ | ✅ |
| `productos/actions-restock.ts:588` → COMPRA_CONTADO (restock) | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (reintento secuencial + 5 concurrentes P2002→RESTOCK_DUPLICADO) | ✅ | ✅ |
| `produccion/ordenes/[id]/completar/route.ts:204` → PRODUCCION_SALIDA | web (ruta propia) | ✅ (`auth-http-real.test.ts` 4/4: Bearer <redacted>) | ✅ | ✅ | ✅ | ✅ | ✅ (`completar-concurrente.test.ts`: 5 concurrentes, 1 gana, 4 CONFLICT; claim optimista) | ✅ | ✅ |
| `venta-servicios/actions.ts:267/:397` → VENTA_SERVICIO_CREDITO (devengo ×2) | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`idempotencyKey` + unique constraint; P2002 → devuelve ganadoras) | ✅ | ✅ (`service-devengo-directo-real.test.ts`: rollback por fallo en asiento) |

**Evidencia:** `purchase-credit-fx-real.test.ts` 6/6; `anticipos-devengo-bruto-real.test.ts` 7/7;
`merma-formal-real.test.ts` 3/3; `restock-formal-real.test.ts` 2/2; `rollback-real.test.ts` 3/3
(producción).

## 6. Anticipos

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `anticipos-workflow.ts:233` → ANTICIPO_CLIENTE_RECIBIDO / PROVEEDOR_ENTREGADO (`createAnticipo`) | web `/api/anticipos` + `/contabilidad/anticipos`; mobile `/advances`; action `actions-anticipos` | ✅ (Bearer real web/móvil/legacy) | ✅ | ✅ (`Idempotency-Key` durable + advisory lock) | ✅ | ✅ | ✅ (reintento concurrente, 409 payload distinto) | ✅ | ✅ |
| `anticipos-workflow.ts:574` → ANTICIPO_*_APLICADO (`applyAnticipoAllocations`) | actions documentales: compras-productos, compras-servicios, ofertas, venta-servicios | ✅ (vía callers) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Evidencia:** `anticipos-fx-real.test.ts` 10/10–11/11 (Bearer real, rollback SQL);
`anticipos-devengo-bruto-real.test.ts` 10/10.

## Gaps para Fase C (priorizados)

### G1 — Rollback físico por fallo de AuditLog en `pago-gastos-workflow` ✅
**Cerrado 05-10:** `pago-gastos-workflow-real.test.ts` 2/2 en PostgreSQL desechable:
trigger `BEFORE INSERT ON "AuditLog"` (entidad `RECONCILIACION`, ERRCODE 22012)
hace rechazar el workflow y revierte saldo bancario, `ReconciliacionGasto`, asiento
y marca de pagado en `GastosDE`. El camino feliz confirma asiento único por
`reconciliacion_gasto` y débito 1000→880. Suite completa: 52/52 archivos, 301/301 tests.

### G2 — Reintento/idempotencia ✅ (parcial: queda C3)
**Cerrado 05-10 para el núcleo:** suite 52/52 archivos, 305/305 tests.
- `pago-gastos-workflow` ✅: guarda `PAGO_DUPLICADO` (409) si ya existe reconciliación
  directa para la referencia; serializado por `FOR UPDATE` en la fuente.
- `mermas` ✅: columna `idempotencyKey` + migración `20261005160000_merma_idempotency_key`
  (unique `[tenantId, idempotencyKey]`); reintento con la misma clave devuelve la merma existente.
- `restock` ✅: guarda `RESTOCK_DUPLICADO` si `numeroFactura` provista ya existe en `gastoCompra`.
- `produccion/completar` ✅: idempotencia natural por máquina de estados (rechaza si no está
  `EN_PROCESO`); test de reintento verifica un solo historial y una sola reconciliación.
**Pendiente en C3:** rutas web cash, `compras-servicios`, transferencias/ajustes/capital,
`venta-servicios` y adaptadores cash (G5).

### G3 — Sesión HTTP real en producción/completar ✅
**Cerrado 05-10:** `completar/__integration__/auth-http-real.test.ts` (4/4) ejercita el
wrapper real de `withAuthPost` contra `userSession` en la DB desechable, sin mock de
`auth-middleware`: 401 sin Bearer, 401 con JWT sin sesión registrada, 401 con sesión
expirada (que queda `isActive=false`) y 200 con Bearer de manager (la ruta responde 200,
no 201) que completa la orden usando la identidad de la sesión. El test corrió también
contra la route de HEAD mediante una copia temporal, con lo que la evidencia no depende
del endurecimiento de tenant/feature/permiso que sigue sin commitear; residuo de fixtures
verificado en 0.

### G4 — `reconciliarVentaDirecta` sin caller ✅
**Cerrado 05-10 (retirar con tombstone, no excluir):** la función y `ReconciliacionDirectaParams`
no tenían callers productivos en `src/` (code graph + búsqueda del árbol, reverificado 02-10),
por lo que se eliminaron de `facturacion-workflow.ts`. La fila 1 de `matriz-writers-r0.5.md`
queda como tombstone RETIRADO, en pie de igualdad con las filas 8/13–16; el inventario baja
a 31 callsites en 19 archivos y la aceptación de las ramas vivas de venta al contado
(`contra_pago`, porción contado mixta) es la de las filas 2/30. **No** se certifica permiso
por delegación: no existe adaptador que ejercite esa rama.

### G5 — Identidad/reintento cash por canal — firmado 11-10 con alcance nominativo
**Corte histórico 05-10, supersedido para firma global:** cada adaptador tiene test de reintento propio que demuestra
que no duplica.
**Cierre C3-extra (06-10):** `AjusteBancario` recibió `idempotencyKey` (`@@unique([tenantId, idempotencyKey])`
+ migración `20261006000000_ajuste_idempotency_key`); `createBankAdjustment` devuelve el ajuste
existente ante reintento con la misma clave sin duplicar saldo ni asiento
(`ajuste-idempotency-real.test.ts` 2/2). `venta-servicios` devengo directo auditado:
`service-devengo-directo-real.test.ts` verifica venta + CxC + asiento `VENTA_SERVICIO_CREDITO`.
- `prestamos-cash-pagar-real.test.ts` y `deudas-cash-real.test.ts`: rutas web con rollback
- `cash-loans-http-real.test.ts` y `cash-debts-http-real.test.ts`: rutas mobile con Bearer real
- `cash-actions-retry-real.test.ts`: server actions `registrarPagoPrestamoAction` y `registrarPagoDeudaAction`
La evidencia histórica de seis adaptadores verifica los casos citados, no todas las
combinaciones alta/pago parcial/pago final. La reconciliación nominativa vigente está
en `reconciliacion-r05-g5-2026-10-11.md`: la continuación verifica las 18 combinaciones
y cierra las cuatro condiciones mediante `cash-g5-acceptance-real.test.ts` (12/12).
El helper `cash-action-replay.ts` corrige el bloqueo de replay post-cierre reproducido
en las cuatro actions; 9 tests unitarios, cobertura focal 100% líneas y 92,85% ramas.
Auth action controlada; HTTP con sesión persistida; firma sobre archivos locales.
No se extiende esta firma a R0.5 global ni a los gates de rollback/baseline/operación.

## Notas

- Las celdas ✅ son afirmaciones de evidencia focal por fila, no aceptación global de los
  31 callsites. La auditoría 07-10 reabrió el gate hasta completar A8–A9 y verificar
  cada adaptador en el entorno/corte correspondiente.
- `venta-mutation-service.ts:498` (shadow sin valoración) no postea por diseño; su
  aceptación es la del outbox durable, ya cubierta en `formal-shadow-cash-sale.test.ts`.
- Este documento no cierra R0.5-ACCEPT; es la entrada de la Fase C y conserva los gaps
  abiertos sin convertir el conteo de inventario en certificación.

### Evidencia focal G5 — ajuste bancario móvil (08-10-2026)

- `POST /bank-adjustments` resuelve replays antes del control de período, conservando
  autenticación, tenant, feature y permiso. El helper usa el mismo advisory lock
  transaccional que el writer; una lectura simple no bastaba para commits pendientes.
- Sin clave, se conserva el control de período; payload keyed inválido devuelve 400.
  Replay idéntico después de cerrar período devuelve la operación previa; payload
  divergente devuelve 409; operaciones nuevas siguen bloqueadas por período cerrado.
- Verificación directa: ruta + servicio **51/51 unitarios**; canales HTTP reales
  **6/6 PostgreSQL**, incluyendo header-only, saldo/filas/asientos sin duplicación y
  espera observable del lock. Revisión fresca final sin bloqueos en este alcance.
- Cuatro suites de contratos de ventas corregidas: **26/26 PostgreSQL**. La suite
  venta-crédito se repitió junto con canales HTTP: **13/13** combinadas.
- Typecheck de aplicación y ESLint focal PASS. `typecheck:tests` conserva **55
  diagnósticos restantes**, cero en los archivos de estas dos correcciones.

Este slice acredita el adaptador móvil de ajustes, no todos los adaptadores G5.
R0.5-ACCEPT, G5 global, R6-ROLLBACK global, R6-BASELINE, R7 operacional y snapshots
históricos permanecen abiertos. No se hizo commit ni push.


### Evidencia focal adicional — 2026-10-08: pagos móviles de deuda cash

- Replay con clave resuelto antes del gate de período bajo el mismo lock del writer;
  mantiene permisos, tenant y deuda indicada por la ruta. Payload divergente: 409;
  nueva operación en período cerrado: rechazada.
- Fecha explícita incluida en huella, conciliación y FX; fechas ISO imposibles
  (por ejemplo 2026-02-30) rechazadas antes de normalización. Retorno de replay
  conserva la fila completa. Revisión fresca final sin bloqueadores focales.
- Verificación directa final: **27/27 unitarios** ruta/servicio y **23/23 PostgreSQL**
  deuda legacy + HTTP móvil. Reparaciones unitarias de compras: **55/55**.
- Snapshot actual de `typecheck:tests`: **44 diagnósticos**; existen cambios
  concurrentes ajenos a este slice, por lo que la reducción no se atribuye toda
  a esta corrección. No equivale a typecheck global aprobado.
- Pendientes: alinear fecha/replay en OpenAPI y SDK de deuda, y resolver el gate
  previo al replay en pagos móviles de préstamos. G5 y cierre global siguen abiertos.
- Sin commit ni push.


### Evidencia focal — 2026-10-08: préstamos móviles y contrato pagos cash

- Replay móvil de préstamo resuelto antes del gate de período, con reread tras
  rechazo; helper y writer comparten lock de tenant y controles de permisos.
  ID de ruta autoritativo. Fecha explícita participa en hash, conciliación y FX.
- Ambos pagos cash exigen fecha ISO válida; timestamps requieren Z/offset.
  Claves normalizadas de 1–64 caracteres verificadas en rutas y servicio.
- OpenAPI/documentación y 20 archivos SDK de pagos regenerados para ambos
  canales: fechaOperacion, idempotencyKey y header Idempotency-Key.
- Verificación directa final: **56/56 unitarios** (rutas/servicio/contrato/hardening),
  **4/4** regresiones SDK focales y **29/29 PostgreSQL** (préstamos HTTP, deudas
  HTTP y deuda legacy). Revisión fresca sin bloqueadores focales.
- Typecheck aplicación y **typecheck:tests PASS** en snapshot actual. Existen
  reparaciones concurrentes ajenas; no se atribuye todo el cambio a este slice.
- Corte previo a regeneración completa: se observaban cuatro expectativas de 110
  operaciones frente a 125 y artefactos ajenos obsoletos; `git diff --check` registró
  espacios finales en documentación Dart/Swift. La ausencia SDK de 15 operaciones queda
  supersedida por la verificación posterior (125 únicas, 46/46 paridad, 3/3 smoke); no
  presentar ese corte como actual. El whitespace es una observación histórica no revalidada.
- G5 global, R0.5-ACCEPT, R6 global/baseline, R7 operacional y snapshots históricos
  siguen abiertos. Sin commit ni push.


### Corte histórico de alcance SDK — 2026-10-09 (supersedido por regeneración completa)

**Corte previo a la regeneración completa, conservado solo como historia:** en ese
momento se observaban 110 operaciones en los SDK frente a 125 en OpenAPI. El estado
quedó supersedido por la regeneración/verificación posterior que alinea los cuatro SDK
con las 125 operaciones únicas, 46/46 paridad y 3/3 smoke. La limitación vigente es que
no se afirma compilación de todos los lenguajes ni aceptación global; no mantener la
ausencia de las 15 operaciones como pendiente actual.

Siguiente evidencia R6: creación de préstamo cash con AuditLog real. La suite
existente mockea logStrict y su rollback bloquea asientos; no acredita falla física
del INSERT de AuditLog para ese writer. Nueva prueba física en preparación.


### R6-ROLLBACK focal — 2026-10-09: creación préstamo cash / AuditLog real

- Nueva suite `cash-loan-create-audit-rollback-real.test.ts`: **2/2 PostgreSQL**
  verificados directamente. Sin mock de AuditLogService. Happy path acredita
  banco, préstamo, CxC, conciliación, asiento con líneas y AuditLog durable.
- Trigger físico de AuditLog filtrado por actor único y entidad PRESTAMO_CASH;
  se exige el mensaje exacto del error. Falla de creación con clave única.
- Después de una creación exitosa preexistente, se compara snapshot completo
  normalizado de banco, préstamos, CxC, conciliaciones, asientos/líneas y auditoría
  antes/después del fallo; también se conservan conteos/saldo. Revisión fresca
  confirma rollback real del estado original, no falso positivo anterior al INSERT.
- `typecheck:tests` PASS. Evidencia focal solo para creación de préstamo con clave;
  vínculo de conciliación en creación sin clave se investiga por separado.
- No cierra R6 global ni los gates operacionales; sin commit/push.


### Corrección trazabilidad cash — 2026-10-09

- Creaciones de préstamos/deudas, canónicas y legacy, vinculan ahora siempre
  la conciliación del desembolso al ID de la entidad creada, con o sin clave,
  dentro de la misma transacción. Historial de pagos conserva filtros de tipo.
- RED confirmado: creación sin clave no efectuaba actualización FK. GREEN:
  **22/22 unitarios**, **35/35 PostgreSQL** en cuatro suites (HTTP préstamos/deudas,
  deuda legacy y rollback AuditLog de creación préstamo). `typecheck:tests` PASS.
- Se corrigieron dos contratos legacy que esperaban FK null; las aserciones
  de FX y asientos permanecen. Revisión fresca no halló explotación tenant ni
  regresión: el ID actualizado proviene de una fila tenant-scoped recién creada
  en la misma transacción; no es una referencia de reconciliación del usuario.
- Verificación focal, no cierre global; pendientes SDK global y gates previos
  siguen abiertos. Sin commit/push.


### R6-ROLLBACK cash físico — 2026-10-09

- Nueva suite `cash-writers-audit-rollback-real.test.ts`: **6/6 PostgreSQL**
  para loan payment/debt create/debt payment canónicos y sus tres handlers legacy.
  AuditLogService, Prisma y posting reales; solo autenticación estabilizada en test.
- Happy path acredita AuditLog durable y asiento con líneas. Trigger real de
  AuditLog filtra actor/entidad únicos y error exacto; snapshots completos incluyen
  banco, préstamo/deuda, CxC/CxP, conciliación, asientos/líneas, período/cache y auditoría.
- Verificación directa combinada con préstamo create: **8/8 PostgreSQL**; revisión
  fresca sin bloqueadores. Se corrigió typing del mock y restauración env en finally.
- No afirmar R6 global: faltan dimensiones/writers ajenos al alcance probado.

Pendientes G5 concretos identificados (no solo etiqueta global): los cuatro POST
legacy cash de alta/pago ignoran claves porque sus schemas no las incluyen y
escriben directamente; los dos POST móviles de altas validan período antes de
replay y carecen de prueba HTTP de conflicto. La UI actual usa Server Actions,
pero los endpoints legacy permanecen activos. Siguiente corrección por adaptadores.
Sin commit/push; no cierre 31/31.


### G5 focal — 2026-10-09: cuatro adaptadores HTTP legacy cash (corte previo)

- POST alta/pago de préstamos y deudas ahora aceptan claves body/header de
  1–64 caracteres; body tiene precedencia e ID de ruta permanece autoritativo.
  Replay bajo lock tenant antes del gate de período; nuevas escrituras con
  clave delegan al servicio canónico. Sin clave se conserva la rama compatible.
- Helpers de altas comparten fingerprint completo, controles de acceso, lock y
  búsqueda tenant-scoped de entidad vinculada. La misma fecha interna capturada
  se valida y persiste; no se incluye el reloj generado en la huella idempotente.
- Verificación directa: **77/77 unitarios**, **38/38 PostgreSQL** (legacy préstamo,
  deuda y rollback AuditLog). Header-only, replay de alta/pago parcial/final,
  conflicto y no duplicación; precedencia body/header en pruebas de adaptador.
  Revisión fresca final sin bloqueadores. Typecheck aplicación PASS; se reparó
  un diagnóstico TS7031 nuevo en el test y typecheck:tests PASS.
- Replay histórico de pago mantiene permisos/tenant/clave/ID aunque la entidad
  se haya eliminado lógicamente; no se trata como una mutación nueva.
- **Pendiente en ese corte, supersedido por la reconciliación final:** los dos POST
  móviles de altas gateaban
  período antes de replay y usan aliases de fecha que el writer no persiste.
  Deben validar la fecha real de posteo; añadir replay/conflicto HTTP post-cierre.
- Diff focal limpio; diff global sigue con whitespace SDK generado. Sin commit
  ni push; no certifica G5 global ni 31/31.

### Reconciliación vigente — 2026-10-09

Esta nota prevalece sobre los pendientes focales contradictorios anteriores; las fechas
y recuentos originales permanecen como historia. Los dos POST móviles de alta cash
quedan corregidos focalmente: replay anterior al gate de período, fecha de posteo
confiable y relectura tras denegación. No equivale a G5 global.

Los cuatro SDKs ya están regenerados con las 125 operaciones únicas fuente. La corrida
independiente `pnpm run openapi:check` terminó exit 0 (lint, 46/46 paridad, 3/3 smoke y
generación determinista); se preservó el lockfile. Dart, Gradle y kotlinc no disponibles,
así que no se afirma compilación completa de SDK.

En venta POS, la ausencia histórica de receipt queda corregida para cinco callers web:
145 migraciones limpias + receipt 5/5 PostgreSQL; seis suites HTTP/web 26/26 y enhanced/
pedido RTL 4/4. **En este corte previo a la verificación nativa**, `mobile/src/SalesSurface.tsx`
se consideraba sin clave; esa afirmación quedó supersedida por la actualización focal nativa
posterior más abajo. No se probó retención tras recarga completa ni rotación tras éxito en el
test de moneda. No inferir cobertura de todos los adaptadores.

R0.5-ACCEPT, G5 global, R6 global, baseline por entorno, R7 de siete días y snapshots
históricos siguen abiertos. No desplegar ni activar `shadow`, `enforce` o replay por esta
evidencia.

### Caller nativo de venta POS — actualización focal — 2026-10-09

La referencia anterior a `SalesSurface` sin clave queda supersedida para el caller nativo
verificado: la clave por intención se envía por `Idempotency-Key`, el body no cambia,
los taps rápidos comparten la intención y el rechazo conserva clave/payload para retry
fail-closed. Éxito limpia la clave antes de refrescar la lista. Verificación root:
505 PASS/4 omitidos en 109 archivos y typecheck PASS; cobertura focal del writer 14/14
en cuatro archivos y revisión fresca sin bloqueos. Dos pruebas renderizadas cubren retry
y doble tap. No hubo E2E de dispositivo; clave en memoria durante el montaje, sin claim
de persistencia tras remount/recarga. Se usa UUID-shaped `Math.random`, no criptografía.
Esto cierra solo la evidencia de este caller, no los adaptadores desconocidos ni las
ocho dimensiones/globales R0.5-ACCEPT, G5, R6, baseline, R7 o snapshots.

### A10 — Reconciliación documental vigente (2026-10-09)

La evidencia focal actual de `CashSnapshotService` está verificada: **6/6 PostgreSQL**
para captura, carrera same-cut y consistencia de lectura; **5/5 unitarios**; cierre formal/
rollback **8/8** y ambos typechecks PASS. El cierre pasa el mismo cliente de transacción
Serializable a la captura. CxC y CxP se leen desde una vista coherente aunque una
actualización ocurra entre ambas lecturas; la carrera de dos capturas al mismo corte termina
con conteos exactos 2 creados/0 existentes y 0 creados/2 existentes, sin duplicados. El
retry de hasta tres intentos aplica solo a la transacción independiente del servicio y solo
a `P2034`/`40P01`; si el caller entrega su propio `tx`, se propagan los errores y no se
reintenta la transacción ajena. La captura refleja estado actual al instante y no reconstruye
saldos pasados/futuros; esa reconstrucción no es requisito del A10 original ni evidencia de
comparabilidad histórica. Esto verifica A10 en su alcance focal, no firma R0.5-ACCEPT/31×8
ni cierra R6, baseline o R7.

### A6 — evidencia focal de devengo directo — 2026-10-11

`service-devengo-directo-real.test.ts` pasó **2/2 PostgreSQL** en la base local
desechable `tcp_test_local` (rol `arturo`, puerto 5433) y `pnpm run typecheck:tests`
pasó sin diagnósticos. El caso positivo persistió venta/CxC/asiento; el fallo físico
de trigger `BEFORE INSERT` sobre `asientos` devolvió `asiento bloqueado` / SQLSTATE
`22012`, con snapshots de ventas, CxC y asientos iguales antes/después.
Es evidencia del writer/camino específico, no una celda universal para los 31 writers.
R6 global mantiene pendiente el mapeo 31 callsites→failpoint físico y la evidencia
correspondiente por writer; no se demostró un bug global ni se cierra R0.5-ACCEPT.

### Preparación para integración — 2026-10-13

La verificación de referencias y conflictos, los límites del paquete contable y el plan de
pruebas operativas QA diferidas están documentados en
[preparación de merge y pendientes](preparacion-merge-y-pendientes-2026-10-13.md). Esta
preparación no cambia celdas de aceptación: evidencia focal/local previa no certifica el HEAD
actual ni R0.5-ACCEPT. Checks CI de la integración y validación con tenant QA aislado siguen
pendientes; no declarar merge listo ni activar `shadow`, `enforce` o replay.
