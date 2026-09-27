# Tasks — Sesión C: crédito y servicios

Plan SDD/TDD. Reglas (memorias del proyecto): TDD estricto con evidencia RED registrada bajo cada fase; tests con rutas explícitas (`pnpm exec vitest run <rutas>`); code review (`/code-review`) antes de cada commit; un commit por fase con **stage selectivo** (revisar `git diff --cached --name-only`, nunca `git add -A`); migraciones con `--create-only` + revisión SQL (producción además aplica db-push); worktree dedicado `../TCP-sesion-c` (rama `feat/sesion-c-credito-servicios` desde `main` b4be12ba) para no tocar `feat/contabilidad-capa-formal`.

Base medida en `main` (b4be12ba): hallazgos 4 y 8 de la re-auditoría + informe de exploración del 2026-09-27 (ver design.md §0-§9).

## C-1 — Límite de crédito editable (UI + action + permiso + auditoría)

- [ ] **T1 — RED action.** `src/features/clientes/__tests__/limite-credito.test.ts`: manager persiste límite y audita `LIMITE_CREDITO_ACTUALIZADO` (valorAnterior→nuevo) en misma tx; sin permiso → `FORBIDDEN`; cliente ajeno → `NOT_FOUND`; `null` quita el tope; negativo/no entero → `VALIDATION_ERROR`.
  `pnpm exec vitest run src/features/clientes/__tests__/limite-credito.test.ts`
- [ ] **T2 — RED permiso.** Registro `operaciones.clientes.limite-credito` (operaciones, manager, sensitive) + fixture de paridad actualizado.
  `pnpm exec vitest run src/lib/auth/__tests__/permission-registry.test.ts src/lib/auth/__tests__/permission-parity.test.ts`
- [ ] **T3 — GREEN.** Union `AuditEntity` += `'CLIENTE'`, `'VENTA_SERVICIO'`; `limiteCreditoSchema`; `updateLimiteCreditoClienteAction`.
- [ ] **T4 — RED/GREEN UI.** Test de componente `editar-limite-credito-dialog.test.tsx` (render, validación, llamada a la action, español neutro) + integración en `cliente-360.tsx` junto al badge de excedido.
  `pnpm exec vitest run src/features/clientes/__tests__/editar-limite-credito-dialog.test.tsx`
- Commit: `feat(clientes): edición del límite de crédito con permiso y auditoría (C-1)`

## C-2 — Enforcement del tope en servicios + revalidación al facturar

- [ ] **T1 — RED helper.** `src/features/crm/__tests__/credito-enforcement.test.ts`: `exigirLimiteCredito` usa `saldoVivoCliente`/`superaLimiteCredito`; sin tope fast-path; sobre tope sin permiso → `CREDITO_EXCEDIDO` (mensaje con saldo/requerido/límite); con permiso → `overrideUsado: true` sin auditar (el caller audita); `cuentaExcluidaId` excluye la cuenta propia del saldo; cliente ajeno → `NOT_FOUND`.
  `pnpm exec vitest run src/features/crm/__tests__/credito-enforcement.test.ts`
- [ ] **T2 — GREEN helper** `src/features/crm/services/credito-enforcement.ts`.
- [ ] **T3 — RED servicios.** Extender `src/features/venta-servicios/__tests__/cxc-credito.test.ts`: mixto CREDITO sobre tope → `CREDITO_EXCEDIDO` sin crear filas; legacy sobre tope idem; legacy con anticipos evalúa remanente; override pasa y audita dentro de la tx; sin tope no consulta permiso.
  `pnpm exec vitest run src/features/venta-servicios/__tests__/cxc-credito.test.ts`
- [ ] **T4 — GREEN** llamadas en `createVentaServicioAction` (mixto + legacy) con auditoría `CREDITO_OVERRIDE`.
- [ ] **T5 — RED facturar productos.** Extender `src/features/ventas/__tests__/venta-lifecycle.test.ts` (describe facturarVenta): facturar con `montoCredito`/`metodoPago CREDITO` sobre tope → `CREDITO_EXCEDIDO`, sin Factura/CxC, venta sigue ENTREGADA; con override → factura + auditoría; contado no evalúa tope.
  `pnpm exec vitest run src/features/ventas/__tests__/venta-lifecycle.test.ts`
- [ ] **T6 — GREEN** revalidación en `VentaLifecycleService.facturarVenta` (dentro de la tx, antes de serie/factura).
- Commit: `feat(ventas): enforcement del límite de crédito en servicios y al facturar (C-2)`

## C-3 — Costo server-side de servicios

- [ ] **T1 — RED schema catálogo.** `Servicios.costo Int @default(0)` + CRUD de catálogo acepta/edita costo (tests de `features/servicios`).
- [ ] **T2 — Migración** `servicios_costo_catalogo` (--create-only, SQL revisado) + `prisma generate`.
- [ ] **T3 — RED snapshot.** Extender `src/features/venta-servicios/__tests__/actions.test.ts`: payload mixto/legacy con `costo: 999999` → `VALIDATION_ERROR` (strict); sin costo → fila persiste `catalogo.costo`; update con `costo` → rechazado por schema; catálogo con costo 0 default.
  `pnpm exec vitest run src/features/venta-servicios/__tests__/actions.test.ts`
- [ ] **T4 — GREEN.** `assertServiciosDelTenant` devuelve `costo`; create usa snapshot; schemas sin `costo`; update sin costo.
- [ ] **T5 — UI.** `servicios-cart.tsx` y `servicios-prestados-form.tsx` dejan de editar costo (referencia de solo lectura desde catálogo si aplica); form del catálogo gana el campo; verificar writers móviles con grep y dejar evidencia.
- Commit: `feat(servicios): costo server-side desde el catálogo (C-3)`

## C-4 — Atomicidad modo mixto + update coherente con la CxC

- [ ] **T1 — RED atomicidad.** `src/features/venta-servicios/__tests__/mixto-atomico.test.ts`: fallo del create de CxC → cero ventas y cero CxC (misma tx); respuesta estable (`mode`/`lineasProcesadas`); auditoría de override dentro de la tx.
- [ ] **T2 — GREEN** reescritura del bloque mixto con `$transaction` interactiva.
- [ ] **T3 — RED update+CxC.** Extender `cxc-credito.test.ts`: cambio de cantidad ajusta `montoDeuda` en misma tx; con reconciliaciones → `HAS_REFERENCES`; CxC `PAGADA` → `CXC_PAGADA`; cambio de cliente revalida tope (`cuentaExcluidaId`) y mueve la CxC; claim de estado (`CXC_ESTADO_CAMBIO` si la CxC cambió entre lectura y escritura).
- [ ] **T4 — GREEN** `updateVentaServicioAction` con transacción interactiva.
- Commit: `fix(servicios): atomicidad venta+CxC en modo mixto y update coherente (C-4)`

## C-5 — Delete con protección de CxC

- [ ] **T1 — RED guard.** Extender `actions.test.ts` (delete): CxC `PENDIENTE` → `VENTA_CON_CXC_ACTIVA` y venta sobrevive; solo CxC `ANULADA` → transacción borra ambas; sin CxC → ok (regresión).
- [ ] **T2 — RED contrato estático.** Test de contrato: `prisma/schema.prisma` declara `onDelete: Restrict` en `CuentaPorCobrar.ventaServicio`.
- [ ] **T3 — Migración** `cxc_servicio_restrict` (--create-only, SQL revisado) + `prisma generate`.
- [ ] **T4 — GREEN** guard + transacción de delete.
- Commit: `fix(servicios): delete con protección de CxC activa y FK Restrict (C-5)`

## C-6 — Factura-documento para servicios

- [ ] **T1 — RED serie compartida.** `src/features/ventas/__tests__/serie-facturacion-service.test.ts` (extracción: misma resolución e incrementos que `facturarVenta` hoy); regresión completa `venta-lifecycle.test.ts` + `facturacion-ventas-workflow.test.ts` verde tras migrar `facturarVenta` al helper.
- [ ] **T2 — Schema + migración** `factura_venta_servicio` (`Factura.ventaServicioId String? @unique` + relación) + `prisma generate`.
- [ ] **T3 — RED action.** `src/features/venta-servicios/__tests__/facturar-servicio.test.ts`: crea Factura con número de serie y `ventaServicioId`; estado `PAGADA` si `reconciliado`; enlaza CxC (facturaId/numeroFactura/fechaVencimiento) sin crear deuda nueva; `VENTA_YA_FACTURADA`; `FACTURA_REQUIERE_CLIENTE`; `FORBIDDEN` sin permiso; no revalida tope (no duplica chequeo).
  `pnpm exec vitest run src/features/venta-servicios/__tests__/facturar-servicio.test.ts`
- [ ] **T4 — RED cierre en cobro.** Test de `AccountingReconciliationService.reconcileService`: al cobrar venta facturada → Factura `PAGADA` y CxC enlazada `PAGADA`/`montoPagado` en la misma tx; sin factura/CxC no rompe (regresión web/móvil).
  `pnpm exec vitest run src/features/contabilidad/__tests__` (archivo del reconcileService)
- [ ] **T5 — GREEN** action + permiso `ventas.servicios.facturar` (+ fixture paridad) + cambio en `reconcileService`.
- [ ] **T6 — UI.** Botón "Facturar" en historial de servicios (`servicios-content.tsx`) gated por permiso; dialog de vencimiento opcional; documentar estado del link a impresión.
- Commit: `feat(servicios): factura-documento para ventas de servicios (C-6)`

## Cierre del change

- [ ] Regresión focalizada verde: `pnpm exec vitest run src/features/venta-servicios src/features/clientes src/features/crm src/features/ventas src/features/contabilidad src/lib/services/__tests__/facturacion-ventas-workflow.test.ts src/lib/auth/__tests__`
- [ ] `pnpm run lint` y `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit` sin errores nuevos.
- [ ] Code review final del diff completo; críticos/altos resueltos.
- [ ] Marcar criterios de aceptación de proposal.md §Criterios con evidencia.
- [ ] Merge a main: SOLO con aviso explícito del usuario (dejar rama y push listos).

## Evidencia de verificación

_(Rellenar por fase: comando RED + fallo observado, comando GREEN + resultado, revisión y SHA de commit.)_

### C-1
- RED:
- GREEN:
- Review:
- Commit:

### C-2
- RED:
- GREEN:
- Review:
- Commit:

### C-3
- RED:
- GREEN:
- Review:
- Commit:

### C-4
- RED:
- GREEN:
- Review:
- Commit:

### C-5
- RED:
- GREEN:
- Review:
- Commit:

### C-6
- RED:
- GREEN:
- Review:
- Commit:
