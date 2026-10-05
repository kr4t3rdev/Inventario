# Tasks — Capa de contabilidad formal (serie CTA)

Plan SDD/TDD. Reglas (memorias del proyecto): TDD estricto con evidencia del fallo RED, tests con rutas explícitas (`pnpm exec vitest run <rutas>` y para DB real `__integration__` con `DATABASE_URL_TEST`), code review + commit por fase con **stage selectivo** (worktree compartido: revisar `git diff --cached --name-only` y desetagear lo ajeno antes de cada commit), migraciones con `--create-only` + revisión SQL. Los runtime de producción usan `prisma migrate deploy`; las bases heredadas que se actualizaron con `db push` requieren baseline verificado antes de adoptarlo (los backfills no corren solos). Independiente de la ventana shadow del change `aislamiento-sistemico-tenant`; los modelos nuevos nacen clasificados `scoped` (CTA-0 T3).

Rama sugerida: `feat/contabilidad-capa-formal` desde `main` (después del merge de `codex/upgrade-next-16`).

## CTA-0 — Modelo de datos, plan por defecto y flags

- [x] **T1 — RED contratos de modelo.** Tests del seed y clasificación: seed crea 7 diarios + plan ~32 cuentas idempotente (re-ejecutarlo no duplica); `CuentaRolTenant` completo (23 roles mapeados); naturaleza coherente con tipo; unicidad `tenantId+codigo`; los 6 modelos nuevos figuran en la clasificación de aislamiento (5 `scoped` + `PlantillaAsiento` global).
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/seed-plan.test.ts src/lib/db/__tests__`
- [x] **T2 — GREEN schema + seed.** Añadir a [prisma/schema.prisma](/prisma/schema.prisma) los 6 modelos y 6 enums del design §1; `src/features/contabilidad-formal/services/seed-plan-contable.ts` (upserts idempotentes); registrar modelo ↔ scoped en `src/lib/db/model-classification.ts`; flag `contabilidad-formal` en [feature-registry.ts](/src/features/planes/feature-registry.ts) (categoría `financiero`).
- [x] **T3 — Migración gateada.** `prisma migrate dev --create-only` → revisión SQL de índices/uniques/decimales (paridad con `fx_evidence`) → aprobación → aplicar en local.
- [x] **T4 — Seed accesible.** Server action `inicializarPlanContableAction` (withAction + `requireFeature('contabilidad-formal')`) idempotente; botón en configuración contable (gated por flag).
- Commit: `feat(contabilidad): schema capa formal + plan de cuentas por defecto (CTA-0)`

## CTA-1 — Motor de asientos + hooks en los 18 writers

- [x] **T1 — RED motor puro.** Tests por evento representativo de cada grupo (venta contado, compra crédito, cobro con intereses, ajuste, transferencia, inyección, diferencia cambiaria, merma): plantilla→líneas correctas, cuadre exacto, moneda original + funcional + fingerprint heredados, rol sin mapear → `CUENTA_SIN_MAPEAR` (enforce) / log (shadow), flag `off` → no-op.
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts`
- [x] **T2 — GREEN motor.** `posting-engine.ts` + `asiento-service.ts` (numeración bajo `AccountingTenantLockService`, hash encadenado, inserción) según design §2; modo vía `CONTABILIDAD_FORMAL_MODE` (default `off`).
- [x] **T3 — RED integración cuadre/idempotencia.** Contra DB real: intentar persistir asiento descuadrado falla; reintentar mismo `origen` no duplica; asiento cae en período resuelto por fecha; período cerrado → rechazo + `INTENTO_BYPASS` en `AuditoriaPeriodo`.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/posting-engine.test.ts`
- [x] **T4 — Hooks en writers (lote 1: ventas y cobros).** `postEvento(tx, …)` en `facturacion-workflow`, `actions-reconciliacion` (ventas), handlers legacy de reconciliación ventas/servicios: eventos `VENTA_CONTADO`, `VENTA_CREDITO`, `COSTO_VENTA_DEVENGADO`, `COBRO_CXC`, `COBRO_SERVICIO`, `DEVOLUCION_VENTA`, `DIFERENCIA_CAMBIARIA`. Tests RED→GREEN por evento (mockean prisma, verifican construcción del evento desde el payload real).
- [x] **T5 — Hooks lote 2 (compras, gastos, nómina).** `COMPRA_*`, `GASTO_*`, `PAGO_CXP`, `PAGO_GASTO_CREDITO`, `PAGO_NOMINA` en compras-*, gastos workflow, pago-salario.
- [x] **T6 — Hooks lote 3 (flujos de efectivo especiales).** Anticipos, préstamos (`COBRO_PRESTAMO` con `INTERESES`), deudas (`PAGO_DEUDA` con `INTERESES`), ajustes bancarios, transferencias, inyección/pago deuda capital, mermas, producción (`produccion/ordenes/[id]/completar`), restock.
- [ ] **T7 — Shadow activable.** `shadow` en staging con contadores por evento; reporte de cobertura (eventos vistos vs contabilizados) visible en `actions-health`.
- Commit por lote: `feat(contabilidad): motor de asientos + hooks ventas (CTA-1/T1–T4)` etc.

<!-- CTA-1 ejecutado 2026-09-22: 16 writers cableados (venta contado/crédito, cobros CxC, devolución, costo FIFO, compras contado/crédito, pago CxP, gastos, nómina, anticipos crear+aplicar, préstamos, deudas, ajustes, transferencias, capital, mermas, producción, servicios, restock). Decisiones v1 documentadas: cobros de préstamo/deuda sin split capital/interés (los writers cobran monto total de CxC/CxP); el handler huérfano `api/handlers.ts:createTransferencia` se retiró el 2026-10-04 tras confirmar que no tenía callers; el canal canónico es `accounting-operations-mutation-service`. -->

## CTA-2 — Libros formales y conciliación cruzada

- [x] **T1 — RED servicios de lectura.** Diario (período, diario, rango, cursor), mayor (saldo corrido por naturaleza), comprobación (4 columnas, total cuadrado), balance/P&L por cuentas, conciliación por rubro vs `balance-results-report-service`.
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/libros.test.ts`
- [x] **T2 — GREEN servicios + actions.** `actions-diario.ts`, `actions-mayor.ts`, `actions-comprobacion.ts`, `actions-conciliacion-cruzada.ts` (withAction + feature guard; Zod strict en filtros).
- [x] **T3 — UI sección "Contabilidad formal".** Vistas diario/mayor/comprobación + panel de conciliación cruzada; componentes <200 líneas; tests Testing Library + `vitest-axe`; copys en español neutro (incl. errores §7 del design).
- [x] **T4 — Integración libros.** Comprobación cuadrada en cualquier período sembrado; mayor de cuenta agregada = saldo de rubro calculado; aislamiento tenant en lecturas.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/libros.test.ts`
- Commit: `feat(contabilidad): libro diario, mayor, comprobación y conciliación cruzada (CTA-2)`

## CTA-3 — Cierre y apertura formales

- [x] **T1 — RED asientos de cierre/apertura.** Aprobar cierre genera asiento de cierre correcto (resultados → `RESULTADO_PERIODO`, pérdida a la inversa); abrir siguiente período genera apertura desde `AperturaPeriodo`; `RESULTADO_PERIODO → RESULTADOS_ACUMULADOS`; `resumenJson` del período incluye totales del libro formal.
- [x] **T2 — GREEN.** Servicios `cierre-formal-service.ts` enganchados a las transiciones de estado existentes ([periodo-contable-service](/src/lib/services/periodo-contable-service.ts)); hash encadenado continúa tras cierre/apertura; script `verificar-cadena-hash` + chequeo en `actions-health`.
- [x] **T3 — Integración.** Flujo completo cierre→apertura con libros cuadrados en ambos períodos; verificador de cadena detecta una línea alterada a propósito (red→green forense).
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/cierre-formal.test.ts`
- Commit: `feat(contabilidad): asientos de cierre y apertura + verificación de cadena (CTA-3)`

## CTA-4 — Backfill histórico (opt-in por tenant)

- [x] **T1 — Dry-run replay.** `replay-backfill-service.ts` (modo dry): conteos por período de eventos replayables / omitidos / ambiguos / sin-fx; reporte al usuario antes de ejecutar (patrón backfill AS-05).
- [x] **T2 — Ejecución gateada.** Modo `replay` del motor (sin guard ni auditoría de escritura, `replayRunId`); orden cronológico; conciliación cruzada resultante contra `SnapshotPeriodo` del período; gate explícito del usuario.
- [x] **T3 — Integración acotada.** Período histórico con datos mixtos (ventas + gastos + préstamos) replays y cuadra contra snapshot.
  `DATABASE_URL_TEST=... pnpm test:integration -- src/features/contabilidad-formal/__integration__/backfill.test.ts`
- Commit: `feat(contabilidad): backfill histórico opt-in con dry-run (CTA-4)`

## Cierre del change

- [x] Suite acotada verde en los tres modos (2026-10-03): `pnpm exec vitest run
  src/features/contabilidad src/features/contabilidad-formal src/features/ventas
  src/features/compras-productos` → **1455 passed / 2 todo** en modo off (default), con
  `CONTABILIDAD_FORMAL_MODE=shadow` y con `=enforce`. Nota de alcance: las suites unitarias de
  writers que mockean prisma fijan el modo a `off` explícitamente (stubEnv) porque el gate
  formal shadow/enforce requiere PostgreSQL real; la cobertura cross-mode real vive en las
  suites `__integration__` (49 archivos, 271/271 en la DB aislada).
- [x] `pnpm run typecheck` (binario local, heap 8192) exit 0 y ESLint de los archivos tocados
  exit 0; `git diff --check` OK (2026-10-03).
- [x] Documentación funcional en `content/docs/modules/contabilidad/capa-formal.md` y
  `docs/GLOSSARY.md` (creado).
- [ ] Gate de producción: shadow ≥1 semana con conciliación cruzada verde antes de `enforce`
  por tenant (R7.3/R7.4) — **pendiente por definición** (ventana real no sustituible por tests).

## Remediación de aceptación 2026-09-23 — pendiente (prevalece sobre los `[x]` históricos)

Los `[x]` CTA-0–CTA-4 registran trabajo previo, **no aceptación**. No cambiar sus marcas ni ejecutar
`enforce`/replay por inferencia. Cada slice siguiente exige RED reproducible (registrar comando y fallo
en evidencia de verificación), GREEN mínimo y REFACTOR con regresión verde; tests unitarios mockean
`@/lib/prisma`, integración real solo bajo `__integration__` y `DATABASE_URL_TEST`. No hacer commits ni
alterar archivos ajenos sin revisión y stage selectivo. `pnpm run typecheck` completo es gate, no
«sin errores nuevos». Los comandos listados son **para Apply**, no evidencia de ejecución de Tasks.

### Fase R0 — Decisiones bloqueantes e inventario (dependencia de R1–R7)

- [x] **Slice focal action reconciliación servicio (25-09).** Dos distribuciones:
  posteo por ID persistido en misma tx, tenant/permiso y rechazo de reintento,
  sin fabricar FX. RED test unitario `findUnique is not a function`; GREEN/REFACTOR
  `pnpm exec vitest run src/features/contabilidad/__tests__/reconciliar-servicio-action.test.ts`
  4/4; typecheck heap 8192 y ESLint focal exit 0. Sin integración DB ni cobertura
  de servicio compartido/API; R0.5 y R6.1 siguen abiertos.

- [x] R0.1 **DECISIÓN RESUELTA:** escala global funcional exacta de 4 decimales,
  rechazo de precisión significativa >4; sin cuantización ni regla de empate. Documentada
  en design/spec. Helper aislado probado; integración R1.3 pendiente. No habilitar enforce/replay.
- [x] R0.2 **DECISIÓN TOMADA, IMPLEMENTACIÓN BLOQUEADA:** savepoint elegido;
  misma conexión, rollback ante fallo SQL y telemetría ligada al commit NO verificados.
  Documentado en design/spec. No habilitar shadow ni promoción shadow→enforce.
- [x] R0.3 **DECISIONES RESUELTAS (implementación R5 pendiente):** vigencia de 24 h
  desde generación, aprobación por manager distinto del solicitante, omisión individual
  de fuentes no reproducibles, transacción única por período y digest SHA-256 versionado
  del snapshot canónico (tenant, período, fuentes, valoración y omisiones). Cambios
  exigen nuevo preflight y aprobación. No habilitar replay hasta R5/Verify.
- [x] R0.4 **DECISIÓN RESUELTA:** período parcial o rubro sin fuente comparable se clasifica
  como `NO_EVALUABLE`, no conforme y bloquea `enforce`; no equivale a diferencia cero.
  Registrado en `design.md` y spec.
- [x] Implementar y probar el estado `NO_EVALUABLE` en conciliación cruzada/UI y asegurar
  que los rubros sin cobertura no se presenten como conformes. Evidencia 2026-09-27:
  RED focal reprodujo que saldos CxC/CxP numéricamente iguales se etiquetaban `OK` sin
  valoración comparable; GREEN hace CxC no evaluable mientras falten moneda/monto funcional,
  y CxP no evaluable si falta saldo fuente o hay moneda distinta de la funcional sin conversión
  persistida. UI muestra estado/causa; un CxP extranjero ya liquidado no bloquea por su
  moneda histórica. Suite libros+panel 15/15 y hooks-writers de ventas 4/4; typecheck,
  ESLint focal y diff-check pasan.
  La comparabilidad de CxC requiere persistir valoración; esto no habilita
  enforce ni reemplaza los gates R4/R7.

  R0.4 detección/UI implementada; certificación operativa y R4.2/R4.3 siguen pendientes.
  **R0.3 decisiones cerradas, implementación R5 pendiente:** autorizador manager confirmado.
  Vigencia predeterminada de 24 h desde la generación del preflight aprobada por el
  usuario el 2026-09-26. Aprobación: manager con permiso vigente para el tenant,
  distinto de la persona solicitante; autoaprobación prohibida. Fuentes ambiguas, sin
  FX indispensable, sin costo verificable o fuera del período: omitir individualmente
  con causa, sin declarar cobertura conforme. Replay por período en una sola transacción:
  cualquier fallo revierte sus asientos y avance; sin lotes parciales. Digest SHA-256
  versionado del snapshot canónico aprobado; cambios exigen nuevo preflight/aprobación.
  Implementación R5 pendiente; replay bloqueado.
- [ ] R0.5 Inventariar en `openspec/changes/contabilidad-capa-formal/tasks.md` matriz verificable de
  los writers reales (incluyendo API legacy, workflows y autoaprobación): ruta, evento, origen único,
  moneda/FX, tx, actor y test; contrastar los 16 cableados anotados con los 18 estimados y marcar
   huecos, sin dar por cubierta una ruta excluida.
    - [x] Slice POST legacy préstamo desembolso: referencia cliente/cuenta tenant-scoped,
      débito condicional y evento PRESTAMO_OTORGADO en el mismo tx, una vez por préstamo;
      test unitario RED 201 vs 400, GREEN 7/7; typecheck heap8192 y lint focal OK.
      Pendientes: permiso específico aprobado, prueba SQL rollback, cobro/pago y deuda.
    - [x] Slice POST legacy deudas (crear + `[id]/pagar`, filas 15/16): duplican al handler
      `handlers-deudas-cash.ts` (no delegan; huérfano con cero callers verificado) y tampoco
      delegan al servicio canónico → hook propio una vez por origen dentro del mismo tx con
      valoración desde la fila persistida, referencias tenant-scoped (proveedor, cuenta,
      tipoPago, deuda), débito condicional `updateMany` y FX fail-closed (CUP pasa; extranjera
      sin tasa → 400 `FX_INSUFICIENTE` antes de escribir). RED 13 fallos nuevos
      (`pnpm exec vitest run src/app/api/contabilidad/deudas-cash
      src/features/contabilidad/__tests__/handlers-deudas-cash.test.ts`: hook sin llamar,
      cross-tenant 201→404/400, FX sin tasa 201→400, evidencia no propagada), GREEN 23/23;
      integración PostgreSQL `__integration__/deudas-cash-real.test.ts` 6/6 (commit crear
      CUP/USD, commit pagar, rollback trigger 22012 en ambos POST, aislamiento referencias);
      typecheck heap8192 y ESLint focal exit 0. Autenticación y validación de período
      mockeadas, no equivalen a autorización real. Pendientes: permiso específico aprobado,
      handler huérfano, filas 11/12 del servicio canónico, préstamos `[id]/pagar` (fila 14).
   - [x] Slice POST legacy préstamos `[id]/pagar` (fila 14, 26-09): duplican al handler
     `handlers-prestamos-cash.ts` (no delegan; huérfano con cero callers verificado por
     búsqueda de contenido en `src`) y tampoco delegan al servicio canónico → hook propio
     una vez por origen `reconciliacion_venta/rec.id` dentro del mismo tx con valoración
     desde la fila persistida, `requireTenant` (firma `AuthenticatedUser`), préstamo
     tenant-scoped (404 cross-tenant), cuenta resuelta por tenant antes del tx, crédito
     condicional `updateMany` con tenant y FX fail-closed (CUP pasa; extranjera sin tasa
     → 400 `FX_INSUFICIENTE` antes de escribir), sin split interés (decisión v1). RED 4
     fallos nuevos (`pnpm exec vitest run
     'src/app/api/contabilidad/prestamos-cash/[id]/pagar/__tests__/route.test.ts'`:
     hook sin llamar, cross-tenant 201→404, cuenta ajena 201→400, FX sin tasa 201→400),
     GREEN 9/9; integración PostgreSQL
     `src/features/contabilidad/__integration__/prestamos-cash-pagar-real.test.ts` 4/4
     (aislamiento referencias, commit pagar CUP, commit pagar USD con fingerprint/tasa
     heredados, rollback trigger 22012 dentro de postEvento); typecheck heap8192 y ESLint
     focal exit 0; regresión focal 7 archivos/46 tests y deudas real 6/6. Autenticación y
     validación de período mockeadas, no equivalen a autorización real. Pendientes:
     permiso específico aprobado, handler huérfano (filas 13/14), filas 9/10 del servicio
     canónico, integración PostgreSQL del desembolso (crear).
    - [x] Slice action servicio PostgreSQL 25-09: test nuevo
     `src/features/contabilidad/__integration__/reconciliar-servicio-real.test.ts` (3/3).
     SQL `psql -X -w` y Prisma generado confirmaron ANTES de writes base exacta,
     `arturo`, puerto 55437, recovery=false, directorio `cta-isolated-pg`.
     Tenant/licencia/plan, servicio+venta, cuenta/tipo pago, período ABIERTO y plan
     contable sembrados: commit enforce produce exactamente un asiento por fila de
     reconciliación; tasa 24, funcional 240 y fingerprint de línea heredado de fila.
     Trigger condicionado al tenant en INSERT de `asientos` lanza error SQL 22012
     dentro de postEvento: rechazo con mensaje del trigger, saldo previo intacto,
     venta no reconciliada, cero reconciliaciones de esa venta y ningún asiento nuevo.
     Referencias servicio/cuenta/tipo pago de otro tenant no alteran saldos ni crean
     reconciliaciones. RED inicial 1/2 por fixture período APROBADO; segundo RED
     1/2 por boundary Next `revalidatePath` fuera de request. GREEN 3/3 tras período
     ABIERTO y mock exclusivo `next/cache`; no se detectó bug de producto nuevo.
     Unit 6/6, typecheck heap8192 y ESLint focal exit 0. Enforce solo en entorno
     efímero del comando de integración, sin flag persistente. R0.5 global sigue [ ].
   **Continuación focal 25-09:** RED 1/6 en action servicio al devolver
   `cuentaBancaria.updateMany.count=0` (se creaba reconciliación/posteo sin ingreso);
   GREEN 6/6 tras rechazo anticipado. Permiso previo a tx y actor/tenant verificados
   con mocks; tsc heap 8192 y lint focal exit 0. SQL+Prisma confirmaron identidad
   aislada 55437; integración producción preexistente 1/1 rollback SQL 22012 en
   ReconciliacionGasto (modo off). Falta integración real action, falla postEvento,
   API/servicio compartido y legacy; R0.5/R6 permanecen abiertos.
  **Slice 25-09 (parcial):** matriz actualizada con traza de action servicio, servicio
  compartido y POST legacy. Producción: RED `pnpm exec vitest run
  src/app/api/produccion/ordenes/[id]/completar/atomicidad.test.ts` (HTTP 200 en
  lugar de 500 cuando falló el registro fuera de tx); GREEN/REFACTOR 2/2 y test
  de identidad 1/1. Reconciliación movida al mismo `tx` del stock y `postEvento`;
  falla propagada. Typecheck local `NODE_OPTIONS=--max-old-space-size=8192
  ./node_modules/.bin/tsc --noEmit --incremental false` exit 0; ESLint focal exit 0.
  **No se ejecutó DB**: rollback real no probado; `cuentaId` opcional, pertenencia
  de cuenta/tipoPago, autorización y FX heredada de las otras rutas siguen abiertos.
   R0.5/R6.1/R6.2 no completos; no habilitar shadow/enforce/replay.
  **Slice producción 25-09 (parcial):** RED `pnpm exec vitest run
  'src/app/api/produccion/ordenes/[id]/completar/atomicidad.test.ts'`: cuatro
  fallos (HTTP 200 en vez de 400 para cuenta/tipo ajeno u omitida y 403 sin
  permiso). GREEN/REFACTOR: 6/6 y actor 1/1; cuenta activa CUP y tipo pago activo
  se verifican por tenant antes del stock, permiso servidor antes de tx; se conserva
  default `efectivo` y operación válida. Typecheck heap 8192 + ESLint focal exit 0.
  Identidad SQL y Prisma solo lectura antes de potenciales writes: DB exacta
  `tcp_test_shadow_rev_contabilidad`, rol `arturo`, puerto 55437, recovery=false,
  data_directory `cta-isolated-pg`. **No hubo writes de DB ni rollback PostgreSQL
   real**: fixture de orden/receta/insumos/productos/usuario/licencia compleja
   pendiente; test mock no lo reemplaza. R0.5 permanece [ ]; no activar modos.
   **Continuación 25-09 (integración real, no RED de producto):** fixture de tenant,
   almacén, categoría, dos productos, receta/insumo, orden EN_PROCESO, cuenta CUP y
   tipo de pago. Trigger SQL por tenant provoca `22012 division by zero` en
   `ReconciliacionGasto` después de modificar stock, orden e historial. Ruta HTTP
   500, stock inicial=2, orden EN_PROCESO, cero historial y reconciliaciones después
   del rollback. SQL y Prisma antes de escribir confirmaron base exacta
   `tcp_test_shadow_rev_contabilidad`, rol `arturo`, puerto 55437, recovery=false,
   directorio `cta-isolated-pg`. Test `rollback-real.test.ts` GREEN 1/1 a la primera:
   valida corrección anterior, **no RED→GREEN nuevo de producto**. Modo formal `off`:
   no prueba falla postEvento; R0.5/R6.1/R6.2 parciales, sin activar modos ni replay.
- [x] R0.6 Capturar baseline `pnpm run typecheck` completo (diagnósticos y rutas, distinguir ajenos)
   y baseline unitario `pnpm exec vitest run src/features/contabilidad-formal`; registrar RED en
   `tasks.md`/reporte de verificación sin atribuir errores ajenos ni ocultarlos.

  **Evidencia Apply 2026-09-23 (baseline, no GREEN):** `pnpm run typecheck` → exit 2,
  diagnósticos TS2345 mayormente por `PostingTx` incompatible con `Prisma.TransactionClient` en
  `src/app/api/contabilidad/reconciliacion/ventas/route.ts`,
  `src/app/api/produccion/ordenes/[id]/completar/route.ts`,
  `src/features/{compras-servicios,venta-servicios}/actions.ts`,
  `src/features/contabilidad/{actions-reconciliacion.ts,api/handlers-reconciliacion-servicios.ts}`,
  `src/features/ventas/services/{devolucion-venta-service,facturacion-workflow,venta-mutation-service}.ts`,
  `src/lib/services/{anticipos-workflow,pago-gastos-workflow}.ts`;
  también `src/features/contabilidad-formal/services/{posting-engine,cierre-formal-service,conciliacion-cruzada-service,replay-backfill-service}.ts`,
  `actions-backfill.ts`, `components/conciliacion-panel.tsx`,
  `src/app/busy/contabilidad/libros/page.tsx` y un diagnóstico adicional en
  `src/features/ventas/services/facturacion-workflow.ts` (tipoCuenta). Clasificación de
  autoría ajena: **no determinada** en worktree compartido; no atribuir esos fallos.
  `pnpm exec vitest run src/features/contabilidad-formal` → exit 0, 16 archivos/99 tests
   verdes; stderr no fatal de jsdom canvas y `onAnimationComplete`. Este baseline no demuestra
   aceptación ni habilita enforce/replay; falta RED específico para R1–R6.

**Slice POST legacy `COBRO_CXC` web (2026-10-01, parcial; R0.5 permanece abierto):**
`api/contabilidad/reconciliacion/ventas/route.ts` ahora requiere feature y permiso,
persiste la conversión FX una vez, valida el snapshot v2 de CxC y actualiza los saldos
nominal y funcional acumulados; `postEvento(COBRO_CXC)` recibe evidencia y diferencia FX
desde la fila persistida. La integración `reconciliar-servicio-real.test.ts` pasó 18/18
en PostgreSQL disposable `tcp_test_devolucion_20261001` (puerto 5433): POST web con
pagos USD acumulados actualiza CxC nominal USD 80 y funcional CUP 2,000; trigger SQL
22012 revierte tesorería, reconciliación, CxC y asiento. También pasaron typecheck
habitual con heap 8192, ESLint focal, `git diff --check` y actualización Graphify.
El boundary de autenticación se inyecta en la integración; no prueba login/sesión HTTP
real ni idempotencia por reintento del POST. No activar shadow/enforce/replay ni cerrar
R0.5/R6 global.

**Slice fila 7 cerrada — sesión HTTP real e idempotencia (2026-10-01):**
RED reproducible: `pnpm exec vitest run --config vitest.integration.config.mjs
src/app/api/contabilidad/reconciliacion/ventas/__integration__/http-real-idempotencia.test.ts`
falló con 2/3: reintento con `Idempotency-Key` devolvía 201 con nuevo
`reconciliacionId` y duplicaba el cobro de CxC (pagado 40→80), y la misma clave con
payload distinto caía en `MONTO_EXCEDIDO` 400 en vez de 409. GREEN: el POST legacy
ahora lee el header `Idempotency-Key`, calcula huella SHA-256 determinista del payload
validado y, antes de abrir transacción, devuelve el resultado previo (200) si la clave
existe con la misma huella o 409 `IDEMPOTENCY_CONFLICT` si difiere; la creación guarda
`idempotencyKey`/`idempotencyPayloadHash` y la carrera concurrente queda protegida por
el unique `(tenantId, idempotencyKey)` (P2002 → replay si la huella coincide, conflicto
si no). Migración aditiva `20261001090000_reconciliacion_venta_idempotencia` aplicada
solo en la DB desechable. Sesión HTTP real certificada sin sustituir `authenticateUser`:
User/UserSession/membresía manager/licencia con plan reales; JWT firmado con
`getJwtSecret()` (el cliente Prisma carga `.env` y define `JWT_SECRET`, por eso el
default dev produce firma inválida en integración); 401 sin token. Integración
final 21/21 (3/3 nueva + 18/18 `reconciliar-servicio-real.test.ts`); unitarios de
regresión 15/15 + contrato de aislamiento 7/7; mocks de `route-credito-gate.test.ts`
actualizados a `updateMany`, snapshot FX y chequeo ANULADA temprano. Typecheck heap
8192, ESLint focal, `git diff --check` y Graphify pasan. No activar
shadow/enforce/replay; R0.5/R6 global sigue abierto por los demás writers.

**Slice filas 9/10 — sesión HTTP Bearer real y carrera multi-conexión (2026-10-02):**
Fila 8 (`handlers-reconciliacion-servicios.ts`) verificada huérfana: sus tres handlers
tienen cero callers en `src`; se documenta y NO se cablea (riesgo de doble posteo con
la ruta viva y el servicio compartido). Para las filas 9/10, la integración nueva
`src/features/contabilidad/__integration__/cash-loans-http-real.test.ts` (3/3) certificó
el canal móvil de préstamos cash sin sustituir `authenticateUser`: login Bearer
end-to-end (JWT con `getJwtSecret()`, UserSession activa, membresía manager y
licencia/plan reales; 401 sin token), creación 200 con desembolso debitado y asiento
único, pago Bearer acredita cuenta/CxC PARCIAL con fingerprint heredado, y carrera
multi-conexión: dos pagos concurrentes de 600 sobre deuda 1000 se serializan por el
lock del tenant; el perdedor recibe 400 `CREDITO_CONFLICTO` y ni CxC ni tesorería
duplican. Regresión `prestamos-cash-pagar-real.test.ts` 11/11: su fixture hardcodeaba
el período de septiembre (ya no cubre hoy, octubre) y la DB vieja en la aserción de
identidad; actualizada a mes corriente y `DATABASE_URL`. Unitarias focales 13/13
(mutation service, credito gate, routes móviles); typecheck heap 8192, ESLint focal y
283: `git diff --check` verdes. El canal móvil responde 200 (no 201) en éxito y el route
284: usa `Request` pero `authenticateUser` exige `NextRequest` (cookies) en los tests. No
285: activar shadow/enforce/replay; R0.5/R6 sigue abierto.

**Slice filas 11/12 — gate de permiso en deudas, sesión Bearer real y numeración (2026-10-02):**
RED reproducible: `pnpm exec vitest run
src/features/contabilidad/services/__tests__/accounting-cash-operations-mutation-service.test.ts`
falló con 3/7: crear deuda sin permiso y sin feature entraba al writer (promise
resolved), y el pago sin permiso fallaba con `FX_INSUFICIENTE` en vez de `FORBIDDEN`.
GREEN: nuevo `requireDeudaMutationAccess` (`requireFeature('deudas-cash')` +
`requirePermission('financiero.contabilidad.acceder')`) en `createCashDebt` y
`registerCashDebtPayment`; unit 7/7 (FORBIDDEN dependiente con feature, plan sin
feature, pago sin permiso). Integración nueva
`src/features/contabilidad/__integration__/cash-debts-http-real.test.ts` (3/3): canal
móvil de deudas sin sustituir `authenticateUser` — 401 sin token, create Bearer 200
con desembolso acreditado y asiento único, pago Bearer debita cuenta (5,000→4,960),
CxP PARCIAL y fingerprint heredado, y carrera multi-conexión: dos creaciones
simultáneas se serializan por el lock del tenant y asignan `DC-N` distinta sin
duplicar `numeroFactura`. Regresión `deudas-cash-real.test.ts` 8/8: fixture
hardcodeaba período de septiembre y DB vieja; actualizada a mes corriente,
`DATABASE_URL` y usuario con `planFeatures['deudas-cash']`. Typecheck heap 8192,
ESLint focal, `git diff --check` y Graphify pasan. No activar
shadow/enforce/replay; R0.5/R6 sigue abierto.

**Slice fila 23 — pagos CxC de servicios, FX de liquidación y sesión HTTP real (2026-10-02):**
Integración nueva `src/features/venta-servicios/__integration__/service-cxc-pago-fx-real.test.ts`
(4/4, PostgreSQL desechable `tcp_test_devolucion_20261001`): venta de servicio a crédito
en USD crea CxC con snapshot FX v2 desde el catálogo (USD 100 → CUP 2,400, tasa 24,
`fxEvidenceVersion` 2, PENDIENTE); `reconcileService` liquida la CxC en su moneda
original con pago parcial (USD 40×25 → CUP 1,000 funcional, valor en libros 960,
diferencia FX 40 al asiento) y pago final (USD 60×25 → CUP 1,500, diferencia 60,
PAGADA + `reconciliado=true`); ambos asientos cuadrados con tres líneas. Sesión HTTP
real del canal `/api/contabilidad/reconciliacion/servicios`: 401 sin token, 201 con
Bearer (JWT con `getJwtSecret()`, UserSession/membresía/licencia reales, CUP con
fingerprint y `reconciliadoPor` del usuario real). Regresión
`service-credit-cxc-real.test.ts` 2/2: bug preexistente corregido (`servicioId` →
`serviceId` en el test cross-tenant, que nunca había corrido: ReferenceError).
Unitarias focales 68/68 en 7 suites + `reconciliar-servicio-real.test.ts` 18/18.
Typecheck heap 8192, ESLint focal, `git diff --check` y Graphify pasan. La action y
el route usan `new Date()` para el guard de período: la fixture creó dos períodos
(febrero de reconciliación y mes corriente). No activar shadow/enforce/replay;
R0.5/R6 sigue abierto.

**Slice fila 24 — permiso contable en pago de gastos y ramas del resolver (2026-10-02):**
RED reproducible: `pnpm exec vitest run
src/features/contabilidad/__tests__/reconciliar-gasto-permiso.test.ts` falló con 2/2:
un dependiente con feature pero sin `financiero.contabilidad.acceder` ejecutaba el
workflow completo vía `reconciliarGastoAction` (promise resolved `success: true`) y el
adapter `reconciliarGastoAdapter` llegaba a sus validaciones internas (TASA_CAMBIO)
sin denegar. GREEN: `requireFeature` + `requirePermission` añadidos a ambos
invocadores; la action deniega con `{ success: false, error.code: 'FORBIDDEN' }`
(el wrapper `withAction` captura el ActionError, no rechaza) y el adapter lanza
FORBIDDEN antes de tocar CxP. Coverage de ramas: `resolverTipoEventoEgreso` (2/2)
resuelve PAGO_CXP/PAGO_NOMINA/COMPRA_CONTADO/GASTO_CONTADO por referencia con
prioridad CxP y nulos; unitarios `pago-gastos-workflow.test.ts` 9/9 ya cubrían las
ramas gastoDE/CxP parcial/PAGADA/compra/servicio. Regresión: routes web/mobile de
gastos 7/7 (mocks de usuario actualizados con rol/permisos) y `__tests__`
contabilidad 222/222 + event-builders 21/21. Typecheck heap 8192, ESLint focal,
`git diff --check` y Graphify pasan. No activar shadow/enforce/replay; R0.5/R6
sigue abierto.

**Revalidación R0.5, writer VENTA_CREDITO (2026-09-27):** la fila 3 queda PARCIAL.
El builder dejó de inventar CUP y el posting/replay fail-closed sin valoración explícita
en modos formales activos; `off` sigue no-op. Los tres callers aún pasan solo el monto y
Factura/CuentaPorCobrar no persisten moneda, monto funcional ni fingerprint FX. Falta
conectar la valoración autoritativa al origen y cubrir factura extranjera, reintento y
rollback con tests de workflow. Ver matriz R0.5/estado.

### Fase R1 — Contratos transaccionales, gate y dinero (tras R0.1; shadow tras R0.2)

**Apply decimal fuente (parcial, 2026-09-27):** el contrato del evento amplía
monto original, tasa y auxiliares monetarios a `DecimalInput`; `postEvento` y
`replayEvento` validan/canonicalizan evidencia decimal, rechazan números JS
inseguros y aplican límites de persistencia (`Decimal(20,4)` para montos y
`Decimal(20,10)` para tasa). Replay omite fuentes no persistibles con causa.
Los builders también aceptan/preservan Decimal y string; comparación de intereses
positivos no convierte a `number`. RED/GREEN focal y regresión del mock: 68/68;
typecheck, ESLint focal, `git diff --check` y revisión fresca sin P1/P2.
Esto cierra solo estas slices: falta verificar todos los callers/writers e
integraciones; R1.1/R1.2/R1.3 no se declaran completas ni se habilitan modos.

**Evidencia Apply (helper decimal aislado):** `pnpm exec vitest run
src/features/contabilidad-formal/__tests__/decimal-contable.test.ts` RED exit 1
(import `decimal-contable` inexistente); GREEN exit 0 (9/9 tests). `pnpm run typecheck`
exit 2, mismos diagnósticos de baseline R0.6 (PostingTx/CierreTx y otros); no declarar
R1.2 ni R1.3 completos ni habilitar enforce. R0.3/R0.4 permanecen abiertos.

**Apply slice posterior (parcial):** RED `pnpm exec vitest run
src/features/contabilidad-formal/__tests__/posting-engine.test.ts` exit 1:
`rechaza precisión funcional mayor que cuatro sin insertar` recibió
`CONTABILIZADO`. Validación de frontera añadida antes del resolver legacy;
pendiente GREEN y reemplazar `round4`/`number`/epsilon por Decimal integral,
además de resolver PostingTx/CierreTx. No marcar R1.2/R1.3 completos.
GREEN focalizado posterior: mismo comando exit 0 (16/16); `pnpm run typecheck`
exit 2, contratos PostingTx/CierreTx y diagnósticos del baseline persisten. La
   validación en frontera rechaza >4, pero el resolver aún convierte a `number`,
   redondea y compara con epsilon: **no hay garantía de exactitud integral**.

 **Apply posterior (parcial, 2026-09-23):** RED `pnpm exec vitest run
 src/features/contabilidad-formal/__tests__/posting-engine.test.ts` exit 1 (descuadre
 1.0001 vs 1 aceptado); GREEN focalizado 17/17, helper decimal 9/9. Eliminados
 `round4`, `EPSILON_CUADRE`, `Number` y aritmética flotante en resolución de
 montos, líneas y cuadre del motor. `PostingTx`/`CierreTx` reemplazados por
 `Prisma.TransactionClient`; el typecheck bajó a diagnósticos en replay y
 facturación (facturación corregida, reejecución pendiente). No marcar R1.2/R1.3:
  faltan gate licencia/tenant, hash versionado, cierre Decimal y typecheck verde.

  **Apply posterior (2026-09-23, slice typecheck solamente):** RED
  `pnpm run typecheck` exit 2: TS2367 en `actions-backfill.ts:48` (rol
  `contador` inexistente en `TenantRole`) y TS2559 en
  `replay-backfill-service.ts:156` (Merma sin campos del contrato de valoración).
  GREEN `pnpm run typecheck` exit 0; regresión
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/replay-backfill-service.test.ts
  src/features/contabilidad-formal/__tests__/posting-engine.test.ts` exit 0,
  **solo 17 tests de posting-engine** (el archivo replay no existe). El cambio
  de merma conserva el costo previo mediante `{ monto: m.costoTotal }`:
  **no** demuestra costo histórico verificable; replay permanece sin autorizar.
  No marcar R1.2/R1.3: faltan gate tenant, hash versionado y cierre exacto.

  **Apply gate focal 2026-09-23 (R1.3 parcial):** RED `pnpm exec vitest run
  src/features/contabilidad-formal/__tests__/posting-engine.test.ts` exit 1
  (4 fallos: sin licencia contabiliza, plan ausente omite, shadow omite o escribe).
  GREEN/REFACTOR mismo comando exit 0 (20/20); `pnpm run typecheck` exit 0.
  `postEvento` comprueba licencia activa no expirada y features efectivos
  (plan/overrides/snapshot legacy) vía tx; off no consulta DB; sin flag omite;
  plan ausente habilitado rechaza enforce; shadow resuelve sin insertar y captura
  errores. **No marcar R1.3**: falta validación de savepoint/telemetría de shadow,
  y restantes requisitos de moneda/valoración. No habilitar shadow operativo ni
  promover enforce; gate operacional R7 pendiente.

**Apply slice R1 — conflicto de origen bajo snapshots (parcial, 2026-09-29):**
RED del test unitario: `pnpm exec vitest run
src/features/contabilidad-formal/__tests__/posting-engine.test.ts` falló porque
tras `P2002` se hacían lecturas dentro de la transacción ya abortada. Se retiró
esa recuperación insegura: `insertarAsientoConNumeracion` propaga el error original;
el caller solo puede repetir la operación completa en una nueva transacción.
GREEN focal: 48/48 tests. En la base desechable `tcp_test_r1_snapshot_retry`
(`127.0.0.1:55437`), migraciones existentes 126/126 aplicadas; integración de
posting 24/27 (3 fallos preexistentes de preflight/backfill, sin relación con esta
slice). Cuatro escenarios SQL deterministas (RepeatableRead/Serializable ×
mismo/distinto origen) establecen snapshot de A con barrera, confirman B, verifican
error de A y rollback del sentinel, y repiten el callback completo en transacción
nueva; la cadena/sequence final queda íntegra. No se agregaron retries automáticos
a callers de producción; su adopción y aceptación operacional continúan pendientes.

- [x] R1.1 **RED:** añadir casos en `src/features/contabilidad-formal/__tests__/posting-engine.test.ts`
  para `Prisma.Decimal`, fracción subcentésima, línea doble/negativa, moneda funcional inconsistente,
  tenant sin plan/plantilla/rol en enforce, licencia ausente y `off`; ejecutar
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts` y anotar fallos.
- [ ] R1.2 **DESCARTADO como criterio de cierre de esta change (2026-09-29):** tipar `src/features/contabilidad-formal/services/posting-engine.ts` y
  `src/features/contabilidad-formal/services/cierre-formal-service.ts` con
  `Prisma.TransactionClient`/payloads reales de `@/generated/prisma`; retirar `tx as never`, contratos
  `PostingTx`/`CierreTx` incompatibles y casts encubridores en helpers/callers; validar con
  `pnpm run typecheck` (sin `skipLibCheck` ni tipar a mano `PrismaPromise`).
  Evidencia parcial 2026-09-29: aliases `PostingTx`/`CierreTx` ya apuntan a
  `Prisma.TransactionClient`; se retiraron `tx as never` del caller replay y el cast del helper
  de lock. El contract test nuevo tuvo RED por el cast replay y quedó GREEN. Suites focales
  independientes: 7 archivos, 119 tests GREEN; `replay-backfill.test.ts` conserva dos fallos
  preexistentes en casos dry-run por modelos ausentes en su mock (fixture no ampliada fuera del
  scope). ESLint y `git diff --check` GREEN; `pnpm run typecheck` GREEN. El contract test compila
  focalmente con `pnpm exec tsc -p .r12-contract-tsconfig.json --noEmit --pretty false` (config
  temporal de archivo único, retirada luego). La variante
  `tsc --noEmit --skipLibCheck false` sigue bloqueada por declaraciones externas (uploadthing/solid-js,
  next-auth/@auth/core, tipos cookie/lodash y duplicados Next/Remotion), así que R1.2 no se marca
  completado hasta verificar el gate estricto sin ese bloqueo. No cubre R1.3–R1.5.
- [x] R1.3 **GREEN:** crear helper decimal compartido en
  `src/features/contabilidad-formal/services/decimal-contable.ts` (parseo finito,
  normalización según R0.1, serialización canónica); usarlo en `posting-engine.ts` antes de insertar:
  positivos exclusivos, moneda consistente, `debe.eq(haber)`, rechazo de valoración insuficiente;
  resolver gate servidor licencia/flag + modo por tenant y fail-closed en enforce.
- [x] R1.4 **RED:** extender `src/features/contabilidad-formal/__integration__/posting-engine.test.ts`
  con rollback de operación+líneas ante descuadre/plan faltante, concurrencia/origen único y FX heredada;
  ejecutar `DATABASE_URL_TEST=postgresql://postgres:test@localhost:5433/test_db pnpm test:integration -- src/features/contabilidad-formal/__integration__/posting-engine.test.ts`; documentar RED.
- [ ] R1.5 **DESCARTADO como criterio de cierre de esta change (2026-09-29):** corregir numeración/hash y tx en
  `src/features/contabilidad-formal/services/posting-engine.ts` y helpers existentes; orígenes
  deterministas distintos por evento, lock tenant y reintento sin duplicar; canonizar origen/fecha/
  orden/importes y versionar verificador existente para hashes ya publicados (nunca reescribirlos).
  Repetir unitario e integración de R1.1/R1.4, `pnpm run typecheck` y lint de archivos tocados.

  **Slice focal input/money 2026-09-29 (parcial):** RED de
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts`
  → 2/44 fallos reproducibles: monto funcional negativo aceptado hasta `PLANTILLA_VACIA`
  (defecto real) y expectativa nueva de moneda funcional/fingerprint nulo aplicada a la segunda
  línea aunque la fixture heredada también la definía como `TOTAL` (test defect, no producto).
  GREEN: `montoFuncional` ahora debe ser estrictamente positivo antes del posting; se corrigió
  la fixture para usar `MONTO_PAGADO` en la línea derivada, validando la regla ya existente de
  moneda funcional y fingerprint nulo. También se cubren exclusividad debe/haber,
  rol sin mapear y plantilla ausente en enforce. `posting-engine.test.ts` +
  `decimal-contable.test.ts`: 53/53; ESLint focal, typecheck completo y `git diff --check`
  exit 0. Esto cierra solo dichos límites unitarios; moneda cruzada/original sin FX,
  callers, integración SQL y aceptación completa R1.1/R1.3 siguen pendientes.

  **Aclaración/cobertura FX añadida:** la afirmación anterior de metadata derivada
  defectuosa era incorrecta: `esTotal` ya conservaba source FX solo para `TOTAL`;
  la falla fue una expectativa/fixture errónea (ambas líneas estaban definidas `TOTAL`).
  RED adicional: dos eventos USD→CUP sin tasa o sin fingerprint sí contabilizaban.
  Con base en spec §2 y design §2.4 (heredar tasa/fingerprint de fuente; no recalcular),
  `postEvento` y `replayEvento` ahora rechazan esa evidencia incompleta con
  `VALORACION_FX_INCOMPLETA`; moneda igual a funcional conserva el comportamiento
  nullable vigente. Suite focal 55/55, typecheck, lint y diff-check exit 0.

**Revalidación R1 (2026-09-29, cierre parcial verificado):** R1.1, R1.3 y R1.4 se marcan
cerrados técnicamente. Los 26 archivos unitarios focales de contabilidad formal pasaron **286/286**;
la integración completa de posting-engine pasó **29/29** contra la nueva base desechable
`tcp_test_r1_closure`, PostgreSQL 17 en `127.0.0.1:55437` con **126/126 migraciones**. Cubre
rollback operación/asiento ante fallo, origen único/concurrencia, valoración FX heredada,
secuencia/hash y RepeatableRead/Serializable con rechazo de snapshot obsoleto y reintento
completo en una transacción nueva. Dos fixtures unitarias se actualizaron para las lecturas
idempotentes de `Asiento` y la fixture SQL configuró explícitamente CUP para el tenant; no se
introdujo fallback monetario ni se alteró lógica de producción. Typecheck habitual y ESLint
focal verdes. La instancia desechable se detuvo al finalizar.

**R1.2 continúa [ ]**: `PostingTx`/`CierreTx` son `Prisma.TransactionClient` reales y el contrato
de compilación focal es verde; sin embargo, el gate solicitado `tsc --noEmit --skipLibCheck false`
termina con errores de declaraciones externas instaladas (Next/Remotion duplican `src`;
faltan tipos de Solid, Auth, cookie y lodash; Remotion/React tienen incompatibilidades). No hay
diagnósticos de código de aplicación en esa corrida; no se añadieron supresiones, shims ni se
cambiaron dependencias para fingir conformidad. **R1.5 continúa [ ]**: motor/metadata/hash v2
y reintento manual de callback en nueva tx están verificados; falta adoptar/probar el contrato
de retry completo en los callers productivos afectados, sin reconsultar una transacción abortada.
La matriz global de writers y su activación siguen R0.5/R6/R7, no quedan acreditadas por R1.
La semántica de gate R1.3 sigue `design.md` §9: sin licencia/flag el tenant está efectivamente
en `off` aunque el modo global sea enforce; plan/rol faltante en tenant habilitado sí rechaza.
Este estado no autoriza activar shadow/enforce/replay ni cerrar R1 completo.

**Slice R1.5 — retry completo del replay (2026-09-29, verificado; R1.5 global parcial):**
`ejecutarBackfillAutorizado` reintenta hasta tres veces **toda** la transacción Serializable
ante `P2034` o SQLSTATE `40001`/`40P01` (directo o en metadata Prisma); no reintenta errores
ajenos. Cada intento vuelve a verificar tenant, licencia, permisos de solicitante y aprobador,
vigencia/digest/aprobación, fuentes y lock, y emite una nueva capability ligada al nuevo tx.
Si el error aborta la transacción, se propaga antes de usar savepoint o consultar el cliente
abortado. RED unitario para `40001` directo y `P2010/meta.code=40001` reprodujo el hueco y
quedó GREEN. Unitarios de servicio+contrato: **51/51**; SQL real **41/41** combinados (backfill
12, posting 29) sobre la base desechable `tcp_test_r15_outer_retry`, con 126 migraciones y URLs
idénticas explícitas en loopback `127.0.0.1:55437`. Un trigger sobre la segunda fuente lanzó
`40001` una sola vez mediante secuencia no transaccional: el retry confirmó un único run
`COMPLETED`, dos asientos con líneas e identidades únicas, sin parcial del primer intento.
Typecheck normal con heap 6144 MB, ESLint focal y revisión independiente GPT-6 Luna sin
bloqueantes. **R1.5 sigue [ ]** por los demás callers productivos que poseen sus propias
transacciones; reintentar dentro de `postEvento(tx, …)` sería incorrecto. La matriz de
callers/writers debe decidir y probar cada reintento completo sin duplicar operaciones de caja.

**R1.2 — gate estricto aún abierto (2026-09-29):** el contrato local
`Prisma.TransactionClient` y typecheck habitual están verdes, pero `tsc --skipLibCheck false`
conserva 20 errores de `.d.ts` externos (Next/Remotion, UploadThing, Auth y tipos de cookie/lodash).
La instalación mínima propuesta de tipos/peer no se aplicó: el registro de pnpm quedó resolviendo
más de cinco minutos y el intento offline carecía de metadata de `third-party-web@latest`;
`package.json`/`pnpm-lock.yaml` no se alteraron por esos intentos. No se añadieron stubs, casts,
supresiones ni `skipLibCheck`; no se declara R1.2 conforme. Un `tsc` directo sin el heap configurado
abortó por memoria y no se usa como evidencia; la repetición con el heap del script terminó bien.
Una invocación accidental amplia de integración se ejecutó solo contra esta base desechable;
no se acredita como gate global (122 pasaron, 48 omitidas, 9 fallaron por otros esquemas y una
aserción entonces en corrección). La repetición posterior con rutas exactas pasó 41/41. No
se tocaron producción, 5432, modos ni se hizo commit/push.

**Slice R1.5 — devolución Serializable (2026-09-29, verificado focal):**
`registrarDevolucion` reintenta la transacción externa completa hasta tres intentos solo ante
`P2034`/`40001`/`40P01`; stock, FIFO, nota de crédito, saldo, auditoría y posting permanecen
en el cliente transaccional. Unitarios focales 17/17, typecheck habitual y lint focal verdes;
la integración existente de devolución FIFO pasó 1/1 en la misma base desechable (rol local
`arturo`, no producción). Revisión independiente GPT-6 Luna sin bloqueantes. Tras la revisión,
el test de retry se reforzó: falla en posting después del progreso previo, crea un cliente
transaccional distinto por intento y verifica un solo posting confirmado; 17/17 nuevamente.
El mapeo encontró dos dueños directos de posting con aislamiento Serializable: replay y esta
devolución. Los demás writers y su política de retry siguen bajo la matriz R0.5/R6; por ello
no se usa este slice aislado para declarar cerrado el R1.5 global.

**Verificación adicional R1.5 (2026-09-29):** la integración real de devolución ahora
inyecta SQLSTATE `40001` en kardex después de restaurar FIFO y actualizar stock. Una
secuencia no transaccional acredita dos intentos, pero solo una devolución, nota de crédito,
línea de stock y efecto CxC confirmados; el replay idempotente no los duplica. Dos pruebas
de integración pasaron en PostgreSQL desechable; el servidor quedó detenido. Los objetos
temporales usan nombres únicos y limpieza incluso si falla la preparación. La revisión
independiente validó el escenario central e identificó esos dos riesgos de fixture, corregidos
antes de la repetición final.

**Límite de cierre R1.2/R1.5:** un intento acotado de instalar tipos pares volvió a quedar
sin resolver en pnpm y se interrumpió sin alterar paquete/lockfile. Investigación de las
declaraciones instaladas confirma que no basta añadir tipos faltantes: Next 16 y Remotion 4
declaran módulos de imagen globales incompatibles; Remotion 4.0.417 además importa
`react/jsx-runtime.js` y refiere `Timer` no definido. La versión 4.0.526 corrige ese import,
pero conserva el conflicto de imágenes y `Timer`, por lo que no se cambia la dependencia
ni se marca el gate estricto verde. R1.5 conserva [ ] por aceptación cross-caller aún no
demostrada; no se confunde con el inventario general R0.5/R6/R7.

**Decisión final R1.2/R1.5 (2026-09-29, por indicación del usuario): DESCARTADOS del
alcance de cierre de esta change, no completados.** R1.2 mantiene verde el contrato local
`Prisma.TransactionClient` y el typecheck habitual, pero no supera el gate estricto sin
`skipLibCheck`; sus 20 diagnósticos de dependencias externas quedan registrados. R1.5 conserva
las correcciones y pruebas focales de secuencia/hash v2, replay y devolución, pero no se
certificó el retry cross-caller completo. No se convierten en `[x]`, no se revierten cambios
ya probados, no se suprimen diagnósticos y no se habilita ningún modo. Las notas históricas
anteriores que los llaman pendientes describen el estado previo a esta decisión final.

### Fase R2 — Shadow y auditoría durable (tras R1, decisión R0.2)

**Continuación focal 2026-09-25 (sin activación):** identidad de solo lectura SQL **y**
Prisma antes de escribir: `tcp_test_shadow_rev_contabilidad`, rol `arturo`, puerto
`55437`, recovery=false, `data_directory=.../opencode/cta-isolated-pg`. Con
`DATABASE_URL=DATABASE_URL_TEST=DIRECT_URL=postgresql://arturo@127.0.0.1:55437/tcp_test_shadow_rev_contabilidad`
y `ALLOW_DISPOSABLE_TEST_DB=1`, `pnpm exec vitest run --config
vitest.integration.config.mjs` sobre `shadow-outbox`, `post-evento-shadow-sql`,
`post-evento-auditoria-sql`, `auditoria-durable`, `savepoint-writer`: **10/10**, 5
archivos, exit 0 (commit/rollback/retry, error SQL real, auditoría fail-closed).
Son regresiones GREEN existentes, **no RED nuevos del motor**: R2.1–R2.3 y R2.5
siguen parciales. Inventario de llamadas operativas `postEvento` (búsqueda en `src`,
excluyendo tests y definición; el conteo de 16 writers no es exhaustivo):

| Writer (líneas de llamada) | Evento/familia, actor/tx, hallazgo |
|---|---|
| `ventas/services/facturacion-workflow.ts:244,331,384`; `venta-mutation-service.ts:474`; `devolucion-venta-service.ts:425` | Ventas, costo, devolución; userId recibido del workflow; tx compartida en hook; verificar autorización del caller original. |
| `contabilidad/actions-reconciliacion.ts:419`; `contabilidad/api/handlers-reconciliacion-servicios.ts:66`; `app/api/contabilidad/reconciliacion/ventas/route.ts:698` | Cobros/reconciliaciones; actor transmitido y tx; revisar permisos legacy y FX por ruta. |
| `contabilidad/services/accounting-cash-operations-mutation-service.ts:148,281,403,524`; `contabilidad/api/handlers-prestamos-cash.ts:72,195`; `handlers-deudas-cash.ts:73,129` | Préstamo/deuda crear/cobrar/pagar; usuario propagado, tx; rutas legacy y canonical duplicadas requieren verificación por origen. |
| `contabilidad/services/accounting-operations-mutation-service.ts:262,356,483,589` | Ajustes/transferencias/capital; usuario propagado en tx; canal legacy no cableado permanece hueco. |
| `compras-productos/actions.ts:363`; `compras-servicios/actions.ts:190`; `venta-servicios/actions.ts:283`; `lib/services/pago-gastos-workflow.ts:613` | Compras/servicios/gastos; tx en hook, actor propagado; revisar autorizaciones y test por ruta. |
| `lib/services/anticipos-workflow.ts:178,564`; `mermas/actions.ts:151`; `productos/actions-restock.ts:558` | Anticipos, merma y restock; tx en hook; revisar procedencia del actor y origen/FX. |
| `app/api/produccion/ordenes/[id]/completar/route.ts:145` | Producción: RED identidad manipulable por `body.userId || user?.userId || 'system'`; GREEN usuario autenticado y `requireTenant`, orden de otro tenant rechazada. ReconciliacionGasto se crea **fuera** del tx: hueco de atomicidad previo no cubierto por el hook. |

En todos los hooks, `postEvento` consulta licencia y feature efectiva dentro del
`TransactionClient`; `off` retorna sin DB. La matriz es inventario de llamadas,
**no certificación** de permisos/FX/actores de servicio de cada caller; faltan tests
por ruta, autoaprobación y handlers que no llaman `postEvento` (R0.5 continúa [ ]).
RED test focal `actor-contract.test.ts`: falló por `body.userId` después de corregir
un error inicial de fixture (`import.meta.url` no era file URL en Vitest). GREEN
1/1; `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit
--incremental false` exit 0 (primer intento encadenado interrumpido a 120 s;
repetido solo con timeout mayor); ESLint focal exit 0. Test estático verifica
el contrato de identidad; falta test de endpoint con usuario autenticado/tenant
ajeno y permisos. **Ninguna tarea R2.x global se marca completa.**

- [x] **Slice focal 2026-09-25 — consulta autenticada de métricas shadow (R2.5 parcial).**
  `actions-metricas-shadow.ts` usa `withAction`, `requireTenant`, `requireFeature` y permiso
  `financiero.auditoria.ver`; delega en `consultarMetricasShadow` sin usar tenant del cliente.
  RED `pnpm exec vitest run src/features/contabilidad-formal/__tests__/actions-metricas-shadow.test.ts`:
  exit 1, import de action inexistente. GREEN/REFACTOR mismo test + posting-engine: 26/26;
  `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit --incremental false`
  y ESLint focal exit 0. Unitarios mockean Prisma: A no consulta B, sin licencia y rol
  insuficiente bloqueados. Conteos del outbox confirmado/idempotencia siguen cubiertos por
  integración previa `__integration__/shadow-outbox.test.ts`; **no se reejecutó integración
  en este slice** ni se activó shadow/enforce/replay. R2.5 global sigue pendiente.

**Apply focal 2026-09-25 — falla SQL real de auditoría (R2.3/R2.4 parciales):**
antes de escribir, SQL `psql -X -w -h 127.0.0.1 -p 55437 -U arturo -d
tcp_test_shadow_rev_contabilidad` y Prisma con URL explícita confirmaron base,
rol `arturo`, puerto 55437, recovery=false y directorio `cta-isolated-pg`.
`__integration__/post-evento-auditoria-sql.test.ts` creó tenant, licencia,
plan, período APROBADO y actor de usuario; precalentó resolución de período
fuera del writer para evitar que Prisma raíz dependa de locks de éste. Trigger
temporal por tenant provocó división por cero en INSERT de `auditoria_periodos`.
En shadow y enforce, `postEvento` propagó `AUDITORIA_FALLIDA`, la modificación
del diario en el writer revirtió y no quedaron auditoría falsa, asiento ni outbox.
Primer pase 2/2 **GREEN sin RED de producto**: el manejo fail-closed ya existía;
esta prueba amplía cobertura pero no acredita una corrección RED→GREEN nueva.
Regresión integración focal 5/5 (incluye shadow SQL y auditoría durable), unitarios
guard+motor 64/64; `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc
--noEmit --incremental false` y ESLint focal exit 0. Ninguna casilla R2.3/R2.4
se marca completa: faltan matriz de callers R0.5, permisos y casos de servicio.
Sin activación de modos globales ni replay; no se usó 5432.

- [x] **Slice focal 2026-09-25 — integración postEvento shadow con tenant real.**
  `__integration__/post-evento-shadow-sql.test.ts`: SQL y Prisma comprobaron antes
  de escribir base `tcp_test_shadow_rev_contabilidad`, usuario `arturo`, puerto
  55437, recovery=false y directorio `cta-isolated-pg`. Tenant, licencia, plan,
  plantilla y período reales; trigger SQL provoca división por cero durante INSERT
  de línea. RED inicial: 1/2, fallo de fixture (`function shadow_sql_fail already exists`
  por reutilización de sesión PostgreSQL), **no fallo de producto**. REFACTOR de
  fixture `CREATE OR REPLACE FUNCTION`: GREEN 2/2, confirma writer sin asiento
  parcial, outbox ERROR_SHADOW visible postcommit, rollback exterior sin outbox.
  Unitarios focales 22/22; `NODE_OPTIONS=--max-old-space-size=8192 tsc
  --noEmit --incremental false` y ESLint focal exit 0. Sin GREEN de producto
  nuevo ni RED de comportamiento de producto: no marcar R2.1/R2.2 completos,
  ni activar shadow/enforce/replay. Falta falla SQL real de auditoría y gate global.

**Apply 2026-09-25 (continuación, gate todavía bloqueado):** se recuperó la ejecución
local de TypeScript sin registry ni cambios de configuración: el primer intento directo
`tsc --noEmit --incremental false` agotó el heap predeterminado de Node (~2 GiB);
`NODE_OPTIONS=--max-old-space-size=8192` con binario `./node_modules/.bin/tsc`,
`--noEmit --incremental false` y watchdog de 100 segundos terminó exit 0 sin
diagnósticos. SQL y Prisma de solo lectura confirmaron **ambos** antes de cualquier
escritura identidad `tcp_test_shadow_rev_contabilidad`, rol `arturo`, puerto 55437,
`pg_is_in_recovery=false`, data_directory `cta-isolated-pg`. En esta continuación
no se ejecutaron escrituras ni integración nueva: todavía falta el test integral
`postEvento` con tenant/licencia/plan/período reales, error SQL *dentro del insert*
del motor y falla SQL real de auditoría. Las pruebas existentes de savepoint/outbox
aislados no sustituyen esos escenarios; R2.1–R2.5 permanecen pendientes y no se
activó shadow/enforce/replay.

**Apply focal 2026-09-25 — métricas R2.5 parciales (NO activar shadow):** antes de
escrituras, SQL y Prisma confirmaron base `tcp_test_shadow_rev_contabilidad`, rol
`arturo`, puerto 55437, recovery=false y data_directory `cta-isolated-pg`.
RED integración focal `shadow-outbox.test.ts`: 1/3 falló (`consultarMetricasShadow
is not a function`). GREEN/REFACTOR: 3/3; agregado de lectura sobre outbox
confirmado por tenant/tipo/estado/causa con p95, independiente del ACK, unicidad
de origen y rollback verificados. Unitario `posting-engine.test.ts` 22/22 y ESLint
focal exit 0. `pnpm run typecheck` fue interrumpido a 120 s por timeout mientras
pnpm intentaba resolver registry; intento directo `tsc --noEmit` terminó con
`ChildProcess.kill`, sin resultado válido. No se verificaron todavía postEvento
integral con tenant real, inyección SQL en su insert, auditoría fail-closed SQL real
ni publicación autenticada de métricas: R2.1–R2.5 siguen [ ] y el gate bloqueado.

**Apply 2026-09-24 — outbox parcial, NO activar shadow:** identidad SQL y Prisma de
`tcp_test_shadow_rev_contabilidad`, usuario `arturo`, puerto 55437, data_directory
`cta-isolated-pg`, recovery=false, verificada antes de escrituras. RED integración
`shadow-outbox.test.ts` módulo ausente (exit 1); GREEN rollback/commit/consumo
idempotente (1/1). SQL de `prisma migrate diff --from-url ... --to-schema-datamodel`
revisado: solamente tabla/índices aditivos; migración escrita y aplicada **solo**
en esa DB aislada, luego `prisma generate`. RED unitario posting-engine: 2 fallos
(savepoint no llamado, error SQL no registrado); GREEN 22/22. Integración
`shadow-outbox.test.ts` + `savepoint-writer.test.ts`: 4/4 con SQL `division by zero`,
cero inserción parcial y writer confirmable. Typecheck exit 0; lint focal exit 0.
Outbox es evidencia, NO métricas: falta sink reportable idempotente, test integral
`postEvento` real (tenant/plan/período), prueba de falla SQL de auditoría, y
verificación de coverage/latencia. R2.1–R2.5 permanecen sin marcar; NO activar
shadow/enforce ni replay. Los tests invocaron `pnpm exec vitest run --config
vitest.integration.config.mjs <rutas>` con tres URLs idénticas a la DB aislada,
`ALLOW_DISPOSABLE_TEST_DB=1`; no se usó 5432.

**Apply focal 2026-09-24 — R2.2 parcial, NO activar shadow:** SQL y Prisma
confirmaron antes de escribir base `tcp_test_shadow_rev_contabilidad`, rol `arturo`,
puerto `55437`, `pg_is_in_recovery=false`, mismo `data_directory` del clúster aislado
`cta-isolated-pg`. RED: `pnpm exec vitest run --config vitest.integration.config.mjs
src/features/contabilidad-formal/__integration__/savepoint-writer.test.ts` (con URLs
idénticas a `postgresql://arturo@127.0.0.1:55437/tcp_test_shadow_rev_contabilidad`
y `ALLOW_DISPOSABLE_TEST_DB=1`) falló por módulo inexistente. GREEN: 2/2 en
PostgreSQL real; el test inserta dentro del savepoint, provoca `division by zero`,
comprueba mismo `pg_backend_pid`, cero filas parciales y confirmación posterior del
writer. Helper revierte también un intento exitoso, sin anidamiento Prisma.
`pnpm run typecheck` y ESLint focal exit 0. **Limitación bloqueante:**
`Prisma.TransactionClient` no expone notificación de commit de la transacción exterior;
emitir un contador desde `postEvento` puede contabilizar una operación finalmente
revertida. No se cableó el helper a `postEvento`, no se agregó métrica engañosa ni
se marcó R2.1/R2.2/R2.5: hace falta outbox transaccional persistido en el mismo
writer, consumido después del commit (y tests commit/rollback), antes de activar
shadow. `AUDITORIA_FALLIDA` continúa fail-closed.

**Apply 2026-09-24 — slice auditoría fail-closed (R2.4 parcial):** SQL de solo lectura
`psql -X -w -h 127.0.0.1 -p 55437 -U arturo -d tcp_test_shadow_rev_contabilidad`
y consulta Prisma con URL explícita verificaron DB exacta, rol `arturo`, puerto 55437,
`data_directory` del clúster `cta-isolated-pg` y `pg_is_in_recovery=false` antes de
integración. `pnpm exec vitest run --config vitest.integration.config.mjs
src/features/contabilidad-formal/__integration__/savepoint-writer.test.ts
src/features/contabilidad-formal/__integration__/auditoria-durable.test.ts` con
`DATABASE_URL=DATABASE_URL_TEST=DIRECT_URL` dirigidas exclusivamente a esa DB y
`ALLOW_DISPOSABLE_TEST_DB=1`: 2/2 GREEN; demuestran savepoint SQL recuperable en
backend writer y auditoría durable después de rollback, **no** shadow productivo.
RED `pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts
-t 'shadow no oculta'`: 1 fallo, shadow absorbía excepción de auditoría. GREEN:
guard traduce fallo obligatorio a `AUDITORIA_FALLIDA`, shadow lo propaga;
regresión 63/63 (posting-engine + guard), `pnpm run typecheck` exit 0 y ESLint
focal exit 0. R2.1–R2.5 continúan sin marcar: falta intento shadow de posteo
aislado, telemetría duradera **ligada al commit**, inyección real de error SQL
en el motor y auditoría fail-closed bajo falla PostgreSQL real. No habilitar
shadow/enforce ni inferir autorización de replay.

**Apply 2026-09-24 — laboratorio PostgreSQL aislado (parcial):** clúster nuevo PostgreSQL 17
en `/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/cta-isolated-pg`,
`127.0.0.1:55437`, autenticación trust limitada al clúster local, base exacta
`tcp_test_shadow_rev_contabilidad`. SQL y Prisma confirmaron `current_database`,
puerto `55437`, `data_directory` exacto y `pg_is_in_recovery=false` antes de preparar
esquema. Se revisó el diff desde vacío contra `prisma/schema.prisma`; como el árbol
de migraciones no contiene migración de los seis modelos formales, se usó `prisma db push`
**únicamente en esta DB efímera**, sin alterar migraciones ni 5432. Runner con
`DATABASE_URL=DATABASE_URL_TEST=DIRECT_URL` passwordless y guard explícito activo.
`pnpm test:integration -- <ruta>` ejecuta *toda* la suite (12 fallos/82 tests;
posting-engine legacy omite por licencia ausente, y kardex exige trigger no creado por
db push); para focalizar se usó `pnpm exec vitest run --config
vitest.integration.config.mjs <rutas>`. Savepoint existente: GREEN 1/1, backend
idéntico tras error SQL real. Nuevo test `auditoria-durable.test.ts`: RED 1/2 por
expectativa de campo `payloadJson` equivocada (schema usa `payload`); corregida la
expectativa, GREEN/REFACTOR 2/2 (savepoint + auditoría persiste actor/origen/período
tras rollback del writer). `pnpm run typecheck` y ESLint focal: exit 0. **No hay RED
del comportamiento productivo ni prueba de telemetría ligada al commit ni fallo cerrado
ante falla de auditoría**; R2.1–R2.5 permanecen pendientes, shadow/enforce no habilitados.
Clúster dejado encendido para continuidad; no borrar directorio sin confirmar pertenencia.

**Apply 2026-09-24 — prueba Prisma sin contraseña, bloqueada antes de esquema:**
con `DATABASE_URL` temporal en el proceso apuntando exclusivamente a
`postgres@localhost:5432/tcp_test_shadow_rev_contabilidad` (sin contraseña),
`PrismaClient.$queryRawUnsafe` de solo lectura devolvió
`PrismaClientInitializationError`: autenticación fallida para `postgres`.
No se mostró la URL ni se leyó `~/.pgpass`; Prisma no autenticó usando las
credenciales libpq disponibles para `psql -w`. La identidad de Prisma no pudo
validarse; por seguridad no se ejecutaron migraciones, `db push` ni pruebas
contra esta u otra base. La autorización de preparar el esquema en esta BD
descartable sigue vigente, condicionada a una URL autenticada que permita
verificar identidad exacta con Prisma antes de cualquier escritura. R1.4 y
R2.1–R2.4 permanecen abiertos; el test savepoint existente no prueba auditoría
durable ni telemetría ligada al commit.

**Apply 2026-09-24 — conexión identificada, integración bloqueada:**
`psql -w -h localhost -p 5432 -U postgres -d tcp_test_shadow_rev_contabilidad -X`
autenticó sin leer ni imprimir credenciales. La consulta de solo lectura confirmó
`current_database() = tcp_test_shadow_rev_contabilidad`, `current_user = postgres`,
`pg_is_in_recovery() = false`, PostgreSQL 17.6 y esquema actual `public`;
`information_schema.tables` reporta cero tablas en ese esquema. El runner exige
`DATABASE_URL = DATABASE_URL_TEST` y permiso explícito, y Prisma usa URL de
conexión (`prisma.config.ts`), no una configuración libpq de `.pgpass` demostrada.
No se suministró a Prisma una URL autenticada sin secretos, ni hay esquema de la
aplicación en la base autorizada. No ejecutar migraciones/db push para crear ese
esquema implícitamente ni dirigir el runner a otra base: integración savepoint y
auditoría durable continúan pendientes; ningún test RED/GREEN de PostgreSQL
ni escritura se realizó. R1.4 y R2.1–R2.4 permanecen sin marcar.

**Apply 2026-09-24 — nueva autorización, sin conexión ni escritura:** el único nombre
autorizado ahora es `tcp_test_shadow_rev_contabilidad` (guiones bajos); las menciones
anteriores de `tcp_test_shadow_rev-contabilidad` son históricas y ya no autorizan
ese destino. El guard `scripts/ci/disposable-database.mjs` acepta sintácticamente
el nuevo nombre con `ALLOW_DISPOSABLE_TEST_DB=1`, pero exige además
host loopback, puerto explícito y URLs `DATABASE_URL`/`DATABASE_URL_TEST` iguales.
En este proceso `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSFILE`,
`PGPASSWORD` y las tres URLs de DB están ausentes (solo se consultó presencia).
`~/.pgpass` existe, es archivo regular del usuario y tiene permisos `0600` según
metadata; no se leyó ni modificó. Falta que el usuario indique host, puerto y
usuario de ese clúster: no se asumieron defaults ni se invocó `psql`; identidad
`current_database()/current_user/inet_server_addr()/pg_is_in_recovery()` no
verificada. `.pgpass` es texto plano, no cifrado. Antes de configurar runner se
debe comprobar si Prisma de este proyecto admite autenticación via `.pgpass`;
libpq/psql sí la usan, pero no se presupone equivalencia. Sin confirmación de
identidad y aislamiento de clúster no hay migraciones, db push, pruebas de
integración ni shadow/enforce. R1.4 y R2.1–R2.4 siguen pendientes.

**Apply 2026-09-24 — comprobación de conexión y runner, sin escritura:** se verificó solo
presencia de variables (sin imprimir valores): `DATABASE_URL_TEST`, `DATABASE_URL`,
`DIRECT_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` ausentes.
`pg_isready -h 127.0.0.1 -p 5432` responde accepting connections, pero
`psql -X -w -d 'tcp_test_shadow_rev-contabilidad' -Atqc 'SELECT current_database()'`
devuelve `fe_sendauth: no password supplied`; identidad no comprobada. Existen
`psql`, `pg_isready`, `pg_ctl`, `initdb` y `createdb`; Docker no está disponible.
El runner `vitest.integration.config.mjs` llama `assertDisposableDatabase` antes de
correr tests: exige `ALLOW_DISPOSABLE_TEST_DB=1`, URLs iguales y nombre que cumpla
`/^\/tcp_test_[a-z0-9_]+$/`; **rechaza el nombre exacto autorizado** por su guion.
Incluso un clúster aislado descartable requeriría corregir y probar ese guard
primero, verificar `current_database()` y preparar esquema sin tocar otra base.
No se abrió conexión identificada, no se ejecutó integración, migración, db push,
savepoint, auditoría durable ni typecheck; no hay evidencia RED/GREEN PostgreSQL.
R2.1–R2.4 y la validación R0.2 continúan pendientes. No habilitar shadow/enforce.

**Reanudación 2026-09-23 tras timeout — bloqueada sin escritura:** autorización limitada a
`tcp_test_shadow_rev-contabilidad`. Se verificó únicamente presencia de variables (sin mostrar
valores): `DATABASE_URL_TEST`, `DATABASE_URL`, `DIRECT_URL`, `PGHOST`, `PGPORT`, `PGUSER`,
`PGDATABASE`, `PGPASSWORD` y `ALLOW_DISPOSABLE_TEST_DB` están ausentes en este proceso.
Consulta de identidad de solo lectura dirigida explícitamente a esa base con
`psql -X -w -d 'tcp_test_shadow_rev-contabilidad' -Atqc
"SELECT current_database(), inet_server_addr(), inet_server_port(), current_user"`
falló antes de autenticar: `fe_sendauth: no password supplied` (socket local 5432).
No se verificó identidad ni esquema; no se ejecutó integración savepoint, prueba de auditoría
duradera, migración ni operación de escritura. No usar `test_db`, otras bases ni credenciales
de archivos `.env`. R1.4/R2.1–R2.4 continúan pendientes; no habilitar shadow/enforce.
Para reanudar se requiere conexión segura suministrada para la base exacta, verificar identidad
y guard/aislamiento del runner **antes** de cualquier operación que pueda escribir; comprobar
además que la prueba de auditoría duradera exista y no dependa de un rollback que revierta
su propio registro. El test `savepoint-writer.test.ts` actual solo comprueba recuperación SQL.

**Intento de integración 2026-09-23 — bloqueado antes de conectar:** usuario autorizó
exclusivamente `tcp_test_shadow_rev-contabilidad`. En este proceso no están definidos
`DATABASE_URL_TEST`, `PGHOST`, `PGPORT`, `PGUSER` ni `PGDATABASE` (se comprobó solo su
presencia, sin leer archivos de secretos). No se puede verificar host, puerto, rol,
identidad de la base ni contenido/esquema previo: no se abrió conexión, no se ejecutó
Vitest de integración, savepoint, auditoría durable, migración ni db push. La base
genérica `test_db` de los comandos de ejemplo y el servidor 5432 no identificado no
son destinos autorizados. R1.4 y R2.1–R2.4 permanecen pendientes. Siguiente paso:
recibir una conexión segura para la base indicada, validar identidad con consultas
de solo lectura y revisar configuración de aislamiento del runner antes de cualquier
test/migración; no publicar un resultado GREEN sin evidencia PostgreSQL real.

**Apply 2026-09-23 — bloqueo PostgreSQL:** `DATABASE_URL_TEST` ausente; `pg_isready
-h 127.0.0.1 -p 5432` responde «accepting connections», pero no identifica
una base descartable autorizada ni provee acceso seguro. No se corrieron pruebas
de integración, no se activó shadow/enforce. Causa a investigar con integración
real: `PeriodoGuard.assertWritable` usa Prisma raíz para resolver/cachear período
y para registrar auditoría mientras el writer mantiene un `TransactionClient`;
un INSERT no confirmado del writer puede retener locks que la conexión raíz
necesita (o la raíz puede observar un estado anterior). No atribuir un timeout a
savepoints antes de medir conexiones/locks y los límites de visibilidad bajo
PostgreSQL. Un savepoint ejecutado via `tx.$executeRaw` puede aislar el error SQL
del writer, pero no hace durable una auditoría en otra conexión ni garantiza
telemetría ligada al commit. R2.1–R2.4 continúan abiertos.
Prueba diagnóstica pendiente de ejecución:
`src/features/contabilidad-formal/__integration__/savepoint-writer.test.ts`
comprueba `pg_backend_pid()` antes/después de un error SQL y recuperación con
`ROLLBACK TO SAVEPOINT`; no demuestra por sí sola auditoría durable ni shadow
de asientos. Ejecutar solo bajo el guard de DB descartable del runner.

**Apply focal 2026-09-23 (R2.3/R2.4 parciales):** RED
`pnpm exec vitest run src/features/contabilidad-formal/__tests__/posting-engine.test.ts
src/lib/services/__tests__/periodo-contable-guard.test.ts` exit 1 (2 fallos:
`assertWritable` no recibía actor/origen y `auditoriaPeriodo.create` no era invocado).
GREEN 62/62 tests unitarios: el posteo habilitado pasa actor/origen al guard,
que registra una sola vez el período cerrado y motivo mediante Prisma raíz,
fuera del `TransactionClient` del writer; error de auditoría propaga. Sin
`DATABASE_URL_TEST` disponible en el entorno: **no se ejecutó integración ni
se probó durabilidad ante rollback real**. R2.3/R2.4 siguen abiertos hasta
integración PostgreSQL y revisión de todos los callers/alcances.

**Cierre R2 (gate shadow) — verificado en slice 2026-10-02 (Apply, TDD con RED → GREEN → REFACTOR):**
clúster aislado recreado (el anterior fue limpiado por el SO): PostgreSQL 17.11 Homebrew en
`/private/var/folders/n_/.../T/opencode/cta-isolated-pg`, auth trust loopback, puerto
`127.0.0.1:55437`; identidad confirmada **por SQL (`psql -X -w`) y por Prisma**, ambas de
solo lectura y ANTES de cualquier escritura: DB exacta `tcp_test_shadow_rev_contabilidad`,
rol `arturo`, `pg_is_in_recovery=false`, datadir `cta-isolated-pg`, 0 tablas;
`prisma migrate deploy` aplicó 135/135 migraciones **solo** en esa DB (nunca 5432).
RED reproducido: `pnpm exec vitest run src/features/contabilidad-formal/__tests__/cierre-formal.test.ts
src/features/contabilidad-formal/__tests__/writers-matrix.test.ts` → 4 fallos (mock viejo:
`periodoContable.findUnique`/`aperturaPeriodo.findFirst` ausentes; matriz esperaba 37 callsites
vs 39 reales). GREEN mínimo: mock corregido (el servicio quedó verificado correcto —
consulta tenant-scoped y defensas documentadas intactas, cubiertas por
`cierre-formal-service.test.ts`); matriz certificada: los 2 callsites nuevos son legítimos
(dentro de tx, actor real propagado, tenant-scoped, origen único) y quedaron documentados
con identidad exacta en las filas 30 (`facturacion-workflow.ts:761`, VENTA_CONTADO cobro
parcial mixto) y 31 (`venta-mutation-service.ts:498`, COSTO_VENTA_DEVENGADO no valorizado
solo-shadow, exclusivo con `:480`) de `matriz-writers-r0.5.md`; apéndice reproducible
actualizado a **39 callsites / 24 archivos** con línea y evento por archivo. Ningún callsite
ilegítimo detectado; no se corrigió código productivo. REFACTOR/regresión en este slice:
- unitaria completa `pnpm exec vitest run src/features/contabilidad-formal` → **30 archivos,
  365/365** verdes;
- integración (`vitest.integration.config.mjs`, `DATABASE_URL=DATABASE_URL_TEST=DIRECT_URL=
  postgresql://arturo@127.0.0.1:55437/tcp_test_shadow_rev_contabilidad`,
  `ALLOW_DISPOSABLE_TEST_DB=1`) → **56/56** en 9 archivos: shadow-outbox 3/3,
  post-evento-shadow-sql 3/3, post-evento-auditoria-sql 2/2, auditoria-durable 2/2,
  savepoint-writer 2/2, R2.3 focal PeriodoGuard
  (`post-evento-auditoria-durable-sale.test.ts`) 2/2, R2.1 focal `createVentaAction`
  (`formal-shadow-cash-sale.test.ts`) 8/8, cierre-formal 5/5, posting-engine (R1.4) 29/29;
- unitarios focales R2.5: posting-engine 50/50 + actions-metricas-shadow 4/4; guard
  unitario 42/42;
- typecheck `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit
  --incremental false` exit 0; ESLint focal (archivos tocados) exit 0; `git diff --check`
  exit 0.
Los modos `shadow`/`enforce` solo se activaron dentro del alcance efímero de los tests de
integración, como diseñado; **no se habilitó shadow/enforce/replay en código, no hubo
commits ni push, y no se tocó 5432**. La certificación de permisos por caller sigue fila
por fila en la matriz: **R0.5 global, R6 y el gate operacional R7 permanecen [ ]**.
Clúster aislado dejado encendido para continuidad; no borrar el directorio sin confirmar
pertenencia.

- [x] R2.1 **RED:** en `src/features/contabilidad-formal/__integration__/posting-engine.test.ts`
  inyectar fallo después de construir/iniciar inserción: venta confirma, cero asientos/líneas parciales,
  causa durable ligada al commit; no afirmar éxito si falla telemetría. Ejecutar comando R1.4.
  *(Cierre 02-10: RED/GREEN originales del 30-09 sostenidos por re-ejecución en este slice —
  `formal-shadow-cash-sale.test.ts` 8/8 en DB aislada: falla SQL en asiento → `ERROR_SHADOW`
  durable y venta conservada sin asiento parcial; falla de inserción del outbox → rollback total
  de venta/factura/reconciliación/saldo/inventario, i.e. no se afirma éxito si falla telemetría.)*
- [x] R2.2 **GREEN:** en `src/features/contabilidad-formal/services/posting-engine.ts` implementar
  aislamiento R0.2 sin `catch` de SQL seguido de queries en tx abortada ni transacción Prisma anidada;
  agregar persistencia/entrega de telemetría ligada al commit en esquema/migración aditiva
  `prisma/schema.prisma` y `prisma/migrations/<timestamp>_contabilidad_formal_remediacion/migration.sql`
  si la arquitectura elegida la necesita. Revisar SQL generado con `--create-only` antes de aplicar.
  *(Cierre 02-10: savepoint-writer 2/2 — mismo `pg_backend_pid`, rollback al savepoint, sin tx
  Prisma anidada — y shadow-outbox 3/3 — outbox persistido en el mismo writer, visible solo
  post-commit, consumo idempotente — re-ejecutados en DB aislada en este slice.)*
- [x] R2.3 **RED:** en `src/features/contabilidad-formal/__integration__/posting-engine.test.ts`
  verificar `INTENTO_BYPASS` con actor humano/servicio, tenant, período y causa pese a rollback del writer,
  y fallo cerrado si no puede auditarse; correr comando R1.4 y registrar RED.
  *(Cierre 02-10: auditoria-durable 2/2 — actor humano y de servicio con tenant/período/origen/causa
  pese a rollback real — más 2/2 del focal PeriodoGuard (`post-evento-auditoria-durable-sale`):
  `INTENTO_BYPASS` sobrevive al rollback y el fallo real del INSERT de auditoría propaga
  `AUDITORIA_FALLIDA` revirtiendo el writer; más post-evento-auditoria-sql 2/2 en shadow y
  enforce. Todo re-ejecutado en DB aislada en este slice.)*
- [x] R2.4 **GREEN/REFACTOR:** en `src/lib/services/periodo-contable-guard.ts` y callers inventariados
  R0.5 propagar `{tenantId,actorId,actorTipo,tipoOperacion,origen,fecha}` y conectar
  `AuditoriaPeriodo` fuera del tx revertido; verificar pertenencia y permisos servidor, no actor `system`
  para usuarios. Repetir R1.4 y unitarios del guard, `pnpm run typecheck`.
  *(Cierre 02-10: auditoría registrada vía Prisma raíz fuera del `TransactionClient` probada con
  rollback real (auditoria-durable/post-evento-auditoria-sql, re-ejecutados); guard unitario 42/42;
  R1.4 re-ejecutado (posting-engine integración 29/29); typecheck completo exit 0. La matriz R0.5
  quedó actualizada y estructuralmente certificada (39 callsites/24 archivos, identidad exacta por
  archivo); la certificación de permisos por caller continúa fila por fila bajo R0.5/R6, que siguen
  abiertos.)*
- [x] R2.5 **RED→GREEN→REFACTOR:** tests en
  `src/features/contabilidad-formal/__tests__/posting-engine.test.ts` para eventos/causa/latencia por
  tenant y tipo, `off` no-op y shadow sin plan; implementar contadores durables/reportables sin crear
  `actions-health.ts` ficticio (ubicar action existente o crear solo si se justifica). Correr R1.1 y R1.4.
  *(Cierre 02-10: posting-engine 50/50 (modos, off no-op, shadow sin plan/rol), action real
  `actions-metricas-shadow.ts` 4/4 (consulta autenticada con `financiero.auditoria.ver`,
  agregación por tenant/tipo/estado/causa con p95) y shadow-outbox 3/3 SQL — re-ejecutados en
  este slice; no se creó `actions-health.ts` ficticio.)*

### Fase R3 — Cierre y apertura (tras R1/R2)

**Apply slice independiente 2026-09-23 (R3.1/R3.2 parcial):** RED
`pnpm exec vitest run src/features/contabilidad-formal/__tests__/cierre-formal-service.test.ts`
exit 1 (`OMITIDO` para saldo inverso subcentésimo). GREEN/REFACTOR: saldo
firmado Decimal, magnitudes positivas, contrapartida de pérdida y cuadre exacto
en cierre; test focal y regresión de cierre/apertura existentes. R3.1/R3.2
siguen pendientes de fecha/rango, período inmediato, apertura y tests adicionales;
ninguna transición ni integración DB validada.

- [x] R3.1 **RED:** en `src/features/contabilidad-formal/__tests__/cierre-formal-service.test.ts`
  cubierto (23/23 el 2026-10-03): utilidad, pérdida, cero, saldo inverso, fecha fuera de rango,
  período inmediato ausente, doble traspaso y apertura descuadrada; comandos y cierre abajo.
- [x] R3.2 **GREEN:** `services/cierre-formal-service.ts` con Decimal firmado (Prisma.Decimal),
  magnitudes positivas, fecha contable dentro del período, contrapartida según utilidad/pérdida,
  apertura desde anterior contiguo APROBADO del mismo tenant; validado por suite completa
  365/365 (30 archivos) + integración 71/71 (12 archivos) el 2026-10-03.
- [x] R3.3 **RED:** integración en PostgreSQL desechable (55437, DB `tcp_test_shadow_rev_contabilidad`):
  `__integration__/cierre-formal.test.ts` 5/5 (rollback aprobación/autocierre, no-manager,
  compatibilidad off/shadow) + NUEVO `__integration__/cierre-apertura-positiva.test.ts` 2/2
  (transición POSITIVA completa cierre→aprobación→apertura con libros cuadrados, resultado
  en cero, traspaso único y hash encadenado; y rollover rechazado sin cierre inmediato aprobado
  sin dejar período). El caso positivo pasó a la primera: cobertura nueva, sin RED de producto.
- [x] R3.4 **GREEN/REFACTOR:** `actions-periodos.ts` — cierre, aprobación y apertura emiten el
  asiento formal en el mismo tx Serializable bajo `acquireAccountingTenantLock` con
  `requireFormalAsientoEnforce`; probado end-to-end por `cierre-apertura-positiva.test.ts`;
  `tsc --noEmit --incremental false` (heap 8192) exit 0 y ESLint focal OK el 2026-10-03.

**Avance focal R2/R3 (2026-09-29; sin cierre global):** R2 tiene prueba SQL de savepoint
en la segunda línea, rollback sin asiento parcial, outbox `ERROR_SHADOW` ligado al commit
y fallo cerrado si falla su inserción (3/3). La auditoría durable cubre actor humano y
servicio, tenant/período/origen/causa pese a rollback (4/4 SQL; 42 unitarios del guard).
La agregación durable del outbox pasó 3/3 SQL (tenant, causa, upsert y p95) y 54 unitarios
focales de motor/action. Son pruebas del motor/guard con transacción Prisma, **no** una venta
de negocio completa ni certificación de los 37 callsites R0.5: R2.1–R2.4 siguen `[ ]`.

R3 corrigió saldos firmados Decimal, fecha de cierre, tenant y período anterior contiguo,
proveniencia de apertura, cuadre exacto y validación integral del cierre previo (22/22
unitarios). Aprobación manual, autocierre y compatibilidad `off`/`shadow` tienen 4/4 SQL
en PostgreSQL desechable: `enforce` revierte una transición cuyo asiento formal se omite.
Typecheck habitual, ESLint focal y diff-check pasan; la instancia desechable fue detenida.
**R3.1–R3.4 siguen `[ ]`**: falta probar transición positiva completa de apertura/cierre;
el productor actual de `AperturaPeriodo` mezcla monedas sin valoración funcional verificable
y deja rubros en cero por defecto, por lo que no puede acreditarse una apertura confiable.
También hay conflicto entre la omisión técnica de un cierre sin movimientos y el requisito
de cierre obligatorio incluso para resultado cero; no se cambia esa política por inferencia.
No habilitar `shadow`, `enforce` ni replay.

**R3 contrato de apertura revisada (implementación parcial; inicial manual CUP aprobado):**
no reutilizar `AperturaPeriodo` agregado como fuente confiable. Su productor actual mezcla
`saldosPorMoneda` con suma `number`, omite rubros como cero y en datos vivos suma banco/CxC/CxP
sin moneda/valoración verificable. Las filas existentes quedan legacy no aprobadas. No usar
esos agregados como evidencia de esta rebanada.

**Avance focal 2026-09-30:** modelo aditivo y migración no desplegada, preflight Decimal,
permisos granulares y flujo revisado implementados. El digest liga fecha efectiva; `TRUSTED`
se rechaza sin resolvedor autoritativo. La aprobación inicial manual CUP revalida ambos actores
y permisos en la transacción, exige que sea el primer período, verifica digest/cuentas/cuadre,
y registra un asiento único e idempotente. Hay acciones/UI para capturar declaración manual,
presentar y aprobar; el backend impide nueva revisión tras aprobación y el contexto usa
`PeriodoContable.fechaInicio` como corte inicial. Pasaron 48/48 unitarios focales, typecheck,
ESLint focal y revisión independiente; integración PostgreSQL desechable pasó 3/3 con asiento,
idempotencia, rollback y carrera de aprobación. Esto **no** acredita R3.5–R3.9 completos: no hay revalidación
autoritativa de FX, rollover desde cierre ni política resuelta de cierre sin actividad.

**R2.1 focal 2026-09-30:** se ejercitó `createVentaAction` real para venta contado con
factura/cobro `contra_pago` en PostgreSQL desechable. Prueba 1 inyecta falla SQL en asiento
`reconciliacion_venta`, exige la causa exacta en outbox `ERROR_SHADOW`, conserva venta y no deja
asiento parcial. Prueba 2 falla inserción del outbox y confirma rollback de venta, factura,
reconciliación, saldo bancario e inventario: 2/2. StockMoveLine es append-only, por lo que el
grafo único de fixture queda en la DB desechable; no borrar ni sortear ese guard. R2.1 completo
solo en este writer, no global. R2.2–R2.5 y R0.5 siguen sin certificación global.

**R2.3 focal 2026-09-30:** integración PostgreSQL desechable de `PeriodoGuard` dentro de
una transacción escritora simulada pasó 2/2: `INTENTO_BYPASS` sobrevive al rollback; el fallo
real del INSERT de auditoría propaga `AUDITORIA_FALLIDA` y revierte el writer. No ejecuta una
venta real ni certifica el wiring de todos los callers; R2.3/R2.4 continúan abiertos globalmente.

**R2.5 focal 2026-09-30:** `posting-engine.test.ts` (50/50) verifica modos, error de plan y no-op
`off`; `actions-metricas-shadow.test.ts` (4/4) cubre consulta/permiso; `shadow-outbox.test.ts`
pasó 3/3 SQL en PostgreSQL desechable con aislamiento tenant y p95. El test SQL complementa, pero
no sustituye, cobertura de los 37 callsites ni un gate global de R2.5.

**R3 rollover focal 2026-09-30:** se corrigió la adyacencia para comparar días civiles UTC
inclusivos (fin a medianoche o fin de día) y se bloquean solapamientos del mismo tenant/tipo
antes de elegir predecesor. `cierre-formal-service.test.ts` pasó 23/23; la integración focal de
`posting-engine.test.ts` pasó 29/29 en PostgreSQL desechable. El test afirma explícitamente los
filtros de tenant, tipo y exclusión del período actual. Esto no acredita la transición positiva
completa exigida por R3.3/R3.4 ni cierra R3 globalmente.

- [x] R3.5 **Modelo aditivo:** `AperturaRevision` (append-only, autoridad de
  estado/actor/permisos/versión/digest) + `LineaAperturaPeriodo` (FK compuesta a la revisión,
  Decimal(20,4) importes, tasa Decimal(20,10), fuente-evidencia) en schema + migración
  `20260930120000_formal_opening_evidence` aplicada y verificada en la DB desechable;
  `opening-schema.test.ts` 3/3 estructural; sin backfill legacy (2026-10-03).
- [x] R3.6 **Captura y procedencia:** clasificación MANUAL de rubros con evidencia, CUP nativo
  funcional=nativo tasa 1/null, TRUSTED rechazado sin resolvedor autoritativo, bloqueo de
  FX fabricado, precisión >4 decimales rechazada (sin redondeo); `apertura-evidencia.test.ts`
  13/13 + `apertura-revision-service.test.ts` 23/23 el 2026-10-03.
- [x] R3.7 **Presentación y revisión:** triggers `apertura_revisiones_protect_lifecycle` y
  `apertura_revisiones_lineas_immutable` rechazan UPDATE/DELETE en revisiones presentadas/
  aprobadas y mutación de líneas fuera de BORRADOR — NUEVO test de comportamiento contra DB real
  en `apertura-revision-approval.test.ts` (4/4) el 2026-10-03; digest SHA-256 con dominio/versión/
  campos ordenados/fechas UTC/Decimal canónico; permisos `financiero.apertura.presentar` y
  `.aprobar` con actor distinto revalidados en tx. **CONFIRMADO por el usuario el 2026-10-03:**
  el servicio rechaza crear una revisión nueva tras la aprobación ('No se pueden crear revisiones
  después de aprobar la apertura'); la corrección post-aprobación se hace a nivel de asiento
  (asiento inverso), no mediante revisión sustitutiva. El detalle original del contrato
  ("revisión append-only que referencie la sustituida") queda sustituido por este comportamiento.
- [x] R3.8 **Atomicidad:** aprobación de revisión + asiento único en un tx bajo lock; rollback
  con fallo inyectado en INSERT del asiento no deja revisión aprobada ni asiento; idempotencia
  y carrera serializada (1 ganadora/1 rechazada); cabecera legacy no aprobable. Cubierto por
  `apertura-revision-service.test.ts` 23/23 + `apertura-revision-approval.test.ts` 4/4 en
  PostgreSQL desechable el 2026-10-03.
- [x] R3.9 **Primer período vs rollover:** apertura inicial solo vía revisión manual aprobada
  (servicio exige primer período); rollover vía `generarAsientoApertura` exige predecesor
  contiguo APROBADO del mismo tenant con `origenPeriodoId` coincidente, cierre formal cuadrado
  y traspaso una sola vez. Positivo E2E + negativo (P2 sin aprobar → P3 rechazado sin
  persistir período) en `cierre-apertura-positiva.test.ts` 2/2 el 2026-10-03; adyacencia civil
  UTC en `cierre-formal-service.test.ts` 23/23.

**Cierre formal R3 (2026-10-03):** tras completar las tres brechas (transición positiva,
comportamiento real de triggers, rollover E2E) la corrida de cierre quedó: unitarios
`pnpm exec vitest run src/features/contabilidad-formal` → 365/365 (30 archivos); integración
DATABASE_URL_TEST=postgresql://arturo@127.0.0.1:55437/tcp_test_shadow_rev_contabilidad +
ALLOW_DISPOSABLE_TEST_DB=1 con `vitest.integration.config.mjs` sobre `__integration__` →
71/71 (12 archivos); typecheck heap 8192 exit 0; ESLint focal de los dos archivos tocados OK;
`git diff --check` OK. Confirmación del usuario 2026-10-03: el detalle de sustitución de R3.7
queda sustituido por el comportamiento vigente (sin revisión post-aprobación; la corrección
posterior es asiento inverso).
Identidad de la DB verificada por SQL y Prisma (solo lectura) antes de escribir; instancia
5432 intacta. No se habilitó shadow/enforce/replay en código; no hubo commits.

- [x] R3.10 **Decidido por el usuario (2026-09-30):** el cierre de un período sin actividad es
  opcional, pero en `enforce` ningún período pasa a `CERRADO`/`APROBADO` sin un asiento formal de
  cierre. Si no puede producirse, se rechaza la transición y se conserva el estado previo; no se
  crea asiento cero. La inactividad se determina por falta de líneas de resultado contabilizadas
  candidatas a cierre, nunca por neto cero solamente; movimientos compensatorios aún requieren
  formalización. Esto decide la política, no marca R3.1–R3.9 ni el cierre global como completos.
  Verificación PostgreSQL desechable 2026-09-30: las 127 migraciones se aplicaron a
  `tcp_test_r3_optional_close_20260930` (localhost:5433) y `cierre-formal.test.ts` pasó 5/5:
  rollback al faltar asiento en aprobación/cierre, compatibilidad `off`/`shadow` e idempotencia.
  No se aplicó ninguna migración a una base persistente.

### Fase R4 — Conciliación y libros (tras R0.1/R0.4 y R1/R3)

**Apply focal R0.4 (2026-09-26):** RED 3/3 casos de cobertura; GREEN agrega
`NO_EVALUABLE` por corte parcial/fuente no comparable, requiere los dos roles de
tesorería y expone `enforceReady: false`. La UI diferencia «No evaluable» de
«Diverge», muestra la causa y estado agregado. Revisión independiente sin P1/P2.
`pnpm exec vitest run src/features/contabilidad-formal/__tests__/libros.test.ts src/features/contabilidad-formal/components/conciliacion-panel.test.tsx`
13/13; ESLint focal y `git diff --check` verdes. La pendiente viva de R4 queda
acotada por la integración/comparabilidad indicada en R4.2.

- [x] R4.1 **RED→GREEN:** ampliar `src/features/contabilidad-formal/__tests__/libros.test.ts` para saldos
  Decimal, diferencia real no conforme, período/moneda no comparables y `SIN_COBERTURA` (también
  período parcial); ejecutar `pnpm exec vitest run src/features/contabilidad-formal/__tests__/libros.test.ts`.
- [x] R4.2 **GREEN:** en `src/features/contabilidad-formal/services/conciliacion-cruzada-service.ts`
  calcular sin `Number`/epsilon, alinear fecha/moneda y cobertura a R0.4; en
  `src/features/contabilidad-formal/actions-libros.ts` publicar estados distinguibles sin declarar verde
  rubros no comparables; conservar reportes caja actuales.
- [x] R4.3 **RED→GREEN→REFACTOR:** tests Testing Library + `vitest-axe` en tests adyacentes de
  `src/features/contabilidad-formal/components/conciliacion-panel.tsx` y
  `components/libros-page-client.tsx` para «Sin cobertura», diferencias, foco/ARIA y toast neutro;
  actualizar solo estados necesarios. Ejecutar
  `pnpm exec vitest run src/features/contabilidad-formal/components` y repetir R4.1.

**Cierre de evidencia R4.1/R4.3 (2026-09-27):** R4.1 quedó cubierto con 16/16 casos de libros
(Decimal exacto, diferencia no conforme, fuentes/monedas no comparables y corte parcial). R4.3
quedó cubierto con 4 tests adyacentes del panel y 3 de la página: Testing Library, axe sin
violaciones, `role=status` con `aria-live`, foco del botón Actualizar, diferencias y `Sin cobertura`.
El flujo no tiene toast; los errores se exponen como `role=alert` con copy neutro. La suite focal
libros+panel+acciones pasó 28/28 y la suite del directorio components 4/4; el warning de canvas
de jsdom/axe es baseline y no falla las pruebas.

**Integración real R4.2 (2026-09-27, parcial):** se añadió
`src/features/contabilidad-formal/__integration__/conciliacion-cruzada.test.ts`. Con la guardia
de base desechable y PostgreSQL aislado en `127.0.0.1:55437`, la corrida directa pasó 3/3:
conciliación CUP exacta y aislamiento entre tenants, saldo extranjero activo bloqueado como
`TESORERIA=NO_EVALUABLE`, y corte parcial con importes `null`/`enforceReady=false`. La prueba
usa fixtures independientes por caso y limpieza tenant-scoped. Esto fortalece la evidencia de
tesorería, FX y corte, pero R4.2 no se cierra: CxC sigue sin moneda/valoración funcional persistida
y falta cobertura real comparable de CxP/CxC. La invocación amplia del script de integración no
se usa como evidencia global: ejecutó suites ajenas y expuso 12 fallos baseline no relacionados.

**Cierre técnico R4.2 (2026-09-29):** conciliación dentro de una única transacción
`RepeatableRead`, aritmética Decimal exacta y roles/cuentas activos del tenant. Sin política
monetaria válida se informa `XXX` (moneda desconocida), importes `null` y `NO_EVALUABLE`, nunca
CUP inferido. CxC compara valor contable inicial y descarga proporcional de principal; no resta
cobros funcionales que incluyen diferencias de cambio. Exige valoración persistida y los diez
campos de evidencia FX canónica consistentes; vínculos de factura/servicio no resolubles en el
tenant y reconciliaciones sin mapeo de pago probado permanecen no evaluables, incluso con saldo
nominal cero. CxP requiere moneda funcional explícita, agregados consistentes y ausencia de pagos
raw/historial sin evidencia monetaria; una deuda pagada no se presume cubierta por estar en cero.
La acción exige `financiero.contabilidad.acceder` antes de leer; la UI indica «Apto para revisión
de Enforce», no activación. Se conservaron los reportes caja existentes.

Verificación final: **40/40** pruebas focales de libros, acciones, panel y página; **5/5** SQL real
sobre `tcp_test_r4_closure` desechable, PostgreSQL 17 en `127.0.0.1:55437`, con 126 migraciones.
Typecheck normal y ESLint focal verdes; revisión independiente GPT-6 Luna detectó y verificó la
corrección de bypasses de saldo cero, vínculos ajenos y evidencia JSON incompleta. Axe no detecta
violaciones en las pruebas; su advertencia canvas de jsdom sigue siendo baseline.

Este cierre acredita el contrato fail-closed de R4, **no cobertura universal de CxC/CxP**: la
normalización de todos los writers, backfill con evidencia y valoración de pagos quedan en sus
gates R0.5/R6/R7. Los rubros sin esa evidencia bloquean `enforceReady`. No se certifica la suite
global ni se habilitan `shadow`, `enforce` o replay, y no se cierra el objetivo completo.

### Fase R5 — Replay autorizado (tras R0.1/R0.3/R0.4 y R1–R4)

**Apply focal 2026-09-26 (R5.1/R5.2 parcial):** tests RED 2/3 detectaron
`null`→0 y moneda ausente→CUP; RED adicional 2/6 detectó regresiones en
transferencia (`monedaOrigen`) y CUP explícito sin `montoConvertido`; revisión
posterior reprodujo RED 1/7 por usar `montoDestino` extranjero como funcional en
CUP→FX, corregido para heredar `montoConvertido` persistido. GREEN
`pnpm exec vitest run src/features/contabilidad-formal/__tests__/replay-backfill-service.test.ts src/features/contabilidad-formal/__tests__/replay-backfill.test.ts`
13/13; `pnpm run typecheck` exit 0 tras el ajuste de precisión; `git diff --check`
limpio. RED adicional detectó importes funcionales con más de cuatro decimales;
GREEN los omite con `PRECISION_FUNCIONAL_INVALIDA`. El monto funcional ahora
conserva Decimal persistido; montos de origen inseguros para `number` se omiten.
El plan omite con causa monto/moneda/FX/costo no verificables y ejecución continúa
las fuentes válidas. **No marcar R5.1/R5.2:** el contrato de monto original y tasa
todavía usa `number`; faltan semánticas completas de valoración/ambigüedad,
preflight persistido, digest conectado a aprobación, y pruebas PostgreSQL. Replay bloqueado.

**Digest canónico R5 (slice puro, 2026-09-27):** `replay-preflight-digest.ts`
genera SHA-256 versionado de tenant/período/fuentes/valoración/FX/clasificación/
omisiones; decimales exactos sin `Number`, orden estable, fechas con zona obligatoria
y submilisegundos rechazados, identidades duplicadas rechazadas. RED→GREEN; 19/19
tests, typecheck/ESLint/diff-check verdes; revisión independiente sin P1/P2.
Todavía no está conectado a persistencia, aprobación ni ejecución; no declarar R5 cerrado.

**Digest de omisiones sin valoración (2026-09-27, parcial):** RED mostró que el helper
rechazaba `originalAmount: null` y por tanto no podía incluir fuentes omitidas por falta de
evidencia sin inventar cero o moneda. El snapshot ahora representa cantidades/monedas
desconocidas como `null`; la canonicalización distingue ese estado de `0`, conserva la
validación decimal estricta y rechaza moneda vacía. RED→GREEN:
`replay-preflight-digest.test.ts` 21/21; ESLint, typecheck completo y `git diff --check`
verdes. Esto habilita representar
omisiones en el futuro preflight, pero aún no persiste snapshot, digest, solicitante ni
aprobación; R5 continúa abierto.

**Moneda funcional de replay (2026-09-27, parcial):** RED reprodujo que una fuente
CUP era considerada replayable para un tenant con política MLC (`replayables=1`, esperado
`0`). El recolector ahora lee `TenantAccountingPolicy` del tenant, conserva la moneda
funcional persistida y omite política ausente, moneda no verificable o discrepancia; no
fija CUP como moneda funcional. Se actualizaron los mocks del replay para incluir la
política requerida. Suites `replay-backfill-service`, `replay-backfill` y
`replay-preflight-digest`: 35/35; `pnpm run typecheck`, ESLint focal y `git diff --check`
exit 0. Esto no completa R5.1/R5.2: valoración histórica completa, ambigüedades,
preflight/digest/aprobación persistidos y pruebas PostgreSQL del flujo autorizado siguen
pendientes; replay continúa bloqueado. La atomicidad de escrituras del período se verificó
en la prueba focal documentada abajo.

**Gate fail-closed de la action de replay (2026-09-27, parcial):** RED reprodujo que una
persona manager podía ejecutar el replay con el token literal `REPLAY`, sin aprobación
independiente persistida. GREEN: `ejecutarBackfillPeriodoAction` rechaza esa vía con
`REPLAY_NO_AUTORIZADO` mientras no exista el flujo aprobado; el dry-run de lectura sigue
disponible. RED→GREEN confirmado en `actions-backfill.test.ts`; regresión de las cuatro
suites de action/replay/digest 40/40, ESLint focal y typecheck completo exit 0. Es un cierre
de seguridad transitorio, no la implementación del gate: faltan preflight y aprobación
persistidos (aprobador distinto, permiso tenant y vigencia de 24 h) ligados al digest/run.
No habilitar replay.

**Atomicidad PostgreSQL del período (2026-09-27, evidencia focal):** se extendió la
integración real de `posting-engine.test.ts`: el asiento de una primera fuente se intenta
antes de una segunda fuente con rol contable ausente; la ejecución falla y la consulta
posterior confirma cero asientos del período (`1/1`). Se ejecutó con filtro explícito vía
`pnpm exec vitest run --config vitest.integration.config.mjs ... -t 'revierte todo el período cuando falla una fuente posterior'`
contra la base disposable verificada. No se usa como validación la invocación previa
`pnpm test:integration -- <ruta>`: Vitest recibió el filtro tras el separador y ejecutó
26 suites, con fallos ajenos de licencia/kardex; quedó saneado el tenant de prueba. La
atomicidad de escritura ya tiene prueba PostgreSQL focal, pero sigue pendiente enlazar
preflight/digest/aprobación al mismo run y verificar el flujo autorizado completo.

**Valoración histórica de mermas (2026-09-27, parcial):** RED reprodujo que una merma
con `costoTotal` pero sin moneda ni valoración funcional persistidas se consideraba
replayable por asignarle CUP (`replayables=1`, esperado `0`). GREEN conserva el importe
fuente sin inventar moneda/valor funcional y la omite con
`VALORACION_MONETARIA_NO_VERIFICABLE`; cuando falta el costo, mantiene
`COSTO_NO_VERIFICABLE`. Suite `replay-backfill-service.test.ts` 13/13. R5.1/R5.2 siguen
abiertas por el resto de las ambigüedades/valoraciones históricas y falta persistir el
preflight, digest, aprobación y run; replay sigue bloqueado.

**Identidad ambigua R5.1 (2026-09-28, parcial):** RED reprodujo que varias filas con el mismo
`(origenTipo, origenId)` podían contarse como replayables. Ahora se omiten todas como
`IDENTIDAD_AMBIGUA`, tanto al planificar como al ejecutar; esa causa precede a `yaPosteados`
para que una coincidencia existente no oculte la ambigüedad ni infle cobertura. La prueba RED
adicional verifica dos duplicados omitidos y una identidad única ya posteada; el servicio quedó
en 15/15 y la revisión independiente no halló problemas en ese cambio. ESLint focal, typecheck y
`git diff --check` pasaron. Esto cierra solo la colisión de identidad: R5.1/R5.2 continúan abiertas
para la clasificación/valoración histórica completa.

**Valoración y evidencia FX canónica R5.1/R5.2 (2026-09-28, parcial):** RED reprodujo falsos
positivos por códigos de moneda con espacios/caso distinto, conversión inconsistente en la misma
moneda, FX extranjero con tasa/fingerprint no vinculados a la conversión, JSON de evidencia con
claves adicionales y fingerprint SAME_CURRENCY obsoleto. El replay normaliza moneda presente con
`trim().toUpperCase()` (sin fallback CUP ni whitelist), compara Decimal exactos para la misma
moneda y, cuando hay metadatos FX, reconstruye la evidencia mediante el builder canónico v2 desde
los campos persistidos; exige fingerprint, versión y conjunto/valores exactos del JSON. Cualquier
evidencia incompleta o inconsistente se omite como `FX_NO_VERIFICABLE`; no se reemplaza ni
recalcula la valoración fuente. RED→GREEN focal: replay-backfill-service 20/20; grupo de cuatro
suites R5 50/50. Typecheck, ESLint dirigido, `git diff --check` y revisión independiente GPT-6
Luna sin hallazgos materiales pasaron. R5.1/R5.2 siguen abiertas para clasificación exhaustiva,
los casos históricos restantes y validación PostgreSQL del flujo aprobado; replay continúa
deshabilitado.

**Runtime R5.4/R5.5 (2026-09-28, validación unitaria parcial):** el preflight persistido y el
flujo de aprobación/ejecución quedaron conectados a los servicios; digest v2 vincula todos los
campos que afectan el asiento. Las rutas de planificación, creación de preflight y aprobación
ahora también verifican entitlement vigente desde la base de datos, tanto en la entrada del
servicio como dentro de las transacciones de escritura, para no confiar en features de sesión
potencialmente obsoletos. La escritura del preflight ocurre en la misma transacción que revalida
entitlement, lock de período, permisos y snapshot; usa aislamiento Serializable y propaga fallos
de serialización sin crear un preflight ni reintentar implícitamente. RED→GREEN enfocado: grupo de
cuatro suites 77/77, typecheck con heap de 4 GB, ESLint dirigido y `git diff --check` pasaron;
revisión independiente GPT-6 Luna sin hallazgos materiales. El revisor observó que los writers
ordinarios no parecen tomar este advisory lock; una escritura posterior puede volver obsoleto el
preflight, pero aprobación/ejecución vuelven a calcular el digest y lo rechazan antes de usarlo.
**Clasificación R5.1 de ajustes (2026-09-28, parcial):** RED confirmó que un tipo histórico distinto
de `ingreso`/`egreso` se contabilizaba como abono. El servicio ahora omite ese origen con causa
`TIPO_AJUSTE_BANCARIO_NO_VERIFICABLE` y conserva su identidad; los dos tipos admitidos siguen
valorándose con su evento canónico y las fuentes válidas del lote continúan procesándose. Suite
R5 focal 77/77, typecheck, ESLint y `git diff --check` pasaron; clasificación R5.1/R5.2 continúa
abierta para las otras fuentes históricas.

**Smoke PostgreSQL de migraciones R5 (2026-09-28):** RED en una base disposable local nueva aplicó
las 122 migraciones previas y falló en `20260928000000_contabilidad_formal_remediacion` con
`42P01`, porque `asientos` no tenía migración de creación previa. Se añadió
`20260927120000_contabilidad_formal_core`, que establece los enums/tablas contables faltantes de
forma aditiva e idempotente antes de las tablas replay. GREEN: `prisma migrate deploy` aplicó las
124 migraciones hasta el final en una base PostgreSQL 17 vacía; el SQL de la migración core también
se reejecutó sobre esas tablas existentes sin error. Esto no sustituye pruebas de integración R5.3
ni validación en PostgreSQL 16 (versión de CI). R5.3/R5.4/R5.5 siguen abiertas, sus checks no se
marcan completos y replay continúa deshabilitado.

**Bloqueo de integración R5.3 (2026-09-28, resuelto parcialmente):** la suite `backfill.test.ts`
detectó drift antes de crear fixtures: faltaban `ReconciliacionVenta.deudaCashId`,
`prestamoCashId`, `tipoReconciliacion`, `DeudaCash` y `PrestamoCash`. La comparación completa
`prisma migrate diff --from-url` produjo 911 líneas de drift, incluidos cambios destructivos y
columnas tenant `NOT NULL` sin backfill; ese diff completo sigue prohibido como migración.

**Dependencias de schema R5 (2026-09-28):** se añadió
`prisma/migrations/20260929000000_r5_formal_schema_dependencies` como reconciliación aditiva y
acotada. El backfill de `CuentaPorPagar.tenantId` usa solo `GastoCompra`, `GastosDE`,
`CompraProducto` y `CompraDocumento`; `Vendor` se omite como fuente de tenant. La migración aborta
ante referencias ausentes, tenant de origen nulo, fuentes ambiguas o discrepancias, y valida el
tenant preexistente de `CompraProducto` contra su `GastoCompra`. Crea las tablas cash/cache,
columnas, índices y FKs faltantes de este slice, sin importar el diff global. El harness
`migration.test.sh` pasó en PostgreSQL desechable con mapeos válidos, escenarios fail-closed,
rollback de DDL/datos y ejecución fallida del SQL R5 exacto mediante `prisma migrate deploy`;
también pasó un deploy completo de 125 migraciones en una base nueva y `prisma validate`.

**Bloqueo P2010 de integración R5.3 resuelto (2026-09-29):** `lockPeriodo` conserva
`pg_advisory_xact_lock` transaccional y convierte su resultado `void` a `text` para que Prisma
pueda deserializarlo. La suite base de cinco pruebas pasó en una base PostgreSQL desechable nueva;
esa resolución del lock por sí sola no acreditaba toda la aceptación de R5.3. La revisión
adversarial fresca de la migración no encontró bloqueos críticos/altos/medios; reportó caveats
menores de portabilidad del harness a un entorno distinto del PostgreSQL local documentado.

**R5.3 validado en PostgreSQL desechable (2026-09-29):** la suite ampliada pasó 6/6 tras deploy
limpio de 125 migraciones en `tcp_test_r5_acceptance_green` (loopback 55437), y se repitió 6/6
tras otro deploy limpio actualizado de las mismas 125 migraciones en `tcp_test_r5_full_recheck_20260929`
(loopback 55437). Esta revalidación detectó dos desajustes schema/migraciones, corregidos en la
migración R5 local: `Pagosalario.tenantId` (backfill exclusivamente desde `Empleado.tenantId`,
fail-closed ante empleado ausente, tenant nulo o conflicto) y `CuentaPorPagar.tipoDeuda` (nullable,
sin default ni backfill semántico). El harness valida escenarios fail-closed/rollback de nómina y
que `tipoDeuda` no se invente ni sobrescriba; revisión fresca GPT-6 Luna sin hallazgos materiales.
Cubre preflight
ajeno/vencido/digest cambiado, aprobador inválido, replay concurrente y `YA_EXISTENTE`, bypass
de período cerrado con auditoría ligada a actor/aprobación/digest, rollback `FAILED` ante fallo
intermedio y recuperación exitosa al reintentar el mismo preflight, y estado `NO_CONFORME` con
diagnóstico al omitir una fuente no soportada. Sigue sin equivaler a ejecución de CI PostgreSQL 16.
R5.4/R5.5 y sus gates siguen separados; replay no se habilita por esta prueba. La revisión fresca
no encontró bloqueos para el flujo probado, pero deja dos riesgos de hardening: `replayEvento`
sigue exportada y el bypass depende del callsite autorizado actual (único uso hallado en repo),
y un crash de proceso después de persistir `RUNNING` puede dejar un run estancado; la recuperación
cubierta aquí corresponde a una excepción intermedia capturada y retry exitoso, no a crash abrupto.

- [x] R5.1 **RED→GREEN verificado:** `src/features/contabilidad-formal/__tests__/replay-backfill-service.test.ts`
  clasifica fuentes soportadas y omite explícitamente tipos desconocidos, referencias canónicas
  ausentes/dangling/inactivas/de otro tenant o inconsistentes, además de merma sin costo, FX
  faltante, nulos, fuera de período, ya posteados y ambiguos; prohíbe CUP/cero inventados.
  Suite focal **45/45**; revisión fresca GPT-6 Luna sin hallazgos materiales.
- [x] R5.2 **GREEN/REFACTOR verificado:** `src/features/contabilidad-formal/services/replay-backfill-service.ts`
  mantiene valoración histórica verificable como Decimal y fingerprint FX; sin costo/tasa/evidencia
  suficiente omite la fuente con causa, no sustituye valores y continúa las fuentes válidas sin declarar
  cobertura conforme. Las consultas de fuentes canónicas son tenant-scoped y por lotes (sin N+1).
  ESLint focal, TypeScript completo con heap 4 GB, diff-check y Graphify pasaron; revisión fresca GPT-6
  Luna sin hallazgos materiales.
- [x] R5.3 **GREEN:** `src/features/contabilidad-formal/__integration__/backfill.test.ts` cubre
  preflight ajeno/vencido/digest cambiado, aprobador inválido, dos replays concurrentes,
  reintento `YA_EXISTENTE`, bypass auditado, fallo intermedio recuperable y `NO_CONFORME` post-run.
  Verificado con `pnpm exec vitest run --config vitest.integration.config.mjs
  src/features/contabilidad-formal/__integration__/backfill.test.ts` usando URL explícita de
  `tcp_test_r5_acceptance_green` en `127.0.0.1:55437`, con deploy limpio de 125 migraciones.
**Persistencia R5.4 (2026-09-28, fundación parcial):** se añadieron los modelos tenant-scoped
`ReplayPreflight`, `ReplayApproval` y `ReplayRun`, el vínculo nullable `Asiento.replayRunId`, su
clasificación y una migración aditiva con FK/digest bindings y checks para aprobador distinto y
vigencia exacta de 24 horas. RED→GREEN de clasificación 5/5; Prisma validate/generate pasaron y
la migración se generó/revisó por diff offline contra el esquema pre-slice. La revisión independiente
consideró seguro este fundamento aditivo, pero confirmó que permisos activos, digest inmutable,
expiración al uso, lock y ejecución atómica requieren validación runtime. PostgreSQL no estuvo
disponible y la migración no se aplicó. R5.4 sigue abierta; replay permanece deshabilitado.

- [x] R5.4 **GREEN verificado 2026-09-29:** añadir persistencia aprobada de preflight/run, fingerprint, `replayRunId`,
  estados/conteos/diagnóstico y aprobación tenant en `prisma/schema.prisma` + migración aditiva
  `prisma/migrations/<timestamp>_contabilidad_formal_remediacion/migration.sql`; generar
  `--create-only`, inspeccionar SQL/índices/uniques y clasificar nuevos modelos tenant-scoped en
  `src/lib/db/model-classification.ts` antes de aplicar.
- [x] R5.5 **GREEN verificado 2026-09-29:** en `src/features/contabilidad-formal/actions-backfill.ts` validar Zod,
  `withAction`, tenant/feature/permiso/aprobación en servidor y vínculo actor–digest–período–preflight;
  en `replay-backfill-service.ts` revalidar bajo lock, capacidad privada auditada para guard, commits
  según R0.3, persistir fallo y conciliación sin publicar éxito falso; repetir R5.3 y REFACTOR.

**Cierre técnico R5.4 (2026-09-29):** se revalidó la persistencia existente, sin crear otra
migración ni modificar el esquema de producción. `ReplayPreflight` conserva snapshot y digest
SHA-256 versionado (fingerprint del preflight); `ReplayApproval` vincula tenant, solicitante,
versión/digest y aprobador; `ReplayRun` conserva vínculo a aprobación, estados, conteos y diagnóstico.
`Asiento.replayRunId` es nullable para históricos y usa FK compuesta tenant/run con `RESTRICT`.
Los tres modelos están clasificados `SCOPED`; se inspeccionaron la migración aditiva existente,
sus FK, índices y uniques (18 índices de las tablas replay), sin depender de un nombre de columna
`fingerprint` adicional al digest ni ampliar el alcance con nuevas restricciones no requeridas.

Se desplegaron **126/126 migraciones** en la base nueva y desechable `tcp_test_r54_closure`
(PostgreSQL 17, `127.0.0.1:55437`). Integración **11/11**: ocho pruebas de ciclo autorizado y tres
pruebas directas de restricciones SQL que rechazan autoaprobación, vigencia distinta de 24 horas,
aprobación entre tenants, digest de run distinto y lineage Asiento→run ajeno. Los rechazos verifican
SQLSTATE `23514`/constraint exacta para CHECK y `P2003`/constraint exacta para FK; un control positivo
crea aprobación independiente válida. El ciclo verifica estados/conteos/diagnóstico, rollback total,
fallo durable y reintento sin duplicar. Estas pruebas acreditan aceptación de comportamiento existente,
no una nueva implementación RED→GREEN de persistencia.

Unitarios focales **50/50** (cinco suites replay); se corrigió exclusivamente el mock de fuentes de
`replay-backfill.test.ts` tras RED de dos casos por modelos ausentes, sin debilitar assertions ni
cambiar código productivo. Typecheck normal, ESLint focal y revisión independiente GPT-6 Luna verdes;
Graphify actualizado. La nota de fundación parcial de 2026-09-28 queda superada por esta evidencia
local, no por un despliegue en producción. R5.1–R5.5 quedan cerrados técnicamente; R0.5/R1/R2/R3/R6/R7
y aceptación operativa siguen separados. Sin commit/push ni activación de shadow/enforce/replay.

### Fase R6 — Cobertura e integración de writers (tras R1–R5)

**Integración focal PostgreSQL 25-09 (R0.5/R6 parcial):** SQL `psql -X -w`
y Prisma generado, ambos de solo lectura antes de writes, confirmaron
`tcp_test_shadow_rev_contabilidad`, `arturo`, 55437, recovery=false,
`cta-isolated-pg`. RED en `reconciliar-servicio-real.test.ts`: 4/5 fallos
(fixture sin modo enforce y variable test en TDZ); con enforce explícito RED
2/5 (API no respetaba fecha del período y expectativa de conteo global del
fixture), RED posterior 1/5: API permitía segundo POST 201. GREEN/REFACTOR
7/7: API marca venta bajo lock en la misma tx y persiste fecha de reconciliación;
action existente, POST web y servicio compartido mobile generan un asiento
por fila con fingerprint FX heredado; API y móvil rechazan reintento y tenant
ajeno; trigger SQL 22012 en INSERT de asientos revierte saldo, venta y fila
de ambos canales. Auth web, feature/permiso, validación de período y audit log
**mockeados**, no equivalen a prueba de autenticación/permisos reales;
concurrencia y matriz global no verificadas. Modo enforce solo en proceso de
integración, eliminado al finalizar; sin replay ni 5432. Runner focal 7/7,
typecheck `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc
--noEmit --incremental false` y ESLint focal exit 0. R0.5/R6.1/R6.2
continúan [ ] hasta cubrir los demás writers y auth real.

**Slice servicio compartido 25-09 (parcial):** POST mobile delega a
`AccountingReconciliationService.reconcileService`; API web y action tienen escritores
independientes y no delegan. RED 3/3 (mock detectó consulta no tenant-scoped);
GREEN/REFACTOR 3/3: referencias tenant-scoped, reintento rechazado, evidencia FX
persistida y un hook por reconciliación dentro de `$transaction`. CUP sin fecha continúa
admitido, FX sin fecha efectiva se rechaza. Typecheck heap8192 y ESLint focal exit 0.
Sin escrituras DB ni integración (no se verificó identidad SQL+Prisma en este slice),
sin prueba de permisos reales ni concurrencia; R6.1/R6.2 y R0.5 globales siguen [ ].

**Slice API servicios FX 25-09 (parcial):** RED 1/6 (`USD` con tasa y fecha
efectiva devolvía 400); GREEN/REFACTOR 6/6 en `route.test.ts`. El POST vuelve a
aceptar FX con evidencia explícita persistida y heredada por el evento; sin fecha
o tasa mantiene rechazo previo. Typecheck heap8192 y ESLint focal exit 0. SQL y
Prisma solo lectura confirmaron base exacta `tcp_test_shadow_rev_contabilidad`,
rol `arturo`, puerto 55437, recovery=false y `cta-isolated-pg`. Sin escrituras ni
integración PostgreSQL del POST: commit/rollback físico, auth real, permisos,
idempotencia concurrente aún no verificados. R0.5/R6.1/R6.2 permanecen [ ]; no
activar modos ni replay.

  - [ ] R6.1 **PARCIAL:** existen cierres focales por fila (ver inventario); no todas las rutas/adaptadores
  de los 31 callsites tienen autorización, valoración, reintento y rollback certificados. Filas
  114–119 avanzaron; la ejecución/reversión manual de anticipos falla cerrada y los workflows
  activos de cancelación formal (venta, nómina, compra de producto, GastoDE y compra de servicio)
  crean asientos inversos atómicos. La corrida completa de integración quedó 51/51 archivos,
  298/298 tests en DB desechable (ver `revision-cierre-2026-10-03.md` §3). Siguen pendientes
  autorización/valoración de otros writers e inventario exacto de R0.5/R6.
- [ ] R6.2 **ACEPTACIÓN GLOBAL PENDIENTE:** el target autorizado `tcp_test_devolucion_20261001:5433`
  terminó la suite de integración completa 51/51 archivos, 298/298 tests; `test:integration`
  valida el target desechable y prepara idempotentemente sus guards SQL. Esto reemplaza la corrida
  histórica fallida; el verificador post-deploy ahora chequea los triggers/checks/indexes críticos.
  La corrida desechable no certifica baseline ni paridad de migraciones en otros
  entornos, y R0.5 sigue abierto por writers/adaptadores no cubiertos.
- [x] R6.3 **RED→GREEN→REFACTOR:** completar fixtures de dos tenants y lecturas cruzadas en
  NUEVO `src/features/contabilidad-formal/__integration__/libros-aislamiento.test.ts` 3/3
  (2026-10-03, DB aislada 55437): dos tenants con plan/licencia/asientos reales; el diario y
  balance del tenant B no ven el asiento de A; leer con `periodoId` ajeno devuelve vacío.
  (`libros.test.ts` histórico es servicio mockeado; la evidencia real se movió al archivo nuevo.)

**Avance R6 directo del orquestador (2026-10-03, DB aislada):**
- Fila 27 (mermas): NUEVO `src/features/mermas/__integration__/merma-formal-real.test.ts` 2/2 —
  enforce postea MERMA_INVENTARIO a costo 50/50 con actor real en mismo tx; trigger SQL en
  `asiento_lineas` revierte merma+stock+ajuste+asiento. Hallazgo lateral documentado: la
  notificación de merma falla silenciosamente (`User` no tiene `tenantId` escalar; la acción
  lo traga con catch) — **RESUELTO aparte (2026-10-03):** fix con TDD en la rama
  `fix/notificar-merma-tenant-scope` sobre `origin/main`, PR #17 (broadcast por membresía,
  sin columna inexistente; 66/66 adyacentes; tsc/lint limpios). Matrix actualizada acá porque
  el hallazgo se originó en la fila 27 de este change.
- Fila 28 (restock): NUEVO `src/features/productos/__integration__/restock-formal-real.test.ts`
  2/2 — enforce postea el egreso 120/120 con FX persistida en el mismo tx; trigger SQL revierte
  stock+gasto+reconciliación. Se creó la tabla faltante `ProductoCostHistory` + enum en la DB
  desechable (drift: existe en schema pero sin migración; producción vive en db-push).
- Filas restantes sin certificación de canal HTTP real: 17, 18, 19, 20 (auth adapter sintética;
  401 sin token probado en rutas vecinas), 21 (contexto manager sintético), 22 (rollback y
  cross-tenant DB pendientes), 29 (costo de producción sin moneda declarada — requiere decisión
  funcional). R6.1/R6.2 quedan **[ ]** hasta cubrir esas filas.

**Continuación R0.5/R6 (2026-10-03, moneda funcional elegida por el usuario):**
- Fila 21 ahora postea `COMPRA_CONTADO` para `PAGO_COMPLETO` en la misma transacción. Cuenta/tipo
  de pago son explícitos; reintentos no duplican débito; se bloquean cambios posteriores de forma
  o estado sin workflow de pago/reverso. El costo promedio de Producto y la evidencia del documento
  se normalizan a `TenantAccountingPolicy.functionalCurrencyCode`; el workflow separa tasa funcional
  y tasa de conversión al saldo bancario.
- Filas 27/29: `Producto.precioCosto` se interpreta como moneda funcional del tenant. Compras
  extranjeras convierten su costo a esa unidad con tasa fuente→CUP y tasa funcional→CUP histórica;
  falta evidencia FX requerida → error antes de escribir. Mermas y producción reciben la moneda
  funcional explícitamente. Una merma con asiento/outbox no puede editarse ni borrarse sin reverso.
- Verificación focal: compras de producto integration 6/6 (incluye functional USD y débito CUP),
  mermas integration 3/3 (USD, rollback e inmutabilidad), producción integration 3/3 (USD,
  rollback y denegación), unitarias focales 72/72 + workflow de pagos 16/16; typecheck y ESLint
  focal sin errores.
- La notificación heredada de mermas sigue fallando dentro de `notificarMerma` porque filtra
  `User.tenantId`, campo que no existe; el error se captura después del commit contable.
- Fila 14 (2026-10-03): el POST productivo `/api/contabilidad/prestamos-cash/[id]/pagar` ahora
  exige `requireFeature('prestamos-cash')` y `requirePermission('financiero.contabilidad.acceder')`
  antes de leer préstamo/cuenta. Unit route 12/12 e integración HTTP real 1/1: 401 anónimo,
  manager Bearer paga y contabiliza, dependiente Bearer recibe 403 sin mutar CxC/tesorería. La
  definición antigua `handlers-prestamos-cash.ts` se retiró tras confirmar cero callers productivos.
- Filas 13/15/16 (2026-10-03): se retiraron `handlers-prestamos-cash.ts` y
  `handlers-deudas-cash.ts` y sus tests exclusivos. Graph inbound y búsqueda de imports en todo
  `src/` solo hallaron tests; las rutas directas equivalentes existen. Se actualizó el inventario
  estático de writers de 39/24 a 35/22. Las rutas vivas de alta de préstamo y deudas aún requieren
  completar los gates/permisos reflejados en filas 117/118.
- Fila 8 (2026-10-03): se retiró `handlers-reconciliacion-servicios.ts` tras `trace_path` sin
  callers y búsqueda completa en `src/`; GET, historial y POST tienen rutas activas alternativas.
  La prueba reproducible registra ahora 32 callsites en 19 archivos.
- Fila 20 (2026-10-03): `operations-channels-http-real.test.ts` ahora compite dos pagos Bearer
  de 350 sobre una deuda de capital de 500: solo uno se registra, el otro recibe 400, queda un
  `PagoDeuda`/asiento y el saldo no sobrepasa la obligación.
- Filas 114–116 (03-10): `reconciliarServicioAction` y el POST web delegan al writer compartido;
  service 24/24, actions 4/4, rutas 7/7 y PostgreSQL `reconciliar-servicio-real.test.ts` 20/20.
  La integración verifica CxC USD parcial/final (40/60), FX funcional, asientos y auditoría durable
  post-commit; trigger SQL confirma rollback de CxC/tesorería/asiento y ausencia de auditoría en fallo.
  También cubre aislamiento tenant, reintentos y canales web/móvil. `reconcileSale` conserva su
  retorno de transacción (regresión reparada durante esta continuación).
- Fila 117 (03-10): además de gates unitarios en ambos POST de deudas cash (`route.test.ts`, 22
  casos), `deudas-cash-auth-http-real.test.ts` 1/1 usa JWT + UserSession + membresías reales en
  ambos endpoints: anónimo 401, manager permitido, dependiente 403 sin mutaciones y registros
  durables de auditoría para alta y pago.
- Filas 118/119/20 (03-10, reejecutadas): `prestamos-cash-pago-auth-http-real.test.ts` 2/2,
  `cash-loans-http-real.test.ts` 3/3 y `operations-channels-http-real.test.ts` 3/3; Bearer real,
  autorización manager/dependiente y carrera multi-conexión de pagos capital con un único ganador.
- Nota de verificación: una invocación amplia accidental de `pnpm test:integration -- <ruta>` corrió
  50 archivos; 46 pasaron y 4 fallaron fuera de este scope (`kardex-backfill`, dos invariantes
  SQL de apertura/backfill formal y una suite que exige la DB fija `tcp_test_shadow_rev_contabilidad`). Las
  suites relevantes se reejecutaron con `pnpm exec vitest run --config vitest.integration.config.mjs
  <ruta>` y finalizaron verdes.
- R6.1/R6.2 siguen **[ ]** globalmente: persisten otros writers parciales y pruebas HTTP reales
  pendientes; consultar estados actuales en `matriz-writers-r0.5.md`.


### Fase R7 — Documentación, verificación y gate operativo (tras R0–R6)

- [x] R7.1 Documentación añadida el 2026-10-03: `content/docs/modules/contabilidad/capa-formal.md`
  (capa formal, modos off/shadow/enforce, plan editable, apertura/cierre y rollover, conciliación
  NO_EVALUABLE, replay con preflight 24h y reversión sin borrado, cobertura y límites declarados)
  y `docs/GLOSSARY.md` (términos de la capa formal).
- [ ] R7.2 **PARCIAL:** `pnpm test:run` aprobó 753 archivos/4,885 tests y `typecheck`, ESLint
  focal y `git diff --check` pasan; el target autorizado completó 51/51 archivos y 298/298 tests.
  La suite prepara guards SQL localmente, pero el flujo
  versionado `migrate deploy`, baseline heredado y objetos SQL por entorno siguen sin verificarse.
  `typecheck:tests` falla por contratos de tipos desactualizados en fixtures/suites; Vitest no
  los reproduce como fallos de ejecución. Tampoco equivale a certificar todos los writers/adaptadores R0.5.
- [ ] R7.3 Habilitar solo shadow para tenant autorizado y registrar **≥7 días continuos** de eventos
  recibidos/simulados/omitidos por tipo/writer, causa, latencia p95, huecos de telemetría y
  conciliación comparable exacta; adjuntar evidencias y responsable en `tasks.md` o verificación;
  no marcar `[x]` sin ventana real observada.
- [ ] R7.4 Registrar aprobación explícita por tenant y criterio de reversión tras R7.2/R7.3 +
  R0.1–R0.4 resueltas; si falla cobertura/conciliación o surge incidente, volver a off para el tenant,
  detener replay, preservar asientos/evidencia, diagnosticar y repetir shadow antes de reactivar.

**Slice servicio canónico de deudas 2026-09-25 (filas 11/12, parcial):** RED unitario
reprodujo proveedor sin `findFirst` tenant-scoped, FX funcional ausente en el evento y deuda
de pago consultada sin tenant; GREEN implementó referencias de proveedor/deuda/cuenta/tipo
de pago tenant-scoped, actualizaciones condicionales, FX persistida desde la reconciliación y
rechazo `FX_INSUFICIENTE`; sin split de intereses (v1). Se añadió `tasaCambio` al schema Zod
de create action. `accounting-cash-operations-mutation-service.test.ts` 4/4, TypeScript
completo (`tsc --noEmit --incremental false`, heap 8192) y ESLint focal exit 0.
Integración `deudas-cash-real.test.ts` 8/8 en DB temporal exacta
`tcp_test_shadow_rev_contabilidad` puerto 55437: deuda y pago USD heredan 24/25 y su
fingerprint a exactamente un asiento cada uno. Las comprobaciones de identidad SQL+Prisma
se ejecutan en `beforeAll` antes de fixtures.

**Nota de verificación ampliada:** el primer uso de `pnpm test:integration -- <ruta>`
pasó `--` al filtro y ejecutó la suite completa (23 archivos): 14 fallos. Los dos
fallos del fixture nuevo fueron por `fecha` ausente en los builders canónicos;
se corrigió pasando `fechaReconciliacion` al evento y luego el archivo focal pasó
8/8. Los otros 12 fallos quedaron en `kardex-backfill` y `posting-engine` (este
último retornó `OMITIDO/SIN_LICENCIA` en sus fixtures); no se atribuyen ni corrigen
en este slice. R7.2 debe resolver el gate global antes de aceptación.

**Alcance parcial:** no se probó el middleware/autorización real de los callers web/mobile,
ni carrera concurrente de numeración o idempotencia. Los métodos canónicos de préstamo
(filas 9/10) siguen siendo otro slice distinto y no se consideran completados por estas
pruebas de deuda. R0.5/R6 global continúan `[ ]`; no activar modos ni replay.

**Slice autorización + distribución de servicio 2026-09-26:** se quitó el mock de
`tenant-scope` en `reconciliar-servicio-real.test.ts`; con helpers reales se probó
que manager con feature reconciliación válida, dependiente sin permiso recibe
`FORBIDDEN`, plan sin feature recibe `FEATURE_NOT_AVAILABLE`, y ningún caso denegado
acredita saldo ni crea reconciliaciones. La action con distribuciones ya emite un
asiento por fila; 9/9 integración en PostgreSQL aislado, incluyendo FX heredada,
cross-tenant, reintento y trigger SQL 22012 con rollback. Se verificó la identidad
DB+puerto antes de fixtures. `withAction` y la identidad del actor siguen sintéticos;
el canal mobile/API no es objeto de esta corrida. Matriz fila writer de distribución
actualizada a PARCIAL, no PASS.

**Slice venta compartida + legacy web 2026-09-26:** RED unitario 3/3 mostró ausencia
de asiento, FX extranjera sin fecha efectiva aceptada y falta de gates en
`AccountingReconciliationService.reconcileSale`. GREEN agrega feature `contabilidad`,
permiso `financiero.contabilidad.acceder`, FX fail-closed con fecha efectiva,
`VENTA_CONTADO`/`COBRO_CXC` y evento desde reconciliación persistida en la misma tx.
El estado CxC toma `montoConvertido` funcional guardado (fallback solo en histórico).
La ruta `/api/contabilidad/reconciliacion/ventas` persiste FX fingerprint/fecha/moneda
funcional y verifica feature+permiso antes de mutar; unit tests shared 3/3 y route 2/2.

La integración `reconciliar-servicio-real.test.ts` ejecutó 13/13 con SQL+Prisma identity
antes de fixtures: shared mobile sale y legacy web USD 10×24, asiento único/FX heredada,
permiso/feature denegados, rechazo de FX incompleta y rollback SQL 22012 completo. Los
adaptadores success usan usuario manager sintético; login Bearer exitoso end-to-end
pendiente. R7.2 (suite/typecheck/lint global) sigue pendiente.

**Slice servicio canónico de préstamos 2026-09-26 (filas 9/10, parcial):** RED
unitario reprodujo cuenta consultada sin tenant, pago de préstamo sin tenant y
valoración del desembolso FX no heredada; GREEN tenant-scoped cliente/préstamo/cuenta/
tipoPago, débito/crédito condicional con tenant, compare-and-update del CxC bajo lock,
FX persistida/heredada, `fecha` y `tipoCuenta` del asiento; sin split de intereses (v1).
El servicio exige además `requireFeature('prestamos-cash')` y
`requirePermission('financiero.contabilidad.acceder')`, cubriendo Server Actions y
mobile después de resolver el usuario autenticado. `accounting-cash-loan-mutation-service.test.ts`
4/4; regresión de unidad de los dos servicios cash 8/8; typecheck heap8192 y ESLint focal
exit 0.

Integración PostgreSQL aislada `prestamos-cash-pagar-real.test.ts` 11/11 tras SQL+Prisma
identity en `beforeAll`: creación canónica USD 100×24 y pago USD 10×25, asiento único y
fingerprint/tasa heredados; rol `dependiente` denegado y manager sin feature denegado;
la ruta móvil real sin token devuelve 401 sin escribir; triggers SQL 22012 fuerzan rollback
completo en creación y pago (saldo, préstamo, CxC, reconciliación y asiento sin cambios).
No se ejercitó login Bearer exitoso end-to-end: el gate del servicio se comprobó con el
helper real sobre contextos sintéticos manager/dependiente. R0.5/R6 global continúan `[ ]`;
quedan venta, FX de writers restantes, auth HTTP exitosa, concurrencia y gates globales.

**Slice producción R0.5/R6 2026-09-26:** se extendió la integración para ejecutar el
writer con licencia/plan formal, plan contable y período abierto; trigger PostgreSQL en
`asientos` fuerza SQLSTATE 22012 dentro de `postEvento`. RED detectó evento sin fecha
(`PeriodoGuard.cacheKey` recibía undefined): el rollback anterior había fallado antes
del motor por trigger en `ReconciliacionGasto`, no probaba posteo contable. GREEN pasa
fecha explícita al builder. Integración final 2/2 con identidad SQL/Prisma verificada:
rollback de stock, orden EN_PROCESO, historial, reconciliación y asiento; rol dependiente
denegado 403 antes de mutar. Se añadió `requireFeature('produccion')`; `withAuthPost`
inyecta actor sintético, no prueba credenciales HTTP. Trigger ahora incluye mensaje
`posteo SQL rechazado` para demostrar que falló dentro del posteo.

**Slice writer de gastos + permiso de mermas 2026-09-26:** en
`pago-gastos-workflow`, RED reprodujo que estado `PENDIENTE` generaba un evento formal
aunque no se debitara tesorería; GREEN solo invoca `postEvento` para reconciliaciones
`PAGADA`/`PARCIAL`. `pago-gastos-workflow.test.ts` 9/9.
`mermas/actions.ts` ahora exige feature `mermas` y permisos distintos para registrar,
editar y eliminar; RED comprobó que create consultaba producto antes de denegar a un
actor sin permiso, GREEN deniega antes de cualquier lectura/escritura. `actions.test.ts`
18/18. Typecheck completo y ESLint focal sin errores. El costo de merma sigue derivado
de `Producto.precioCosto` y etiquetado CUP; unidad monetaria/costo cero requiere
definición y prueba de integración antes de cerrar fila 27.

**Slice transferencia bancaria 2026-09-26, fila 17 parcial:** RED unitario encontró
lookups `findUnique` sin tenant y servicio sin permission/feature gate; GREEN tenant-scopes
cuenta origen/destino, activa, actualización condicional con saldo suficiente, consecutivo
por tenant y exige feature `transferencias-bancarias` + permiso contable. RED integración
reprodujo evento sin fecha (guard TypeError) y con el builder sin timestamp; GREEN usa
`TransferenciaBancaria.fechaTransferencia`. Unit/regresión operations 12/12; PostgreSQL
6/6: asiento CUP cuadrado y único, USD→CUP 10×24 con FX heredada, cuenta ajena denegada, trigger SQL 22012
en `asientos` revierte saldos/transferencia. Identidad SQL/Prisma validada antes de fixtures.
La evidencia FX aditiva quedó implementada para `TransferenciaBancaria` mediante
`20260926000001_transferencia_bancaria_fx_evidence`: USD→CUP 10×24 persiste snapshot y
transmite fingerprint/tasa al asiento. Misma moneda extranjera usa la tasa a CUP; pares
extranjeros distintos se rechazan por falta de cotización cruzada. DB temporal recibió
esa migración tras identity SQL+Prisma; no se tocó otra DB. CUP/FX/rollback total quedan
probados; llamadas HTTP del adaptador y concurrencia multi-conexión siguen pendientes.

**Slice ajuste bancario 2026-09-26, fila 18 parcial:** RED verificó lectura de cuenta
sin tenant ni feature/permiso; GREEN usa `findFirst(cuentaId,tenantId,isActive)`, exige
feature `contabilidad` y permiso `financiero.contabilidad.acceder`, actualiza saldo con
`updateMany` tenant/activa y comprueba `count`. Test `accounting-operations-mutation-service`
incluye ownership/gates. Inicialmente faltaba snapshot FX; se corrigió en el slice siguiente
con columnas aditivas.

**Slice evidencia FX ajuste bancario 2026-09-26:** RED unitario mostró que AjusteBancario
guardaba tasa/monto convertido sin `fxEvidenceFingerprint` y el asiento no heredaba la
prueba. Se amplió schema de forma aditiva con los campos canónicos y migración
`20260926000000_ajuste_bancario_fx_evidence`; se aplicó a la DB de test aislada y se
generó Prisma Client. El servicio ahora valida moneda=moneda de cuenta, exige FX completa,
persiste evidencia y genera evento desde la fila persistida con fecha; tenant/feature/
permiso y updateMany condicional. Unit test FX, faltante FX y tenant-scope; DB de
transfer/ajuste 5/5 confirma USD 10×24/fingerprint/asiento único además de CUP/rollback.
No se tocó otra DB. Falta verificar migración completa en flujo de `migrate --create-only`
y respaldar el rollout de esquema; los ajustes históricos no reciben backfill FX.

**Slice FX capital/deuda capital 2026-09-26, filas 19/20 parcial:** RED unitario confirmó
que ambos métodos escribían sin permiso; GREEN añadió feature `inyeccion-capital` y permiso
`financiero.contabilidad.acceder`. Se añadieron snapshots FX nullable a `InyeccionCapital`
y `PagoDeuda` y migración `20260926000002_capital_cash_fx_evidence`; el servicio exige
tasa/evidencia, moneda coincidente con la cuenta y publica asiento desde la fila persistida.
PostgreSQL `accounting-bank-transfers-real` confirma aporte USD 50×24 y pago USD 10×25,
cada uno con un asiento y fingerprint/tasa. Migración aplicada solo al clúster temporal tras
identity SQL+Prisma. Unit, HTTP Bearer exitoso, rollback SQL de estos métodos y ruta
`migrate --create-only`/rollout formal siguen pendientes.

**Slice anticipo en venta de servicios (fila 23) 2026-09-26:** RED unitario detectó que
el action permitía iniciar sin permiso `ventas.venta.registrar` y el asiento no heredaba
el fingerprint FX. GREEN añade permiso antes de lecturas, valida cuenta origen tenant-scoped,
elimina fallback de actor `system` y transmite monto funcional/tasa/fingerprint/fecha/tipoCuenta
desde la reconciliación persistida. `venta-servicios/actions.test.ts` 29/29. Integración de
rollback/cross-tenant de este action todavía pendiente.

**Slice compra a crédito FX (fila 21) 2026-09-26:** RED unitario agregó caso que debe
rechazar una compra USD parcial sin tasa/fecha efectiva; action ahora toma FX evidence
una vez, persiste snapshot nullable en `CompraDocumento`, exige feature compras y permiso
`compras.compras.gestionar`, y pasa functional/tasa/fingerprint del documento persistido
al único `COMPRA_CREDITO` en la misma tx. UI ofrece tasa/fecha para moneda extranjera.
Schema + migración add-only `20260926000003_compra_documento_fx_evidence` + Prisma generado.
Unit focal `actions.test.ts` moneda 4 tests; PostgreSQL aislado `purchase-credit-fx-real.test.ts`
2/2 (USD 100×24, fingerprint en fila/línea, rollback trigger SQL en Asiento). El runner de
integración sincroniza columnas en DB con db-push, por lo que intentar aplicar manualmente
la migración a ese schema ya sincronizado devolvió columna duplicada; migration path
`migrate --create-only`/aplicación formal no queda verificado. PAGO_COMPLETO no tiene todavía
evento formal propio porque su flujo no registra reconciliación/tesorería en esta acción.

**Slice compra de servicios liquidada con anticipo (fila 22) 2026-09-26:** RED
unitario mostró ausencia de fingerprint FX en `postEvento` aunque la reconciliación
lo persistía. GREEN valida la cuenta origen tenant-scoped, exige reconciliación FX
completa, postea desde la fila persistida, usa fecha y tipoCuenta, y elimina el actor
fallback `system`; feature/permiso existentes en el action se conservan.
`compras-servicios/actions.test.ts` 17/17; falta integración DB de rollback/cross-tenant.

**Slice restock foreign evidence + tenant 2026-09-26 (fila 28 parcial):** RED reprodujo
restock de producto de otro tenant entrando a transacción; GREEN rechaza con NOT_FOUND antes
de stock. El pago completo ahora verifica cuenta tenant/activa, construye y persiste FX
snapshot desde montoOriginal×tasa y fecha de operación, exige montoConvertido coherente,
transmite fingerprint/monto funcional desde ReconciliacionGasto y omite actor fallback
`system`; actualiza saldo con `updateMany` scoped. Unit `src/features/productos/__tests__/actions.test.ts`
cross-tenant + foreign restock focal verde. PostgreSQL integración específica pendiente.

**Gate focal de este lote 2026-09-26:** `pnpm exec vitest run` de 12 archivos del
scope escritores/auth ejecutó 164/164 tests. `NODE_OPTIONS=--max-old-space-size=8192
./node_modules/.bin/tsc --noEmit --incremental false` terminó sin diagnósticos.
ESLint sobre archivos tocados: cero errors y tres warnings existentes en
`compra-producto-form.tsx` (React Hook Form `watch` incompatible con React Compiler y
dos dependencias de `useMemo`). No se ejecutó suite global completa ni R7.2.

**Handoff de pausa 2026-09-26:** trabajo persistido en Engram, OpenSpec y Second Brain.
R0.5/R6 continúan abiertas; no cambiar flags operativos. Restock carece de integración
PostgreSQL, el action de venta-servicio y compra-servicio también; HTTP Bearer exitoso
no se probó end-to-end. `PAGO_COMPLETO` de compra no genera todavía asiento en el action.
No se debe considerar la ventana shadow de siete días satisfecha por tests; Verify espera
R0–R7 y reglas replay R0.3 resueltas.

**R4.2 exactitud decimal de conciliación (2026-09-27, parcial):** RED focal actualizado
para exigir strings canónicos y reproducir seis fallos con la implementación anterior:
`0.10 + 0.20` frente a `0.30`, ceros exactos y el importe
`123456789012345.6789` perdían la forma monetaria por `Number`/redondeo. GREEN reemplazó
la aritmética de `conciliacion-cruzada-service.ts` por `Prisma.Decimal`, elimina
`Number`, `Math.round`, `Math.abs` y epsilon del servicio, clasifica solo `Decimal.isZero()`
como `OK`, y expone `saldoLibros`, `saldoOperativo` y `diferencia` como strings planos
canónicos antes de la serialización de `withAction`. El panel formatea esos strings solo
como presentación y no realiza aritmética; conserva `NO_EVALUABLE` para fuentes no
comparables y evalúa moneda CxP solo en saldos pendientes no cero. Suite libros+panel
`17/17`, typecheck completo exit 0, ESLint focal y `git diff --check` exit 0. La corrida
de cobertura focal pasó 17/17, pero el reporte V8 global quedó en 0% por la configuración
del repositorio y versiones mixtas de Vitest/coverage; no se usa como evidencia de 80%.
La integración real de conciliación, la comparabilidad CxC y R4.3 siguen pendientes;
no habilitar enforce ni otros modos operativos.

**R4.2 follow-up de revisión fresca (2026-09-27):** se corrigieron tres observaciones
de contrato. La consulta de tesorería ahora trae todas las cuentas bancarias activas,
suma únicamente las de moneda funcional y marca `NO_EVALUABLE` si existe una cuenta
activa no funcional con saldo no cero; una cuenta extranjera liquidada no bloquea por sí
sola. Cuando se solicita `fechaHasta`, los tres importes del rubro se devuelven como
`null` porque el servicio aún no aplica un corte consistente a ambos lados, y el panel
muestra `Sin cobertura` en lugar de cifras actuales. `generadoAt` ahora es ISO string
en el DTO, compatible con la serialización de `withAction`. RED reprodujo los tres
casos; GREEN pasó libros+panel `19/19`, typecheck completo, ESLint focal y diff-check.
La integración temporal de cortes y la comparabilidad CxC continúan pendientes.

**R4.3 UI/accesibilidad (2026-09-27, cerrada):** se añadió cobertura Testing
Library + `vitest-axe` para `ConciliacionPanel` y `LibrosPageClient`: «Sin
cobertura» en cortes no valorables, diferencia evaluable, estado `NO_EVALUABLE`
distinto de `Diverge`, causa visible, `aria-live="polite"` y foco operativo en
`Actualizar`. Los componentes de libros/conciliación no emiten toasts; las rutas
de error quedan inline con copy neutro (`role="alert"`), por lo que no hay toast
neutro que validar en este scope. Verificación focal:
`pnpm exec vitest run src/features/contabilidad-formal/components src/features/contabilidad-formal/__tests__/libros-ui.test.tsx src/features/contabilidad-formal/__tests__/libros.test.ts`
→ 23/23. `vitest-axe` sigue mostrando el warning baseline de jsdom/canvas para
color-contrast, sin fallar la suite.

## Cierre de revisión y correcciones obligatorias (2026-09-27)

Este documento queda como guía de corrección, no como aceptación final. El estado verificable
es: **R4.3 cerrada**, **R4.2 parcial** (integración real de tesorería/corte verde, CxC aún no
comparable) y **R0.5/R6/R7 abiertos**. Antes de cambiar cualquier `[ ]` a `[x]` o habilitar un
modo operativo, completar en este orden:

1. **Contrato CxC:** agregar a `CuentaPorCobrar` un snapshot nullable y explícito de moneda
   original, importe original/saldo funcional, moneda funcional, tasa, fecha efectiva, fuente,
   versión y fingerprint de evidencia FX. Las filas históricas sin evidencia permanecen
   `NO_EVALUABLE`; no convertirlas a CUP por defecto.
2. **Writers y lectores:** adaptar facturación/ventas a crédito, servicios a crédito, préstamos
   cash, creación manual y cobros para escribir/leer ese snapshot desde la fila persistida,
   con tenant, actor y transacción única. Resolver el desalineamiento de
   `createCuentaPorCobrarAction` que hoy intenta escribir `moneda` inexistente.
3. **Backfill conservador:** definir fuentes aceptables y omitir individualmente las filas sin
   trazabilidad; no inferir valoración desde `Factura.tasaCambio` aislada. Añadir pruebas de
   factura extranjera, reintento idempotente, rollback y aislamiento entre tenants.
4. **Corte temporal:** implementar una fecha-as-of consistente para ambos lados de la
   conciliación; hasta entonces, conservar `null`/`Sin cobertura` y bloqueo de `enforce`.
5. **Gates de operación:** cerrar preflight persistido, digest/aprobación de manager distinto
   del solicitante, savepoint/telemetría y replay en una única transacción. La ventana shadow
   de siete días y R7.2 siguen siendo gates reales, no se sustituyen por suites focales.
6. **Verificación final:** ejecutar migración formal en una base desechable identificada,
   typecheck/lint y suites unitarias e integración focales; registrar fallos baseline ajenos
   por separado. Solo después revisar nuevamente R0.5→R7 y solicitar aprobación de activación.

**Regla de cierre:** no activar `shadow`, `enforce` ni replay, y no presentar la conciliación
como conforme mientras CxC o cualquier rubro siga `NO_EVALUABLE`.

**Snapshot CxC (2026-09-27, parcial; no acredita cierre de las indicaciones 1–3):** se añadieron
al modelo `CuentaPorCobrar` campos opcionales para moneda/importe original, saldo funcional,
tasa/fecha y procedencia/versionado/fingerprint FX. La migración
`20260927000000_cxc_fx_valuation` es aditiva y no completa filas históricas. El writer manual ya
no intenta escribir la columna Prisma inexistente `moneda`; conserva `monedaOriginal` y
`montoOriginal`. El input exige moneda explícita y el builder de venta pendiente rechaza moneda
ausente, normaliza códigos y no convierte toda moneda no-USD en CUP. RED/GREEN:
`schemas-cuentas.test.ts` 8/8; typecheck completo, ESLint focal, Prisma validate y comparación de
migración contra schema pasan. La revisión fresca detectó además asociación cliente/venta
permisiva y totales UI que asumían CUP; el action ahora valida cliente de la venta y cliente del
tenant, rechaza ventas sin cliente asociado, y la UI presenta importes por moneda explícita,
conservando la moneda original en filas CxC; moneda desconocida no se agrupa. Tests de helpers no
sustituyen aún pruebas de action ni de render/UI. Pendiente: origen autoritativo de
conversión y persistencia transaccional de valoración funcional, cobertura de todos los
writers/readers/cobros, backfill prudente e integración PostgreSQL para factura
extranjera/reintento/rollback/tenant. Por tanto R4.2 y las indicaciones CxC 1–3 siguen abiertas;
filas sin evidencia deben permanecer `NO_EVALUABLE`. No habilitar modos operativos.

**Writer de crédito por servicios (2026-09-27, parcial):** el modo mixto ahora crea las ventas
de servicio y sus CxC en una única transacción interactiva; la prueba usa dos líneas en USD/EUR
y verifica el mapeo individual de moneda e importe persistidos. El crédito legacy sin anticipos
conserva el snapshot original del catálogo; con anticipos, el remanente queda sin moneda/importe
original porque su valor numérico no demuestra una moneda homogénea. RED reprodujo antes dos
riesgos: Prisma rechaza `fxEvidenceJson: null` y venta/CxC mixtas se guardaban en transacciones
separadas. GREEN omite esa clave JSON y agrupa ambas escrituras; cinco suites focales pasan
53/53 (incluye legacy CxC 5/5 y precio de catálogo 3/3, con mocks alineados al tx interactivo,
cuenta tenant-scoped y reconciliación persistida). ESLint focal, typecheck y `git diff --check`
pasan. Los unit tests no demuestran rollback SQL.
Los campos funcionales/FX siguen desconocidos; faltan integración PostgreSQL, writers/cobros
restantes, y evidencia funcional autoritativa. R4.2 y las indicaciones CxC 1–3 continúan abiertas;
no habilitar shadow/enforce/replay.

**Valoración exacta de crédito por servicios (2026-09-28, parcial):** para crédito mixto y legacy,
el mismo writer transaccional exige política de moneda funcional del tenant y valora cada saldo de CxC
según su propia moneda. Los anticipos parciales solo son compatibles cuando su moneda coincide con la
de la venta; de lo contrario se rechaza toda la transacción, pues el remanente nominal no es comparable.
Misma moneda usa tasa identidad; moneda extranjera requiere tasa histórica del catálogo consultada con
el cliente transaccional. El proveedor preserva `Prisma.Decimal`; tasas no representables por el campo
`Decimal(20,10)` (más de 10 decimales o tasa ≥ 10^10) se rechazan antes de persistir. El helper FX calcula conversión exacta, exige precisión
funcional máxima de cuatro decimales y genera fingerprint v2/procedencia `CATALOG_RATE`; ausencia de
política/tasa falla antes de crear la CxC.
RED/GREEN: helper FX 7/7, proveedor histórico 4/4, action 37/37, regresión CxC 5/5 y precio de catálogo
3/3 (56/56); typecheck y ESLint focal pasan.
La integración PostgreSQL `src/features/venta-servicios/__integration__/service-credit-cxc-real.test.ts`
pasó 2/2 contra la base desechable `tcp_test_shadow_rev_contabilidad` (puerto 55437): trigger SQL
que rechaza el INSERT de CxC revierte la venta y las referencias a servicio/cliente de otro tenant
no escriben filas. El test ahora invoca `assertDisposableDatabase(process.env)` antes de inicializar
Prisma, independientemente del config de Vitest. La acción se invoca directamente; no certifica
autenticación HTTP. Siguen sin cubrirse los demás writers/cobros ni la liquidación FX de CxC.
La acción valora crédito sin anticipos y crédito parcial con anticipos en moneda compatible; R4.2, CxC 1–3,
R0.5/R6 y R7 permanecen abiertos, sin habilitar shadow/enforce/replay.

**R0.5 inventario reproducible (2026-09-27):** se añadió
`src/features/contabilidad-formal/__tests__/writers-matrix.test.ts`, que recorre el árbol
productivo, excluye definición/tests/integración y verifica que los **37 callsites en 24
archivos** de `postEvento(` estén reflejados en `matriz-writers-r0.5.md`. RED reprodujo el
drift del encabezado histórico (29/18); GREEN pasó el test focal, ESLint y `git diff --check`.
Esto cierra el inventario mecánico, no la semántica de cada writer: R0.5/R6 siguen abiertos
por permisos, FX, autorización real, concurrencia e integración faltante.

**R0.5/R1 writer COBRO_SERVICIO (2026-09-27, parcial):** RED en
`src/features/venta-servicios/__tests__/actions.test.ts` reprodujo pérdida de precisión al
convertir `Prisma.Decimal` a `Number` antes de `postEvento` (`9007199254740993.125` llegaba
como `9007199254740994`). GREEN elimina esas conversiones y pasa los valores Decimal de la
reconciliación persistida; si falta `montoConvertido`, falla cerrado antes del posteo. La
regresión del action pasó 30/30, ESLint, typecheck y diff-check. La fila 23 queda PARCIAL:
faltan integración PostgreSQL, rollback/cross-tenant real y autorización HTTP end-to-end.

**Liquidación compartida de CxC de ventas (2026-09-28, parcial):** `AccountingReconciliationService.reconcileSale`
separa el principal nominal del importe funcional; liquida según principal, acumula ambos montos
en sus unidades respectivas y envía la diferencia entre la tasa de reconocimiento persistida y
la tasa del cobro al asiento formal como ganancia/pérdida cambiaria. Actualiza saldo CxC, banco,
reconciliación y posteo dentro de una sola transacción; un error debe revertir el conjunto. La
unidad rechaza antes de escribir si moneda/snapshot CxC no permite comparar o si la moneda del
cobro no coincide (`FX_INSUFICIENTE`). La validación compara el saldo funcional de reconocimiento
redondeado a `Decimal(20,4)` con `Prisma.Decimal.ROUND_HALF_UP` contra `montoDeudaFuncional`.
También calcula FX de cobro entre importes funcionales redondeados a cuatro decimales
(`ROUND_HALF_UP`), evitando precisión mayor que la escala aceptada por el motor formal.
El valor libro liquidado en cada pago ahora se asigna por la diferencia entre las asignaciones
acumuladas redondeadas antes/después del principal nominal; el pago final absorbe el residual de
cuatro decimales. Regresión multi-cuota: CxC USD 0.01 reconocida a 1.2345, dos pagos USD 0.005
a 1.25 → FX 0.0001 y luego 0.0002; clearing del valor libro persistido 0.0123. La corrección
ya está en el servicio.
RED/GREEN focal: tasa histórica 1.2345678901, saldo funcional persistido 1.2346, cobro a 1.25
→ diferencia 0.0077. Tras la corrección residual, las cuatro suites focales pasan 67/67;
typecheck completo, ESLint focal y `git diff --check` también pasan. La integración PostgreSQL
de rollback se añadió, pero **NO ESTÁ VERIFICADA**:
la base desechable local no estaba disponible (conexión rechazada; el directorio no contiene
`PG_VERSION`); no contarla como evidencia pasada.

Alcance incompleto: el writer de pago de crédito por servicios aún no actualiza el saldo CxC;
las rutas directas Server Action/web y los lectores CxC no están adaptados/certificados por esta
rebanada. Los demás writers y lectores siguen pendientes; liquidación de moneda incompatible
permanece fail-closed. R0.5/R4/R7 no se cierran ni se habilita `shadow`, `enforce` o replay.

**Addendum — liquidación shared de CxC de servicios (2026-09-28, parcial):**
`AccountingReconciliationService.reconcileService` (fuente actual alrededor de `:715+`) ahora
actualiza CxC, banco, reconciliación y posteo `COBRO_SERVICIO` en una sola transacción. Mantiene
principal nominal separado del funcional y asigna valor libro por diferencia entre acumulados
redondeados, con residual en el pago final. Unit `src/features/contabilidad/services/accounting-reconciliation-service.test.ts`
18/18 PASS; ESLint focal, typecheck completo y chequeo de whitespace de archivos rastreados pasan.
La revisión fresca no encontró hallazgos materiales. Las pruebas cubren rechazo antes de writes
financieros si el saldo funcional inicial no es cero con historial vacío, aceptación de `null`
y Decimal cero, y rechazo de historial con principal/funcional incompatibles. La integración
PostgreSQL no se volvió a ejecutar y sigue **NO VERIFICADA**.

Esto solo cierra la lógica shared del método; no equivale a cerrar sus adaptadores. El writer
directo de Server Action, ruta web/API independiente, handler legacy y lectores CxC siguen
pendientes, al igual que brechas de matriz/gates R0.5/R4.2/R6/R7. No habilitar `shadow`,
`enforce` ni replay.

**Addendum — autorización y gates de liquidación de servicio (2026-09-28):** se corrigió evidencia
histórica de la ruta web y del método shared: RED mostró `reconcileService` aceptando usuario no
admin sin permiso y POST web respondiendo 404 donde debía responder 403. Ambos writers ahora
llaman `requirePermission(user, 'financiero.contabilidad.acceder')`; la ruta conserva
`requireFeature('servicios')`, toma advisory lock por tenant y ejecuta claim condicional. FX válida
persiste evidencia; FX extranjera ausente se rechaza antes de abrir transacción. Unit de servicio y
ruta: 26/26 (19+7); ESLint focal, typecheck completo y chequeos de whitespace scoped pasan. La prueba
web comprueba también `requireFeature('servicios')`. La revisión fresca previa no halló issues
materiales; la revisión posterior a la aserción de feature está pendiente y no se atribuye un
resultado. `pnpm run typecheck:tests` terminó OOM cerca de 2 GB; no se cuenta como gate aprobado.

Pendientes verificados: integración PostgreSQL/rollback real y cobertura CxC, precheck de fuente de
saldo antes de abrir tx y `AuditLog` posterior al commit. El permiso explícito no cierra los demás
canales: writer directo Server Action, web/API independiente, handler legacy y lectores CxC siguen
separados y pendientes; la feature `servicios` está en los callers mobile/web. R0.5/R4.2/R6/R7 siguen
abiertos; no habilitar `shadow`, `enforce` ni replay.

**Addendum — feature gate en servicio shared (2026-09-28):** una revisión fresca encontró que
`reconcileService` no exigía la feature `servicios` dentro del método y un usuario no admin con
permiso financiero pero `planFeatures.servicios:false` podía conciliar. Ahora, antes de abrir la
transacción, aplica `requireTenant` → `requireFeature(user, 'servicios', ...)` →
`requirePermission(user, 'financiero.contabilidad.acceder')`. RED/GREEN: el nuevo caso exige
`FEATURE_NOT_AVAILABLE` y verifica que no se abre la transacción. Verificación independiente
combinada: servicio 20/20 + route 7/7 = 27/27; ESLint focal, `pnpm run typecheck` completo y
whitespace scoped de archivos rastreados/no rastreados pasan. Fresh GPT-6 Luna review del guard y
test sin hallazgos; review previo de los cuatro archivos de permiso y del assertion de feature de
route sin problemas materiales. `pnpm run typecheck:tests` continúa OOM (~2 GB), no es pase.

Quedan pendientes el rollback/integración PostgreSQL de CxC parcial/final, el precheck de fuente
de saldo antes del tx y `AuditLog` posterior al commit. El writer directo de Server Action, route
web/API independiente, handler legacy, lectores CxC y gates R0.5/R4/R6/R7 siguen abiertos; no
activar `shadow`, `enforce` ni replay.

**Addendum — preflight y movimiento de cuenta origen en el writer shared (2026-09-28, unit verificado; parcial):**
RED añadió regresiones para saldo origen insuficiente previo a la transacción y para mover el importe
funcional entre cuenta origen/destino en una sola transacción. GREEN consulta el tipo de pago y el
saldo origen antes de abrir tx, agrega importes funcionales por cuenta y rechaza insuficiencia; dentro
de la transacción vuelve a resolver tipo de pago y aplica débito condicional (`saldo >= importe`) más
crédito funcional a destino, evitando carrera entre precheck y escritura. La review detectó también
que filas históricas con `reconciliado=false` pasaban la validación inicial, pero no coincidían con el
update final que solo reclamaba `null`; RED/GREEN amplió el compare-and-set a `null OR false`,
preservando tenant e ID. El conjunto enfocado quedó en 24/24 tests del servicio + 7/7 de route =
31/31; ESLint focal, typecheck completo y diff-check pasaron. Fresh GPT-6 Luna review sin hallazgos
materiales. La capa SQL de rollback y liquidación CxC parcial/final aún no se pudo verificar: el puerto
PostgreSQL desechable 55437 no responde. Esto no cierra `AuditLog` post-commit ni los otros writers,
lectores y gates R0.5/R4.2/R6/R7; no habilitar `shadow`, `enforce` ni replay.

**Addendum — atomicidad del replay histórico por período (2026-09-29, verificado focal):**
RED confirmó que `ejecutarBackfillAutorizado` abría una transacción para revalidar y confirmar
`RUNNING`, y otra para contabilizar: el nuevo test exigió exactamente una transacción serializable.
Ahora lock, revalidación de licencia/permisos/aprobación/digest, run `RUNNING`, asientos, vínculos
`replayRunId`, conteos, diagnóstico y `COMPLETED`/`NO_CONFORME` se confirman en una sola transacción.
Un savepoint después de crear el run permite que un fallo manejado revierta todos los asientos y
registre `FAILED` dentro de la misma transacción; una falla al commit revierte run y ledger juntos,
permitiendo reintentar el mismo preflight. Se añadió una prueba de límite de importación: en código
de producción solo el servicio autorizado puede importar `replayEvento` (uso directo en tests sigue
permitido).

Verificación: servicio unitario + límite de importación 47/47; integración PostgreSQL 7/7 en la
base nueva `tcp_test_replay_atomic_sep29`, loopback `127.0.0.1:55437`, con 125 migraciones aplicadas.
Incluye trigger SQL para fallo posterior al primer asiento y retry con `FAILED` durable, y fallo
diferido al commit que confirma cero asientos y cero runs persistidos antes del retry exitoso. ESLint
focal y `git diff --check` pasan; `graphify update .` ejecutado. Revisión fresca aún pendiente; no
se marca el gate R5.4/R5.5 cerrado ni se habilita `shadow`, `enforce` o replay.

**Addendum — posting SQL concurrencia/rollback/FX (2026-09-29, slice focal; R1.4/R1.5 parciales):**
La integración contra DB real agregó rollback de operación ante plan ausente/descuadre,
concurrencia de mismo y distinto origen, secuencia/hash y herencia de tasa/fingerprint FX. RED
reprodujo fallo concurrente concreto: el segundo mismo-origen post intentaba capturar `P2002` y
consultar dentro de la transacción PostgreSQL ya abortada (`25P02`). GREEN revalida el origen tras
adquirir el advisory lock tenant; el mismo origen retorna el asiento ganador.

Verificación: DB nueva `tcp_test_r1_posting` en `127.0.0.1:55437` (arturo sin password), 125
migraciones existentes aplicadas; casos focales 5/5; unitarios `posting-engine` + decimal 55/55;
typecheck, ESLint focal, `graphify update .` y `git diff --check` pasan. La suite de integración
completa no queda cerrada: 4 fallos pendientes (verificador hash y contrato/recuento de
replay/backfill, que ahora exige preflight aprobado). Se observaron antes y después del fix de
lock, pero después de ampliar tests/fixtures; no hay baseline anterior al slice para atribuirlos
como preexistentes. No se marca R1.4/R1.5 completos;
hash-versioning y reparaciones de replay quedan fuera de este slice. Fixture precisó sembrar CUP
porque la migración formal agregó FK de moneda funcional.

Revisión fresca GPT-6 Luna y reejecución del coordinador: integración completa **16/20**,
con los mismos cuatro fallos. La cadena sana ya falla antes de manipularla: writer y verificador
ordenan por `createdAt/asientoId`, no por el orden de adquisición del lock; PostgreSQL fecha la
transacción desde su inicio, por lo que concurrencia puede romper esa suposición. Esto está
conectado a R1.5 y **no** se considera un fallo ajeno. La reconsulta de origen bajo lock resuelve
la carrera verificada en READ COMMITTED; falta demostrar el comportamiento con snapshots de
REPEATABLE READ/SERIALIZABLE y retirar la recuperación por consulta después de `P2002` en tx
abortada. R1.4/R1.5 permanecen abiertos hasta resolver orden/hash versionado y dichos límites.

**Addendum — secuencia tenant y hash versionado (2026-09-29, verificado focal; R1.5 parcial):**
Autorizada la migración aditiva `20260929120000_asiento_tenant_hash_sequence`: campos
nullable `hashVersion` y `tenantSequence`, índice único por tenant/secuencia. No asigna
cronología ni versión a filas históricas y no reescribe hashes ni líneas. SQL RED detectó el
nombre físico incorrecto `Asiento`; se corrigió únicamente esta migración candidata para
`asientos` conforme a `@@map`. GREEN: 126 migraciones aplicadas a la BD desechable nueva
`tcp_test_r1_hash_sequence`, loopback `127.0.0.1:55437`, con URLs explícitas.

Los nuevos asientos usan `canonical-v2`, decimales exactos y secuencia global por tenant bajo
el lock. El helper puro compartido `hash-chain-integrity.ts` valida la cadena completa antes
de verificar, inicializar o insertar: versiones reconocidas, hashes exactos, raíz única,
sin bifurcaciones/ciclos/desconexiones y secuencia contigua `1..N`. La inicialización interna
`inicializarMetadataCadenaHistorica` exige prueba exacta de serializer legado numérico o
Decimal-string y topología íntegra antes de asignar metadata; una reejecución también valida
metadata ya poblada. Historial no clasificado o corrupto bloquea nuevos asientos. Solo la
versión legada numérica usa `Number`; v2 y legado Decimal conservan strings exactos.
La validación completa por inserción es O(N) por tenant: coste explícito por integridad,
pendiente evaluar rendimiento antes de una habilitación operativa.

RED/GREEN focal: 61/61 unitarios engine/verificador. Coordinador reejecutó regresión ampliada
engine/verificador/decimal/replay: **116/116**. SQL focal **5/5** incluye versión nueva,
inicialización/reintento sin cambiar hashes ni líneas, inversión determinista del orden de
inicio/lock, detección de manipulación y Decimal(20,4) grande con fracción. Reejecución SQL
completa del coordinador: **20/23**, tres fallos de replay ya observados antes de este slice
(preflight no aprobado en dos casos y replayables esperado 2 obtenido 1). Typecheck habitual,
ESLint focal y diff-check pasan; Graphify actualizado. Revisión fresca GPT-6 Luna detectó
metadata poblada no validada, secuencias faltantes, append sin prueba completa y pérdida de
precisión v2; todos corregidos con regresiones. Revisión final sin P1/P2 en el alcance.

R1.4/R1.5 siguen sin marcar completos: pendiente política/reintento probado bajo snapshots
REPEATABLE READ/SERIALIZABLE y recuperación segura de P2002, aceptación de todos los callers,
las tres pruebas replay y gate estricto de declaraciones externas de R1.2. No se aplicó
migración/initializer a producción ni se habilitó shadow, enforce o replay.

**Addendum — aceptación SQL replay retomada (2026-09-29, pruebas focales verdes):**
Tras la interrupción se verificaron los cambios guardados de fixtures antes de repetirlos.
Las pruebas antiguas ejecutaban replay sin preflight aprobado y contaban como válida una
reconciliación `tipoGasto='gasto'` con referencia ficticia, que el contrato actual omite. Las
fixtures positivas ahora contienen dos fuentes válidas y generan preflight/aprobación mediante
los servicios reales, con responsables activos distintos del solicitante. Los tests usan los
IDs exactos de esa autorización; no se insertan aprobaciones manuales ni se desactiva el gate.

Se conservó la cobertura negativa: replay sin aprobación y autoaprobación se rechazan sin
run/asiento; la fixture antigua de gasto se omite expresamente con
`TIPO_GASTO_NO_VERIFICABLE`. El trigger SQL falla en la segunda fuente válida y exige cero
asientos/líneas junto a un run `FAILED` durable. El recorrido exitoso contabiliza ambas fuentes
con cuadre Decimal exacto; el reintento autorizado devuelve dos ya posteados, cero nuevos y
exactamente dos asientos persistidos. No hubo cambios de lógica de producción en este slice.

Verificación actual PostgreSQL 17.6: **36/36** (posting-engine 29 + backfill 7), tras aplicar las
126 migraciones existentes a una base nueva `tcp_test_replay_acceptance_resume` en una
instancia temporal propia en loopback 55437. Incluye las siete pruebas autorizadas/atómicas
anteriores, sin modificar esa suite. Unitarios replay/actions/límite de importación **54/54**;
ESLint focal, typecheck habitual y diff-check pasan. Un fallo adicional al ampliar la prueba
negativa fue una fixture sin `descripcion` requerida, corregida sin alterar producto.
La instancia temporal se detiene al terminar; no se tocó la instancia PostgreSQL habitual.

No se lanzó otro modelo: la herramienta de reanudación rechazó `gpt-6-luna` como no disponible;
el coordinador completó y verificó localmente estas pruebas. No se declara una revisión fresca
por subagente de este slice. R1/R5 y el objetivo global no se marcan completos: adopción de
reintentos en callers, gate estricto externo, capability privada del bypass y demás R2–R7
continúan separados. No hay publicación, commits ni habilitación de modos.

**R5.5 — refuerzo del límite de importación (2026-09-29, gate parcial):**
`replay-event-boundary.test.ts` ahora analiza AST TypeScript y detecta acceso al módulo de replay
por import nombrado/aliasado, namespace, reexport, `import()` dinámico, `require()` e import-equals;
solo admite otros imports nombrados que no expongan `replayEvento`. Los casos sintéticos y el
escaneo del árbol de producción pasan (2/2), junto con ESLint focal, typecheck y `git diff --check`.
Esto cierra evasiones del gate estático previo, pero no crea una capability privada en runtime ni
cierra R5.5. No modifica lógica de producción ni habilita replay.


**Cierre técnico R5.5 (2026-09-29):**
- RED verificó que `replayEvento` aceptaba un evento válido sin autoridad runtime. GREEN exige
  una capability no falsificable registrada en una WeakMap privada; su emisión revalida en la
  transacción el run `RUNNING`, preflight, aprobación independiente, digest, vigencia exacta,
  licencia y permisos actuales. Se liga a tx/tenant/actor/período y payload exacto de la fuente
  aprobada. Copiar o serializar el token no conserva autoridad; `finally` la revoca.
- El engine vuelve a comprobar la autoridad inmediatamente antes del INSERT, después del lock
  y las lecturas asíncronas. Una prueba determinista inicia un replay sin esperarlo, revoca la
  capability y libera la lectura bloqueada: se rechaza sin crear asiento. El bypass mantiene
  evidencia `authorityVersion=r55-runtime-v1`; su factory y el entrypoint siguen bajo el límite
  estático de importación. No existe emisión pública sin validación de autorización persistida.
- La planificación también requiere permiso contable. Las actions rechazan tenant/actor
  inyectados y derivan ambas identidades de la sesión autenticada; conservan run/status/diagnóstico
  y no devuelven éxito cuando falla la ejecución.
- La conciliación posterior, dentro de la misma transacción, compara el snapshot aprobado con
  las fuentes del ledger realmente persistidas: identidad única, tenant/período/fecha/semántica,
  lineage de los nuevos asientos, balance Decimal exacto, validez de líneas y ancla de valoración
  original/funcional/tasa/fingerprint. Registra diferencias y `NO_CONFORME` por discrepancias u
  omisiones. El resultado expone `replayRunId`, estado, conteos y conciliación. Una alteración SQL
  deliberada de `0.0001` produce una diferencia durable exacta sin anunciar conformidad.
- La conciliación se declara **APPROVED_SOURCE_SNAPSHOT**, no conciliación global de rubros o
  plantillas de R4, y devuelve siempre `enforceReady=false`. No permite promover a `enforce`.

Verificación final: **127/127 unitarios focales** (6 suites), **37/37 integraciones SQL**
(posting-engine 29 + backfill 8), typecheck habitual y ESLint focal verdes. SQL se ejecutó tras
126 migraciones en la base nueva `tcp_test_r55_capability`, únicamente en PostgreSQL 17.6
propio/desechable en `127.0.0.1:55437`; la instancia quedó detenida y verificada. La revisión
independiente y sus deltas usaron explícitamente **GPT-6 Luna**, sin bloqueantes. El reporte
V8 focal indicó 100% statements/functions/lines y 89.62% branches en los dos módulos nuevos;
advirtió versiones mezcladas Vitest 3.2.4/coverage-v8 3.2.7, por lo que no se considera una
certificación del gate global de cobertura/CI ni se cambiaron dependencias para ocultar el aviso.

Este cierre actualiza solamente R5.5. R5.4 conserva su estado documental pendiente, R4 y los
restantes gates R1–R7/aceptación operativa continúan separados. Sin commit/push, migración en
producción ni activación de shadow/enforce/replay.

**Nota terminal R1.2/R1.5 (2026-09-29):** prevalece la decisión de `DESCARTADO` indicada
arriba para ambos criterios de cierre de esta change. Las referencias anteriores a
«pendiente» son estados históricos, no tareas activas ni evidencia de cumplimiento.
Ninguno se marca `[x]`; se conservan las implementaciones y pruebas verificadas sin
autorizar activación operativa.

**Slice R0.5/R6.1 — writer VENTA_CREDITO (2026-09-30, parcial):**
RED reproducible con `pnpm exec vitest run
'src/features/ventas/services/__tests__/facturacion-workflow-venta-credito.test.ts'
-t 'crédito funcional no requiere banco ni tipo de pago'`: el workflow rechazaba con
`Error: No hay tipos de pago activos para ...` al intentar resolver tesorería en una
venta a crédito. La salida completa no se conserva; se registra solo el fallo principal
reportado por el subagente, sin presentarlo como transcripción exacta.

GREEN: la rama de crédito ya no consulta cuenta bancaria ni tipo de pago; usa la moneda
funcional de `TenantAccountingPolicy` cuando no existe moneda explícita y exige
`monedaOriginal` + evidencia FX v2 para moneda extranjera. La CxC persiste el snapshot
monetario en la misma transacción y el evento se reconstruye desde la fila persistida.
La suite focal de siete archivos pasó **70/70**; typecheck con heap 8192, ESLint focal y
`git diff --check` pasaron; `graphify update .` fue ejecutado. Se añadieron regresiones
para crédito sin tesorería, valoración CUP/FX explícita, ausencia de política/tasa,
reintento/origen estable, fail-closed histórico y rollback.

**Corrección de compatibilidad por modo (2026-09-30):** RED adicional con
`CONTABILIDAD_FORMAL_MODE=off` reprodujo que una CxC sin política monetaria fallaba con
`FX_INSUFICIENTE` antes del no-op del motor. GREEN hace que `off` conserve el flujo legacy
sin consultar política ni exigir valoración. En `shadow`, la falta de policy/FX conserva la
operación y envía un evento no valorizado al motor para registrar el fallo; `enforce` sigue
siendo fail-closed. La prueba de CxC histórica sin snapshot quedó cubierta en `off` y
`enforce`.

Se añadió fail-closed de moneda extranjera sin `monedaOriginal` explícita y de cambio del
monto nominal de una CxC existente en `enforce`; el snapshot histórico no se sobrescribe.
En `shadow`, discrepancia nominal conserva caja/CxC y manda al motor un evento no valorizado,
evitando simular un asiento correcto con un valor desalineado. La acción de facturación de
ofertas ahora exige `ventas.ofertas.gestionar`; el workflow propaga la moneda real de los
servicios leída dentro de la transacción y combina códigos cuando hay varias monedas, para
que el writer formal no las reclasifique como moneda funcional sin evidencia.

**Aceptación PostgreSQL de VENTA_CREDITO (2026-09-30):** RED de integración mostró que el
fixture anterior no creaba ningún asiento porque carecía de licencia, plan de cuentas y
período; la CxC pasaba aunque `postEvento` devolvía `OMITIDO`. Se completó el fixture formal
real (plantillas, roles, licencia, política y período) y se exige asiento persistido cuadrado.
En `tcp_test_r61_venta_credito` (127 migraciones aplicadas, PostgreSQL desechable en
127.0.0.1:5433), las dos suites focales pasaron **13/13**: asiento CUP cuadrado, USD con tasa,
fecha, monto original y fingerprint FX heredados por ambas líneas, reintento idempotente,
dos transacciones concurrentes sobre una factura con un solo asiento/CxC, outbox durable
`ERROR_SHADOW` sin FX, fail-closed enforce, aislamiento tenant y rollback SQL.
El test verificó por SQL posterior que no quedaron tenants/CxC/asientos con prefijo `r61-`.

Verificación final: **70/70 unitarios** (7 suites), **13/13 integraciones PostgreSQL**, typecheck
completo `tsc --noEmit --incremental false` con heap 8192, ESLint focal y `git diff --check`
verdes; `graphify update .` ejecutado. La unión `CreditoOverridePermission` ahora incluye
`ventas.venta.credito-override`, resolviendo el diagnóstico previo del typecheck. Se probó
el permiso de facturar ofertas en Server Action: manager sin permiso recibe `FORBIDDEN` antes
de consultar la oferta. Callers revisados: `venta-mutation-service` usa permiso/tenant de
usuario autenticado; `venta-lifecycle-service` exige feature y permiso de pedidos; oferta
exige feature y permiso explícito, actor/tenant derivados de `withAction`.

Esta slice de VENTA_CREDITO está implementada y verificada en su flujo formal, callers y
transacciones reales; la matriz marca la fila 3 cerrada. El gate R0.5/R6 global permanece
`[ ]` por cobertura y aceptación de los otros 36 callsites/writers. No activar `shadow`,
`enforce` ni replay en producción.

**Continuación R0.5 — venta al contado POS (fila 2; 2026-09-30):** la función exportada
`reconciliarVentaDirecta` (fila 1) no tiene callers de producción: code graph y búsqueda
del árbol solo encuentran definición y tests; se registra como no activa, no como writer
operativo aceptado. La ruta activa es `applyFacturacionCobroWorkflow` con `contra_pago`,
llamada desde el POS. RED/GREEN de caller/actions+builder: **41/41 tests** (3 suites).
Integración real `formal-shadow-cash-sale.test.ts`: ahora **8/8** en `tcp_test_r61_venta_credito`:
asiento CUP real cuadrado con actor/tenant correctos y evidencia identity persistida; cuenta
USD sin tasa/fingerprint falla cerrado y revierte venta, factura, reconciliación, saldo y
stock; fallo SQL del asiento en shadow conserva venta/outbox `ERROR_SHADOW`; fallo SQL del
outbox revierte todo el writer. `createVentaAction` prueba el permiso
`ventas.venta.registrar` en unitarios. Las filas temporales append-only se conservan en la
base desechable dedicada por el guard de historial; no tocarla fuera de estas pruebas.
Fila 2 cerrada para `contra_pago` con FX funcional/evidencia; no se afirma soporte de cobro
extranjero sin valoración. El writer inactivo de fila 1 permanece fuera del inventario de
producción. R0.5/R6 global continúa abierto.

**Continuación R0.5 — COSTO_VENTA_DEVENGADO (fila 4; 2026-10-01):** RED PostgreSQL
agregó un lote USD con costo unitario 300 y tasa/fingerprint persistidos, y reprodujo el
defecto: el asiento registraba 300 CUP en lugar de 7,200 CUP. El FIFO anterior sumaba
`precioUnitario` sin moneda/tasa y el event builder fijaba CUP.

GREEN introduce `getCostoFifoVentaValorado`: consulta asignaciones tenant-scoped, exige
política funcional y valida moneda, tasa, fecha, fingerprint, procedencia/versionado de cada
compra extranjera. Convierte cada asignación con `Prisma.Decimal` y rechaza evidencia ausente
o alterada, escala funcional superior a cuatro decimales o rango superior a Decimal(20,4).
Compras nativas en moneda funcional se agregan sin conversión. El event builder recibe la
moneda funcional real. `off` conserva legacy sin lookup formal; `shadow` conserva caja y deja
outbox si el costo no es valorizable; `enforce` revierte la venta completa.

Verificación: unitarios FIFO/venta/event builder/actions/hook **94/94 en 8 suites**.
PostgreSQL desechable `tcp_test_r61_venta_credito` en 127.0.0.1:5433,
`formal-shadow-cash-sale.test.ts` **8/8**: COGS USD 300×24→CUP 7,200 balanceado, suma de
asignaciones con diferentes monedas/tasas, `shadow` durable sin FX, `enforce` rollback por
FX ausente y trigger SQL de fallo en INSERT del asiento que revierte venta, inventario y FIFO.
Typecheck `tsc --noEmit --incremental false` heap 8192, ESLint focal, `git diff --check` y
Graphify pasan. El caller de compra actual almacena snapshot FX v1 `MANUAL_GOVERNED`; el
writer no infiere tasa si falta. Fila 4 cerrada; R0.5/R6 global permanece abierto.

**Continuación R0.5 — DEVOLUCION_VENTA (fila 5; 2026-10-01):** RED en
`event-builders.test.ts` reprodujo USD devuelto etiquetado como CUP con monto funcional
nominal, pese a una tasa fuente explícita. GREEN introduce `resolverValoracionDevolucion`:
con CxC original FX v2 valida el snapshot/fingerprint y convierte devoluciones parciales a la
tasa de reconocimiento; ventas funcionales sin CxC usan la política del tenant. La tasa
aislada de `Factura` ya no es autoridad. Sin snapshot en CxC histórica o pago extranjero sin
fuente unívoca se falla cerrado; shadow conserva la devolución y registra outbox.

El costo FIFO restaurado usa las cantidades efectivamente devueltas y convierte cada lote
desde el snapshot de compra en la misma moneda funcional; sin FX, enforce aborta antes de
terminar y shadow marca el evento no valorado. Al aplicar la devolución a CxC se incrementa
también `montoPagadoFuncional` con la misma tasa origen cuando esa columna tiene historial
comparable. Nota de crédito, devolución, anticipos y evento conservan la moneda origen.

Verificación: **58/58 unitarios** en valoración, servicio, esquema, action, FIFO y event builder.
PostgreSQL desechable `tcp_test_r61_venta_credito`, `devolucion-fifo.test.ts` **5/5**:
devolución de USD 1,000 desde CxC reconocida a 24 genera 24,000 CUP en las líneas de ingreso,
hereda fingerprint original, COGS FIFO reabierto 4,800 CUP, actualiza CxC nominal/funcional
(1,400 USD / 33,600 CUP), balancea asiento y un trigger SQL al asiento prueba rollback completo
de devolución/item/kardex/CxC. También se verifica enforce fail-closed y outbox shadow durable
para CxC histórica sin snapshot. Typecheck completo, ESLint focal, diff-check y Graphify pasan.
Fila 5 cerrada; R0.5/R6 global continúa abierto.

**Continuación R0.5 — action COBRO_CXC (fila 6; 2026-10-01):** RED de permiso mostró que
`reconciliarVentaAction` llegaba a NOT_FOUND/DB sin `requirePermission`. La action tenía lógica
duplicada de reconciliación y sumaba `monto * tasa` con `Number`, sin actualizar
`montoPagadoFuncional`. GREEN exige `financiero.contabilidad.acceder` antes del writer y
delegó la operación a `AccountingReconciliationService.reconcileSale`; el servicio compartido
mantiene lock/tenant/cuenta/FX, CxC nominal+funcional, diferencia FX, asiento y tesorería en una
sola transacción. La action obtiene y pasa el `fxCatalogRateId` del proveedor, además de mantener
su gate de período y auditoría.

Verificación: unitarios de reconciliación **40/40 en 5 suites**; PostgreSQL desechable nuevo
`tcp_test_devolucion_20261001` (schema sincronizado con Prisma y `Servicios.tenantId` presente),
`reconciliar-servicio-real.test.ts` **16/16**. Cubre action delegando con actor real/permiso,
shared mobile, CxC USD principal/funcional y delta FX, rollback SQL, permisos, referencias
tenant-scoped y POST legacy con evidencia. Typecheck completo, ESLint focal, diff-check y
Graphify pasan. La verificación fue posible tras sustituir el DB test de esquema incompleto por
uno desechable generado desde el schema vigente.

La fila 6 queda cerrada. La fila 7 (POST web legacy) sigue PARCIAL: el test SQL confirma FX y
asiento heredado, pero ese handler conserva implementación separada y actualiza CxC nominal sin
ajustar `montoPagadoFuncional`; rollback/login real del endpoint aún no se han cerrado. R0.5/R6
global permanece `[ ]`.

**Primer arreglo secuencial de la revisión de cierre (2026-10-03, deuda cash):** el RED PostgreSQL
en `deudas-cash-real.test.ts` reprodujo 2/2 pagos aceptados de 600 sobre deuda 1.000 tanto en web
como en el servicio, dejando recibos 1.200 y CxP 600. GREEN: ambos writers adquieren el lock de
tenant antes de releer deuda/CxP, revalidan saldo bajo lock y usan escrituras condicionales para
CxP, deuda y saldo origen. El web sigue devolviendo su forma de respuesta; excedente debido a
cambio concurrente se expresa como conflicto.

Verificación focal GREEN: `deudas-cash-real.test.ts` 12/12 (incluye web/servicio concurrentes,
un recibo/asiento, CxP 600/400 y débito 600), `accounting-cash-operations-mutation-service.test.ts`
8/8, `deudas-cash/__tests__/route.test.ts` 22/22, `deudas-cash-auth-http-real.test.ts` 1/1,
typecheck, ESLint focal y diff-check. Esto resuelve únicamente la carrera del pago deuda cash;
no cierra R0.5/R6 ni la moneda cuenta/documento, tipoPago tenant-scoped, idempotencia de abonos
parciales de servicios, anticipos, garantías SQL de replay/apertura/kardex, auditoría de negocio
best-effort, reconciliación del inventario o ventana operativa R7.3/R7.4.

**Arreglo secuencial (2026-10-03, valoración cash debts/loans; decisión del usuario):**
se acepta pago extranjero de obligación CUP y se convierte el principal a CUP con la tasa indicada.
`resolveCashDebtCurrencyAmounts` distingue importe del recibo, importe CxP y movimiento nominal
de banco: deuda CUP + pago USD 10×25 + cuenta CUP reduce CxP/banco por 250; cuenta USD debita 10.
Obligación no-CUP requiere fondos en su moneda; cuenta en moneda tercera sin tasa falla cerrada.
RED PostgreSQL reprodujo 10 registrados en CxP en lugar de 250 en web y servicio; GREEN cubre
web/servicio y móvil Bearer con asiento cuadrado. También crea deuda USD 3,000×24 con cuenta CUP:
el saldo bancario aumenta 72,000 CUP mientras CxP conserva principal 3,000 USD; cubierto en POST
web, servicio canónico y móvil.

Deudas: unit helper 5/5, service 8/8, route 22/22; PostgreSQL
`deudas-cash-real.test.ts` 12/12, `cash-debts-http-real.test.ts` 5/5 y Bearer web 1/1.
Préstamos: service unit 5/5, credit gate 5/5, routes web create/payment 7/7 y 12/12, PostgreSQL
`prestamos-cash-pagar-real.test.ts` 12/12, `cash-loans-http-real.test.ts` 4/4 y
`prestamos-cash-pago-auth-http-real.test.ts` 2/2. Typecheck, ESLint focal y diff-check pasan.
P0 #2 sigue abierto para otros writers y moneda funcional tenant no-CUP; R0.5/R6 siguen
abiertos.

**Verificación de guards SQL y suites de cierre (2026-10-04):** `test:integration` ahora
ejecuta `prepare-disposable-integration-database.mjs`, después
`verify-accounting-sql-guards.mjs` y finalmente Vitest. El harness de DB disposable instala
los triggers de inmutabilidad de snapshots/FX/checkpoints/política, constraints de evidencia
FX de apertura e idempotencia/cuentas de `ReconciliacionServicio`; el verifier falla cerrado
si falta alguno de los objetos declarados. Con `ALLOW_DISPOSABLE_TEST_DB=1` y las tres URLs
iguales a `tcp_test_devolucion_20261001` en loopback: PostgreSQL **51 archivos / 299 tests**;
unitarias **754 archivos / 4,894 tests aprobados, 1 omitido y 2 todo**; `pnpm run typecheck`,
ESLint focal y `git diff --check` pasan.

El smoke limpio adicional creó `tcp_test_migrate_guards_20261004` en PostgreSQL 17.6,
loopback `127.0.0.1:5433`; `prisma migrate deploy` aplicó 135/135 migraciones,
`prisma migrate status` reportó el esquema actualizado y
`verify-accounting-sql-guards.mjs` confirmó los guards requeridos. Esto acredita la cadena
versionada desde cero en ese motor/target local; no demuestra estado por ambiente heredado.

**Re-ejecución (2026-10-05):** el guard fail-closed del 04-10 (política funcional
obligatoria en `postEvento`) dejó 13 fixtures de integración sin política; se restauraron en
los 13 archivos (creación de `TenantAccountingPolicy` CUP en el fixture + borrado antes del
tenant) y la suite volvió a cerrar **51/51 archivos y 299/299 tests** en la DB desechable
local (`tcp_test_local`, 46.88 s). `posting-engine.test.ts` 29/29 con el escenario FX en CUP
explícito. Esto re-certifica el estado al 05-10; R0.5/R6 quedan `[ ]`: siguen pendientes el
inventario FX/auditoría de otros writers y la certificación de baseline por ambiente. No ejecutar `migrate deploy` en la DB existente
`tcp_test_devolucion_20261001`, sincronizada por `db push` con 132 migraciones pendientes;
mantener baseline/producción sin cambios hasta aprobación específica.

**Continuación R6 — auditoría de CxC/CxP (2026-10-04):** las actions de crear/actualizar
CxC y crear CxP ya usan `AuditLogService.logStrict` dentro de la misma transacción que la
mutación. La creación de CxP, que antes escribía sin una transacción agrupadora, ahora
devuelve error si el audit insert falla. Tests unitarios en
`src/features/contabilidad/api/__tests__`: 7 archivos/43 tests; typecheck, ESLint focal e
integración PostgreSQL completa (51/299) pasan. El fallo de auditoría en esas tres actions
se prueba a nivel de action mockeada, no como rollback físico PostgreSQL.

También quedaron strict dentro de su mutación la anulación de CxC y las acciones formales
de abrir/cerrar/reabrir/aprobar períodos.

**Clasificación de `AuditLogService.log` restante (2026-10-04):** grep del árbol actual
detectó 27 calls; todas son no atómicas porque `AuditLogService.log` atrapa cualquier fallo
y no recibe el cliente transaccional.

| Grupo / caller | Cantidad | Estado y atomicidad |
|---|---:|---|
| Server Actions exchange: `convertMoneyAction`, `createMonedaAction`, `updateMonedaAction`, `updateTasaCambioAction` | 4 | Activos; conversión/moneda/tasa se escriben antes del log, sin transacción común; fallos del log se absorben. Configuración y conversión no son posteo R0.5. |
| Server Actions de `CierreContable`: create/update/delete | 3 | Activos; mutación directa y log best-effort posterior; no son las transiciones formales de `PeriodoContable`. |
| Server Actions de tipos de pago: create/update/delete | 3 | Activos; config tenant-scoped; escritura termina antes del log, sin rollback por fallo de auditoría. |
| Server Actions de cuentas bancarias: update/delete | 2 | Activos; escritura directa seguida por log best-effort; no mueven el saldo. |
| API tipos de pago: POST, PUT/PATCH y DELETE | 3 | Activas y duplican la superficie de configuración; mutación antes del log best-effort. |
| `api/exchange-handlers.ts`: create/update moneda y create tasa | 3 | No se encontró caller HTTP de mutación; las rutas exchange actuales son GET. Candidatos a retiro/decisión, no writers vivos confirmados. |
| `api/handlers.ts`: inyección/pago capital, CRUD cierre, ajuste bancario | 6 | Sin referencias/callers en `src/`; los writers vivos están en actions/servicios canónicos. |
| `features/admin/actions.ts` | 3 | Mutaciones de administración/licencias, fuera del scope R0.5 contable. |

**FX residual R0.5 (2026-10-04; inventario histórico, reemplazado por la re-inspección del 05-10):** corregidos en esta continuación `reconcileSale` servicio/web
(política tenant dentro de tx, cuenta nativa, importes de cuenta origen/destino persistidos y
CHECK SQL) y `applyPagoGastoWorkflow` (política tenant, log strict por reconciliación, sin
fallback CUP ni movimiento nominal a cuenta tercera). Restan 15 callsites productivos de
`buildPersistedAccountingAmount` con moneda funcional implícita/default CUP: 4 rutas web
cash deuda/préstamo, 4 writers cash compartidos, 4 operaciones transferencia/ajuste/capital,
2 ramas activas de facturación POS/mixta y restock; `reconciliarVentaDirecta` no tiene caller.
El helper de cash debt también codifica CUP en la elección de monedas de obligación/cuenta.
Se necesita resolver tasa a moneda funcional/obligación, delta de cuenta nativa y snapshot
FX por canal. Las columnas nuevas en `ReconciliacionVenta` son opcionales para históricos y
solo se escriben desde los dos canales de reconcileSale; los cash debt/loan, capital y
facturación deben persistir sus propios deltas nativos. `ReconciliacionGasto` todavía carece
de par de importe/moneda de cuenta. Además, `buildPersistedAccountingAmount` conserva
aritmética Number/evidencia FX v1 y sus callers suponen que `tasaCambio` ya expresa la moneda
funcional; falta migrar esos caminos a Decimal/evidencia canónica v2 y vincular tasa, fecha,
fuente/catalog rate y cuenta nativa. Transferencias extranjeras-cruzadas continúan cerradas
por ausencia de quote.
R0.5/R6 siguen `[ ]`; el conteo 32/19 no certifica permisos, valoración, evidencia ni rollback
de cada writer/adaptador, y los logs de configuración listados arriba siguen best-effort.

**FX residual R0.5 (2026-10-05) — slice FX-1 aplicado:** la nota de «15 callsites» del 04-10
estaba desactualizada. La re-inspección y los cambios posteriores dejan política funcional
explícita en los 4 writers cash de `accounting-cash-operations-mutation-service.ts`, las 4 rutas
web cash, `reconcileSale`, `reconcileService`, restock, el pago de deuda de capital y
`pago-gastos-workflow`. Corregidos en este slice: `createBankTransfer`, `createBankAdjustment`
y `createCapitalInjection` (política `TenantAccountingPolicy` dentro del tx tras el lock;
`monedaFuncional` explícita como sexto argumento de `buildPersistedAccountingAmount`;
USD→USD con funcional USD no exige tasa; funcional→extranjera convierte con la tasa de la
pata extranjera; dos extranjeras sin quote cruzada fallan cerrado), las ramas `contra_pago` y
porción contado mixta de `facturacion-workflow.ts` más `reconciliarVentaDirecta` por
consistencia (`requireMonedaFuncionalVenta` en tx; sin política `FX_INSUFICIENTE` antes de
mutar), y la excepción CUP hardcodeada de `resolveCashDebtCurrencyAmounts` generalizada a
`obligación≠fondos && obligación≠funcional`. **Evidencia:** typecheck limpio + 43/43 unit
focales (`cash-debt-payment-valuation` 8/8, `accounting-operations-mutation-service` 22/22,
`facturacion-workflow-gate` 13/13); matriz actualizada (filas 2, 12, 17, 18, 19, 30).
La inspección actual en disco encuentra **18 callsites fuera de tests en 10 archivos**; ninguno usa
el sexto argumento por defecto: helper de reconciliación (1), rutas web cash (4), servicio cash
(4), operaciones contables (4), workflow de facturación (3), POST de reconciliación de ventas
(1) y restock (1). El pago de deuda de capital y `pago-gastos-workflow` ya reciben política,
pero no llaman directamente al helper. Se añadió prueba unitaria MLC para el POST de pago de
préstamo (`route.test.ts`, 13/13). La política explícita está cerrada al invocar el helper; la
aceptación funcional completa por canal/moneda y rollback permanece dentro de R0.5-ACCEPT.
**Rectificación por auditoría 05-10:** una llamada pertenece a `reconciliarVentaDirecta`, sin
caller productivo localizado (17 activas + 1 sin caller). Las cuatro rutas web cash pasan la
política al helper, pero omiten la moneda funcional al construir el evento y este vuelve a CUP.
Ver `auditoria-fx-1-2-4-2026-10-05.md`, que prevalece sobre las notas de cierre FX-2/FX-4.

## Backlog consolidado de cierre R0.5/R6 — 2026-10-04

Los siguientes criterios siguen abiertos aunque las slices anteriores estén verdes.
La auditoría `auditoria-fx-1-2-4-2026-10-05.md` confirma FX-1 solo al invocar el helper y
reabre FX-2/FX-4 por brechas reproducidas de propagación, Decimal/evidencia y fingerprint.

### R0.5 — Valoración funcional y movimiento bancario

- [ ] **R0.5-FX-1 — Mantener política funcional explícita y completar aceptación por canal.**
  Para cada writer registrar política del tenant, moneda de tender/obligación/cuenta, tasa y fecha
  efectiva, fuente/catalog rate, importe funcional y persistencia de importe/moneda nativos.
  Fallar antes de mutar cuando falte tasa, política o quote cruzada.
  **Avance 05-10:** la nota de «15 callsites» del 04-10 estaba desactualizada. Los 18 callsites
  fuera de tests del helper en 10 archivos pasan política funcional explícita; verificación de
  ausencia del default en disco y prueba focal MLC del pago web de préstamo (13/13). La
  aceptación por canal/moneda, incluyendo tasa ausente/vencida y rollback, continúa en
  R0.5-ACCEPT. El inventario incluye 17 llamadas activas y una sin caller productivo localizado.
  **Auditoría 05-10:** F1 cerrado en Fase A el 05-10 (ver abajo): las cuatro rutas web cash
  pasan `monedaFuncionalCodigo` de la política al evento y conservan `Prisma.Decimal`.
  La aceptación por canal/moneda continúa en R0.5-ACCEPT.
  **Decisión de producto 05-10:** mantener rechazo `FX_INSUFICIENTE` cuando la moneda de la
  obligación difiere tanto de la moneda de fondos como de la moneda funcional; no añadir
  conversión adicional a CUP para permitir ese caso.
  - [x] 3 escritores de `accounting-operations-mutation-service.ts`: transferencia,
    ajuste, inyección de capital (política dentro del tx tras el lock; funcional
    explícita al builder; USD→USD con funcional USD sin tasa; dos extranjeras sin quote
    fallan cerrado). El pago de deuda capital ya estaba corregido el 04-10.
  - [x] 2 ramas activas de `facturacion-workflow.ts`: contra-pago y porción contado de
    venta mixta con vencimiento (`requireMonedaFuncionalVenta` en tx; sin política
    `FX_INSUFICIENTE` sin mutación); `reconciliarVentaDirecta` usa política explícita por
    consistencia (sigue sin caller productivo).
  - [x] `resolveCashDebtCurrencyAmounts` (`cash-debt-payment-valuation.ts`): excepción CUP
    hardcodeada generalizada a moneda funcional; caso nuevo funcional USD.
  - [x] Re-inspección final de todos los callsites de `buildPersistedAccountingAmount`
    (05-10, verificada contra el árbol en disco): 18 callsites fuera de tests en 10 archivos y
    **ninguno usa el sexto argumento por defecto** — `accounting-reconciliation-service` (1),
    rutas web de cash deuda/préstamo (4), `accounting-cash-operations-mutation-service` (4),
    `accounting-operations-mutation-service` (4), `facturacion-workflow` (3), POST de
    reconciliación de ventas (1) y `actions-restock` (1). `pago-gastos-workflow`, `compras-productos`,
    `venta-servicios`, `devolucion-venta-service`, `anticipos-workflow` y `mermas` no llaman
    al builder. FX-1 queda cerrado solo al invocar el helper; no incluye la propagación al evento
    ni certifica como activo `reconciliarVentaDirecta` (una de las tres llamadas de facturación).
  - [x] Propagar la funcional persistida al evento de las cuatro rutas web cash; comprobar el
    payload completo y el guard real del posteo para tenants no-CUP (hallazgo F1 de la auditoría).
    **Cerrado 05-10 (Fase A):** `monedaFuncionalCodigo: functionalCurrency` en los cuatro eventos;
    `Number()` eliminados sobre valores persistidos. Evidencia: typecheck limpio +
    `prestamos-cash/[id]/pagar` route 13/13.
  - Criterio de salida: tests RED→GREEN por moneda funcional no-CUP, tasa ausente/vencida,
    cuenta en moneda tender/funcional/tercera, precisión y rollback; actualizar filas de la
    matriz solo con cobertura de cada canal.
- [x] **R0.5-FX-2 — Sacar aritmética `Number` y evidencia v1 de los writers contables.** Migrar
  valoraciones a Decimal exacto, evidencia canónica v2 y snapshot que ligue importe, moneda,
  tasa, fecha efectiva, procedencia y `fxCatalogRateId`; no reinterpretar históricos sin
  evidencia.
  **Avance 05-10 (parcial; reabierto por auditoría):** `buildPersistedAccountingAmount` reescrito sobre
  `buildAppliedFxEvidenceExact`: acepta `number | string | Prisma.Decimal`, devuelve
  `Prisma.Decimal | null` y evidencia v2 con `fxEvidenceJson` + fingerprint SHA-256 canónico;
  sin tasa para moneda extranjera → nulos (fail-closed preservado; los callers lo convierten en
  `FX_INSUFICIENTE`). Lo consumen 13 llamadas fuera de tests en 5 archivos (reconciliación 1,
  cash 4, operaciones 4, facturación 3, restock 1), las 4 rutas web cash y el POST web de
  reconciliación de ventas: 18/10, una sin caller productivo. Utils `prestamo-cash`/`deuda-cash` y
  `cash-debt-payment-valuation` devuelven `Prisma.Decimal`. La afirmación anterior de eventos
  siempre Decimal y Number limitado a bordes Float/Int/UI no se cumple: las cuatro rutas cash
  y el POST web de ventas convierten los valores persistidos a Number antes de construir el
  evento. `pago-gastos-workflow` y valoración extranjera de inventario aún generan evidencia v1.
  Fail-closed nuevo en facturación (venta directa, contra_pago, contado mixto) si la valoración
  no trae evidencia. **Evidencia:** `pnpm run typecheck` limpio + 50/50 unit focales
  (`cash-debt-payment-valuation` 8/8, `facturacion-workflow-gate` 14/14,
  `accounting-operations-mutation-service` 22/22, `accounting-reconciliation-service` 6/6
  incl. caso clásico `0.1 × 0.2 = 0.02` sin error binario y rechazo de >4 decimales funcionales).
  El primer typecheck reportó 36 errores (rutas duplicadas, componentes UI, columnas Float/Int);
  todos corregidos y re-verificados en ese slice histórico; no equivale a aceptación de FX-2.
  **Auditoría 05-10:** 86/86 tests existentes aprobados; probe temporal 6 RED, incluidos evento
  MLC emitido como CUP/Number y evidencia v1 de inventario extranjero. Ver hallazgos F1–F3.
  - [x] Mantener Decimal en los payloads de eventos web cash y reconciliación de ventas.
    **Cerrado 05-10 (Fase A):** cuatro rutas cash + POST `reconciliacion/ventas` sin `Number()`
    sobre valores persistidos.
  - [x] Migrar generación nueva de evidencia en gastos e inventario extranjero a v2;
    preservar compatibilidad explícita de lectura histórica v1. **Cerrado 05-10 (Fase A):**
    `pago-gastos-workflow` e `inventory-cost-valuation` (rama extranjera) generan v2;
    el fingerprint solo cambia para evidencias con `crossQuote` no nulo (transferencias
    cruzadas de los últimos días; sin producción — R7 pendiente — corte limpio documentado
    en la matriz).
  - [x] Proteger todos los campos de `crossQuote` en el fingerprint canónico (compartido con FX-4).
    **Cerrado 05-10 (Fase A):** `canonicalStringify` recursivo; 6 tests nuevos de sensibilidad.
  **Cierre Fase A 05-10:** typecheck limpio + 49/49 unit focales (`fx-evidence` 15/15,
  `inventory-cost-valuation` 6/6, `pago-gastos-workflow` 15/15, `prestamos-cash/[id]/pagar`
  route 13/13). La aceptación por canal/moneda y rollback físico continúa en R0.5-ACCEPT.
- [x] **R0.5-FX-3 — Completar snapshots de cuenta nativa.** Los nuevos campos y CHECKs de
  `ReconciliacionVenta` ya se escriben por `reconcileSale`, su POST web y los writers cash de
  deuda/préstamo (canal web y servicio compartido); el pago web de préstamo tiene caso MLC.
  **Cerrado 05-10:** las tres ramas de facturación que crean `ReconciliacionVenta` (venta
  directa, `contra_pago`, contado mixto) persisten `montoCuenta`/`monedaCuenta` vía
  `resolveAccountingAccountMovement`; `ReconciliacionGasto` ganó el par importe/moneda de
  cuenta (migración `20261005120000_reconciliacion_gasto_moneda_cuenta` con CHECK
  `ReconciliacionGasto_accountAmountPair_check` de paridad atómica) y `applyPagoGastoWorkflow`
  lo llena por cada distribución bancaria; el resultado del workflow expone el snapshot.
  Capital no crea `ReconciliacionVenta` (verificado: nada que completar ahí) y devolución no
  crea reconciliaciones directamente.
  **Evidencia:** `pnpm run typecheck` limpio + 48/48 unit focales
  (`pago-gastos-workflow.test.ts` 15/15 con 3 casos FX-3 nuevos,
  `facturacion-workflow-venta-credito.test.ts` 19/19,
  `facturacion-workflow-gate.test.ts` 14/14 con aserción de snapshot en `contra_pago`).
  Columnas aplicadas a `TCPBD` vía `prisma db execute` + `migrate resolve --applied` +
  `prisma generate` (`migrate dev` inviable ahí por drift histórico preexistente).
  - [ ] Seguimiento fuera del slice: préstamos cash deben crear/actualizar `CuentaPorCobrar`
    con `montoDeudaFuncional`, `montoPagadoFuncional` y `monedaFuncional` (hoy el cobro solo
    acumula `montoPagado` nominal); revisar el snapshot equivalente de CxP para deudas cash.
- [x] **R0.5-FX-4 — Cerrar FX cruzado con política explícita.** Resolver catálogo de pares y
  validar importes por moneda nativa; rechazar las transferencias sin cotización suficiente.
  Los callers sin campo para tasa cuenta deben rechazar antes de crear
  reconciliación, obligación o mover saldo.
  **Avance 05-10 (parcial; reabierto por auditoría):** nuevo `resolveCrossQuote` en
  `src/features/contabilidad/domain/fx-cross-quote.ts` que resuelve A→B desde el catálogo
  `TasaCambio` en orden determinista — par directo → par inverso (1/tasa) → triangulación vía
  la funcional (`tasa(A→F)/tasa(B→F)`) — con búsqueda histórica (`fechaVigencia <= fecha
  operación`) y aritmética Decimal exacta; sin cobertura devuelve null (fail closed).
  `createBankTransfer` lo usa cuando ambas monedas difieren de la funcional: la pata funcional
  (origen→F) valora el asiento con proveniencia `CATALOG_RATE`, `fxCatalogRateId` y
  `rateEffectiveAt` de la vigencia del catálogo; la pata destino se deriva por multiplicación
  con la tasa cruzada (4 decimales) y la cotización queda en `fxEvidenceJson.crossQuote`.
  **Hallazgo F2:** su fingerprint incluye `rate`/`kind`, pero omite monedas, IDs de catálogo y
  fecha de la cotización por el filtro de propiedades de `JSON.stringify`; modificar cualquiera
  de esos cuatro campos no cambia la huella (4 RED). Tasa manual **rechazada** para pares
  cruzados, que requieren cotización persistida; pares F↔X siguen exigiendo tasa manual.
  `montoDestino` informado se valida contra la cruzada con tolerancia 0.0001. Los callers de
  `resolveAccountingAccountMovement` (reconcileSale, reconcileService, restock) mantienen el
  rechazo antes de mutar al no tener campo de tasa cuenta. **Evidencia:** `pnpm run
  typecheck` limpio + 40/40 unit focales (`fx-cross-quote` 8/8,
  `accounting-operations-mutation-service` 26/26, `accounting-reconciliation-service` 6/6).
  Esa evidencia no prueba integridad de los campos anidados. La auditoría vuelve a confirmar
  resolución y rechazo sin quote, pero no acepta FX-4 hasta cerrar el fingerprint.
  **Cierre Fase A 05-10:** fingerprint canónico recursivo en `fx-evidence.ts` (ver matriz);
  typecheck limpio + `fx-evidence.test.ts` 15/15 (6 de sensibilidad a campos anidados + 2 de
  redondeo declarado `HALF_UP_4DP`). La certificación PostgreSQL continúa en R0.5-ACCEPT.
  - [x] Canonicalización recursiva y pruebas de sensibilidad a todos los campos de la cotización.
    **Cerrado 05-10 (Fase A).**
  - [ ] Certificar rechazo sin quote/pata funcional y persistencia de evidencia con PostgreSQL
    dentro de R0.5-ACCEPT; conservar el rechazo acordado para obligaciones sin conversión soportada.

### R0.5 — Certificación completa del inventario

- [ ] **R0.5-ACCEPT — Certificar los 31 callsites/19 archivos y todos sus adaptadores vivos.**
  Para cada writer probar actor/permiso, aislamiento tenant, referencia/origen único,
  moneda/FX, transacción, idempotencia/retry, error de posting/auditoría y rollback SQL.
  Incluir web, Server Actions, móvil y workflows; los unit tests mock no cuentan como prueba
  física de rollback.
  **Fase B 05-10:** matriz sistemática en `matriz-accept-r0.5.md` (31 callsites ×
  adaptadores vivos × 8 dimensiones). Los 31 vivos están en ✅ para actor/permiso, tenant,
  origen, FX, tx y posting/auditoría; G4 cerrado con el retiro de `reconciliarVentaDirecta`
  (sin caller). Gaps para Fase C:
  - [x] G1: rollback físico por fallo de AuditLog en `pago-gastos-workflow` (trigger SQL
    que falle el AuditLog dentro del tx; revierte saldo, obligación, reconciliación y asiento).
    **Cerrado 05-10:** `pago-gastos-workflow-real.test.ts` 2/2; suite 52/52 archivos, 301/301 tests.
  - [ ] G2: reintento/idempotencia física en `pago-gastos-workflow`, `mermas`, `restock`,
    `produccion/completar` (sin evidencia), rutas web cash, `compras-servicios`,
    transferencias/ajustes/capital y devengo directo de `venta-servicios` (parcial).
  - [ ] G3: sesión HTTP real (Bearer 401/201) en `produccion/ordenes/[id]/completar`.
  - [x] G4: decidir `reconciliarVentaDirecta` (retirar con tombstone o excluir formalmente).
    **Cerrado 05-10 — retirar con tombstone:** la función y `ReconciliacionDirectaParams`
    tenían cero callers productivos en `src/` (code graph + búsqueda del árbol, reverificado
    02-10); se eliminaron de `facturacion-workflow.ts` (−102 líneas). Fila 1 de la matriz de
    writers marcada RETIRADO al estilo de las filas 8/13–16; inventario 31 callsites/19
    archivos. Evidencia: `writers-matrix.test.ts` (guard de conteo) y los tests de
    `facturacion-workflow` sin referencias a la función; typecheck limpio.
  - [ ] G5: reintento por adaptador en `accounting-cash-operations-mutation-service`
    (actions + mobile; la evidencia de carrera vive solo en el servicio).
- [x] **R0.5-LEGACY — Resolver los cinco writers/exclusiones históricas y handlers huérfanos.**
  **Cerrado 05-10:** verificadas las cinco tombstones de matriz (filas 8, 13–16): cero callers
  productivos para los módulos legacy de reconciliación de servicios, préstamos cash y deudas
  cash; se eliminaron `handlers-reconciliacion-servicios.ts`, `handlers-prestamos-cash.ts`,
  `handlers-deudas-cash.ts` y el test exclusivo del handler de préstamos. Revisión de referencias
  por símbolos y módulos tras la eliminación: cero importadores/callers; permanecen las rutas
  web canónicas (ventas/cobros de servicio, crear/pagar préstamos y crear/pagar deudas). Matriz
  filas 8, 13–16 conserva los tombstones y canales vivos correspondientes. Verificación:
  `pnpm exec vitest run src/features/contabilidad-formal/__tests__/writers-matrix.test.ts
  src/features/contabilidad/api` → 8 archivos, 44/44 tests.
  `reconciliarVentaDirecta` se retiró en G4 (05-10, tombstone en la matriz); los otros
  exports huérfanos de `api/handlers.ts` y `api/exchange-handlers.ts` siguen en R6-ORPHANS.

### R6 — Auditoría durable y despliegue

- [ ] **R6-LOGS — Resolver las 15 llamadas activas best-effort de configuración:**
  `actions-exchange.ts` (4), `actions-cierres.ts` (3), `actions-tipos-pago.ts` (3),
  `actions-cuentas-bancarias.ts` (2), API tipos de pago (3). Decidir si pertenecen a R6;
  si sí, migrar mutación + `logStrict` al mismo tx y probar fallo de audit; si no, excluir con
  razón y policy explícita.
- [ ] **R6-ORPHANS — Retirar o documentar los 9 exports legacy sin callers** (6 en
  `api/handlers.ts`, 3 mutaciones en `api/exchange-handlers.ts`). Tres logs de acciones admin
  quedan fuera del scope contable.
- [ ] **R6-ROLLBACK — Añadir prueba PostgreSQL de fallo del AuditLog dentro de las
  transacciones strict de gasto/CxP, anticipo, períodos, CxC create/update/anulación y demás
  writers, demostrando rollback de saldo, obligación, reconciliación y asiento. Ventas web
  ya tiene caso real de trigger SQL.
- [ ] **R6-BASELINE — Verificar baseline y guards por cada entorno heredado soportado** con
  comparación aprobada de DDL/backfills/triggers/checks y plan de `migrate resolve`. El smoke
  limpio local en PostgreSQL 17.6 (135/135) no acredita despliegues existentes.

**Estado global:** R0.5/R6 permanecen `[ ]` hasta completar esos criterios. No activar modo
operativo ni actualizar el baseline heredado como parte del inventario.
