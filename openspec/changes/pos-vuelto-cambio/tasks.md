# Tasks — VC Vuelto/cambio en el POS (Gap 3)

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en
unitarios; rutas explícitas al correr vitest; review por fase (typescript-reviewer) y commit
por fase con **stage selectivo** (worktree sucio: jamás `git add -A`). Evidencias en
`evidence/` dentro de este change.

## VC-T1 — Modelo + cálculo puro

- [x] **T1.1 RED.** `src/features/ventas/__tests__/pos-vuelto-calcu.test.ts` ~8 casos:
  vuelto calculado, cobro exacto (sin vuelto), insuficiente → rechazo, nulls en no-efectivo.
  Evidencia `evidence/VC-T1-RED.txt`.
- [x] **T1.2 GREEN.** `src/features/ventas/services/pos-vuelto-calcu.ts` + schema:
  2 columnas nuevas en `Venta` (`montoRecibidoEfectivo`, `cambioDevuelto`); refinamiento Zod
  en `createVentaSchema` (invariante recibido/retenido/cambio) + migración offline con
  `DATABASE_URL` dummy + `migrate diff`, anotando la nota de deploy db-push (los campos
  nullable caen limpios sin backfill). Evidencia `evidence/VC-T1-GREEN.txt`.
- [x] Review + commit `7602d79d`: feat(ventas): modelo y cálculo puro del vuelto (VC-T1)

## VC-T2 — Persistencia en el servicio de venta

- [x] **T2.1 RED.** `venta-mutation-service.test.ts` (o caso nuevo): venta con efectivo
  persiste `montoRecibidoEfectivo`/`cambioDevuelto`; sin ellos quedan null; regresión del
  flujo clásico intacta.
- [x] **T2.2 GREEN.** `venta-mutation-service.ts` guarda los dos campos en el create (sin
  tocar resto del ciclo de vida); mismos tests verdes. Evidencia `evidence/VC-T2-GREEN.txt`.
- [x] Review + commit `2c36a4ac`: feat(ventas): persistir vuelto en la venta (VC-T2)

## VC-T3 — Panel de cobro y UX del POS

- [x] **T3.1 RED.** Tests del diálogo: render de recibido solo si método lo amerita, vuelto
  en vivo, bloqueo de cobro si insuficiente, helper de enteros en el input.
  Evidencia `evidence/VC-T3-RED.txt`.
- [x] **T3.2 GREEN.** `src/features/ventas/components/pos-cobro-dialog.tsx` (método,
  montos por método existentes, recibido, vuelto vivo, validación) + integración en
  `pv-interface.tsx` y en `pv-invoice-dialog.tsx` (mismo panel antes de facturar) +
  accesibilidad (labels, aria). Textos en español neutro. Evidencia `evidence/VC-T3-GREEN.txt`.
- [x] Review + commit `6ce8f936` (BLOQUEO por H1 cargoTransporte → corregido en la misma fase:
  total del cobro con cargo en factura, MIXTO incluye cargo, reset de estado del diálogo,
  redondeos, banner de vuelto solo cuando aplica, test MIXTO completo): feat(ventas): panel
  de cobro con cálculo de vuelto (VC-T3)

## VC-T4 — Ticket y arqueo

- [x] **T4.1 RED.** Test del generador del ticket/recibo de venta: con vuelto muestra
  las líneas; sin vuelto no muestra nada. Evidencia `evidence/VC-T4-RED.txt`.
- [x] **T4.2 GREEN.** Generador del ticket + tests del cuadre/arqueo intactos (el esperado
  sigue sumando lo retenido; test de regresión explícito con vuelto incluido).
  Evidencia `evidence/VC-T4-GREEN.txt`.
- [ ] Review + commit: `feat(ventas): ticket con recibido/vuelto y arqueo intacto (VC-T4)`

## VC-T5 — Cierre

- [ ] **T5.1 Regresión completa** (ventas, arqueo, turnos, cuadre, reportes, mobile pos).
  Evidencia `evidence/VC-T5-GREEN.txt`.
- [ ] **T5.2 E2E rápido** del flujo (POS → cobro con vuelto → arqueo lo cuenta bien),
  guardado para post-deploy manual.
- [ ] **T5.3 Cierre documental:** memoria actualizada (`ventas-vs-odoo-verificacion`: gap 3
  resuelto) y archivo del change a `openspec/changes/archive/2026-09-16-pos-vuelto-cambio/`.
- Commit: `docs(openspec): cerrar VC vuelto en POS`
