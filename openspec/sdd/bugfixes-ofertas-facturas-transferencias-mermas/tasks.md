# Tasks: Bugfixes de ofertas, facturas, transferencias y mermas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 40-80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR (cambios pequeños y localizados) |
| Files touched | 8 (4 actions + 4 test files) |

## Priority & Dependency Order

Los fixes son independientes. Orden recomendado: H1 → H2 → H5 → H6 → H3 → H4 (de más simple a más complejo, y evitando que fixes de stock se apliquen antes de que los cambios de nombre de campo estén verificados).

---

## Task 1: H1 — Oferta update: corregir `ofertaId` → `id`

### Files
- `src/features/ofertas/actions.ts` (lines 95-120)
- `src/features/ofertas/__tests__/actions.test.ts` (si usa `ofertaId` en mocks)

### Changes
- [ ] Cambiar `where: { ofertaId, tenantId }` → `where: { id: ofertaId, tenantId }` en findFirst
- [ ] Cambiar `where: { ofertaId }` → `where: { id: ofertaId }` en update
- [ ] Eliminar ambos `// @ts-expect-error`
- [ ] Verificar tests: si los mocks usan `ofertaId`, actualizar a `id`
- [ ] Ejecutar `pnpm run test:run -- src/features/ofertas/` para confirmar

### Verification
- [ ] TypeScript strict: sin errores en las líneas modificadas
- [ ] Tests de ofertas pasan

---

## Task 2: H2 — Factura update: corregir `facturaId` → `idFactura`

### Files
- `src/features/facturas/actions.ts` (lines 60-74)
- `src/features/facturas/__tests__/actions.test.ts`

### Changes
- [ ] Cambiar `where: { facturaId, tenantId }` → `where: { idFactura: facturaId, tenantId }` en findFirst
- [ ] Cambiar `where: { facturaId }` → `where: { idFactura: facturaId }` en update
- [ ] Eliminar ambos `// @ts-expect-error`
- [ ] Verificar tests: si los mocks usan `facturaId`, actualizar a `idFactura`
- [ ] Ejecutar `pnpm run test:run -- src/features/facturas/` para confirmar

### Verification
- [ ] TypeScript strict: sin errores en las líneas modificadas
- [ ] Tests de facturas pasan

---

## Task 3: H5 — Transferencias count: agregar filtro `tenantId`

### Files
- `src/features/transferencias/actions.ts` (line ~144)

### Changes
- [ ] Cambiar `count({ where: { deletedAt: null } })` → `count({ where: { tenantId, deletedAt: null } })`

### Verification
- [ ] Test de `getTransferenciasAction` verifica que `count` recibe `tenantId`
- [ ] Tests de transferencias pasan

---

## Task 4: H6 — Mermas update: manejar cambio de almacén

### Files
- `src/features/mermas/actions.ts` (lines 136-208)
- `src/features/mermas/__tests__/actions.test.ts`

### Changes
- [ ] Refactorizar condicional de cambio para incluir `almacenId`
- [ ] Calcular `oldAlmacenId` y `nuevoAlmacenId` correctamente
- [ ] En transacción: revertir stock del almacén anterior, aplicar al nuevo
- [ ] Validar stock suficiente en destino cuando aplica
- [ ] Actualizar `almacenId` en la merma
- [ ] Agregar test: update solo almacén → upsertStockUbicacion llamado con old/new almacén
- [ ] Agregar test: update solo motivo → no toca stock
- [ ] Agregar test: update almacén + producto → transacción completa
- [ ] Ejecutar `pnpm run test:run -- src/features/mermas/` para confirmar

### Verification
- [ ] Tests de mermas pasan (incluyendo los nuevos)
- [ ] Cambio solo de almacénId mueve stock correctamente
- [ ] Cambio solo de motivo no toca stock

---

## Task 5: H3 — Transferencias delete: verificar estado antes de revertir stock

### Files
- `src/features/transferencias/actions.ts` (lines 566-619)
- `src/features/transferencias/__tests__/actions.test.ts`

### Changes
- [ ] Agregar guard: solo ejecutar `upsertStockUbicacion` si `transferencia.estado === "COMPLETADA"`
- [ ] Mantener el update a `CANCELADA` + `deletedAt` siempre
- [ ] Agregar test: delete PENDIENTE → no llama a upsertStockUbicacion
- [ ] Agregar test: delete COMPLETADA → llama a upsertStockUbicacion (comportamiento actual correcto)
- [ ] Ejecutar `pnpm run test:run -- src/features/transferencias/` para confirmar

### Verification
- [ ] Tests de transferencias pasan
- [ ] PENDIENTE se cancela sin tocar stock
- [ ] COMPLETADA se cancela y revierte stock

---

## Task 6: H4 — Transferencias update: verificar estado antes de resincronizar stock

### Files
- `src/features/transferencias/actions.ts` (lines 476-559)
- `src/features/transferencias/__tests__/actions.test.ts`

### Changes
- [ ] Agregar `const isCompleted = existing.estado === "COMPLETADA"` antes de la transacción
- [ ] Envolver las operaciones de stock (`upsertStockUbicacion`) dentro de `if (isCompleted)`
- [ ] Mantener update de datos de transferencia siempre (fuera del condicional o dentro pero siempre ejecutado)
- [ ] Agregar test: update PENDIENTE con cambio de origen → actualiza datos sin tocar stock
- [ ] Agregar test: update COMPLETADA con cambio de cantidad → resincroniza stock
- [ ] Agregar test: update PENDIENTE sin cambios reales → retorna "Sin cambios" (comportamiento actual)
- [ ] Ejecutar `pnpm run test:run -- src/features/transferencias/` para confirmar

### Verification
- [ ] Tests de transferencias pasan
- [ ] PENDIENTE se actualiza sin tocar stock
- [ ] COMPLETADA se actualiza y resincroniza stock

---

## Task 7: Verify all fixes together

### Changes
- [ ] Ejecutar `pnpm run typecheck` (o `pnpm run lint`) para verificar TypeScript
- [ ] Ejecutar `pnpm run test:run` para verificar que todos los tests del proyecto pasan
- [ ] Verificar que no quedan `@ts-expect-error` en los archivos modificados

### Verification
- [ ] TypeScript: 0 errors
- [ ] Tests: todos pasan
- [ ] No hay `@ts-expect-error` en ofertas/actions.ts ni facturas/actions.ts
