# Tasks — Capa de contabilidad formal (serie CTA)

Plan SDD/TDD. Reglas (memorias del proyecto): TDD estricto con evidencia del fallo RED, tests con rutas explícitas (`pnpm exec vitest run <rutas>` y para DB real `__integration__` con `DATABASE_URL_TEST`), code review + commit por fase con **stage selectivo** (worktree compartido: revisar `git diff --cached --name-only` y desetagear lo ajeno antes de cada commit), migraciones con `--create-only` + revisión SQL (producción corre `PRISMA_MIGRATION_MODE=db-push`: los backfills no corren solos). Independiente de la ventana shadow del change `aislamiento-sistemico-tenant`; los modelos nuevos nacen clasificados `scoped` (CTA-0 T3).

Rama sugerida: `feat/contabilidad-capa-formal` desde `main` (después del merge de `codex/upgrade-next-16`).

## CTA-0 — Modelo de datos, plan por defecto y flags

- [ ] **T1 — RED contratos de modelo.** Tests del seed y clasificación: seed crea 7 diarios + plan ~32 cuentas idempotente (re-ejecutarlo no duplica); `CuentaRolTenant` completo (23 roles mapeados); naturaleza coherente con tipo; unicidad `tenantId+codigo`; los 6 modelos nuevos figuran en la clasificación de aislamiento (5 `scoped` + `PlantillaAsiento` global).
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/seed-plan.test.ts src/lib/db/__tests__`
- [ ] **T2 — GREEN schema + seed.** Añadir a [prisma/schema.prisma](/prisma/schema.prisma) los 6 modelos y 6 enums del design §1; `src/features/contabilidad-formal/services/seed-plan-contable.ts` (upserts idempotentes); registrar modelo ↔ scoped en `src/lib/db/model-classification.ts`; flag `contabilidad-formal` en [feature-registry.ts](/src/features/planes/feature-registry.ts) (categoría `financiero`).
- [ ] **T3 — Migración gateada.** `prisma migrate dev --create-only` → revisión SQL de índices/uniques/decimales (paridad con `fx_evidence`) → aprobación → aplicar en local.
- [ ] **T4 — Seed accesible.** Server action `inicializarPlanContableAction` (withAction + `requireFeature('contabilidad-formal')`) idempotente; botón en configuración contable (gated por flag).
- Commit: `feat(contabilidad): schema capa formal + plan de cuentas por defecto (CTA-0)`

## CTA-1 — Motor de asientos + hooks en los 18 writers

- [ ] **T1 — RED motor puro.** Tests por evento representativo de cada grupo (venta contado, compra crédito, cobro con intereses, ajuste, transferencia, inyección, diferencia cambiaria, merma): plantilla→líneas correctas, cuadre exacto, moneda original + funcional + fingerprint heredados, rol sin mapear → `CUENTA_SIN_MAPEAR` (enforce) / log (shadow), flag `off` → no-op.
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts`
- [ ] **T2 — GREEN motor.** `posting-engine.ts` + `asiento-service.ts` (numeración bajo `AccountingTenantLockService`, hash encadenado, inserción) según design §2; modo vía `CONTABILIDAD_FORMAL_MODE` (default `off`).
- [ ] **T3 — RED integración cuadre/idempotencia.** Contra DB real: intentar persistir asiento descuadrado falla; reintentar mismo `origen` no duplica; asiento cae en período resuelto por fecha; período cerrado → rechazo + `INTENTO_BYPASS` en `AuditoriaPeriodo`.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/posting-engine.test.ts`
- [ ] **T4 — Hooks en writers (lote 1: ventas y cobros).** `postEvento(tx, …)` en `facturacion-workflow`, `actions-reconciliacion` (ventas), handlers legacy de reconciliación ventas/servicios: eventos `VENTA_CONTADO`, `VENTA_CREDITO`, `COSTO_VENTA_DEVENGADO`, `COBRO_CXC`, `COBRO_SERVICIO`, `DEVOLUCION_VENTA`, `DIFERENCIA_CAMBIARIA`. Tests RED→GREEN por evento (mockean prisma, verifican construcción del evento desde el payload real).
- [ ] **T5 — Hooks lote 2 (compras, gastos, nómina).** `COMPRA_*`, `GASTO_*`, `PAGO_CXP`, `PAGO_GASTO_CREDITO`, `PAGO_NOMINA` en compras-*, gastos workflow, pago-salario.
- [ ] **T6 — Hooks lote 3 (flujos de efectivo especiales).** Anticipos, préstamos (`COBRO_PRESTAMO` con `INTERESES`), deudas (`PAGO_DEUDA` con `INTERESES`), ajustes bancarios, transferencias, inyección/pago deuda capital, mermas, producción (`produccion/ordenes/[id]/completar`), restock.
- [ ] **T7 — Shadow activable.** `shadow` en staging con contadores por evento; reporte de cobertura (eventos vistos vs contabilizados) visible en `actions-health`.
- Commit por lote: `feat(contabilidad): motor de asientos + hooks ventas (CTA-1/T1–T4)` etc.

## CTA-2 — Libros formales y conciliación cruzada

- [ ] **T1 — RED servicios de lectura.** Diario (período, diario, rango, cursor), mayor (saldo corrido por naturaleza), comprobación (4 columnas, total cuadrado), balance/P&L por cuentas, conciliación por rubro vs `balance-results-report-service`.
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/libros.test.ts`
- [ ] **T2 — GREEN servicios + actions.** `actions-diario.ts`, `actions-mayor.ts`, `actions-comprobacion.ts`, `actions-conciliacion-cruzada.ts` (withAction + feature guard; Zod strict en filtros).
- [ ] **T3 — UI sección "Contabilidad formal".** Vistas diario/mayor/comprobación + panel de conciliación cruzada; componentes <200 líneas; tests Testing Library + `vitest-axe`; copys en español neutro (incl. errores §7 del design).
- [ ] **T4 — Integración libros.** Comprobación cuadrada en cualquier período sembrado; mayor de cuenta agregada = saldo de rubro calculado; aislamiento tenant en lecturas.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/libros.test.ts`
- Commit: `feat(contabilidad): libro diario, mayor, comprobación y conciliación cruzada (CTA-2)`

## CTA-3 — Cierre y apertura formales

- [ ] **T1 — RED asientos de cierre/apertura.** Aprobar cierre genera asiento de cierre correcto (resultados → `RESULTADO_PERIODO`, pérdida a la inversa); abrir siguiente período genera apertura desde `AperturaPeriodo`; `RESULTADO_PERIODO → RESULTADOS_ACUMULADOS`; `resumenJson` del período incluye totales del libro formal.
- [ ] **T2 — GREEN.** Servicios `cierre-formal-service.ts` enganchados a las transiciones de estado existentes ([periodo-contable-service](/src/lib/services/periodo-contable-service.ts)); hash encadenado continúa tras cierre/apertura; script `verificar-cadena-hash` + chequeo en `actions-health`.
- [ ] **T3 — Integración.** Flujo completo cierre→apertura con libros cuadrados en ambos períodos; verificador de cadena detecta una línea alterada a propósito (red→green forense).
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/cierre-formal.test.ts`
- Commit: `feat(contabilidad): asientos de cierre y apertura + verificación de cadena (CTA-3)`

## CTA-4 — Backfill histórico (opt-in por tenant)

- [ ] **T1 — Dry-run replay.** `replay-backfill-service.ts` (modo dry): conteos por período de eventos replayables / omitidos / ambiguos / sin-fx; reporte al usuario antes de ejecutar (patrón backfill AS-05).
- [ ] **T2 — Ejecución gateada.** Modo `replay` del motor (sin guard ni auditoría de escritura, `replayRunId`); orden cronológico; conciliación cruzada resultante contra `SnapshotPeriodo` del período; gate explícito del usuario.
- [ ] **T3 — Integración acotada.** Período histórico con datos mixtos (ventas + gastos + préstamos) replays y cuadra contra snapshot.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/backfill.test.ts`
- Commit: `feat(contabilidad): backfill histórico opt-in con dry-run (CTA-4)`

## Cierre del change

- [ ] Suite acotada verde con flag en `off`, `shadow` y `enforce`: `pnpm exec vitest run src/features/contabilidad src/features/contabilidad-formal src/features/ventas src/features/compras-productos`.
- [ ] `pnpm run lint` y typecheck sin errores nuevos.
- [ ] Documentación funcional en `content/docs/modules/contabilidad/` (qué es la capa formal, plan editable, libros, cierre) y actualización de `docs/GLOSSARY.md`.
- [ ] Gate de producción: shadow ≥1 semana con conciliación cruzada verde antes de `enforce` por tenant; registro en memoria del proyecto.
