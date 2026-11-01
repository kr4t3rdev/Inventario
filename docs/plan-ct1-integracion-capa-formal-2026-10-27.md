# Plan CT-1 — Integración por slices de la capa formal de contabilidad

**Fecha:** 2026-10-27
**Objetivo:** definir la vía verificable para llevar la capa formal de contabilidad (hoy solo en `feat/contabilidad-capa-formal`) a `origin/main` en cortes pequeños, sin activarla.
**No es:** autorización de merge/push/despliegue, ni activación de `shadow`/`enforce`/replay (eso queda en CT-3/CT-4 con los gates R6/R7.3/R7.4 intactos).
**Proviene de:** `docs/auditoria-contabilidad-vs-odoo-2026-10-24.md` (prioridad CT-1, riesgos RL-1/RL-3/RL-6) y los dictámenes `bloqueantes-merge-main-2026-10-13.md` y `preparacion-merge-y-pendientes-2026-10-13.md` de la propia rama.

## 1. Estado de partida (verificado 2026-10-27)

### Refs y antigüedad

| Ref | SHA | Observación |
|---|---|---|
| `origin/main` | `e15017d1` | Avanzó +56 commits desde el dictamen 2026-10-13 (F-1 unidades, Vercel) |
| `feat/contabilidad-capa-formal` | `d1d06c4` | Tip del 2026-10-12, 15 días sin movimiento; ~70 commits propios desde el merge-base `876b0d86` |
| `wip/codex-mobile-2026-10-12` | `dd302bf7` | Línea móvil sobre `d1d06c4`; **acumula piezas contables**: migración `accounting_tenant_id_hardening` y rutas móviles de contabilidad |
| `codex/contabilidad-merge-ci` | `6cbca815` | Reintento 2026-10-18; su contenido ya está reflejado en main (núcleo formal incluido); sin deltas formales hoy |

**Consecuencia clave:** main ya contiene el **núcleo formal** (motor, plan, shadow, replay-gate; 3 writers de caja). Los add/add del núcleo formal no son "rama trae algo nuevo" sino **dos versiones divergidas del mismo núcleo** que hay que unificar.

### Tamaño del paquete contable (diff tres puntos vs `origin/main`)

| Área | Archivos | Líneas |
|---|---|---|
| `src/features/contabilidad-formal` | 75 | +18.275 |
| `src/features/contabilidad` | 125 | +18.431 / −2.417 |
| `src/app/api/contabilidad` | 36 | +4.842 / −1.479 |
| `src/app/api/mobile` (solo contabilidad) | 40 | +1.913 / −158 |
| `prisma` (schema + migraciones) | 36 | +2.511 |
| `scripts` | 16 | +1.663 |
| **Total aproximado** | **~330** | **~48.000** |

### Superficie de conflictos actual (`git merge-tree` e15017d1 vs d1d06c4)

| Tipo | Cantidad | Tratamiento |
|---|---|---|
| Graphify (add/add y contenido) | 211 | **Excluir del merge**; regenerar al final (S10). No son criterio de conflicto de código |
| Núcleo formal (add/add): `posting-engine.ts`, `plan-default.ts`, `replay-posting-capability.ts`, `shadow-outbox.ts`, `posting-engine.test.ts` | 5 | **S1**: unificación canónica, sujeta a decisión D1 (moratoria) |
| Servicios y actions de caja | ~12 | **S3**: conciliar contra la versión actual de main (que ya recibió valoración FX e idempotencia el 10-24/26) |
| Writers comerciales (`compras-productos/actions`, `mermas/actions`, `ofertas/actions`, `venta-servicios/actions`, `venta-mutation-service`, `venta-lifecycle-service`, `pago-salario/schemas`, …) | ~15 | **S4** en 5 sub-slices |
| Rutas API contables y móviles | ~25 | **S3** (contables) y **S8** (móviles) |
| Tests de toda la app | ~80 | Se resuelven dentro del slice correspondiente; **mayor costo del programa** |
| Infra global (`schema.prisma`, `package.json`, `pnpm-lock.yaml`, `permission-registry`, `permission-parity.json`, `model-classification`, `raw-sql-allowlist`, `periodo-contable-guard`, admin, `openapi/mobile-v1.json` + contract test, `start.sh`) | ~15 | **S2** (schema) y **S9** (resto, conciliar contra versión actual de main) |
| modify/delete `renew-licencia.test.ts` | 1 | **S9**: main lo modificó, la rama lo eliminó; conservar el de main salvo dependencia demostrada |

### Migraciones: desalineación temporal

| Migración | Vive en | Problema |
|---|---|---|
| `20261012090000_align_formal_schema_baseline` | Rama formal (commiteada) | Fechada **antes** que las F-1 de main (`20261024100000`, `20261024110000`); Prisma aplica por orden de nombre → hay que **re-secuenciar** (re-fecha o regenerar consolidada) contra el schema actual |
| `20261012100000_accounting_tenant_id_hardening` | **Solo línea móvil** (`dd302bf7`) + worktree | Falla cerrada ante titularidad legacy ambigua; requiere preflight + tests como unidad de entrega (S2) |
| `scripts/ops/preflight-accounting-tenant-hardening.mjs` + tests | Rama formal | Ídem S2 |

### Divergencias semánticas abiertas (bloqueantes de contenido)

- **RL-1 / D1 — Moratoria:** main tiene split moratorio con cascada (moratorio→ordinario→principal, lib `cash-*.ts`); la rama eliminó el split (v1, plantillas de 3 líneas). El plan default de main referencia roles moratorios **sin cuenta default** (defecto latente `CUENTA_SIN_MAPEAR`). No se puede resolver archivo por archivo: exige **una decisión** y una sola algebra.
- Los resultados históricos (59/59, 201/201 focales; 148 migraciones locales) **no certifican** los SHAs actuales ni el candidato integrado.

## 2. Decisiones previas (requeridas antes del primer PR)

| ID | Decisión | Dueño | Bloquea |
|---|---|---|---|
| D1 | Semántica moratoria: split (main) vs sin split (rama); corregir el plan default acorde | Producto/dominio | S1 en adelante |
| D2 | Alcance móvil: ¿las rutas móviles de contabilidad entran en CT-1 (S8) o se difieren a la línea móvil? | Producto | S8 |
| D3 | Política graphify: excluir artefactos del merge y regenerar post-integración (recomendado) | Proceso | Todos |
| D4 | Estrategia de integración: slices sobre ramas frescas desde `origin/main` con cherry-pick/`git checkout <ref> -- <paths>` + resolución funcional (recomendado), no merge global de la rama | Ingeniería | Todos |

## 3. Slices

Cada slice: rama nueva desde `origin/main` del día, PR pequeño, tests focales, CI del SHA candidato. Rebasing al iniciar cada slice sobre el `origin/main` vigente (main absorbe 1-2 tandas de PRs diarias).

| # | Slice | Contenido | Criterio de salida |
|---|---|---|---|
| **S0** | Congelado e inventario | Ramas de trabajo `codex/contabilidad-ct1-s*`; inventario del paquete reconciliando `.tmp/merge-pending.json` (~130 rutas) con el diff tres puntos; confirmar autoría/propiedad de las piezas que solo viven en la línea móvil; registrar D1-D4 | Inventario commiteado en `docs/`; sin cambios de código |
| **S1** | Núcleo formal canónico | Resolver los 5 add/add **con D1 aplicada**: una sola versión de motor/plan/shadow/replay en main; si D1 = sin split, eliminar roles moratorios del plan y de las plantillas; si D1 = split, mapear cuentas default | Tests del núcleo verdes; `CUENTA_SIN_MAPEAR` imposible con el plan default |
| **S2** | Schema y migraciones | `schema.prisma` = unión (modelos F-1 + formales); re-secuenciar `align_formal_schema_baseline` tras las F-1; traer `accounting_tenant_id_hardening` (de línea móvil) + preflight + tests como **unidad indivisible** | `migrate deploy` limpio desde cero (CI integration) **y** sobre clon desechable del baseline; guards SQL verdes |
| **S3** | Caja cash al día | Conciliar `accounting-cash-operations-mutation-service` (main: 3 writers + valuation 10-24) con replay/idempotencia de la rama (`cash-action-replay`, `cash-debt-payment-valuation`); actions deudas/préstamos; rutas `api/contabilidad` | Tests de caja + idempotencia + rutas verdes; sin regresión en los 3 writers existentes |
| **S4** | Writers comerciales (5 sub-slices) | (a) ventas + ofertas + facturación; (b) compras productos/servicios + pago-gastos + restock; (c) mermas + producción; (d) anticipos; (e) venta-servicios | Cada sub-slice: PR propio, writer con test focal, **fila de la matriz R0.5 actualizada con evidencia** |
| **S5** | Libros y conciliación cruzada + UI | Libro diario/mayor/comprobación, `conciliacion-cruzada-service`, UI contable | Libros leen el mayor; conciliación cruzada ejecuta sobre datos de demo |
| **S6** | Cierre/apertura formal + reversa | `cierre-formal-service`, apertura con evidencia, `reversal-service` | Período de prueba cierra/apertura con asientos; reversa produce asiento inverso inmutable |
| **S7** | Replay/backfill orquestado | Orquestador, actions, verificación post-replay, verificador forense autónomo + health | Preflight→aprobación→replay con aprobador distinto en entorno de prueba |
| **S8** | Rutas móviles contables (si D2 las incluye) | Desde línea móvil `dd302bf7`: bank-adjustments, capital-injections, cash-debts/loans | Contract test OpenAPI móvil regenerado (no aceptado por lado) |
| **S9** | Infra global | permission-registry + parity, model-classification, raw-sql-allowlist, admin schemas/queries, `openapi/mobile-v1.json` + contract test, lockfiles, `start.sh`, `renew-licencia.test` | Todo conciliado **contra la versión actual de main** (nunca ours/theirs globales); suites de admin/auth verdes |
| **S10** | Cierre del programa | Graphify regenerado; CI completo sobre SHA final; matriz R0.5 documentada por fila; `tasks.md` de la rama actualizado con SHAs reales; registro en `docs/` | merge-tree final sin conflictos funcionales del paquete contable |

**Orden y dependencias:** S0 → S1 → S2 → S3 → S4(a..e en paralelo posible) → S5 → S6 → S7; S8 tras S3 si D2 lo incluye; S9 al final (concilia contra main reciente); S10 cierra.

## 4. Definition of done de CT-1

1. `git merge-tree origin/main feat/contabilidad-capa-formal` sin conflictos funcionales del paquete contable (solo graphify residual, si queda hasta S10).
2. CI completo verde en el SHA final: lint, typecheck, 4 shards, cobertura, build, required checks, smoke.
3. Integración PostgreSQL: migraciones desde cero **y** sobre baseline clonado autorizado, en DB desechable.
4. Matriz 31 writers × 8 dimensiones con evidencia por fila (estado R0.5 documentado; el ACCEPT global sigue siendo gate operativo aparte).
5. Cada writer integrado con test focal en su PR; sin PR que mezcle más de un subdominio.
6. **Sin activación**: `CONTABILIDAD_FORMAL_MODE` sigue `off`, flag fuera del registry, R6/R7.3/R7.4 intactos (se abordan en CT-2..CT-5).

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Main absorbe PRs diarios; cada semana encarece el programa (RL-6) | Slices cortos, rebasar al inicio de cada uno; S0-S3 esta semana como mínimo |
| Superficie de tests (~80 archivos) domina el costo | Un test por archivo se resuelve en el slice dueño del código que prueba; no un PR "masivo de tests" |
| Dos algebras moratorias en conflicto (D1) | Decidir en S0; ninguna resolución de S1+ empieza sin ella |
| Entrelazado móvil (la línea móvil tiene piezas contables) | Inventario S0 con autoría confirmada; S8 explícito o difusión documentada |
| Schema: modelos F-1 + formales deben coexistir | S2 con re-secuenciación y validación dual (desde cero + baseline) |
| Tentación de cerrar gates con CI verde | Los gates R6/R7 son operativos y permanecen abiertos; CI es condición necesaria, no suficiente |

## 6. Estimación (no contractual)

Con D1-D4 resueltas en S0 y churn de main moderado: S0-S2 en 2-4 días; S3 en 1-2 días; S4 una semana (5 PRs); S5-S7 una semana; S8-S9 2-3 días; S10 un día. **~3 semanas efectivas.** El costo crece con cada semana que main avance sin trabajo en el programa.

## 7. Referencias

- `docs/auditoria-contabilidad-vs-odoo-2026-10-24.md` — CT-1..CT-7, RL-1..RL-6, gates.
- `openspec/changes/contabilidad-capa-formal/bloqueantes-merge-main-2026-10-13.md` y `preparacion-merge-y-pendientes-2026-10-13.md` (en línea móvil `dd302bf7`) — dictamen original y paquete.
- `openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md` — inventario de los 31 writers para S4.
- `.tmp/merge-pending.json` — inventario de ~130 rutas pendientes (insumo de S0; reubicar en S0 a `docs/`, no commitear en `src/`).
- `docs/auditoria-comparativa-odoo-2026-10-24.md` — contexto general (F-1 ya integrado; actualizar su fila F-1).
