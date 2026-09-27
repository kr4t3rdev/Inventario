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
- [ ] Merge a `main` — **espera aviso explícito del usuario**.
