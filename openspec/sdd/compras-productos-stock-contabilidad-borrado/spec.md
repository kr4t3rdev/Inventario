# Spec: Corrección de stock legacy, reconciliación contable y borrado seguro en compras-productos

## Scope

Cuatro problemas en el módulo de compras de productos. Orden de aplicación recomendado: H1 → H3 → H4 → H2 (de más simple a más complejo, dejando reconciliación contable para el final por su complejidad).

## H1 — Alta de compra: sincronizar producto.stock con StockUbicacion

### Archivo
`src/features/compras-productos/actions.ts:137-147`

### Cambios
1. Después de llamar `upsertStockUbicacion()` con `modo: 'increment'`, agregar actualización de `producto.stock` con el mismo delta.
2. Hacer dentro de la misma transacción para mantener atomicidad.

### Scenarios

**Scenario: Crear compra incrementa producto.stock**
Given un producto con `stock = 10` y `StockUbicacion.cantidad = 10`
When se crea una compra con `cantidad = 5`
Then `upsertStockUbicacion` se llama con `modo: 'increment', delta: 5`
And `producto.update` se llama con `data: { stock: { increment: 5 } }`
And `producto.stock` queda en `15`
And `StockUbicacion.cantidad` queda en `15`

**Scenario: Stock legacy y StockUbicacion sincronizados**
Given una compra recién creada
When se consulta `producto.stock` y `SUM(StockUbicacion.cantidad)`
Then ambos valores son iguales

---

## H3 — Eliminar compra: validar que no esté impactada

### Archivo
`src/features/compras-productos/actions.ts:267-279`

### Cambios
1. Antes de hacer soft delete, verificar que la compra no tenga:
   - `gastoCompraId` no null (generó gasto contable)
   - `cuentaPorPagarId` no null (generó cuenta por pagar)
   - Anticipo aplicado (verificar en `AnticipoMovimiento` con `documentoDestinoId` y `contexto: 'COMPRA_PRODUCTO'`)
2. Si tiene alguno de estos, lanzar `ActionError` con mensaje claro indicando qué debe revertir primero.
3. Si no tiene impacto, proceder con soft delete normal.

### Scenarios

**Scenario: Borrar compra sin impacto contable**
Given una compra con `gastoCompraId = null`, `cuentaPorPagarId = null`, sin anticipos aplicados
When se llama `deleteCompraProductoAction(id)`
Then se hace soft delete (`deletedAt = new Date()`)
And retorna `{ id, eliminado: true }`

**Scenario: Borrar compra con gastoCompra es rechazado**
Given una compra con `gastoCompraId = "gc-1"`
When se llama `deleteCompraProductoAction(id)`
Then lanza `ActionError` con código `'HAS_IMPACT'`
And mensaje: "No se puede eliminar la compra porque tiene gasto contable asociado. Revierta el gasto desde Contabilidad primero."
And no se hace soft delete

**Scenario: Borrar compra con cuentaPorPagar es rechazado**
Given una compra con `cuentaPorPagarId = "cxp-1"`
When se llama `deleteCompraProductoAction(id)`
Then lanza `ActionError` con código `'HAS_IMPACT'`
And mensaje: "No se puede eliminar la compra porque tiene cuenta por pagar asociada. Revierta la cuenta desde Contabilidad primero."
And no se hace soft delete

**Scenario: Borrar compra con anticipo aplicado es rechazado**
Given una compra con anticipo aplicado (existe `AnticipoMovimiento` con `documentoDestinoId = id` y `contexto = 'COMPRA_PRODUCTO'`)
When se llama `deleteCompraProductoAction(id)`
Then lanza `ActionError` con código `'HAS_IMPACT'`
And mensaje: "No se puede eliminar la compra porque tiene anticipo aplicado. Revierta el anticipo primero."
And no se hace soft delete

---

## H2 — Editar formaPago/estado: reconciliación contable

### Archivo
`src/features/compras-productos/actions.ts:250-261`

### Cambios
1. Antes de actualizar `formaPago`, cargar la compra con sus relaciones (`gastoCompra`, `cuentaPorPagar`).
2. Si `formaPago` cambia, ejecutar lógica de reconciliación:
   - **De PAGO_PARCIAL a PAGO_COMPLETO**: eliminar `cuentaPorPagar` asociada (si `estado = 'PENDIENTE'` y `saldoPendiente = montoDeuda`).
   - **De PAGO_COMPLETO a PAGO_PARCIAL**: crear nueva `cuentaPorPagar` con `montoDeuda = total`, `saldoPendiente = total`.
   - **De/Cualquier estado a ANTICIPO_PAGO**: bloquear edición con error (no hay función de reversión de anticipo implementada).
   - **De ANTICIPO_PAGO a otro**: bloquear edición con error (no hay función de reversión de anticipo implementada).
3. Si `estado` cambia, validar que el nuevo estado sea válido según reglas de negocio (no implementar lógica compleja por ahora).
4. Actualizar `gastoCompra` si es necesario (por ahora, solo mantenerlo sincronizado con el total).

### Scenarios

**Scenario: Cambiar formaPago de PAGO_PARCIAL a PAGO_COMPLETO**
Given una compra con `formaPago = 'PAGO_PARCIAL'`, `cuentaPorPagarId = 'cxp-1'`, `cuentaPorPagar.estado = 'PENDIENTE'`, `cuentaPorPagar.saldoPendiente = cuentaPorPagar.montoDeuda`
When se llama `updateCompraProductoAction({ compraDocumentoId, formaPago: 'PAGO_COMPLETO' })`
Then se elimina `cuentaPorPagar` con `delete({ where: { cuentaPorPagarId: 'cxp-1' } })`
And se actualiza `compraDocumento.cuentaPorPagarId = null`
And se actualiza `compraDocumento.formaPago = 'PAGO_COMPLETO'`
And retorna la compra actualizada

**Scenario: Cambiar formaPago de PAGO_COMPLETO a PAGO_PARCIAL**
Given una compra con `formaPago = 'PAGO_COMPLETO'`, `cuentaPorPagarId = null`, `total = 1000`, `proveedorId = 'prov-1'`, `numeroFactura = 'F-001'`
When se llama `updateCompraProductoAction({ compraDocumentoId, formaPago: 'PAGO_PARCIAL' })`
Then se crea `cuentaPorPagar` con `montoDeuda = 1000`, `saldoPendiente = 1000`, `estado = 'PENDIENTE'`, `moneda = 'CUP'`, `tipo = 'compra'`
And se actualiza `compraDocumento.cuentaPorPagarId = nuevoId`
And se actualiza `compraDocumento.formaPago = 'PAGO_PARCIAL'`
And retorna la compra actualizada

**Scenario: Cambiar formaPago a ANTICIPO_PAGO es rechazado**
Given una compra con `formaPago = 'PAGO_COMPLETO'`
When se llama `updateCompraProductoAction({ compraDocumentoId, formaPago: 'ANTICIPO_PAGO' })`
Then lanza `ActionError` con código `'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED'`
And mensaje: "No se puede cambiar a ANTICIPO_PAGO porque la reconciliación de anticipos no está implementada. Cree una nueva compra con anticipo en lugar de editar esta."
And no se actualiza la compra

**Scenario: Cambiar formaPago desde ANTICIPO_PAGO es rechazado**
Given una compra con `formaPago = 'ANTICIPO_PAGO'`
When se llama `updateCompraProductoAction({ compraDocumentoId, formaPago: 'PAGO_COMPLETO' })`
Then lanza `ActionError` con código `'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED'`
And mensaje: "No se puede cambiar desde ANTICIPO_PAGO porque la reconciliación de anticipos no está implementada. Anule la compra y cree una nueva."
And no se actualiza la compra

**Scenario: Cambiar cuentaPorPagar con saldo parcial es rechazado**
Given una compra con `formaPago = 'PAGO_PARCIAL'`, `cuentaPorPagar.saldoPendiente < cuentaPorPagar.montoDeuda` (tiene pagos parciales)
When se llama `updateCompraProductoAction({ compraDocumentoId, formaPago: 'PAGO_COMPLETO' })`
Then lanza `ActionError` con código `'CXP_HAS_PAYMENTS'`
And mensaje: "No se puede cambiar la forma de pago porque la cuenta por pagar tiene pagos parciales aplicados. Revierta los pagos desde Contabilidad primero."
And no se actualiza la compra

**Scenario: Editar solo campos de cabecera sin impacto contable**
Given una compra con cualquier `formaPago`
When se llama `updateCompraProductoAction({ compraDocumentoId, numeroFactura: 'F-002', descripcion: 'Nueva descripción' })`
Then se actualizan solo `numeroFactura` y `descripcion`
And no se toca `formaPago` ni entidades contables
And retorna la compra actualizada

---

## H4 — Tests: cubrir invariantes críticas

### Archivo
`src/features/compras-productos/__tests__/actions.test.ts`

### Cambios
1. Agregar tests para H1: validar que `producto.update` se llama con `stock: { increment }` después de `upsertStockUbicacion`.
2. Agregar tests para H3: validar que `deleteCompraProductoAction` rechaza compras con impacto.
3. Agregar tests para H2: validar reconciliación de `cuentaPorPagar` al cambiar `formaPago`.
4. Usar mocks realistas de Prisma que reflejen el schema real.

### Scenarios

**Scenario: Test de stock legacy sincronizado**
Given un mock de `upsertStockUbicacion` y `producto.update`
When se ejecuta `createCompraProductoAction` con datos válidos
Then `producto.update` fue llamado con `data: { stock: { increment: cantidad } }`
And la llamada incluye el mismo `delta` que `upsertStockUbicacion`

**Scenario: Test de borrado de compra impactada**
Given un mock de `compraDocumento.findFirst` que retorna compra con `gastoCompraId`
When se ejecuta `deleteCompraProductoAction`
Then el resultado tiene `success: false`
And el error tiene código `'HAS_IMPACT'`
And `compraDocumento.update` no fue llamado (no se hizo soft delete)

**Scenario: Test de reconciliación PAGO_PARCIAL a PAGO_COMPLETO**
Given un mock de compra con `cuentaPorPagar` en estado `PENDIENTE` y saldo completo
When se ejecuta `updateCompraProductoAction` con `formaPago: 'PAGO_COMPLETO'`
Then `cuentaPorPagar.delete` fue llamado
And `compraDocumento.update` fue llamado con `cuentaPorPagarId: null`

**Scenario: Test de reconciliación bloqueada por anticipo**
Given un mock de compra con `formaPago: 'PAGO_COMPLETO'`
When se ejecuta `updateCompraProductoAction` con `formaPago: 'ANTICIPO_PAGO'`
Then el resultado tiene `success: false`
And el error tiene código `'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED'`
And `compraDocumento.update` no fue llamado
