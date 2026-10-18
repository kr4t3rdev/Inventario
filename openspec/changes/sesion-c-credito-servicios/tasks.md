# Tasks — Sesión C: crédito y servicios

Plan SDD/TDD. Reglas (memorias del proyecto): TDD estricto con evidencia RED registrada bajo cada fase; tests con rutas explícitas (`pnpm exec vitest run <rutas>`); code review (`/code-review`) antes de cada commit; un commit por fase con **stage selectivo** (revisar `git diff --cached --name-only`, nunca `git add -A`); migraciones con `--create-only` + revisión SQL (producción además aplica db-push); worktree dedicado `../TCP-sesion-c` (rama `feat/sesion-c-credito-servicios` desde `main` b4be12ba) para no tocar `feat/contabilidad-capa-formal`.

Base medida en `main` (b4be12ba): hallazgos 4 y 8 de la re-auditoría + informe de exploración del 2026-09-27 (ver design.md §0-§9).

## C-1 — Límite de crédito editable (UI + action + permiso + auditoría)

- [x] **T1 — RED action.** `src/features/clientes/__tests__/limite-credito.test.ts`: manager persiste límite y audita `LIMITE_CREDITO_ACTUALIZADO` (valorAnterior→nuevo) en misma tx; sin permiso → `FORBIDDEN`; cliente ajeno → `NOT_FOUND`; `null` quita el tope; negativo/no entero → `VALIDATION_ERROR`.
  `pnpm exec vitest run src/features/clientes/__tests__/limite-credito.test.ts`
- [x] **T2 — RED permiso.** Registro `operaciones.clientes.limite-credito` (operaciones, manager, sensitive) + fixture de paridad actualizado.
  `pnpm exec vitest run src/lib/auth/__tests__/permission-registry.test.ts src/lib/auth/__tests__/permission-parity.test.ts`
- [x] **T3 — GREEN.** Union `AuditEntity` += `'CLIENTE'`, `'VENTA_SERVICIO'`; `limiteCreditoSchema`; `updateLimiteCreditoClienteAction`.
- [x] **T4 — RED/GREEN UI.** Test de componente `editar-limite-credito-dialog.test.tsx` (render, validación, llamada a la action, español neutro) + integración en `cliente-360.tsx` junto al badge de excedido.
  `pnpm exec vitest run src/features/clientes/__tests__/editar-limite-credito-dialog.test.tsx`
- Commit: `feat(clientes): edición del límite de crédito con permiso y auditoría (C-1)`

## C-2 — Enforcement del tope en servicios + revalidación al facturar

- [x] **T1 — RED helper.** `src/features/crm/__tests__/credito-enforcement.test.ts`: `exigirLimiteCredito` usa `saldoVivoCliente`/`superaLimiteCredito`; sin tope fast-path; sobre tope sin permiso → `CREDITO_EXCEDIDO` (mensaje con saldo/requerido/límite); con permiso → `overrideUsado: true` sin auditar (el caller audita); `cuentaExcluidaId` excluye la cuenta propia del saldo; cliente ajeno → `NOT_FOUND`.
  `pnpm exec vitest run src/features/crm/__tests__/credito-enforcement.test.ts`
- [x] **T2 — GREEN helper** `src/features/crm/services/credito-enforcement.ts`.
- [x] **T3 — RED servicios.** Extender `src/features/venta-servicios/__tests__/cxc-credito.test.ts`: mixto CREDITO sobre tope → `CREDITO_EXCEDIDO` sin crear filas; legacy sobre tope idem; legacy con anticipos evalúa remanente; override pasa y audita dentro de la tx; sin tope no consulta permiso.
  `pnpm exec vitest run src/features/venta-servicios/__tests__/cxc-credito.test.ts`
- [x] **T4 — GREEN** llamadas en `createVentaServicioAction` (mixto + legacy) con auditoría `CREDITO_OVERRIDE`.
- [x] **T5 — RED facturar productos.** Extender `src/features/ventas/__tests__/venta-lifecycle.test.ts` (describe facturarVenta): facturar con `montoCredito`/`metodoPago CREDITO` sobre tope → `CREDITO_EXCEDIDO`, sin Factura/CxC, venta sigue ENTREGADA; con override → factura + auditoría; contado no evalúa tope.
  `pnpm exec vitest run src/features/ventas/__tests__/venta-lifecycle.test.ts`
- [x] **T6 — GREEN** revalidación en `VentaLifecycleService.facturarVenta` (dentro de la tx, antes de serie/factura).
- Commit: `feat(ventas): enforcement del límite de crédito en servicios y al facturar (C-2)`

## C-3 — Costo server-side de servicios

- [x] **T1 — RED schema catálogo.** `Servicios.costo Int @default(0)` + CRUD de catálogo acepta/edita costo (tests de `features/servicios`).
- [x] **T2 — Migración** `servicios_costo_catalogo` (--create-only, SQL revisado) + `prisma generate`.
- [x] **T3 — RED snapshot.** Extender `src/features/venta-servicios/__tests__/actions.test.ts`: payload mixto/legacy con `costo: 999999` → `VALIDATION_ERROR` (strict); sin costo → fila persiste `catalogo.costo`; update con `costo` → rechazado por schema; catálogo con costo 0 default.
  `pnpm exec vitest run src/features/venta-servicios/__tests__/actions.test.ts`
- [x] **T4 — GREEN.** `assertServiciosDelTenant` devuelve `costo`; create usa snapshot; schemas sin `costo`; update sin costo.
- [x] **T5 — UI.** `servicios-cart.tsx` y `servicios-prestados-form.tsx` dejan de editar costo (referencia de solo lectura desde catálogo si aplica); form del catálogo gana el campo; verificar writers móviles con grep y dejar evidencia.
- Commit: `feat(servicios): costo server-side desde el catálogo (C-3)`

## C-4 — Atomicidad modo mixto + update coherente con la CxC

- [x] **T1 — RED atomicidad.** `src/features/venta-servicios/__tests__/mixto-atomico.test.ts`: fallo del create de CxC → cero ventas y cero CxC (misma tx); respuesta estable (`mode`/`lineasProcesadas`); auditoría de override dentro de la tx.
- [x] **T2 — GREEN** reescritura del bloque mixto con `$transaction` interactiva.
- [x] **T3 — RED update+CxC.** Extender `cxc-credito.test.ts`: cambio de cantidad ajusta `montoDeuda` en misma tx; con reconciliaciones → `HAS_REFERENCES`; CxC `PAGADA` → `CXC_PAGADA`; cambio de cliente revalida tope (`cuentaExcluidaId`) y mueve la CxC; claim de estado (`CXC_ESTADO_CAMBIO` si la CxC cambió entre lectura y escritura).
- [x] **T4 — GREEN** `updateVentaServicioAction` con transacción interactiva.
- Commit: `fix(servicios): atomicidad venta+CxC en modo mixto y update coherente (C-4)`

## C-5 — Delete con protección de CxC

- [x] **T1 — RED guard.** Extender `actions.test.ts` (delete): CxC `PENDIENTE` → `VENTA_CON_CXC_ACTIVA` y venta sobrevive; solo CxC `ANULADA` → transacción borra ambas; sin CxC → ok (regresión).
- [x] **T2 — RED contrato estático.** Test de contrato: `prisma/schema.prisma` declara `onDelete: Restrict` en `CuentaPorCobrar.ventaServicio`.
- [x] **T3 — Migración** `cxc_servicio_restrict` (--create-only, SQL revisado) + `prisma generate`.
- [x] **T4 — GREEN** guard + transacción de delete.
- Commit: `fix(servicios): delete con protección de CxC activa y FK Restrict (C-5)`

## C-6 — Factura-documento para servicios

- [x] **T1 — RED serie compartida.** `src/features/ventas/__tests__/serie-facturacion-service.test.ts` (extracción: misma resolución e incrementos que `facturarVenta` hoy); regresión completa `venta-lifecycle.test.ts` + `facturacion-ventas-workflow.test.ts` verde tras migrar `facturarVenta` al helper.
- [x] **T2 — Schema + migración** `factura_venta_servicio` (`Factura.ventaServicioId String? @unique` + relación) + `prisma generate`.
- [x] **T3 — RED action.** `src/features/venta-servicios/__tests__/facturar-servicio.test.ts`: crea Factura con número de serie y `ventaServicioId`; estado `PAGADA` si `reconciliado`; enlaza CxC (facturaId/numeroFactura/fechaVencimiento) sin crear deuda nueva; `VENTA_YA_FACTURADA`; `FACTURA_REQUIERE_CLIENTE`; `FORBIDDEN` sin permiso; no revalida tope (no duplica chequeo).
  `pnpm exec vitest run src/features/venta-servicios/__tests__/facturar-servicio.test.ts`
- [x] **T4 — RED cierre en cobro.** Test de `AccountingReconciliationService.reconcileService`: al cobrar venta facturada → Factura `PAGADA` y CxC enlazada `PAGADA`/`montoPagado` en la misma tx; sin factura/CxC no rompe (regresión web/móvil).
  `pnpm exec vitest run src/features/contabilidad/__tests__` (archivo del reconcileService)
- [x] **T5 — GREEN** action + permiso `ventas.servicios.facturar` (+ fixture paridad) + cambio en `reconcileService`.
- [x] **T6 — UI.** Botón "Facturar" en historial de servicios (`servicios-content.tsx`) gated por permiso; dialog de vencimiento opcional; documentar estado del link a impresión.
- Commit: `feat(servicios): factura-documento para ventas de servicios (C-6)`

## Cierre del change

- [ ] Regresión focalizada verde: `pnpm exec vitest run src/features/venta-servicios src/features/clientes src/features/crm src/features/ventas src/features/contabilidad src/lib/services/__tests__/facturacion-ventas-workflow.test.ts src/lib/auth/__tests__`
- [ ] `pnpm run lint` y `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit` sin errores nuevos.
- [ ] Code review final del diff completo; críticos/altos resueltos.
- [ ] Marcar criterios de aceptación de proposal.md §Criterios con evidencia.
- [ ] Merge a main: SOLO con aviso explícito del usuario (dejar rama y push listos).

## Integración con main + correcciones del review (2026-10-18, rama feat/sesion-c-integracion)

Merge de `feat/sesion-c-credito-servicios` sobre `origin/main` (75 commits de
distancia). El review pre-merge (2 agentes + análisis propio) halló 6 bloqueos;
todos corregidos con tests de regresión en la rama de integración:

- [x] **Resolución de conflictos (3)**: `venta-servicios/{actions,schemas}.ts` y
  `__tests__/actions.test.ts`. Se preservó la idempotencia de main (replay,
  fingerprint, lock de clave) y la semántica de C (costo del catálogo, crédito,
  transacción única); `costo` sale del fingerprint (el schema strict ya no lo
  acepta — un replay del payload viejo falla en validación antes que en el
  fingerprint, error explícito).
- [x] **B-1 (Alta) — update evade el tope**: `updateVentaServicioAction`
  reescrito con lecturas dentro de la transacción; todo cambio de total con CxC
  activa re-valida el tope (mismo cliente: `cuentaExcluidaId` + nuevo total;
  cambio de cliente: exige el total resultante al cliente destino). Tests:
  aumento 5000→10000 con límite 6000 → `CREDITO_EXCEDIDO`; cliente+cantidad
  valida el NUEVO total (el código viejo validaba la deuda previa).
- [x] **B-2 (Alta) — `plazo` evade el tope al facturar productos**: el monto
  evaluado es ahora EXACTAMENTE la deuda que crea el workflow
  (`tipoVencimiento` fecha/plazo → CxC por el total completo; sin workflow →
  `montoCredito`/CREDITO). Tests: plazo sin metodoPago y CREDITO+montoCredito 0
  + plazo, ambos sobre tope → `CREDITO_EXCEDIDO` sin factura.
- [x] **B-3 (Alta) — venta facturada editable**: guarda
  `VENTA_FACTURADA_INMUTABLE` para cantidad/cliente con factura emitida;
  observaciones siguen editables. Tests propios.
- [x] **B-4 (Alta) — carrera de crédito concurrente**: `lockCreditoCliente`
  (advisory xact lock por tenant+cliente) tomado dentro de la transacción por
  TODOS los writers de deuda: create mixto/legacy, update, facturar productos,
  POS createVenta (re-validación con lock dentro de la tx, resultado con lock
  es el auditado) y edición del límite (lectura de valorAnterior también bajo
  lock — cierra la auditoría con valor previo obsoleto). Tests: aserción de
  `$executeRaw` en cada writer.
- [x] **B-5 (Alta) — resurrección de CxC anulada**:
  `cerrarDocumentoServicio` con claims `updateMany` filtrando estado (solo
  PENDIENTE/PARCIAL); anulación concurrente gana en silencio. Tests: claim con
  filtro de estado y count 0 no resurrecta.
- [x] **B-6 (Media) — snapshot obsoleto al facturar servicio**:
  `facturarVentaServicioAction` lee venta/factura previa/CxC dentro de la
  transacción bajo `lockDocumentoServicio` (compartido con el cobro); CxC con
  claims de estado. Tests: lectura dentro de tx + lock asertado.
- [x] **Medios**: `VENTA_SERVICIO_INCLUDE` incluye la factura (el botón
  "Facturar" del historial refleja el estado real); auditoría del límite con
  lectura bloqueada (B-4); allowlist de raw SQL actualizada (AS-03:
  `credito-enforcement` nuevo, `accounting-reconciliation-service` 3→4).
- [x] **Migración de mocks**: lecturas compartidas raíz↔tx (`vi.hoisted`) en 6
  suites — los tests configuran una sola vez y los writers quedan separados
  para seguir probando atomicidad. Defaults anti-fuga donde el mock compartido
  requería reset explícito.

### Evidencia de la integración

- RED de referencia: los 6 bloqueos están fuente-evidenciados en el review
  pre-merge (escenarios reproducibles por intercalado); los tests de regresión
  se escribieron contra el código corregido y fijan cada escenario.
- Regresión focalizada: `venta-servicios`+`ventas`+`clientes`+`crm`+
  `reconcile-cierre` → **299/299** (37 archivos).
- Suite completa: **4657/4657 (exit 0)**, 725 archivos + 1 skip.
  Typecheck **0 errores**; lint **0 errores** (416 warnings preexistentes
  de main); `openapi:check` **exit 0**.

## Evidencia de verificación

_(Rellenar por fase: comando RED + fallo observado, comando GREEN + resultado, revisión y SHA de commit.)_

### C-1
- RED: `pnpm exec vitest run src/features/clientes/__tests__/limite-credito.test.ts` → 7/7 fallos (action inexistente, error de import).
- GREEN: mismos tests + registry/parity → 40/40; componente `editar-limite-credito-dialog.test.tsx` RED (import) → 6/6. Regresión `src/features/clientes` 30/30. ESLint focal 0 problemas.
- Review: sin críticos/altos. Refactor: interface de props movida arriba del componente (estilo del repo).
- Commit: `803ad427` feat(clientes): edición del límite de crédito con permiso y auditoría (C-1)

### C-2
- RED helper: `src/features/crm/__tests__/credito-enforcement.test.ts` → módulo inexistente (sin tests). RED servicios: 3 fallos nuevos en `cxc-credito.test.ts` (mixto/legacy sobre tope sin enforcement, override sin auditoría). RED facturar: 3 fallos en `venta-lifecycle.test.ts` (factura a crédito sobre tope se emitía; MIXTO con montoCredito; sin auditoría).
- GREEN: helper `credito-enforcement.ts` 9/9; venta-servicios 42/42; venta-lifecycle 23/23; regresión `src/features/ventas/__tests__` 146/146.
- Review: hallazgo 🟠 corregido — auditoría del override en modo mixto usaba `logStrict` fuera de la tx (riesgo de reintento duplicado); cambiada a `log()` no bloqueante como puente hasta C-4.
- Commit: `21dacbd6` feat(ventas): enforcement del límite de crédito en servicios y al facturar (C-2)

### C-3
- RED: 5 fallos (mixto/legacy/update con costo manipulado aceptados; catálogo sin costo serializado).
- GREEN: `Servicios.costo` (migración `20260927100000_servicios_costo_catalogo`), snapshot del catálogo en create mixto/legacy, schemas de venta sin `costo` (strict rechaza), update schema strict, UI (carrito costo solo lectura en VENTA/editable en COMPRA; form legacy de solo lectura; catálogo editable). Suites venta-servicios + servicios 79/79. `revalidatePath('/busy/venta-servicios')` → `/busy/servicios` (ruta real).
- Review: sin críticos/altos. Verificado con grep: no hay writers móviles de venta de servicios (solo reconciliación); el único otro writer (`facturar-oferta-workflow`) queda para Sesión E.
- Commit: `fbd6512d` feat(servicios): costo server-side desde el catálogo (C-3)

### C-4
- RED: 11 fallos nuevos (mixto con 2 transacciones separadas + fallo sin revertir + auditoría fuera de tx; update sin ajuste de CxC, sin guardas de cobros/pagada/cliente, sin claim de estado).
- GREEN: mixto en `$transaction` interactiva única con auditoría `logStrict` dentro; update reescrito con tx interactiva (ajuste de `montoDeuda` con claim, movimiento de cliente con revalidación de tope, guardas `HAS_REFERENCES`/`CXC_PAGADA`/`VALIDATION_ERROR`, `CXC_ESTADO_CAMBIO`). venta-servicios 56/56.
- Review: sin críticos/altos. Nota: al cambiar cliente con CxC activa, el tope se evalúa sobre el saldo del nuevo cliente sin exclusión (la CxC pertenece al cliente anterior).
- Commit: `691bb531` fix(servicios): atomicidad venta+CxC en modo mixto y update coherente con la deuda (C-4)

### C-5
- RED: 4 fallos (delete con CxC activa permitido; CxC anulada no limpiada; contrato estático de FK sin Restrict).
- GREEN: guard `VENTA_CON_CXC_ACTIVA`, transacción que limpia CxC `ANULADA` + venta, FK `onDelete: Restrict` (migración `20260927110000_cxc_servicio_restrict`), contrato estático del schema. venta-servicios 60/60.
- Review: sin críticos/altos; el orden cobros → CxC → delete deja mensajes accionables y la FK defiende writers futuros.
- Commit: `0686bd92` fix(servicios): delete con protección de CxC activa y FK Restrict (C-5)

### C-6
- RED: helper de serie (1 fallo por bug del test, corregido); action facturar-servicio 8/8 fallos (import); cierre en `reconcileService` 1 fallo.
- GREEN: `resolverSerieYNumero` extraído y `facturarVenta` migrado (regresión 31/31); `Factura.ventaServicioId` unique (migración `20260927120000_factura_venta_servicio`); `facturarVentaServicioAction` con permiso `ventas.servicios.facturar` (+ fixture), sin revalidación de tope (documentada, test la fija); guard `VENTA_CON_FACTURA` en delete; helper `cerrarDocumentoServicio` cableado en el servicio compartido móvil Y en `reconciliarServicioAction` (web). Regresión cruzada 934 passed / 114 archivos.
- Review: hallazgo propio 🟠 corregido — el escritor web del cobro (`reconciliarServicioAction`) no cerraba el documento; se extrae helper compartido para ambos escritores.
- Commit: `2967e2b4` feat(servicios): factura-documento para ventas de servicios (C-6)
