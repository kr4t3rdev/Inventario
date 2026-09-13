# Tasks — LP-0 Integridad de precios server-side

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en unitarios (contrato vigente); rutas explícitas al correr vitest; code review y commit por fase con stage selectivo.

## LP0-T1 — Resolver + permiso

- [ ] **LP0-T1.1 RED.** `src/features/ventas/__tests__/precio-venta-resolver.test.ts`: cadena cliente > PV > base, fuente correcta en cada rama, lista del cliente ausente → cae a PV, ambas ausentes → base, `precios` vacío → base. Evidencia `evidence/LP0-T1-RED.txt`.
  `pnpm exec vitest run src/features/ventas/__tests__/precio-venta-resolver.test.ts`
- [ ] **LP0-T1.2 GREEN.** Implementar `src/features/ventas/services/precio-venta-resolver.ts`.
- [ ] **LP0-T1.3 Permiso.** Alta de `ventas.precio.override` en `permission-registry.ts` + fixture de paridad (solo manager). Suite de auth verde.
  `pnpm exec vitest run src/lib/auth`
- Commit: `feat(ventas): resolver de precio unificado y permiso ventas.precio.override (LP0-T1)`

## LP0-T2 — Enforcement en creación de venta

- [ ] **LP0-T2.1 RED.** `src/features/ventas/__tests__/venta-price-integrity.test.ts`:
  (a) precio manipulado sin override → `PRICE_MISMATCH`, sin `venta.create` ni stock;
  (b) mismatch con override → venta creada con precio enviado + `AuditLogService.logStrict` con ambos precios;
  (c) cliente con lista → se exige su precio (mismatch si el POS mandó el del PV);
  (d) coincide → flujo normal;
  (e) sin listas → exige `precioVenta`.
  Evidencia `evidence/LP0-T2-RED.txt`.
  `pnpm exec vitest run src/features/ventas/__tests__/venta-price-integrity.test.ts`
- [ ] **LP0-T2.2 GREEN.** Implementar en `venta-mutation-service.ts` según design.md.
- [ ] **LP0-T2.3 Mocks existentes.** Ajustar `src/features/ventas/__tests__/actions.test.ts` y `src/app/api/ventas/punto-venta/ventas/route.test.ts` (nuevo `producto.findMany` de resolución) hasta verde.
  `pnpm exec vitest run src/features/ventas src/app/api/ventas`
- Commit: `feat(ventas): re-resolución de precios server-side con política de override (LP0-T2)`

## LP0-T3 — Payload POS con precios de cliente

- [ ] **LP0-T3.1 RED.** Tests de `src/lib/api/productos-ubicacion.test.ts`: con `clienteId` incluye `precios` de las listas PV+cliente; sin `clienteId` comportamiento actual; almacén ignora cliente.
  `pnpm exec vitest run src/lib/api/productos-ubicacion.test.ts`
- [ ] **LP0-T3.2 GREEN.** `getProductosPorUbicacion(ubicacionId, clienteId?)`, ruta con `?clienteId=`, wrapper de `src/app/actions/` y `pv-interface.tsx` pasando el cliente seleccionado.
- [ ] **LP0-T3.3 Sync.** Actualizar `src/app/api/ventas/punto-venta/[puntoDeVentaId]/productos/route.test.ts` si cambia la forma del payload.
- Commit: `feat(ventas): POS expone precios de listas PV+cliente para coherencia (LP0-T3)`

## LP0-T4 — Cierre

- [ ] **LP0-T4.1 Regresión.** `pnpm exec vitest run src/features/ventas src/lib/api src/lib/auth src/app/api/ventas` + `pnpm run lint`. Evidencia `evidence/LP0-T4-GREEN.txt`.
- [ ] **LP0-T4.2 Code review** con el agente reviewer; corregir hallazgos.
- [ ] **LP0-T4.3 Memorias + archivo.** Actualizar `listas-precios-audit-plan` (LP-0 completado, H1/H2 cerrados a nivel server) y mover el change a `openspec/changes/archive/2026-09-12-ventas-precio-server-lp0/`.
- Commit: `docs(openspec): cerrar LP-0 integridad de precios server-side`
