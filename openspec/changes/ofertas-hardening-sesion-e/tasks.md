# Tasks — Sesión E: hardening de ofertas (serie E)

Reglas de ejecución (aplican a todas las fases):

- TDD estricto: **RED** (tests que fallan por la razón correcta) → **GREEN**
  (implementación mínima) → **REFACTOR**. Comando por fase:
  `pnpm exec vitest run src/features/ofertas` (o la ruta específica indicada).
- Skill `code-review` sobre el diff de la fase antes de cada commit; resolver
  críticos/altos.
- Stage selectivo (`git add <archivos>`); nunca `git add -A`/`.`. Confirmar con
  `git diff --cached --name-only` antes del commit.
- Commit por fase, mensaje convencional con sufijo de fase.
- Worktree: `TCP-sesion-e-ofertas`, rama `feat/sesion-e-ofertas` (base `main`).

> **Ejecutado 2026-09-27** en worktree `TCP-sesion-e-ofertas`, rama
> `feat/sesion-e-ofertas` (renombrada de `feat/ofertas-sesion-e` para la
> convención de sesiones). Suite del feature: 69/69 verde
> (11 archivos, `pnpm exec vitest run src/features/ofertas src/app/api/ofertas`).
> Lint de archivos tocados: 0 errores.

## E-1 — Numeración con retry (patrón contratos)

- [x] **T1 — RED generador.** `src/features/ofertas/lib/numero-oferta-generator.test.ts`:
  formato `OF-000007`, continuación del último, primer número sin ofertas,
  colisión P2002 reintenta y triunfa, 3 colisiones agotan y relanzan, error no-P2002
  se propaga, `buildData` recibe el número formateado.
- [x] **T2 — GREEN generador.** `src/features/ofertas/lib/numero-oferta-generator.ts`.
- [x] **T3 — RED acción.** Test de colisión en `__tests__/actions.test.ts`:
  `create` rechaza una vez con P2002 y la acción reintenta.
- [x] **T4 — GREEN acción.** `createOfertaAction` usa `crearOfertaConNumero`.
- [x] Commit: `c2ae1774 feat(ofertas): numeración secuencial con reintento ante P2002 (E-1)`

## E-2 — Estado VENCIDA + guardas

- [x] **T1 — RED expiración.** `expiracion-estado.test.ts`: expira PENDIENTE
  vencidas, lecturas y facturar invocan la expiración.
- [x] **T2 — RED transiciones.** Matriz validada; `FACTURADA→PENDIENTE`,
  `VENCIDA→*`, `ACEPTADA→FACTURADA` rechazadas; solo-`observaciones` permitido;
  `delete` de `FACTURADA` rechazado (`ESTADO_NO_ELIMINABLE`); facturar/convertir
  rechazan `VENCIDA`.
- [x] **T3 — GREEN schema + código.** Enum `VENCIDA` + migración
  `20260927000000_oferta_estado_vencida` (aditiva); union TS y badges de UI;
  lib `transiciones-estado.ts`; servicio `expiracion-ofertas-service.ts`.
- [x] **T4 — REFACTOR mocks.** `updateMany` por defecto en los factories de
  `actions.test.ts` y `facturar-erronea.test.ts` (contrato de mocks).
- [x] Commit: `daf0f6d7 feat(ofertas): estado VENCIDA con expiración perezosa y guardas de transición (E-2)`

## E-3 — Totales e impuestos recalculados en servidor

- [x] **T1 — RED calculadora.** `totales-oferta.test.ts` (pura): línea,
  redondeo 2 decimales, subtotal, total, validación TAX_INVALID.
- [x] **T2 — RED integración.** create rechaza `impuestos > subtotal`
  (`TAX_INVALID`, sin `create`); el payload forjado de subtotal/total/línea se
  ignora y se persisten montos recalculados.
- [x] **T3 — GREEN.** `lib/totales-oferta.ts` + cableado en `createOfertaAction`.
- [x] Commit: `7eb5d91b feat(ofertas): recálculo autoritativo de totales e impuestos en servidor (E-3)`

## E-4 — Edición de ítems y duplicación

- [x] **T1 — RED edición.** `edicion-duplicado.test.ts`: reemplazo atómico en
  PENDIENTE (deleteMany + createMany + update de montos), `ITEMS_NO_EDITABLES`
  fuera de PENDIENTE, conservación/validación de impuestos, cross-tenant.
- [x] **T2 — RED duplicación.** número nuevo vía generador, PENDIENTE, precios
  re-resueltos, `fechaVencimiento` futura conservada / vencida → `null`,
  `TAX_INVALID` si los impuestos originales superan el nuevo subtotal,
  cross-tenant `NOT_FOUND`.
- [x] **T3 — GREEN.** `ofertaUpdateSchema.items/impuestos`; lib compartida
  `resolver-items-oferta.ts` (reusada en create); rama de ítems en
  `updateOfertaAction`; `duplicarOfertaAction`.
- [x] **T4 — UI.** Botón Duplicar en la tabla (toast + `router.refresh()`).
  **Pendiente explícito:** formulario de edición de ítems en la UI — la acción
  server quedó lista y testeada; `OfertaForm` (579 líneas, modo create) necesita
  una fase propia de refactor a modo edición.
- [x] Commit: `ea3ac5dd feat(ofertas): edición de ítems en PENDIENTE y duplicación con precios re-resueltos (E-4)`

## Cierre

- [x] Suite completa del feature: `pnpm exec vitest run src/features/ofertas`
  — 69/69 verde.
- [x] Lint de archivos tocados — 0 errores (1 warning pre-existente de React
  Compiler en `useReactTable`, ajeno al cambio).
- [x] Spec delta revisado contra la implementación final
  (`specs/ofertas/spec.md` — los 6 requirements cubiertos por tests).
- [x] Merge a `main` — autorizado el 2026-10-19: fast-forward `19bfb880 → 8ac9004b` vía `feat/sesion-e-integracion`.

## Integración con main + correcciones del review (2026-10-19, rama feat/sesion-e-integracion)

Merge de `feat/sesion-e-ofertas` sobre `origin/main` (101 commits de distancia,
incluidos Sesión A re-integrada, C y D). El review pre-merge (2 agentes
independientes + análisis propio) halló 2 bloqueos; ambos corregidos con TDD
(RED genuino: 12 fallos capturados contra el código pre-fix en
`/tmp/e-red2.log`; GREEN: 83/83):

- [x] **Resolución de conflicto (1)**: `__tests__/actions.test.ts` — se
  conservó la forma del registro de E (`id` + `estado`) que main había dejado
  obsoleta.
- [x] **B-1 (Alta) — la edición de ítems no estaba serializada con
  facturar/convertir**: la edición validaba PENDIENTE fuera de la
  transacción y luego reemplazaba ítems/totales incondicionalmente; una
  facturación o conversión concurrente dejaba la venta/factura con el
  snapshot viejo y la oferta con el contenido nuevo. Ahora los 3 writers
  comparten el advisory lock transaccional por oferta
  (`lib/oferta-lock.ts`, allowlist AS-03 al día): la edición relee el estado
  VIVO dentro de su transacción (no-PENDIENTE → `ITEMS_NO_EDITABLES`), y
  facturar/convertir toman el snapshot bajo el mismo lock (relectura fresca
  en la transacción). El marcado FACTURADA pasa de `update` incondicional a
  claim condicional (`updateMany` por estado releído; count 0 revierte la
  venta con la transacción). La conversión re-verifica idempotencia dentro
  de la transacción (doble conversión concurrente devuelve el pedido
  existente en vez de chocar por el unique).
- [x] **B-2 (Alta) — aceptar desde un detalle obsoleto eludía la expiración
  (E-2)**: `updateOfertaAction` no expiraba al tocar el módulo, y la
  aceptación no verificaba `fechaVencimiento`; una PENDIENTE vencida podía
  pasar a ACEPTADA y ya nunca expiraba (la expiración solo toca PENDIENTE),
  facturándose después. Ahora update expira antes de leer y la transición de
  estado es un claim condicional que exige el estado leído **y** que la
  oferta no esté vencida (`OR fechaVencimiento IS NULL / >= ahora`); el claim
  fallido se relee para distinguir `OFERTA_VENCIDA` (se marca VENCIDA) de
  `ESTADO_TRANSICION_INVALIDA`. La edición de ítems también aborta con
  `OFERTA_VENCIDA` si vence durante la edición.

### Evidencia de la integración

- RED: 12 fallos por las razones correctas (sin lock/relectura fresca, sin
  claim de FACTURADA, sin idempotencia en tx, aceptación de vencida).
- GREEN: ofertas + API → **83/83** (12 archivos); allowlists + auth +
  contrato de aislamiento → **140/140**.
- Suite completa / typecheck / lint / openapi: verificados sobre el árbol
  combinado (regenerado el cliente Prisma: el enum VENCIDA + schema de
  main).
- Honestidad de evidencia: los intercalados se cierran por diseño (lock
  compartido + relectura + claims) y quedan fijados con tests de claim
  fallido; no se reprodujeron carreras reales contra PostgreSQL vivo.
