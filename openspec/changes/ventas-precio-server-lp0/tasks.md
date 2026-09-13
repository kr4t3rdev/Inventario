# Tasks — LP-0 Integridad de precios server-side

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en unitarios (contrato vigente); rutas explícitas al correr vitest; code review y commit por fase con stage selectivo.

## LP0-T1 — Resolver + permiso

- [x] **LP0-T1.1 RED.** `src/features/ventas/__tests__/precio-venta-resolver.test.ts` (6 casos). Evidencia `evidence/LP0-T1-RED.txt` (fallo de módulo inexistente).
- [x] **LP0-T1.2 GREEN.** `src/features/ventas/services/precio-venta-resolver.ts` — 6/6 verdes. Evidencia `evidence/LP0-T1-GREEN.txt`.
- [x] **LP0-T1.3 Permiso.** `ventas.precio.override` (manager, sensitive) en `permission-registry.ts` + fixture de paridad. Suite auth 77/77.
- Commit: `94fecb18 feat(ventas): resolver de precio unificado y permiso ventas.precio.override (LP0-T1)`

## LP0-T2 — Enforcement en creación de venta

- [x] **LP0-T2.1 RED.** `src/features/ventas/__tests__/venta-price-integrity.test.ts` (7 casos: mismatch sin permiso, match, override+audit, lista cliente exigida, base, PV inexistente, producto inexistente). Evidencia `evidence/LP0-T2-RED.txt` (6 fallos auténticos).
- [x] **LP0-T2.2 GREEN.** `venta-mutation-service.ts`: resolución pre-tx (PV/cliente/productos tenant-scoped), `PRICE_MISMATCH`, override + `AuditLogService.logStrict` dentro de la tx. **Fix transversal encontrado**: `with-action.ts` clasificaba como Prisma cualquier `ActionError` con código que empieza por "P" (PRICE_MISMATCH, PAYMENT_*, PERIODO_CERRADO…); el check `instanceof ActionError` ahora precede al duck-typing, con tests.
- [x] **LP0-T2.3 Mocks existentes.** `actions.test.ts` (mock `producto.findMany`, `cliente.findFirst`, PV por defecto). Suites `src/features/ventas src/app/api/ventas src/lib/server-actions src/lib/auth`: 21 archivos/158 tests verdes. Evidencia `evidence/LP0-T2-GREEN.txt`.
- Commit: `a19839d0 feat(ventas): re-resolución de precios server-side con política de override (LP0-T2)`
- Nota: `with-action.ts` quedó dentro del commit ajeno `fe472e86` (B-03, otra sesión) por contaminación de índice; contenido verificado idéntico en HEAD, sin pérdida.

## LP0-T3 — Payload POS con precios de cliente

- [x] **LP0-T3.1 RED.** 3 casos nuevos en `src/lib/api/productos-ubicacion.test.ts` (precios PV+cliente, solo PV sin cliente, almacén sin precios). Evidencia `evidence/LP0-T3-RED.txt`.
- [x] **LP0-T3.2 GREEN.** `getProductosPorUbicacion(ubicacionId, clienteId?)` con `precios` por producto; ruta `?clienteId=`; wrapper `src/app/actions/`; `pv-client.ts`; `pv-interface.tsx` pasa el cliente seleccionado y recarga al cambiarlo.
- [x] **LP0-T3.3 Sync.** `route.test.ts` (+test de propagación de clienteId) y `app/actions` test. Suites: 29 archivos/142 tests verdes. Evidencia `evidence/LP0-T3-GREEN.txt`.
- Commit: `feat(ventas): POS expone precios de listas PV+cliente para coherencia (LP0-T3)`

## LP0-T5 — Fixes del code review

Review (agente typescript-reviewer) con veredicto: bloquear por M-1/M-2; resto fast-follow.

- [x] **M-1 (bloqueante).** Lookup de cliente con filtro tenant condicional (fail-open) → fail-closed: `getProductosPorUbicacion` exige `tenantId` en contexto (403 si falta) y todos los lookups (PV, almacén, productos, cliente) van con filtro explícito. Cierra además el **P-0 pre-existente** (endpoint sin aislamiento).
- [x] **M-2 (bloqueante).** Tests ahora fijan el scoping: contexto con tenant, asserts de `tenantId` en where de PV/productos/cliente, caso 403 sin tenant y caso "cliente de otro tenant no filtra su lista".
- [x] **Menor 2.** Test "cliente de otro tenant → NOT_FOUND" en `venta-price-integrity.test.ts`.
- [x] **M-3.** POS bloquea cobro mientras `isFetchingProductos` (guardas en `processVenta`/`processVentaConFactura` + `disabled` en ambos botones).
- [x] **Menor 4.** Docstring de caché inexistente corregido en `src/app/actions/productos-ubicacion.ts` (con advertencia anti-caché por mezcla de precios).
- [x] **Docs.** TOCTOU y nota de rollout (mobile legacy + override manager) en `design.md`.
- Diferidos (documentados, fuera de alcance): M-4 rollout (acción operativa al desplegar), `empleadoId` sin scoping en venta (pre-existente, va con la re-auditoría B-xx), `serie: any`, `EnhancedVentaForm` no montado, 32 fallos de la suite completa fuera del diff (pre-existentes).
- Evidencia `evidence/LP0-T5-RED.txt` / `evidence/LP0-T5-GREEN.txt`.
- Commit: `fix(ventas): scoping fail-closed y bloqueo de cobro durante recarga (LP0-T5)`

## LP0-T4 — Cierre

- [ ] **LP0-T4.1 Regresión.** `pnpm exec vitest run src/features/ventas src/lib/api src/lib/auth src/lib/server-actions src/app/api/ventas src/app/actions src/app/api/mobile` + `pnpm exec tsc --noEmit` + lint de archivos tocados. Evidencia `evidence/LP0-T4-GREEN.txt`.
- [ ] **LP0-T4.2 Memorias + archivo.** Actualizar `listas-precios-audit-plan` (LP-0 completado) y mover el change a `openspec/changes/archive/2026-09-12-ventas-precio-server-lp0/`.
- Commit: `docs(openspec): cerrar LP-0 integridad de precios server-side`
