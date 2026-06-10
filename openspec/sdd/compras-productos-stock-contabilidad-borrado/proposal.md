# SDD Proposal: Corrección de stock legacy, reconciliación contable y borrado seguro en compras-productos

## Business Problem

El módulo de compras de productos tiene 3 problemas críticos que comprometen la integridad del inventario y la contabilidad:

1. **Stock legacy inconsistente**: Al crear una compra, se actualiza `StockUbicacion` pero no `producto.stock`, violando el contrato de sincronización definido en `stock-ubicacion-service.ts:30-33`.

2. **Edición de formaPago/estado sin reconciliación**: La UI permite cambiar forma de pago y estado, pero el backend no ajusta las entidades contables asociadas (`gastoCompra`, `cuentaPorPagar`, `anticipo`), dejando datos cruzados.

3. **Borrado sin reversión**: Eliminar una compra solo hace soft delete (`deletedAt`), sin revertir los efectos en stock, costo, cuenta por pagar ni anticipo aplicado.

Además, la cobertura de tests es insuficiente: no valida las invariantes reales del sistema (sincronización de stock, reconciliación contable, restricciones de borrado).

## Hallazgos (Evidence)

### H1 — Alta de compra: producto.stock no se actualiza

**Archivo:** `src/features/compras-productos/actions.ts:137-147`

**Problema:** Después de llamar a `upsertStockUbicacion()` con `modo: 'increment'`, no se actualiza `producto.stock` con el mismo delta.

**Evidencia:**
- Línea 144-147: `upsertStockUbicacion(tx, { modo: 'increment', delta: item.cantidad, ... })` → correcto
- No hay `producto.update({ data: { stock: { increment: item.cantidad } } })` → falta
- `stock-ubicacion-service.ts:30-33` dice explícitamente: "toda mutación a StockUbicacion DEBE también actualizar producto.stock con el mismo delta"

**Impacto:** `producto.stock` queda desincronizado de `SUM(StockUbicacion.cantidad)`. Reportes de stock muestran valores incorrectos. La inconsistencia se acumula con cada compra.

### H2 — Editar formaPago/estado no reconcilia contabilidad

**Archivo:** `src/features/compras-productos/actions.ts:250-261`

**Problema:** `updateCompraProductoAction` permite cambiar `formaPago` y `estado`, pero no ajusta:
- `gastoCompra` (registro contable del gasto)
- `cuentaPorPagar` (deuda pendiente si era PAGO_PARCIAL)
- `anticipo` (pago anticipado si era ANTICIPO_PAGO)

**Evidencia:**
- Línea 254: `if (data.formaPago !== undefined) updateData.formaPago = data.formaPago;` → solo actualiza el campo
- Línea 255: `if (data.estado !== undefined) updateData.estado = data.estado;` → solo actualiza el campo
- No hay lógica para:
  - Crear/eliminar `gastoCompra` al cambiar entre PAGO_COMPLETO/PAGO_PARCIAL/ANTICIPO_PAGO
  - Crear/eliminar `cuentaPorPagar` al cambiar a/desde PAGO_PARCIAL
  - Revertir/aplicar `anticipo` al cambiar a/desde ANTICIPO_PAGO

**Impacto:** Si una compra cambia de PAGO_PARCIAL a PAGO_COMPLETO, la `cuentaPorPagar` sigue existiendo con `saldoPendiente` original. Si cambia de PAGO_COMPLETO a ANTICIPO_PAGO, el `gastoCompra` sigue existiendo pero el anticipo no se aplica. Contabilidad inconsistente.

### H3 — Eliminar compra no revierte efectos

**Archivo:** `src/features/compras-productos/actions.ts:267-279`

**Problema:** `deleteCompraProductoAction` solo hace soft delete (`deletedAt: new Date()`), sin revertir:
- Stock incrementado (StockUbicacion y producto.stock)
- Precio de costo actualizado
- GastoCompra creado
- CuentaPorPagar creada
- Anticipo aplicado

**Evidencia:**
- Línea 273-276: Solo `compraDocumento.update({ data: { deletedAt: new Date() } })`
- No hay lógica de reversión

**Impacto:** Compra "eliminada" sigue impactando inventario y contabilidad. Stock inflado, costo incorrecto, cuentas por pagar fantasma, anticipos aplicados a documentos inexistentes.

### H4 — Cobertura de tests insuficiente

**Archivo:** `src/features/compras-productos/__tests__/actions.test.ts`

**Problema:** Los tests validan éxito básico pero no cubren invariantes reales:
- Sincronización `producto.stock` vs `StockUbicacion`
- Reconciliación contable al cambiar formaPago
- Restricciones de borrado (compras impactadas vs no impactadas)
- Manejo de anticipo al crear/editar/borrar

**Impacto:** Bugs como H1, H2, H3 pasan desapercibidos porque los tests no validan las propiedades críticas del sistema.

## Target Users

- Usuarios que registran compras de productos (operaciones diarias)
- Usuarios que editan compras (corrección de datos)
- Usuarios que eliminan compras (errores de digitación)
- **Impacto directo:** integridad del inventario y contabilidad para todos los tenants

## Non-Goals

- No refactorizar la arquitectura de Server Actions
- No cambiar el modelo de datos Prisma (no agregar campos nuevos)
- No implementar anulación reversora (crear documento inverso) — se eligió opción mínima para borrado
- No migrar de `producto.stock` a solo `StockUbicacion` (mantener legacy en paralelo)
- No modificar la UI de edición (solo el backend)
- No agregar nuevas funcionalidades de reconciliación automática desde Contabilidad

## Solution Sketch

4 fixes independientes, aplicables en orden:

1. **H1 (Stock legacy):** Agregar actualización de `producto.stock` después de `upsertStockUbicacion` en `createCompraProductoAction`.

2. **H2 (Reconciliación contable):** Implementar lógica de reconciliación en `updateCompraProductoAction` al cambiar `formaPago`:
   - Si cambia a/desde PAGO_PARCIAL: crear/eliminar `cuentaPorPagar`
   - Si cambia a/desde ANTICIPO_PAGO: aplicar/revertir `anticipo`
   - Actualizar `gastoCompra` si es necesario

3. **H3 (Borrado seguro):** Validar en `deleteCompraProductoAction` que la compra no esté impactada:
   - No tiene `gastoCompraId` (no generó gasto contable)
   - No tiene `cuentaPorPagarId` (no generó cuenta por pagar)
   - No tiene anticipo aplicado (verificar en `AnticipoEjecucionDetalle`)
   - Si está impactada, rechazar el borrado con error claro

4. **H4 (Tests):** Agregar tests que validen:
   - `producto.stock` se incrementa correctamente al crear compra
   - Cambio de formaPago reconcilia contabilidad
   - Borrado de compra impactada es rechazado
   - Borrado de compra no impactada funciona

## Success Criteria

- ✅ `producto.stock` == `SUM(StockUbicacion.cantidad)` después de crear compra
- ✅ Cambiar formaPago de PAGO_PARCIAL a PAGO_COMPLETO elimina `cuentaPorPagar`
- ✅ Cambiar formaPago de PAGO_COMPLETO a ANTICIPO_PAGO aplica anticipo correctamente
- ✅ Intentar borrar compra con `gastoCompraId` retorna error
- ✅ Intentar borrar compra con `cuentaPorPagarId` retorna error
- ✅ Intentar borrar compra con anticipo aplicado retorna error
- ✅ Tests cubren todas las invariantes anteriores
- ✅ No hay regresión en tests existentes

## Risks and Mitigations

### Riesgo 1: Reconciliación contable compleja
**Riesgo:** Implementar reconciliación completa puede ser más complejo de lo esperado (anticipos parcialmente aplicados, múltiples compras con mismo anticipo).
**Mitigación:** Empezar con casos simples (cambio de formaPago sin anticipo parcial). Si es muy complejo, fallback a opción segura (bloquear edición).

### Riesgo 2: Compras "atrapadas" no se pueden borrar
**Riesgo:** Si una compra tiene `gastoCompraId` pero el usuario necesita borrarla, queda "atrapada".
**Mitigación:** Mensaje de error claro explicando qué debe revertir primero (desde Contabilidad). Documentar workflow de reversión.

### Riesgo 3: Tests frágiles con mocks
**Riesgo:** Tests pueden usar mocks que no reflejan comportamiento real de Prisma.
**Mitigación:** Usar `vi.mock` con implementaciones realistas. Validar llamadas con `toHaveBeenCalledWith` incluyendo campos de stock y contabilidad.

## Dependencies

- `src/lib/services/stock-ubicacion-service.ts` (contrato de sincronización)
- `src/lib/services/anticipo-service.ts` (funciones `applyAnticipoAllocations`, `hasUnrevertedAnticipoExecution`)
- Modelo Prisma: `CompraDocumento`, `GastoCompra`, `CuentaPorPagar`, `AnticipoEjecucionDetalle`

## Estimated Effort

- H1 (Stock legacy): 2 horas (fix + test)
- H2 (Reconciliación): 6-8 horas (lógica compleja + tests)
- H3 (Borrado seguro): 3 horas (validación + tests)
- H4 (Tests adicionales): 4 horas (cubrir invariantes)
- **Total:** 15-17 horas

## Rollback Plan

Si la reconciliación contable (H2) resulta demasiado compleja o introduce bugs:
1. Revertir a opción segura: bloquear edición de `formaPago` y `estado` en la UI
2. Mantener H1 y H3 (son fixes independientes y seguros)
3. Reprogramar H2 para siguiente sprint con diseño más detallado
