# Tasks — PVE Pedidos de venta con ciclo de estados

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en
unitarios (barrera de aislamiento vigente: nada de prisma real fuera de `__integration__`);
runs acotados con rutas explícitas (`pnpm exec vitest run <rutas>`); code review por fase
(agente typescript-reviewer) y **commit por fase con stage selectivo** (el worktree vive sucio:
jamás `git add -A`; revisar `git diff --cached --name-only` antes de commitear). Evidencias en
`openspec/changes/pedidos-venta-ciclo-estados/evidence/`.

## PVE-T1 — Schema, migración, permiso y feature flag

- [x] **T1.1 RED.** Test de tipos/contrato: `src/features/ventas/__tests__/venta-estado-types.test.ts`
  (enum importable, defaults del schema validados vía `_dmmf` o fixture; backfill documentado como
  snapshot de la migración SQL). Evidencia `evidence/PVE-T1-RED.txt`.
- [x] **T1.2 GREEN.** `EstadoVenta` + `Venta.estado @default(ENTREGADA)` en `prisma/schema.prisma`;
  migración con backfill (`ANULADA` ← deletedAt, `FACTURADA` ← factura) generada offline
  (`migrate diff` datamodel↔datamodel + backfill a mano; `migrate dev` inaccesible sin
  DATABASE_URL en la shell del agente — `prisma.config.ts` salta la carga de .env).
  Aplicación: pendiente en dev local; en producción corre con `migrate deploy` al arrancar.
- [x] **T1.3 Permiso + flag.** `ventas.pedido.gestionar` en `permission-registry.ts`
  (default = roles de `ventas.venta.registrar`) + fixture de paridad; feature `ventas-pedidos`
  en `feature-registry.ts`. Suite auth/planes verde (101 tests, incluida paridad).
- [x] Review (typescript-reviewer: APROBAR, sin bloqueantes; typecheck exit 0) + commit
  `24061660 feat(ventas): estado de ciclo de vida en Venta con backfill (PVE-T1)`.

## PVE-T2 — Servicio de ciclo de vida (núcleo, sin tocar create)

- [x] **T2.1 RED.** `src/features/ventas/__tests__/venta-lifecycle.test.ts` (13 casos):
  entregar (happy + stock insuficiente sin efectos + doble entrega + tenant + gate plan),
  facturar (happy con serie + workflow de cobro + pedido-no-entregado + sin cliente),
  anular por estado (PEDIDO sin efectos, ENTREGADA con reversión, FACTURADA completa, turno
  cerrado). Evidencia `evidence/PVE-T2-RED.txt` (módulo inexistente).
- [x] **T2.2 GREEN.** `venta-lifecycle-service.ts` con `entregarVenta`, `facturarVenta`,
  `anularVentaPorEstado`; claims idempotentes por `updateMany` condicionado a estado;
  efectos con los mismos servicios vigentes; `cancel()` del mutation-service queda como
  wrapper delegando (reversión unificada). Evidencia `evidence/PVE-T2-GREEN.txt`
  (suite ventas 71/71: 15 lifecycle + 56 existentes intactos).
- [x] **T2.3 Review (typescript-reviewer: APROBAR con observaciones) y fixes aplicados.**
  MEDIA-1: invariante MIXTO restaurado en `facturarVenta` (+test). MEDIA-2: `cargoTransporte`
  fuera del schema de facturar (subtotal = total + descuento; columna en Venta queda como
  change futuro si se necesita). MEDIA-3: invariante documentado — el pedido nace sin pago,
  el cobro se define al facturar. BAJA-1: costo del kardex leído dentro de la tx.
  BAJA-4: `observaciones` propagadas al workflow. Cobertura extra: claim perdedor (+1 test).
- [x] Commit: `feat(ventas): servicio de ciclo de vida de pedidos (PVE-T2)`

## PVE-T3 — `create` como orquestador + acciones server

- [x] **T3.1 RED.** Tests de orquestación en `venta-create-orquestacion.test.ts` (4 casos:
  clásico+cliente→FACTURADA, clásico sin cliente→ENTREGADA, modo pedido→PEDIDO sin efectos ni
  pago persistido, shape de respuesta intacto) + caso `anular PEDIDO con turno cerrado` en
  `venta-lifecycle.test.ts`. Evidencia `evidence/PVE-T3-RED.txt` (4 fallos auténticos).
- [x] **T3.2 GREEN.** Extracción de efectos a `aplicarEfectosInventario` (paridad exacta) y
  orquestación en `create` (estado en el create; serie/factura/efectos saltados en modo pedido);
  `anularVentaPorEstado` exime al PEDIDO de la guarda de turno cerrado (sin efectos que revertir,
  igual pre-tx que post-lock). Regresión: `src/features/ventas src/app/api/ventas src/app/actions`
  21 archivos / 105 tests verdes + typecheck limpio. Evidencia `evidence/PVE-T3-GREEN.txt`.
- [x] **T3.3 Actions.** `entregarVentaAction`, `facturarVentaAction` con `withAction` +
  `requireFeature('ventas-pedidos')` + delegación al lifecycle + `revalidatePath`.
  Tests de auth/permiso en `actions-lifecycle.test.ts` (3 casos).
  Nota review T3: `modoPedido` sin `.default()` (z.input) para no romper payloads de UI.
- [x] Review (typescript-reviewer: APROBAR con observaciones; MEDIUM de JSDoc corregido,
  LOWs documentados: MIXTO-pedido inofensivo, turno en pedido se ataca en T4 con la UI de
  entrega) + commit: `feat(ventas): create orquesta el ciclo y acciones de transición (PVE-T3)`

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
