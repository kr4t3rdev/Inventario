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
| `prestamos-cash/route.ts:297` → PRESTAMO_OTORGADO (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ⚠️ (origen único DB; carrera probada en servicio, no en ruta web) | ✅ | ✅ |
| `prestamos-cash/[id]/pagar/route.ts:214` → COBRO_PRESTAMO (POST web) | web (ruta propia) | ✅ (Bearer real 401/403) | ✅ | ✅ | ✅ | ✅ | ⚠️ (igual que anterior) | ✅ | ✅ |
| `deudas-cash/route.ts:305` → DEUDA_RECIBIDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ⚠️ (igual) | ✅ | ✅ |
| `deudas-cash/[id]/pagar/route.ts:203` → PAGO_DEUDA (POST web) | web (ruta propia) | ✅ (Bearer real) | ✅ | ✅ | ✅ | ✅ | ⚠️ (igual) | ✅ | ✅ |
| `accounting-cash-operations-mutation-service.ts` (4: `:208/:406/:560/:725`) | actions `actions-prestamos-cash` / `actions-deudas-cash`; mobile `cash-loans/**`, `cash-debts/**` | ✅ (gates en servicio; Bearer real) | ✅ | ✅ | ✅ | ✅ | ✅ (carrera multi-conexión: un ganador, `CREDITO_CONFLICTO`) | ✅ | ✅ |

**Evidencia:** `cash-loans-http-real.test.ts` 3/3 + `cash-debts-http-real.test.ts` 3/3
(Bearer real, carreras); `prestamos-cash-pagar-real.test.ts` 11/11 y `deudas-cash-real.test.ts`
8/8 (rollback físico crear/pagar); `deudas-cash-auth-http-real.test.ts` 1/1.

## 3. Operaciones bancarias

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `accounting-operations-mutation-service.ts:307` → TRANSFERENCIA_BANCARIA | web `/contabilidad/transferencias`; mobile `/bank-transfers/**`; action `contabilidad/actions.ts` | ✅ (Bearer real web/móvil) | ✅ | ✅ | ✅ (FX-4 cross-quote + fingerprint) | ✅ | ⚠️ (numeración tenant probada; reintento genérico no) | ✅ (strict en tx) | ✅ |
| `...:424` → AJUSTE_BANCARIO | web/mobile `/bank-adjustments` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (igual) | ✅ | ✅ |
| `...:568` → DEUDA_RECIBIDA / INYECCION_CAPITAL | web/mobile `/capital-injections` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (igual) | ✅ | ✅ |
| `...:698` → PAGO_DEUDA_CAPITAL | mobile `/capital-injections/[id]/payments` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (carrera 350+350 vs saldo 500) | ✅ | ✅ |

**Evidencia:** `accounting-bank-transfers-real.test.ts` 9/9 (rollback por error SQL de
auditoría); `operations-channels-http-real.test.ts` 4/4 (Bearer web/móvil, filas 17–20).

## 4. Reconciliación de servicios y gastos

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `accounting-reconciliation-service.ts:547` → COBRO_CXC/VENTA_CONTADO (`reconcileSale`) | action `actions-reconciliacion`; web `reconciliacion/ventas`; mobile `reconciliation/sales` | ✅ | ✅ | ✅ (clave idempotente + hash bajo lock) | ✅ | ✅ | ✅ (replay sec./concurrente, 409) | ✅ (AuditLog estricto) | ✅ |
| `...:1140` → COBRO_SERVICIO (`reconcileService`) | action; web `reconciliacion/servicios`; mobile `reconciliation/services` | ✅ (HTTP real 401/201 en servicios) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pago-gastos-workflow.ts:642` → PAGO_CXP / PAGO_NOMINA / COMPRA_CONTADO / GASTO_CONTADO | action `compras-productos/actions`, `contabilidad/actions-reconciliacion`; adapter `reconciliacion-gastos-adapter` | ✅ (permiso en ambos invocadores) | ✅ | ✅ | ✅ (v2 desde Fase A) | ✅ | ❌ (sin prueba de reintento) | ✅ (`logStrict` en tx) | ❌ (sin prueba de fallo de AuditLog) |

**Evidencia:** `reconciliar-servicio-real.test.ts` 23/23 (rollback CxC y auditoría);
`service-cxc-pago-fx-real.test.ts` 4/4; `pago-gastos-workflow.test.ts` 15/15 (unitario).

## 5. Compras, inventario y producción

| Writer (callsite → evento) | Adaptadores vivos | actor/permiso | tenant | origen único | moneda/FX | tx | idem/retry | posting/auditoría | rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| `compras-productos/actions.ts:446` → COMPRA_CREDITO / COMPRA_CONTADO | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (debita una vez) | ✅ | ✅ |
| `compras-servicios/actions.ts:141` → GASTO_CON_ANTICIPO_PROVEEDOR | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| `mermas/actions.ts:180` → MERMA_INVENTARIO | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (sin prueba de reintento) | ✅ | ✅ |
| `productos/actions-restock.ts:588` → COMPRA_CONTADO (restock) | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (sin prueba de reintento) | ✅ | ✅ |
| `produccion/ordenes/[id]/completar/route.ts:204` → PRODUCCION_SALIDA | web (ruta propia) | ⚠️ (`withAuthPost` inyectado en test; sin sesión HTTP real) | ✅ | ✅ | ✅ | ✅ | ❌ (sin prueba de reintento) | ✅ | ✅ |
| `venta-servicios/actions.ts:267/:397` → VENTA_SERVICIO_CREDITO (devengo ×2) | action (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ (cubierto con anticipo; devengo directo sin prueba propia) |

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

### G1 — Rollback físico por fallo de AuditLog en `pago-gastos-workflow` ❌
El workflow usa `logStrict` dentro del tx pero no hay prueba PostgreSQL de que un fallo
del AuditLog revierta saldo, obligación, reconciliación y asiento. Es el caso que
R6-ROLLBACK ya lista como pendiente para gasto/CxP. **Fase C:** test de integración
con trigger SQL que falle el `AuditLog` dentro del tx (patrón `*-real.test.ts` existente).

### G2 — Reintento/idempotencia sin evidencia física ❌/⚠️
Writers con origen único declarado pero sin prueba de reintento:
- `pago-gastos-workflow` ❌, `mermas` ❌, `restock` ❌, `produccion/completar` ❌
- rutas web cash ⚠️ (carrera probada solo en el servicio canónico), `compras-servicios` ⚠️,
  transferencias/ajustes/capital ⚠️, `venta-servicios` devengo directo ⚠️
**Fase C:** para cada uno, reintento con misma clave/payload → un único asiento;
reintento concurrente → serialización sin duplicados.

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

### G5 — Cobertura por canal de `accounting-cash-operations-mutation-service` ⚠️
El servicio canónico tiene carreras y rollback probados, pero sus adaptadores
(actions `actions-prestamos-cash`/`actions-deudas-cash` y rutas mobile) no tienen
prueba de reintento propia; la evidencia de idempotencia vive en el servicio.
**Fase C:** al menos un test por adaptador de que el reintento no duplica.

## Notas

- Las dimensiones actor/permiso, tenant, origen, FX, tx y posting/auditoría están en
  ✅ para los 31 callsites vivos con la evidencia citada (unit + integración existente).
- `venta-mutation-service.ts:498` (shadow sin valoración) no postea por diseño; su
  aceptación es la del outbox durable, ya cubierta en `formal-shadow-cash-sale.test.ts`.
- Este documento no cierra R0.5-ACCEPT; es la entrada de la Fase C.
