# Tasks: Transferencias — cierre de flujo (Sesión B)

## 1. Fase B-1 — Despacho (EN_TRANSITO alcanzable)

- [x] 1.1 Tests rojos: `despacharTransferenciaAction` (APROBADA→EN_TRANSITO con claim, PENDIENTE rechazado, dependiente FORBIDDEN, sin movimiento de stock/kardex)
- [x] 1.2 Implementar `despacharTransferenciaAction` (permiso `inventario.transferencias.gestionar`, claim atómico tenant-scoped)
- [x] 1.3 Helpers puros `puedeDespachar`/`puedeConfirmarRecepcion` en `lib/estados.ts` con tests
- [x] 1.4 UI: item "Despachar" en la tabla para APROBADA + handler en content + test verde

## 2. Fase B-2 — PARCIAL real (acumulativo)

- [x] 2.1 Tests rojos: completar persiste PARCIAL + mueve solo delta + kardex por recepción; acumulación hasta COMPLETADA; excedente rechazado; claim condicional concurrente; cancelar PARCIAL revierte; permiso gestionar en completar
- [x] 2.2 Implementar acumulación y PARCIAL en `completarTransferenciaAction` (claim condicional por `cantidadRecibida`, delta de stock, secuencias `SALIDA-n`/`ENTRADA-n`)
- [x] 2.3 `deleteTransferenciaAction` revierte PARCIAL; `updateTransferenciaAction` bloquea EN_TRANSITO/PARCIAL
- [x] 2.4 `TRANSFERENCIA_ESTADOS` + `PARCIAL`; select de listado incluye `cantidadRecibida`
- [x] 2.5 UI: diálogo de recepción con prellenado del faltante y evidencia "X de Y"; tabla muestra `recibida/enviada` y habilita recepción sobre PARCIAL; tests verdes

## 3. Fase B-3 — Input muerto y estados de creación

- [x] 3.1 Tests rojos: `updateTransferenciaSchema` descarta `estado`; `createTransferenciaSchema` rechaza estados distintos de PENDIENTE/COMPLETADA
- [x] 3.2 Retirar `estado` del schema de update y restringir el de creación; tests verdes

## 4. Fase B-4 — Higiene de logs

- [x] 4.1 Eliminar logs con datos de negocio de `createTransferenciaAction` (conservar warn de reintento y error genérico de notificación)
- [x] 4.2 Verificación: grep sin `=== ` en el feature y suite scoped verde

## 5. Fase B-5 — Checklists openspec

- [x] 5.1 Verificar contra el código y sincronizar tareas de `fix-transferencias-bugs` (0/24)
- [x] 5.2 Verificar contra el código y sincronizar tareas de `migrar-transferencias-server-first` (0/13)
- [x] 5.3 Archivar ambos en `openspec/changes/archive/2026-09-26-*`

## 6. Verificación final

- [x] 6.1 Suite scoped de transferencias + dashboard/reportes relacionados verde
- [x] 6.2 `pnpm run lint` y `pnpm run typecheck` limpios
- [x] 6.3 Code review (skill) sobre el diff completo; críticos/altos resueltos
- [x] 6.4 Push de `feat/transferencias-cierre-flujo` a origin (sin merge a main hasta aviso del usuario)

## Notas de verificación (2026-09-26)

- Suite: 122/122 (transferencias 62 + reportes-financieros 46 + dashboard 14) · lint scoped 0 errores · `tsc --noEmit` principal 0 errores.
- `typecheck:tests` no es gate activo: 1321 errores TS preexistentes en main y el script crashea por OOM sin NODE_OPTIONS (limitación preexistente, fuera de alcance).
- Code review final del diff completo (APPROVE): sin críticos/altos; limitaciones documentadas en design.md (filas fantasma históricas sin backfill, BUG-3 de agregados PV queda para la Sesión A, semántica del input `cantidadRecibida` documentada en schema).

## 7. Fase B-6 — Cierre de la revisión de cancelaciones (2026-11-01)

- [x] 7.1 Tests rojos: `src/app/api/mobile/__tests__/transfers-cancelacion.test.ts` (6/6 en rojo) — paridad del DELETE móvil con el desktop: reversión de stock para COMPLETADA y PARCIAL, compensación de kardex, claim que incluye `cantidadRecibida`, 409 `CONFLICT` y `deletedAt` en CANCELADA legacy
- [x] 7.2 GREEN móvil: `DELETE /api/mobile/transfers/[id]` reescrito con claim atómico tenant-scoped, reversión por unidades realmente movidas y compensación de kardex (`revertirMovimientosDeOrigen`)
- [x] 7.3 Helper único de verdad `calcularUnidadesMovidas` en `src/features/transferencias/lib/stock-pv.ts` (COMPLETADA → `cantidadRecibida ?? cantidad`; PARCIAL → `cantidadRecibida ?? 0`; resto → 0), usado por `calcularAporteRecibido`, el DELETE desktop y el DELETE móvil
- [x] 7.4 Tests rojos + GREEN desktop (`src/features/transferencias/__tests__/cancelacion-coherencia.test.ts`, 6/6): H4 (COMPLETADA recibida parcialmente revierte lo recibido), H5 (claim atómico tenant-scoped en aprobar/rechazar con `CONFLICT`), H3 (secuencia libre de kardex al editar)
- [x] 7.5 `aprobarTransferenciaAction` y `rechazarTransferenciaAction` con claim atómico `updateMany` (`estado: PENDIENTE`, `deletedAt: null`, `tenantId`) → `CONFLICT` si otra decisión ganó la carrera
- [x] 7.6 Secuencia libre de kardex: helper `siguienteIndiceKardex` (`src/features/transferencias/lib/kardex-secuencia.ts`) aplicado en `updateTransferenciaAction` y `completarTransferenciaAction` (la clave de evento incluye la secuencia: reutilizarla descartaba el movimiento)
- [x] 7.7 Scripts de reconciliación alineados con la regla de runtime: `prisma/scripts/reconcile-stock-ubicacion.ts`, `prisma/scripts/seed-stock-ubicacion.ts` y `prisma/scripts/backfill-stock-move.ts` usan `calcularUnidadesMovidas` y filtran `deletedAt: null` + estados que movieron stock
- [x] 7.8 Verificación: `pnpm exec vitest run src/features/transferencias src/app/api/mobile/__tests__` → 161/161 (14 archivos) · `pnpm exec vitest run src/features/puntos-venta src/lib/__tests__/stock-pv.test.ts src/features/inventario` → 92/92 · `tsc --noEmit` sin errores
