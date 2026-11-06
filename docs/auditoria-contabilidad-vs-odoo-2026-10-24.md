# Auditoría contable profunda: TCP frente a Odoo

**Fecha de corte:** 2026-10-24 · **Última revisión:** 2026-10-27 (ver «Registro de revisión»)
**Baseline de código:** árbol de trabajo local en `main` (HEAD `c40c4cf0`). En las revisiones del 2026-10-26 y 2026-10-27 `origin/main` avanzó de `9883783` a `f7268390` y luego a `e15017d1` (integración F-1 de conversión de unidades vía PRs #21-#41, y endurecimiento de la capa gerencial de caja); la capa `contabilidad-formal` no cambió en ningún tramo (diffs vacíos) y los hallazgos se verificaron contra cada SHA. No se volvió a verificar despliegue, runtime ni base de datos. Se inspeccionó además, solo lectura, el worktree `/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP` (rama `feat/contabilidad-capa-formal`, HEAD `d1d06c4`, **no fusionada** a main; el directorio fue reasignado después a `wip/codex-mobile-2026-10-12`, trabajo móvil sobre la misma línea).
**Baseline externo:** documentación oficial de Odoo 19.0 (Community/Enterprise según sección; edición exacta por función no establecida aquí).
**Complementa:** `docs/auditoria-comparativa-odoo-2026-10-24.md` (visión general por área). Este documento profundiza únicamente en contabilidad.

## Dictamen ejecutivo

Desde la comparación contable de 2026-09-06, las dos brechas mayores declaradas entonces — ausencia de plan de cuentas y de asientos de partida doble — **se cerraron a nivel de código**: existe `src/features/contabilidad-formal/` con motor transaccional, plan default, diarios, plantillas, cadena hash y modo shadow. La lectura precisa no es "TCP ya tiene contabilidad formal", sino:

1. **La capa formal está dormante en main.** Modo `off` por defecto, flag `contabilidad-formal` ausente del feature-registry (verificado: 0 coincidencias en `src/features/planes/feature-registry.ts`), sin seed productivo ni UI. Aun cambiando `CONTABILIDAD_FORMAL_MODE`, todo evento retornaría `OMITIDO/FLAG_INACTIVO`.
2. **Solo 3 de ~33 tipos de evento están cableados en `origin/main` (`f7268390`)**: `COBRO_PRESTAMO`, `DEUDA_RECIBIDA` (desembolso de deuda cash, evento inline con evidencia FX) y `PAGO_DEUDA`, los tres en `accounting-cash-operations-mutation-service.ts`. En el árbol local auditado (`c40c4cf0`) son 2: el desembolso de deuda se agregó en `origin/main` junto con el servicio de valoración `cash-debt-payment-valuation.ts`.
3. **La capa completa (31 writers, libros, cierre/apertura, reversa, backfill, UI) vive en una rama no fusionada** (`feat/contabilidad-capa-formal`, `d1d06c4`, tip sin movimientos), bloqueada por el dictamen 2026-10-13 "no integrar todavía"; la divergencia con main crece (manifiesto interno: 912 rutas relevantes, 135 divergentes, 40 faltantes) y la revisión 2026-10-26 halló ramas de reintento aún sin cerrar el hueco (ver RL-6).
4. **Los reportes siguen siendo gerenciales, derivados de sublibros.** Ningún reporte, balance, PyG, snapshot ni conciliación lee `Asiento`/`AsientoLinea`. La contabilidad formal es hoy un archivo de solo escritura con tres flujos en `origin/main` (dos en el árbol local).

Contra Odoo 19: TCP no alcanza paridad contable operativa (cobertura de posteo, impuestos, conciliación bancaria, reportes del mayor, activos, presupuestos, analítica). En cambio, varios controles de integridad de TCP **exceden** lo que Odoo Community ofrece de fábrica (cadena hash preventiva, evidencia FX inmutable, backfill con doble aprobación). El cuello de botella no es calidad de código: es integración y activación.

## Las tres capas contables de TCP hoy

| Capa | Qué es | Estado |
|---|---|---|
| **Gerencial** (`src/features/contabilidad/`) | Reportes (balance, PyG, flujo), períodos, snapshots, FX, CxC/CxP, caja, bancos | Operativa; fuente de verdad de los reportes actuales |
| **Formal en main** (`src/features/contabilidad-formal/`) | Núcleo: motor `postEvento`, plan default, hash-chain, shadow, replay-gate | Dormante (off, flag sin registrar, 3 writers en `origin/main` — 2 en árbol local —, sin seed/UI) |
| **Formal en rama no fusionada** (`feat/contabilidad-capa-formal`) | Capa completa: 31 writers, libros diario/mayor/comprobación, cierre/apertura formal, reversa, backfill ejecutable, verificador forense, UI | Bloqueada desde 2026-10-13 (conflictos de merge, migración untracked, CI sin evidencia); reintentos de merge en curso al 2026-10-26 (RL-6) |

## Comparación por dominio contable

| Dominio | Odoo 19 (documentado) | TCP main | TCP rama formal | Veredicto |
|---|---|---|---|---|
| Partida doble | Automática para **todas** las transacciones (facturas, facturas de proveedor, POS, gastos, valoración de inventario) | Motor existe; cuadre exacto Decimal(20,4), idempotencia por origen, transaccional | 31 call-sites en 19-24 archivos | Brecha de **cobertura**: 3/33 eventos en `origin/main` (2 en árbol local) |
| Plan de cuentas | Configurable por compañía + paquetes de localización fiscal (100+ países) | 34 cuentas default, 23 roles mapeados, configurable por tenant (`CuentaRolTenant`); sin localización de país; sin seed productivo | Ídem + action de inicialización + UI | Parcial |
| Diarios | Sale/Purchase/Cash/Bank/Misc, secuencias | 7 diarios default (VTA, CMP, CAJ, BAN, NOM, AJU, APE), numeración por diario+período bajo advisory lock | Ídem | Parcial (sin secuencias editables/configuración avanzada) |
| Libros y reportes del mayor | Balance, PyG, Flujo de caja, Mayor general, Balance de comprobación, Auditoría de diarios, Libro de terceros, Antigüedad CxC/CxP, informes fiscales, y más | **Ninguno lee asientos**; libros solo en la rama formal | Libro diario, mayor, balance de comprobación, conciliación cruzada | Brecha principal en main |
| Cierre de ejercicio | Retained earnings en tiempo real (sin asiento de cierre), lock dates (usuarios/asesores) | Cierre = congelar evidencia + bloquear escrituras; retained earnings implícito en fórmula del balance; `CierreContable` legacy como fuente alternativa | Asientos formales de cierre/apertura (`CIERRE_PERIODO`/`APERTURA_PERIODO`), traspaso a resultados acumulados | Filosofía distinta en main; formal solo en worktree |
| Períodos y bloqueo | Lock dates por fecha de corte | Estados BORRADOR→APROBADO→REABIERTO, jerarquía DIARIO→ANUAL, guard server-side con modos, auditoría de bypass durable | Ídem | **Control comparable o superior** (granular por período + bypass auditado) |
| Multi-moneda | Tasa automática, ganancia/pérdida cambiaria al reconciliar, reporte de diferencias no realizadas | Evidencia FX inmutable con fingerprint, tasa histórica determinista; **sin** reconocimiento cambiario ni revaluación (saldos sin evidencia excluidos) | Diferencia cambiaria en plantillas formales (`DIFERENCIA_FX` con ramas condicionales) | TCP más fuerte en evidencia; más débil en reconocimiento |
| Conciliación bancaria | Sincronización bancaria (Ponto/Basiq), importación, **modelos de conciliación automática** | Manual, documento↔banco interno; sin importación de extractos (MT940/OFX/CSV) | Ídem (No-goal declarado) | Brecha (declarada No-goal) |
| CxC/CxP | Libro de terceros, antigüedad, seguimientos (follow-up), términos de pago | Aging básico 30/60/90, liquidación transaccional, sin intereses comerciales ni recordatorios | Ídem + eventos `COBRO_CXC`/`PAGO_CXP` | Parcial |
| Impuestos | Rejillas fiscales, base caja, posiciones fiscales, retenciones, EDI | **No existe** (No-goal; el marco FE es de facturación electrónica, no contable) | Ídem | Brecha (declarada No-goal) |
| Activos fijos / diferidos | Depreciación, gastos diferidos, plan de depreciación | No existe (No-goal) | Ídem | Brecha (declarada No-goal) |
| Presupuestos / analítica | Presupuestos, cuentas analíticas, dimensiones | No existe (No-goal) | Ídem | Brecha (declarada No-goal) |
| Integridad/inalterabilidad | Reporte de verificación de inalterabilidad (detectivo) | Cadena hash SHA-256 v2 por tenant, secuencia contigua, **re-validación de toda la cadena antes de cada posteo** → alteración bloquea posteos nuevos; snapshots v2/v3 con hash; verificador autónomo solo en worktree | Ídem + verificador forense + health check | **TCP por delante** (preventivo vs detectivo) |
| Backfill/histórico | Sin equivalente auditado con doble aprobación | Replay con capability no falsificable, preflight con digest, aprobador ≠ solicitante, vigencia 24 h; mecanismo de gate sin orquestador | Orquestador + actions + conciliación post-replay | Diseño superior; ejecución pendiente |
| Multi-entidad | Multi-compañía, sucursales, consolidación, intercompañía | Multi-tenant SaaS ≠ multi-compañía contable; sin consolidación | Ídem | Brecha conceptual (ya señalada en auditoría general) |
| Base caja vs devengo | Ambas soportadas | `modoContable CAJA|DEVENGO` por período, cuadre por modo; devengo de ventas a crédito vía CxC | Ídem | Parcial (solo en reportes gerenciales) |

## Dónde TCP excede a Odoo Community

Con matices declarados (esto no compensa las brechas de cobertura):

1. **Cadena hash preventiva por asiento.** Odoo verifica inalterabilidad vía reporte; TCP recalcula y valida la cadena completa del tenant antes de **cada inserción** (`HASH_CHAIN_INVALID` bloquea posteos sobre un histórico alterado). Es integridad estructural continua, no una auditoría puntual.
2. **Evidencia FX inmutable y exclusiones honestas.** Cada conversión lleva `fxEvidenceFingerprint`, tasa histórica `getRateAsOf` (≤ fecha), lectores estrictos que excluyen partidas sin evidencia (`MISSING_CONVERSION`) y las reportan en `coverage`. Odoo reporta el número completo; TCP declara qué no puede demostrar.
3. **Precisión monetaria exacta.** Decisión R0.1: 4 decimales representables exactamente, rechazo de no representables, cuadre sin epsilon con `Prisma.Decimal`. Filosofía distinta al redondeo configurable de Odoo; elimina una clase completa de errores de punto flotante.
4. **Backfill con doble aprobación.** Capability no falsificable ligada al tx, aprobador ≠ solicitante, vigencia de 24 h, fuentes no verificables omitidas con causa en lugar de inventar valoración.
5. **Shadow mode de contabilización.** Savepoint especulativo + outbox atómico con métricas p95 por tenant. Odoo no tiene un equivalente de "ensayar la contabilidad antes de activarla".

## Riesgos latentes detectados

| # | Hallazgo | Evidencia |
|---|---|---|
| RL-1 | **Roles moratorios sin cuenta en el plan default.** Las plantillas de `COBRO_PRESTAMO`/`PAGO_DEUDA` usan `INTERESES_MORATORIOS_GANADOS`/`GASTOS_MORATORIOS`, roles sin cuenta default → un pago con mora > 0 en `enforce` daría `CUENTA_SIN_MAPEAR`. Divergencia semántica con el worktree (que eliminó el split moratorio en su decisión v1). **Resuelto (2026-11-05)**: la decisión D1 del plan CT-1 conservó el split moratorio de `main` y el commit `82b64e45` mapeó las cuentas default `4.6` (ingresos) y `6.6` (gastos) a los dos roles; con el plan default, un pago con mora ya no puede dar `CUENTA_SIN_MAPEAR`. | `lib/plan-default.ts` (25 roles con cuenta hoja, incluidas `4.6` y `6.6`) + `services/seed-plan-contable.ts`; evidencia: `src/features/contabilidad-formal/__tests__/seed-plan.test.ts` y `src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts` |
| RL-2 | **Flag inexistente en el registry.** `contabilidad-formal` no está en `src/features/planes/feature-registry.ts`; la capa es inerte aunque cambie el modo. **Resuelto (2026-11-05)**: la clave existe en el registry y en los tres planes (migración `20261102000000_contabilidad_formal_planes`), con contrato propio. El modo sigue gobernado por los gates apagados (`CONTABILIDAD_FORMAL_MODE=off`), así que registrar el flag no enciende nada. | `src/features/planes/feature-registry.ts` + `src/features/planes/__tests__/capa-formal-global.test.ts` + `prisma/migrations/20261102000000_contabilidad_formal_planes/migration.sql` |
| RL-3 | **Ventana shadow no valida nada con 3 writers.** El gate R7.3 exige ≥ 7 días con conciliación cruzada; con solo `COBRO_PRESTAMO`/`DEUDA_RECIBIDA`/`PAGO_DEUDA` no ejercita la matriz real. **Actualizado (2026-11-05)**: la matriz real ya no es la de tres writers —el registro CT-1 documenta 25 filas con evidencia focal por writer—, pero la ventana shadow de ≥ 7 días nunca se abrió y sigue siendo tarea operacional (R7.3), igual que la aprobación por tenant (R7.4). | `openspec/changes/contabilidad-capa-formal/tasks.md` (solo rama formal): R7.3/R7.4 abiertos; matriz y estado actual en `docs/ct1-cierre-integracion-capa-formal.md` |
| RL-4 | **Manifiesto de comparación commiteado en ruta de código.** `src/lib/utils/prestamo-cash.ts` es un JSON de 912 rutas (comparación worktree vs main), agregado en el commit `6ce65e16`. Es un artefacto de proceso con extensión `.ts` dentro de `src/`; reubicar (p. ej. `docs/` o herramienta de build). **Resuelto (2026-11-05)**: el manifiesto se retiró de `src/` (commit `b327cf7f9`, que devolvió al archivo su forma de utilidad real) y la comparación quedó congelada como artefacto de documentación (CT-6). | Lectura directa del archivo; copia congelada en `docs/artefactos/manifiesto-comparacion-rutas-rl4.json` (`sha256 b640dd41…a86cf4`) |
| RL-5 | **Dualidad de fuentes históricas.** `CierreContable` legacy sigue aportando resultados acumulados cuando no hay snapshot aprobado del año; coexiste con `PeriodoContable` + snapshots v2/v3. | `services/current-balance-service.ts` |
| RL-6 | **Divergencia creciente con la rama formal.** 135 rutas divergentes + 40 faltantes (de 912 relevantes) según el manifiesto RL-4; cada semana de evolución de main encarece el merge. Revisión 2026-10-26: hay ramas de reintento — `codex/contabilidad-merge-ci` (2026-10-18, ya sin deltas formales respecto de `origin/main`) y `codex/contabilidad-completar-integracion` (2026-10-24; pese a su nombre transporta los 5 commits F-1 de unidades, sin cambios formales) — y un inventario de merge no rastreado de ~130 rutas (`.tmp/merge-pending.json`) que incluye núcleo formal, servicios de caja y rutas móviles de contabilidad. La capa completa sigue solo en `feat/contabilidad-capa-formal` (`d1d06c4`). El worktree `contabilidad-correcciones` fue reasignado a `wip/codex-mobile-2026-10-12` (móvil sobre la misma línea). **Resuelto en cuanto al riesgo (2026-11-05)**: la capa formal llegó a `main` por slices verificados (registro CT-1, sección 3), de modo que ya no hay una rama que mergear ni un merge pendiente que bloquear. Queda limpieza de proceso: ramas de reintento (`feat/contabilidad-capa-formal` `d1d06c4`, `codex/contabilidad-merge-ci` `143a589c`, `codex/contabilidad-completar-integracion`) que ya no transportan deltas formales. | `bloqueantes-merge-main-2026-10-13.md` (rama formal) + `git branch -a` + `.tmp/merge-pending.json` (no presente en el worktree actual) + `docs/ct1-cierre-integracion-capa-formal.md` |

## Gates de activación pendientes (según tasks de la rama formal)

| Gate | Estado | Qué exige |
|---|---|---|
| R0.1–R0.4 | `[x]` (histórico) | Decimales exactos; savepoint shadow; preflight 24 h + aprobador distinto; `NO_EVALUABLE` bloquea enforce |
| R0.5-ACCEPT | `[ ]` | Matriz global 31 writers × 8 dimensiones |
| R1–R5 | `[x]` (histórico) | Libros, cierre/apertura, replay autorizado |
| R6.1/R6.2 | `[ ]` | Aceptación global de writers; baseline por entorno (298-299 tests en DB desechable no certifican todos los ambientes) |
| R7.3 | `[ ]` | Ventana shadow real ≥ 7 días con conciliación cruzada verde — **nunca iniciada** |
| R7.4 | `[ ]` | Aprobación explícita por tenant con criterio de reversión |

## Prioridades siguientes

1. **CT-1 — Resolver la dualidad main/rama formal.** Es el bloqueante estructural de todo lo demás. Recomendar merge por slices verificados (como se hizo con la rama F), empezando por el núcleo sin conflicto (motor + plan + shadow), luego writers por evento, con re-baseline del dictamen 2026-10-13. Las ramas de reintento detectadas el 2026-10-26 (RL-6) aún no transportan los writers ni los libros. Sin esto, la capa formal no existe operativamente.
2. **CT-2 — Decidir la semántica moratoria antes del merge** (RL-1): split moratorio de main vs v1 sin split del worktree, y alinear el plan default con la decisión. **Cerrado (2026-11-05)**: la decisión D1 conservó el split moratorio de `main` (pagos a mora, interés ordinario y principal) y el plan default quedó alineado con ella (cuentas `4.6` y `6.6` para los dos roles moratorios, 25 roles con cuenta hoja).
3. **CT-3 — Registrar el flag y el seed en main** tras CT-1/CT-2: `contabilidad-formal` en el feature-registry, action de inicialización del plan y seed idempotente. **Cerrado (2026-11-05)**: la clave está en el registry y en los tres planes (migración `20261102000000_contabilidad_formal_planes`), existe la action de inicialización del plan contable (`src/features/contabilidad-formal/actions-plan-contable.ts`) y el seed es idempotente (35 cuentas, 7 diarios y 25 roles). La capa sigue apagada por los gates.
4. **CT-4 — Abrir la ventana shadow R7.3 solo con la matriz completa de writers** (RL-3); la conciliación cruzada sublibros↔mayor (existe en worktree) es el criterio objetivo de salida.
5. **CT-5 — Migrar reportes al mayor formal como fuente única** cuando la ventana pase; hasta entonces mantener la doble lectura declarada (gerencial + formal) y no mezclar fuentes en un mismo informe.
6. **CT-6 — Reubicar el manifiesto RL-4** fuera de `src/` y mantener la comparación como artefacto de docs. **Cerrado (2026-11-05)**: la copia congelada vive en `docs/artefactos/manifiesto-comparacion-rutas-rl4.json`, con su nota de origen, alcance y verificación en `docs/artefactos/README.md`.
7. **CT-7 — Mantener los No-goals como series posteriores** (impuestos, extractos bancarios, activos, presupuestos, analítica), como declara el proposal CTA. La decisión de país fiscal — pendiente desde 2026-09-06 — condiciona impuestos y localización; no diseñar el motor fiscal sin ella.

## Correcciones a documentos previos

| Afirmación previa | Corrección |
|---|---|
| Auditoría general 2026-10-24: "`postEvento` tiene tres call-sites (dos pagos y creación de deuda)" | **Correcta para `origin/main`** (3: `COBRO_PRESTAMO`, `DEUDA_RECIBIDA` en desembolso, `PAGO_DEUDA`). La primera versión de este documento la corrigió a 2 midiendo el árbol local `c40c4cf0`, donde el desembolso aún no postea; esa corrección solo valía para ese baseline y se retracta aquí. |
| Comparación 2026-09-06: "TCP no tiene plan de cuentas ni modelos de asientos" | Cierto entonces; hoy existe la capa formal con `CuentaContable`, `Diario`, `Asiento`, `AsientoLinea`, `CuentaRolTenant` (schema main, líneas 3247-3417). Dormante, pero el modelo existe. |
| Comparación 2026-09-06: "falta motor fiscal" | Sigue sin haber motor fiscal **contable**; el marco FE-T1..T5 es de facturación electrónica y no llena ese hueco. |

## Registro de revisión

**2026-11-05 — RL-1, RL-2 y CT-2/CT-3 re-verificados contra `main`: el split moratorio y el flag quedaron resueltos.**

- RL-1 (roles moratorios sin cuenta default): la decisión D1 conservó el split moratorio de `main` y el commit `82b64e45` mapeó las cuentas default `4.6` y `6.6` a `INTERESES_MORATORIOS_GANADOS` y `GASTOS_MORATORIOS`. El seed siembra 25 roles con cuenta hoja y el test de integración del pago con mora usa esas cuentas del plan default (`src/features/contabilidad/services/__integration__/cash-debt-formal-posting.integration.test.ts`). Con el plan default, un pago con mora no da `CUENTA_SIN_MAPEAR`.
- RL-2 (flag ausente del registry): `contabilidad-formal` ya está en `feature-registry.ts` y en los tres planes (migración `20261102000000_contabilidad_formal_planes`), con contrato propio (`src/features/planes/__tests__/capa-formal-global.test.ts`). El gate global sigue apagado: registrar el flag no enciende la capa.
- CT-2 y CT-3 quedan cerrados por lo anterior. RL-3 se actualiza: la matriz de writers ya no es la de tres (25 filas con evidencia focal en el registro CT-1), pero la ventana shadow de ≥ 7 días (R7.3) y la aprobación por tenant (R7.4) siguen siendo operacionales.
- Sin cambios en el estado de los gates: `R0.5-ACCEPT` sin firma, `R6` abierto y `R7` sin iniciar.

**2026-11-05 — CT-6 cerrado: el manifiesto RL-4 sale de `src/` y queda como artefacto congelado de documentación.**

- `src/lib/utils/prestamo-cash.ts` ya no contenía el manifiesto: desde `b327cf7f9` es la utilidad real del módulo (42 líneas). Lo que quedaba de RL-4 era conservar la comparación de 912 rutas como artefacto legible fuera del árbol de código.
- La comparación se recuperó verbatim del commit `6ce65e16` (912 entradas; `source_head` `d1d06c4` contra `pinned_main` `ea6084c5`; 495 `exact-present`, 242 `genuinely-new-source`, 40 `missing`, 135 `divergent-needs-review`) y quedó en `docs/artefactos/manifiesto-comparacion-rutas-rl4.json` (`sha256 b640dd413c2e1a7abd8adb457fc6b61f8b1dd458c10a722d131c27fc28a86cf4`).
- `docs/artefactos/README.md` documenta el origen, el alcance, la comparación, los conteos y cómo verificar la copia (`git show 6ce65e16:src/lib/utils/prestamo-cash.ts`).
- RL-4 queda cerrado. RL-6 sigue vigente: las cifras del manifiesto son la foto del 2026-10-23 y la divergencia con `main` ya cambió desde entonces; el manifiesto se conserva congelado y no se regenera.

**2026-10-27 — re-verificación contra `origin/main` `e15017d1`: sin cambios contables.**

- `origin/main` avanzó de `f7268390` a `e15017d1` (+9 merges, PRs #33-#41): continuación de F-1 (dimensiones de unidad: tracker, UI, transiciones en PostgreSQL, referencias de producto) y hardening de despliegue Vercel (build boundary, Prisma tracing, scope de ignores móviles). **Ni `contabilidad-formal` ni `contabilidad` (gerencial) cambiaron en este tramo** (diffs vacíos); los 3 writers y sus líneas no se movieron.
- Vigencia re-confirmada en `e15017d1`: RL-1 (roles moratorios sin cuenta default), RL-2 (flag `contabilidad-formal` ausente del registry), RL-4 (manifiesto en `src/lib/utils/prestamo-cash.ts`, blob sin cambios), RL-5.
- Ramas de contabilidad congeladas: `feat/contabilidad-capa-formal` (`d1d06c4`, tip del 2026-10-12, 15 días), `codex/contabilidad-merge-ci` (2026-10-18) y `codex/contabilidad-completar-integracion` (2026-10-24) sin nuevos commits. Mientras main absorbe 1-2 tandes de PRs por día, la divergencia RL-6 sigue creciendo y ningún reintento transporta aún los 31 writers ni los libros.
- Los gates R0.5/R6/R7.3/R7.4 permanecen abiertos (tasks.md de la rama formal sin modificar desde el 2026-10-23).

**2026-10-26 — re-verificación contra `origin/main` `f7268390`:**

- `origin/main` avanzó de `9883783` a `f7268390` (+~25 commits): integración de F-1 (conversión de unidades, PRs #21-#31, con trazabilidad de unidad de origen en partidas de compra — insumo del costo FIFO) y endurecimiento de caja: nuevo servicio `cash-debt-payment-valuation.ts` (valoración FX de pagos de deuda cash, errores `FX_INSUFICIENTE`), tests de idempotencia de creación de deuda (+145 líneas) y de valoración de pagos (+99). Sin cambios en `contabilidad-formal` (diff vacío) ni en los servicios de reportes.
- **Tercer writer confirmado en `origin/main`**: `DEUDA_RECIBIDA` al desembolsar deuda cash (evento inline con `fxEvidenceFingerprint` y `medioCobro: 'BANCOS'`). El conteo "2 writers" de la versión del 2026-10-24 correspondía al árbol local `c40c4cf0`.
- Siguen vigentes en `origin/main`: RL-1 (roles moratorios sin cuenta default), RL-2 (flag ausente del registry), RL-4 (manifiesto JSON commiteado en `src/lib/utils/prestamo-cash.ts`, blob presente), RL-5 (dualidad `CierreContable`/snapshots) y los gates R0.5/R6/R7.3/R7.4 abiertos (tasks.md de la rama formal sin modificar desde el 2026-10-23).
- El merge se está reintentando por slices: `codex/contabilidad-merge-ci` (2026-10-18, "close accounting integration blockers" + migraciones formales, hoy sin deltas formales vs `origin/main`) y `codex/contabilidad-completar-integracion` (2026-10-24, transporte de F-1 pese a su nombre) más el inventario `.tmp/merge-pending.json` (~130 rutas). **Ninguna rama contiene aún los 31 writers ni los libros**: la capa completa sigue solo en `feat/contabilidad-capa-formal` (`d1d06c4`).
- Nota para la auditoría general: F-1 (UdM con factor) pasó de "Parcial/no" a **integrado** en `origin/main`; la fila correspondiente de `docs/auditoria-comparativa-odoo-2026-10-24.md` quedó desactualizada.

## Alcance y límites de esta revisión

Síntesis de solo lectura sobre el árbol de trabajo local (`c40c4cf0`) y el worktree `feat/contabilidad-capa-formal` (`d1d06c4`), con documentación oficial de Odoo 19.0 como baseline externo. No se ejecutaron tests, builds, migraciones ni consultas a base de datos; no se verificó despliegue, runtime ni aceptación de usuarios; los estados `[x]` de tasks son históricos, no recertificación. La comparación por edición (Community vs Enterprise) se dejó indicada por sección cuando corresponde.

## Referencias

**Odoo 19.0:** [Accounting](https://www.odoo.com/documentation/19.0/applications/finance/accounting.html) · [Chart of accounts](https://www.odoo.com/documentation/19.0/applications/finance/accounting/get_started/chart_of_accounts.html) · [Journals](https://www.odoo.com/documentation/19.0/applications/finance/accounting/get_started/journals.html) · [Multi-currency](https://www.odoo.com/documentation/19.0/applications/finance/accounting/get_started/multi_currency.html) · [Bank synchronization](https://www.odoo.com/documentation/19.0/applications/finance/accounting/bank/bank_synchronization.html) · [Reconciliation models](https://www.odoo.com/documentation/19.0/applications/finance/accounting/bank/reconciliation_models.html) · [Year-end / lock dates](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/year_end.html) · [Analytic](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/analytic_accounting.html) · [Budgets](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/budget.html) · [Assets](https://www.odoo.com/documentation/19.0/applications/finance/accounting/vendor_bills/assets.html) · [Fiscal localizations](https://www.odoo.com/documentation/19.0/applications/finance/fiscal_localizations.html) · [Data inalterability](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/data_inalterability.html)

**Internas:** `docs/auditoria-comparativa-odoo-2026-10-24.md` — `docs/auditoria-listas-precios-vs-odoo.md` — `openspec/changes/contabilidad-capa-formal/` (worktree) — `src/features/contabilidad-formal/` — `src/features/contabilidad/` — `src/lib/services/periodo-contable-guard.ts` — `src/lib/services/periodo-snapshot-service.ts`
