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

- [ ] 3.1 Tests rojos: `updateTransferenciaSchema` descarta `estado`; `createTransferenciaSchema` rechaza estados distintos de PENDIENTE/COMPLETADA
- [ ] 3.2 Retirar `estado` del schema de update y restringir el de creación; tests verdes

## 4. Fase B-4 — Higiene de logs

- [ ] 4.1 Eliminar logs con datos de negocio de `createTransferenciaAction` (conservar warn de reintento y error genérico de notificación)
- [ ] 4.2 Verificación: grep sin `=== ` en el feature y suite scoped verde

## 5. Fase B-5 — Checklists openspec

- [ ] 5.1 Verificar contra el código y sincronizar tareas de `fix-transferencias-bugs` (0/24)
- [ ] 5.2 Verificar contra el código y sincronizar tareas de `migrar-transferencias-server-first` (0/13)
- [ ] 5.3 Archivar ambos en `openspec/changes/archive/2026-09-26-*`

## 6. Verificación final

- [ ] 6.1 Suite scoped de transferencias + dashboard/reportes relacionados verde
- [ ] 6.2 `pnpm run lint` y `pnpm run typecheck` limpios
- [ ] 6.3 Code review (skill) sobre el diff completo; críticos/altos resueltos
- [ ] 6.4 Push de `feat/transferencias-cierre-flujo` a origin (sin merge a main hasta aviso del usuario)
