# R0.5-ACCEPT — Matriz de aceptación writer × adaptador (Fase B, 2026-10-05)

**Alcance:** los 31 callsites productivos en 19 archivos del inventario reproducible
(`writers-matrix.test.ts`), cruzados con sus adaptadores vivos y evaluados en 8
dimensiones de aceptación. No es certificación: es el mapa sistemático que alimenta
la Fase C (integración PostgreSQL por canal + rollback físico).

**Leyenda:** ✅ PASS con evidencia citada · ⚠️ PARCIAL (evidencia indirecta o de un
solo canal) · ❌ GAP (sin evidencia) · ➖ N/A por diseño.

**Adaptadores vivos confirmados (script `/tmp/writer_adapters2.py` + matriz):**
web = ruta Next.js propia · mobile = `/api/mobile/v1/**` · action = Server Action ·
workflow/service = caller intermedio (el adaptador real está un salto más arriba).

## 1. Ventas y facturación

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `facturacion-workflow.ts` (`reconciliarVentaDirecta`) | **RETIRADO (05-10, G4)** — sin callers productivos; función y rama eliminadas | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| `facturacion-workflow.ts:692` → VENTA_CONTADO (`contra_pago`, vía `applyFacturacionCobroWorkflow`) | action POS `createVentaAction` → `venta-lifecycle-service` / `venta-mutation-service`; workflow ofertas; `reparaciones/ordenes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `facturacion-workflow.ts:761` → VENTA_CONTADO (porción contado mixta) | mismos que :692 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `facturacion-workflow.ts:872` → VENTA_CREDITO | mismos que :692 + lifecycle/ofertas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `venta-mutation-service.ts:480` → COSTO_VENTA_DEVENGADO (valorado) | action `createVentaAction` (vía `aplicarEfectosInventario`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `venta-mutation-service.ts:498` → COSTO_VENTA_DEVENGADO (shadow sin valoración) | mismo | ✅ | ✅ | ✅ | ➖ (no postea a propósito; outbox con causa) | ✅ | ➖ | ➖ | ✅ |
| `devolucion-venta-service.ts:585` → DEVOLUCION_VENTA | service (caller: action/API devolución) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`idempotencyKey`) | ✅ | ✅ |
| `actions-reconciliacion.ts:307` → COBRO_CXC/VENTA_CONTADO (`reconciliarVentaAction`) | action → `AccountingReconciliationService.reconcileSale` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reconciliacion/ventas/route.ts:884` → COBRO_CXC/VENTA_CONTADO (POST web) | web (ruta propia) | ✅ (HTTP real 401/201) | ✅ | ✅ (`Idempotency-Key` + unique) | ✅ | ✅ | ✅ (reintento → mismo `reconciliacionId`, 409 conflicto) | ✅ | ✅ |

**Evidencia:** `formal-shadow-cash-sale.test.ts` 8/8 (filas contra_pago, COGS, VENTA_CREDITO:
asiento cuadrado, rollback por falta FX, shadow/outbox); `facturacion-workflow-gate.test.ts`
14/14; `devolucion-fifo.test.ts` 5/5 (rollback trigger SQL); `reconciliar-servicio-real.test.ts`
18/18 + `http-real-idempotencia.test.ts` 3/3 (fila ventas route).

## 2. Cash: préstamos y deudas

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `prestamos-cash/route.ts:297` → PRESTAMO_OTORGADO (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (`prestamos-cash-pagar-real.test.ts` y `deudas-cash-real.test.ts`: reintento no duplica) | ✅ | ✅ |
| `prestamos-cash/[id]/pagar/route.ts:214` → COBRO_PRESTAMO (POST web) | web (ruta propia) | ✅ (Bearer real 401/403) | ✅ | ✅ | ✅ | ✅ | ✅ (`prestamos-cash-pagar-real.test.ts`: reintento no duplica) | ✅ | ✅ |
| `deudas-cash/route.ts:305` → DEUDA_RECIBIDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `deudas-cash/[id]/pagar/route.ts:203` → PAGO_DEUDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (ver fila anterior) | ✅ | ✅ |
| `accounting-cash-operations-mutation-service.ts` (4: `:208/:406/:560/:725`) | actions `actions-prestamos-cash` / `actions-deudas-cash`; mobile `cash-loans/**`, `cash-debts/**` | ✅ (gates en servicio; Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (carrera multi-conexión: un ganador, `CREDITO_CONFLICTO`) | ✅ | ✅ |

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
| `venta-servicios/actions.ts:267/:397` → VENTA_SERVICIO_CREDITO (devengo ×2) | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ (`service-devengo-directo-real.test.ts`: rollback por fallo en asiento) |

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

### G5 — Cobertura por canal de `accounting-cash-operations-mutation-service` ✅
**Cerrado 05-10 (Fase C):** cada adaptador tiene test de reintento propio que demuestra
que no duplica.
**Cierre C3-extra (06-10):** `AjusteBancario` recibió `idempotencyKey` (`@@unique([tenantId, idempotencyKey])`
+ migración `20261006000000_ajuste_idempotency_key`); `createBankAdjustment` devuelve el ajuste
existente ante reintento con la misma clave sin duplicar saldo ni asiento
(`ajuste-idempotency-real.test.ts` 2/2). `venta-servicios` devengo directo auditado:
`service-devengo-directo-real.test.ts` verifica venta + CxC + asiento `VENTA_SERVICIO_CREDITO`.
- `prestamos-cash-pagar-real.test.ts` y `deudas-cash-real.test.ts`: rutas web con rollback
- `cash-loans-http-real.test.ts` y `cash-debts-http-real.test.ts`: rutas mobile con Bearer real
- `cash-actions-retry-real.test.ts`: server actions `registrarPagoPrestamoAction` y `registrarPagoDeudaAction`
Los 6 adaptadores verifican idempotencia en reintento sin duplicar registros.

## Notas

- Las dimensiones actor/permiso, tenant, origen, FX, tx y posting/auditoría están en
  ✅ para los 31 callsites vivos con la evidencia citada (unit + integración existente).
- `venta-mutation-service.ts:498` (shadow sin valoración) no postea por diseño; su
  aceptación es la del outbox durable, ya cubierta en `formal-shadow-cash-sale.test.ts`.
- Este documento no cierra R0.5-ACCEPT; es la entrada de la Fase C.
