# Tasks — PVE Pedidos de venta con ciclo de estados

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en
unitarios (barrera de aislamiento vigente: nada de prisma real fuera de `__integration__`);
runs acotados con rutas explícitas (`pnpm exec vitest run <rutas>`); code review por fase
(agente typescript-reviewer) y **commit por fase con stage selectivo** (el worktree vive sucio:
jamás `git add -A`; revisar `git diff --cached --name-only` antes de commitear). Evidencias en
`openspec/changes/pedidos-venta-ciclo-estados/evidence/`.

## PVE-T1 — Schema, migración, permiso y feature flag

- [ ] **T1.1 RED.** Test de tipos/contrato: `src/features/ventas/__tests__/venta-estado-types.test.ts`
  (enum importable, defaults del schema validados vía `_dmmf` o fixture; backfill documentado como
  snapshot de la migración SQL). Evidencia `evidence/PVE-T1-RED.txt`.
- [ ] **T1.2 GREEN.** `EstadoVenta` + `Venta.estado @default(ENTREGADA)` en `prisma/schema.prisma`;
  migración con backfill (`ANULADA` ← deletedAt, `FACTURADA` ← factura) generada y revisada a mano.
  `npx prisma validate` + migración aplicada en DB local de desarrollo.
- [ ] **T1.3 Permiso + flag.** `ventas.pedido.gestionar` en `permission-registry.ts`
  (default = roles de `ventas.venta.registrar`) + fixture de paridad; feature `ventas-pedidos`
  en `feature-registry.ts`. Suite auth verde.
- [ ] Review + commit: `feat(ventas): estado de ciclo de vida en Venta con backfill (PVE-T1)`

## PVE-T2 — Servicio de ciclo de vida (núcleo, sin tocar create)

- [ ] **T2.1 RED.** `src/features/ventas/__tests__/venta-lifecycle.test.ts`:
  entregar (happy + stock insuficiente sin efectos + doble entrega concurrente), facturar
  (happy + gate `ventas-factura` + ya-facturada), anular desde cada estado (PEDIDO sin efectos,
  ENTREGADA revierte stock/FIFO, FACTURADA reversión completa, turno cerrado rechazado).
  Evidencia `evidence/PVE-T2-RED.txt`.
- [ ] **T2.2 GREEN.** `venta-lifecycle-service.ts` con `entregarVenta`, `facturarVenta`,
  `anularVentaPorEstado`; guards idempotentes por `updateMany` condicionado a estado; efectos
  llamando a los mismos servicios actuales (`upsertStockUbicacion`, `allocateFifoForSale`,
  `applyFacturacionCobroWorkflow`). Evidencia `evidence/PVE-T2-GREEN.txt`.
- [ ] Review + commit: `feat(ventas): servicio de ciclo de vida de pedidos (PVE-T2)`

## PVE-T3 — `create` como orquestador + acciones server

- [ ] **T3.1 RED.** Tests de orquestación en `venta-lifecycle.test.ts` o nuevo
  `venta-create-orquestacion.test.ts`: create clásico termina `FACTURADA`/`ENTREGADA` según plan;
  create modo pedido termina `PEDIDO` sin stock; mismos campos de respuesta que hoy.
  Evidencia `evidence/PVE-T3-RED.txt`.
- [ ] **T3.2 GREEN.** Extracción de efectos en `venta-mutation-service.ts` (bloques
  persistir/entrega/facturación) y orquestación; `anular` delega en `anularVentaPorEstado`.
  Regresión: suites `src/features/ventas src/app/api/ventas src/app/api/mobile` verdes (la red
  de 150+ tests existente valida el refactor puro). Evidencia `evidence/PVE-T3-GREEN.txt`.
- [ ] **T3.3 Actions.** `entregarVentaAction`, `facturarVentaAction` con `withAction` +
  `requireTenant` + `requirePermission('ventas.pedido.gestionar')` + `AuditLogService.log`.
  Tests de auth/permiso incluidos.
- [ ] Review + commit: `feat(ventas): create orquesta el ciclo y acciones de transición (PVE-T3)`

## PVE-T4 — UI de pedidos + integración Ofertas

- [ ] **T4.1 RED.** Tests de componentes nuevos (badge de estado, filtro, botones por estado con
  permiso) en `src/features/ventas/__tests__/` con Testing Library. Evidencia
  `evidence/PVE-T4-RED.txt`.
- [ ] **T4.2 GREEN.** Lista de ventas (`src/app/busy/sales/`): columna/badge de estado + filtro;
  detalle con acciones Entregar/Facturar/Anular según estado y permiso; formulario "Nuevo pedido"
  (crea en `PEDIDO`, sin paso de cobro). Todo tras flag `ventas-pedidos`; textos en español neutro
  con JSDoc según guía. Componentes < 200 líneas.
- [ ] **T4.3 Ofertas.** `convertirOfertaAPedidoAction` + botón en detalle de oferta
  (`PENDIENTE|ACEPTADA`); tests: crea venta `PEDIDO` vinculada por `ofertaId`, oferta queda
  `ACEPTADA`, idempotencia (doble click no duplica). Evidencia `evidence/PVE-T4-GREEN.txt`.
- [ ] Review + commit: `feat(ventas): UI de pedidos con transiciones y conversión desde ofertas (PVE-T4)`

## PVE-T5 — Cierre: regresión, E2E y docs

- [ ] **T5.1 Regresión completa** de suites scoped: `src/features/ventas src/features/ofertas
  src/lib/api src/lib/auth src/lib/server-actions src/app/api/ventas src/app/api/mobile
  src/app/actions`; `tsc --noEmit` limpio; eslint limpio en archivos tocados.
  Evidencia `evidence/PVE-T5-GREEN.txt`. (Fallos pre-existentes ajenos se listan, no se arreglan.)
- [ ] **T5.2 E2E.** Spec Playwright del ciclo pedido→entregar→facturar en entorno controlado
  (specs e2e force-trackeados); el smoke contra producción corre manual tras el deploy
  (`pnpm run test:e2e:prod`).
- [ ] **T5.3 Cierre.** Actualizar memoria (`ventas-vs-odoo-verificacion`: gap 1 → resuelto) y
  AGENTS.md si el flujo de ventas cambia para próximas sesiones; mover el change a
  `openspec/changes/archive/2026-09-XX-pedidos-venta-ciclo-estados/`.
- [ ] Commit: `docs(openspec): cerrar PVE pedidos de venta con ciclo de estados`

## Dependencias y notas

- LP-0 (precios server-side) ya resuelve y exige precios en create: el modo pedido **reusa el
  mismo resolver**; no se re-discute precios aquí.
- Anticipos en el cobro: ocurren en `FACTURADA` vía el workflow actual; pedidos a crédito generan
  CxC en `FACTURADA` como hoy.
- Si en T4 surge necesidad de editar un pedido, no se improvisa: se anota como fast-follow.
