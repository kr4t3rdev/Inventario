# Tasks — DNC Devoluciones parciales y nota de crédito

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en
unitarios (contrato MM-B vigente: DB real inalcanzable, integración solo en
`__integration__/` con `pnpm test:integration`); rutas explícitas al correr vitest; code
review con typescript-reviewer y commit por fase con **stage selectivo** (el worktree vive
sucio: jamás `git add -A`). Evidencias en `evidence/` dentro de este change
(`evidence/DNC-Tx-RED.txt`, `evidence/DNC-Tx-GREEN.txt`).

## DNC-T1 — Modelo de datos + permisos ✅

- [x] **T1.1 Spike documentado** (ver sección "Resultado del spike T1.1" en design.md):
  consumidores de `anticipo.contrato` null-safe; `Factura.tipoDocumento` sin cambios;
  `Anticipo.facturaId` confirmado libre/único.
- [x] **T1.2 Schema + migración.** `DevolucionVenta`, `DevolucionVentaItem`,
  `EstadoDevolucion`, `ContextoAnticipo.NOTA_CREDITO`, `Anticipo.contratoId` opcional y
  back-relations; migración `20260914240000_add_devoluciones_nota_credito` (generada con
  `migrate diff` offline por falta de DATABASE_URL en la shell del agente) + `prisma generate`.
  Nota de operación: un edit intermedio se detectó corrupto vía `prisma validate`
  (`references: [productoId]` en VentaItem) y se revirtió antes de commit — sin efecto residual.
  Regresión anticipos/ventas: 123 archivos / 1062 tests verdes.
- [x] **T1.3/T1.4 Permisos.** `ventas.devolucion.registrar` (manager/economico, sensitive) y
  `ventas.devolucion.reembolso` (manager, sensitive) con RED de paridad auténtico
  (`evidence/DNC-T1-RED.txt`) y fixture actualizado; suite auth 77/77 (`DNC-T1-GREEN.txt`).
- [x] **T1.5 Schema Zod.** `registrarDevolucionSchema` + `devolucion-schema.test.ts` (6/6).
- Commit: `feat(ventas): modelo DevolucionVenta, serie NC y permisos de devoluciones (DNC-T1)`

## DNC-T2 — Motor de dominio puro

- [ ] **DNC-T2.1 RED.** `src/features/ventas/__tests__/devolucion-calculo.test.ts`:
  disponibles por ítem con devoluciones previas; rechazo de cantidad 0/negativa/superior;
  prorrateo de descuento (floor, cap acumulado, bruto 0, distribución en N parciales sin
  exceder el descuento original); cascada financiera (CxC cubre todo / CxC parcial +
  excedente a saldo / sin CxC → saldo o reembolso / reembolso sin turno → rechazo);
  consolidación de ítems repetidos. ~12 casos. Evidencia `evidence/DNC-T2-RED.txt`.
- [ ] **DNC-T2.2 GREEN.** `src/features/ventas/services/devolucion-calculo.ts` puro:
  `calcularDisponibles`, `calcularMontosDevolucion`, `resolverTratamientoFinanciero`.
  Sin I/O, enteros `Int` centavos. Evidencia `evidence/DNC-T2-GREEN.txt`.
- [ ] **DNC-T2.3 Review typescript-reviewer de la fase; fixes si aplica.**
- Commit: `feat(ventas): cálculo puro de devoluciones y cascada financiera (DNC-T2)`

## DNC-T3 — Servicio transaccional de registro

- [ ] **DNC-T3.1 RED unitario.** `src/features/ventas/__tests__/devolucion-service.test.ts`
  con prisma mockeado: happy path multi-ítem; guardas (tenant, anulada, excedida, sin
  permiso); replay por `idempotencyKey`; orden de llamadas (lock → guardas → efectos);
  CxC recalculada; anticipo creado solo con excedente; reembolso solo con permiso + turno
  abierto; NC solo con feature `facturacion`; audit log estricto. Evidencia
  `evidence/DNC-T3-RED.txt`.
- [ ] **DNC-T3.2 GREEN.** `devolucion-venta-service.ts` (`registrar`): tx `Serializable`,
  `FOR UPDATE`, claim idempotente, stock/kardex/allocations, serie `NC-` + NC, cascada,
  audit. Helpers: `restaurarAllocacionesFifo` en
  `src/lib/services/fifo-allocation.ts` (retorna costo ponderado; tests propios) y
  `createAnticipoDevolucion` en `src/lib/services/anticipos-workflow.ts` (sin contrato,
  `facturaId` = NC, `contexto: NOTA_CREDITO`, idempotencia por devolución). Kardex vía
  `registrarMovimiento` con `origenId = devolucionId` (sin enum nuevo).
  `assertVentaDevolvible` con `TODO(PVE)` para la guarda de `estado`.
- [ ] **DNC-T3.3 Arqueo.** Helper único de reembolsos del turno aplicado en
  `getEsperadosArqueoAction`, `realizarArqueoAction` y
  `src/app/api/mobile/pos/turnos/esperados/route.ts`; tests actualizados (el esperado
  descuenta reembolsos; turno sin reembolsos intacto).
- [ ] **DNC-T3.4 Integración real.** `src/features/ventas/__integration__/devolucion-fifo.test.ts`
  con `pnpm test:integration`: dos compras del mismo producto a costos distintos → venta
  que cruza ambos lotes → devolución parcial → se verifican stock reintegrado, allocations
  reducidas en orden FIFO, línea de kardex con costo ponderado, NC y cascada financiera
  persistidas; replay por key no duplica nada.
- [ ] **DNC-T3.5 Review typescript-reviewer de la fase; fixes si aplica.**
  Evidencia `evidence/DNC-T3-GREEN.txt`.
- Commit: `feat(ventas): registro transaccional de devoluciones con nota de crédito (DNC-T3)`

## DNC-T4 — Actions, UI y bloqueo de anulación

- [ ] **DNC-T4.1 Actions RED→GREEN.** `src/features/ventas/actions-devoluciones.ts`:
  `getDevolucionContextoAction`, `registrarDevolucionAction`, `getDevolucionesAction`
  (patrón `withAction` + `requireTenant` + permisos + gates de plan). Tests de actions con
  prisma mockeado. Evidencia `evidence/DNC-T4-RED.txt` / `evidence/DNC-T4-GREEN.txt`.
- [ ] **DNC-T4.2 UI.** `components/devolucion-wizard.tsx` (2 pasos, máximos por ítem,
  resumen financiero, reembolso deshabilitado con motivo visible), entrada "Devolver…" en
  detalle/tabla de ventas, badge de devolución parcial/total, filtro `NOTA_CREDITO` con
  detalle vinculado en facturas. Componentes <200 líneas, JSDoc, español neutro, estados
  de carga y error con toast.
- [ ] **DNC-T4.3 Bloqueo de anulación.** Guarda `VENTA_CON_DEVOLUCIONES` en
  `VentaMutationService.cancel` (consulta barata dentro de la tx actual) + test; tooltip en
  la UI que orienta a completar la devolución al 100%.
- [ ] **DNC-T4.4 Review typescript-reviewer de la fase; fixes si aplica.**
- Commit: `feat(ventas): wizard de devoluciones, vista de NC y bloqueo de anulación (DNC-T4)`

## DNC-T5 — Reportes, review final y cierre

- [ ] **DNC-T5.1 Inventario de consumidores.** Grep de lecturas de ventas con
  `deletedAt: null` (cuadre diario/turno, reportes de ventas, rentabilidad FIFO, dashboard);
  lista anotada en la evidencia de la fase.
- [ ] **DNC-T5.2 Neteo.** Línea "Devoluciones" y "Ventas netas" en cuadre y reporte de
  ventas; rentabilidad resta `Σ cantidad × costoUnitarioDevolucion` usando el campo
  persistido (sin recalcular FIFO en el reporte). Tests donde el patrón del archivo lo
  permita; ajuste mínimo por consumidor.
- [ ] **DNC-T5.3 Review global typescript-reviewer** del diff completo del change; fixes
  bloqueantes dentro de la fase, fast-follows documentados.
- [ ] **DNC-T5.4 Regresión.** Suites `src/features/ventas src/features/arqueo-caja
  src/features/turnos-pos src/features/facturas src/lib/services src/lib/auth
  src/app/api/mobile/pos` verdes; `tsc --noEmit` limpio; `pnpm run lint` sin errores en
  archivos tocados; quistes pre-existentes anotados como en LP-0.
  Evidencia `evidence/DNC-T5-GREEN.txt`.
- [ ] **DNC-T5.5 Smoke manual post-deploy** (checklist, sin E2E): venta a crédito con CxC →
  devolución parcial → CxC reducida + NC lista; venta de contado → devolución con saldo a
  favor → anticipo usable en el POS; reembolso con turno abierto → arqueo descuenta;
  anulación bloqueada con devoluciones; tenant sin `facturacion` devuelve sin NC.
- [ ] **DNC-T5.6 Archivo.** Mover el change a
  `openspec/changes/archive/2026-09-14-devoluciones-nota-credito/` y actualizar memorias.
- Commit: `feat(ventas): neteo de devoluciones en reportes y cuadre (DNC-T5)` +
  `docs(openspec): cerrar DNC devoluciones y nota de crédito`
