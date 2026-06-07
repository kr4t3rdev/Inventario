# Spec: Retirar `producto.stock` del flujo operativo

## Requirement 1 — Las mutaciones no dependen de `producto.stock`

Las operaciones de ventas, transferencias, mermas, producción y compras MUST validar y mutar stock usando `StockUbicacion` y/o consultas derivadas desde `StockUbicacion`, nunca `producto.stock`.

### Scenario 1.1 — Venta sin punto de venta
- **Given** un producto con stock en su almacén materializado en `StockUbicacion`
- **When** se crea una venta sin `puntoDeVentaId`
- **Then** la validación usa el stock disponible del almacén
- **And** la venta no lee `producto.stock` para permitir o rechazar la operación

### Scenario 1.2 — Transferencia desde almacén
- **Given** una transferencia con origen almacén
- **When** se valida disponibilidad
- **Then** la validación usa el registro de `StockUbicacion` del almacén origen
- **And** no usa `producto.stock` como fallback operativo

### Scenario 1.3 — Merma / producción / compra
- **Given** una operación que modifica inventario
- **When** se persiste la transacción
- **Then** el stock afectado se modifica solo vía `StockUbicacion`
- **And** no existe `tx.producto.update({ stock: ... })` como parte de la lógica operativa

## Requirement 2 — Existe una fuente explícita para stock total

El sistema MUST ofrecer una consulta explícita para obtener stock total por producto derivado de `SUM(StockUbicacion.cantidad)`.

### Scenario 2.1 — Dashboard o reporte necesita stock total
- **Given** una consulta agregada de inventario
- **When** necesita stock total por producto
- **Then** usa un helper/consulta derivada desde `StockUbicacion`
- **And** no compone fórmulas manuales con `producto.stock ± transferencias ± ventas`

## Requirement 3 — `producto.stock` queda fuera del contrato operativo

El campo `producto.stock` MAY seguir existiendo temporalmente en el modelo, pero MUST NOT ser fuente de verdad para flujos de negocio o reportes migrados.

### Scenario 3.1 — Inconsistencia entre `producto.stock` y `StockUbicacion`
- **Given** un producto con `producto.stock` distinto del total derivado
- **When** una acción de negocio o consulta migrada se ejecuta
- **Then** el resultado se basa en `StockUbicacion`
- **And** la inconsistencia del campo legacy no altera la lógica principal

## Requirement 4 — Strict TDD

Cada reemplazo de lectura/escritura MUST estar cubierto por tests escritos antes de la implementación.

### Scenario 4.1 — Reemplazo de validación legacy
- **Given** una ruta que hoy usa `producto.stock`
- **When** se migra a `StockUbicacion`
- **Then** primero existe un test rojo que demuestre la dependencia legacy
- **And** luego un test verde que pruebe la nueva fuente de verdad
