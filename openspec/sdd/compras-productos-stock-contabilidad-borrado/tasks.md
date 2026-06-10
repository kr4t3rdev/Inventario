# Tasks: Corrección de stock legacy, reconciliación contable y borrado seguro en compras-productos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-180 |
| 400-line budget risk | Medium (H2 es la más compleja) |
| Chained PRs recommended | No — single PR (fixes relacionados) |
| Files touched | 2 (1 actions + 1 test file) |

## Priority & Dependency Order

Orden recomendado: H1 → H3 → H4 → H2 (de más simple a más complejo). H1 y H3 son fixes independientes. H4 agrega tests para H1 y H3. H2 es el más complejo y se deja para el final.

---

## Task 1: H1 — Sincronizar producto.stock con StockUbicacion

### Files
- `src/features/compras-productos/actions.ts` (lines 137-147)

### Changes
- [ ] Después de `upsertStockUbicacion()` en el loop de items, agregar `producto.update` con `stock: { increment: item.cantidad }`
- [ ] Verificar que se hace dentro de la transacción (ya está dentro de `prisma.$transaction`)
- [ ] Ejecutar `pnpm run test:run -- src/features/compras-productos/` para confirmar que no hay regresión

### Verification
- [ ] TypeScript strict: `pnpm run lint` sin errores
- [ ] Tests existentes pasan
- [ ] Manual: crear compra y verificar que `producto.stock` == `SUM(StockUbicacion.cantidad)`

---

## Task 2: H3 — Validar que compra no esté impactada antes de borrar

### Files
- `src/features/compras-productos/actions.ts` (lines 267-279)

### Changes
- [ ] Agregar `include: { cuentaPorPagar: true }` en `findFirst` para cargar relación
- [ ] Agregar validación: si `compra.gastoCompraId` no es null, lanzar `ActionError` con código `'HAS_IMPACT'`
- [ ] Agregar validación: si `compra.cuentaPorPagarId` no es null, lanzar `ActionError` con código `'HAS_IMPACT'`
- [ ] Agregar query a `AnticipoMovimiento` con `documentoDestinoId` y `contexto: 'COMPRA_PRODUCTO'`
- [ ] Si existe `AnticipoMovimiento`, lanzar `ActionError` con código `'HAS_IMPACT'`
- [ ] Ejecutar `pnpm run test:run -- src/features/compras-productos/` para confirmar

### Verification
- [ ] TypeScript strict: sin errores
- [ ] Tests existentes pasan
- [ ] Manual: intentar borrar compra con gasto contable → error claro
- [ ] Manual: intentar borrar compra sin impacto → soft delete exitoso

---

## Task 3: H4 (parcial) — Tests para H1 y H3

### Files
- `src/features/compras-productos/__tests__/actions.test.ts`

### Changes
- [ ] Agregar test: `createCompraProductoAction` llama `producto.update` con `stock: { increment }`
- [ ] Agregar test: `deleteCompraProductoAction` rechaza compra con `gastoCompraId`
- [ ] Agregar test: `deleteCompraProductoAction` rechaza compra con `cuentaPorPagarId`
- [ ] Agregar test: `deleteCompraProductoAction` rechaza compra con anticipo aplicado
- [ ] Agregar test: `deleteCompraProductoAction` permite borrar compra sin impacto
- [ ] Ejecutar `pnpm run test:run -- src/features/compras-productos/` para confirmar

### Verification
- [ ] Todos los tests nuevos pasan
- [ ] Cobertura de invariantes: stock sincronizado, borrado seguro
- [ ] No hay regresión en tests existentes

---

## Task 4: H2 — Reconciliación contable al cambiar formaPago

### Files
- `src/features/compras-productos/actions.ts` (lines 250-261)

### Changes
- [ ] Agregar `include: { cuentaPorPagar: true }` en `findFirst` para cargar relación
- [ ] Crear función helper `reconcileFormaPago(compra, nuevaFormaPago)` fuera del action
- [ ] En `reconcileFormaPago`: bloquear cambios desde/hacia `ANTICIPO_PAGO` con error `'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED'`
- [ ] En `reconcileFormaPago`: implementar PAGO_PARCIAL → PAGO_COMPLETO (eliminar `cuentaPorPagar` si saldo completo)
- [ ] En `reconcileFormaPago`: implementar PAGO_COMPLETO → PAGO_PARCIAL (crear `cuentaPorPagar`)
- [ ] En `reconcileFormaPago`: validar que `cuentaPorPagar.saldoPendiente === montoDeuda` antes de eliminar
- [ ] Llamar `reconcileFormaPago` en `updateCompraProductoAction` si `formaPago` cambia
- [ ] Ejecutar `pnpm run test:run -- src/features/compras-productos/` para confirmar

### Verification
- [ ] TypeScript strict: sin errores
- [ ] Tests existentes pasan
- [ ] Manual: cambiar PAGO_PARCIAL → PAGO_COMPLETO → cuentaPorPagar eliminada
- [ ] Manual: cambiar PAGO_COMPLETO → PAGO_PARCIAL → cuentaPorPagar creada
- [ ] Manual: intentar cambiar a ANTICIPO_PAGO → error claro

---

## Task 5: H4 (completo) — Tests para H2

### Files
- `src/features/compras-productos/__tests__/actions.test.ts`

### Changes
- [ ] Agregar test: `updateCompraProductoAction` cambia PAGO_PARCIAL → PAGO_COMPLETO eliminando `cuentaPorPagar`
- [ ] Agregar test: `updateCompraProductoAction` cambia PAGO_COMPLETO → PAGO_PARCIAL creando `cuentaPorPagar`
- [ ] Agregar test: `updateCompraProductoAction` rechaza cambio a ANTICIPO_PAGO
- [ ] Agregar test: `updateCompraProductoAction` rechaza cambio desde ANTICIPO_PAGO
- [ ] Agregar test: `updateCompraProductoAction` rechaza PAGO_PARCIAL → PAGO_COMPLETO si tiene pagos parciales
- [ ] Agregar test: `updateCompraProductoAction` permite editar solo campos de cabecera sin impacto contable
- [ ] Ejecutar `pnpm run test:run -- src/features/compras-productos/` para confirmar

### Verification
- [ ] Todos los tests nuevos pasan
- [ ] Cobertura completa de invariantes de reconciliación
- [ ] No hay regresión en tests existentes

---

## Task 6: Verificación final y lint

### Files
- Todos los archivos modificados

### Changes
- [ ] Ejecutar `pnpm run lint` para verificar que no hay errores de ESLint
- [ ] Ejecutar `pnpm run test:run` para verificar que todos los tests pasan
- [ ] Verificar que TypeScript strict no reporta errores
- [ ] Revisar que no hay `@ts-expect-error` innecesarios
- [ ] Documentar en el PR los cambios y el rationale

### Verification
- [ ] `pnpm run lint` → 0 errores
- [ ] `pnpm run test:run` → todos los tests pasan
- [ ] `tsc --noEmit` → sin errores de tipo
- [ ] Code review: cambios son claros y siguen convenciones del proyecto

---

## Rollback Plan

Si H2 (reconciliación contable) introduce bugs o es más complejo de lo esperado:
1. Revertir Task 4 y Task 5 (H2 y sus tests)
2. Mantener Task 1, 2, 3 (H1, H3, tests de H1/H3)
3. Fallback: bloquear edición de `formaPago` y `estado` en la UI hasta implementar reconciliación completa
4. Reprogramar H2 para siguiente sprint con diseño más detallado

---

## Definition of Done

- [ ] Todos los tests pasan (`pnpm run test:run`)
- [ ] Lint pasa sin errores (`pnpm run lint`)
- [ ] TypeScript strict sin errores
- [ ] Code review aprobado
- [ ] Documentación actualizada (proposal, spec, design, tasks)
- [ ] PR creado con descripción clara de cambios
- [ ] Verificación manual de al menos 2 scenarios críticos
