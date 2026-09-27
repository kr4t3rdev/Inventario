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
- Worktree: `TCP-sesion-e-ofertas`, rama `feat/ofertas-sesion-e` (base `main`).

## E-1 — Numeración con retry (patrón contratos)

- [ ] **T1 — RED generador.** `src/features/ofertas/lib/numero-oferta-generator.test.ts`:
  formato `OF-000007`, continuación del último, primer número sin ofertas,
  colisión P2002 reintenta y triunfa, 3 colisiones agotan y relanzan, error no-P2002
  se propaga, `buildData` recibe el número formateado.
  `pnpm exec vitest run src/features/ofertas/lib/numero-oferta-generator.test.ts`
- [ ] **T2 — GREEN generador.** Implementar `numero-oferta-generator.ts`.
- [ ] **T3 — RED acción.** Test: `createOfertaAction` delega el número en el
  generador (no calcula inline); mocks de `prisma.oferta.findFirst/create`
  ajustados. Adaptar `__tests__/actions.test.ts` si el mock necesita el nuevo
  camino.
  `pnpm exec vitest run src/features/ofertas/__tests__/actions.test.ts`
- [ ] **T4 — GREEN acción.** `createOfertaAction` usa `crearOfertaConNumero`.
- [ ] Commit: `feat(ofertas): numeración secuencial con reintento ante P2002 (E-1)`

## E-2 — Estado VENCIDA + guardas

- [ ] **T1 — RED expiración.** `expiracion-ofertas-service` + test: expira
  PENDIENTE vencidas, no toca sin `fechaVencimiento`, no toca otros estados.
  Lecturas (`getOfertasAction`/`getOfertaByIdAction`) y facturar/convertir invocan
  la expiración antes de operar.
  `pnpm exec vitest run src/features/ofertas/__tests__/expiracion-estado.test.ts`
- [ ] **T2 — RED transiciones.** Matriz: `PENDIENTE→ACEPTADA/RECHAZADA` ok;
  `FACTURADA→PENDIENTE` y `VENCIDA→*` rechazadas con `ESTADO_TRANSICION_INVALIDA`;
  solo-`observaciones` permitido en cualquier estado; `delete` rechaza `FACTURADA`
  (`ESTADO_NO_ELIMINABLE`); facturar y convertir rechazan `VENCIDA` con mensaje.
- [ ] **T3 — GREEN schema + código.** Enum `VENCIDA` + migración SQL;
  `pnpm exec prisma generate`; union TS (`src/app/models/ofertas.ts`); badge en
  `ofertas-table.tsx`; guardas en `actions.ts`; lib de transiciones.
- [ ] **T4 — REFACTOR mocks.** Actualizar mocks existentes que llamen los nuevos
  caminos (expiración en lecturas).
- [ ] Commit: `feat(ofertas): estado VENCIDA con expiración perezosa y guardas de transición (E-2)`

## E-3 — Totales e impuestos recalculados en servidor

- [ ] **T1 — RED calculadora.** `totales-oferta.test.ts` (pura): total por línea
  con redondeo a 2, subtotal = Σ líneas, `total = subtotal + impuestos`,
  `impuestos < 0` (bloqueado antes por Zod, defensa en profundidad) e
  `impuestos > subtotal` → `TAX_INVALID`, cero ítems permitido con impuestos 0.
  `pnpm exec vitest run src/features/ofertas/lib/totales-oferta.test.ts`
- [ ] **T2 — RED integración.** `createOfertaAction` rechaza payload con
  `impuestos > subtotal` (`TAX_INVALID`) y persiste totales por línea recalculados
  aunque el cliente envíe `total` forjado.
  `pnpm exec vitest run src/features/ofertas/__tests__/actions.test.ts`
- [ ] **T3 — GREEN.** Implementar `totales-oferta.ts` y cablear en create.
- [ ] Commit: `feat(ofertas): recálculo autoritativo de totales e impuestos en servidor (E-3)`

## E-4 — Edición de ítems y duplicación

- [ ] **T1 — RED edición.** `edicion-duplicado.test.ts`: items en `PENDIENTE`
  reemplaza atómicamente (deleteMany+createMany) con precios re-resueltos y
  montos recalculados; items en estado distinto → `ITEMS_NO_EDITABLES`; producto
  cross-tenant → error; solo-observaciones sigue funcionando.
- [ ] **T2 — RED duplicación.** `duplicarOfertaAction`: copia con precios de hoy,
  número nuevo vía E-1, `PENDIENTE`, `fechaVencimiento` futura se conserva /
  vencida → `null`, `impuestos` original validado (supera nuevo subtotal →
  `TAX_INVALID`), cross-tenant → `NOT_FOUND`.
- [ ] **T3 — GREEN.** `ofertaUpdateSchema.items` + lógica en `updateOfertaAction`;
  `duplicarOfertaAction` nueva.
- [ ] **T4 — UI.** Botón Duplicar (tabla y/o detalle) con toast y refresh.
  Evaluar wire-up de edición de ítems según reusabilidad de `OfertaForm`; si no es
  contenida, dejar acción server + tarea explícita pendiente documentada aquí.
- [ ] Commit: `feat(ofertas): edición de ítems de oferta PENDIENTE y duplicación con precios re-resueltos (E-4)`

## Cierre

- [ ] Suite completa del feature: `pnpm exec vitest run src/features/ofertas`
- [ ] Lint de archivos tocados: `pnpm exec eslint <archivos>`
- [ ] Spec delta revisado contra la implementación final
  (`specs/ofertas/spec.md`)
- [ ] Rama lista para merge a `main` — **el merge espera aviso explícito del
  usuario**.
