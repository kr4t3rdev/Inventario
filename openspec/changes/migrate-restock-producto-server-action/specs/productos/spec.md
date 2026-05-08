# Productos: Restock Server Action

## Purpose

Definir el comportamiento de `restockProductoAction`, la Server Action que reemplaza
el endpoint REST `/api/productos/restock` y el hook RTKQ `useRestockProductoMutation`.

## Requirements

### Requirement: Validación del payload de restock

El sistema **MUST** validar el payload de entrada con Zod, rechazando requests
que no cumplan con el schema `restockSchema`.

Los campos obligatorios son: `productoId`, `cantidad`.

Los campos opcionales incluyen: `precioCosto`, `precioVenta`, `descripcion`,
`numeroFactura`, `facturaUrl`, `formaPago`, `estado`, `moneda`, `tasaCambio`,
`montoConvertido`, `cuentaId`, `tipoRestock`.

#### Scenario: Payload mínimo válido

- GIVEN un `productoId` existente y `cantidad = 5`
- WHEN se invoca `restockProductoAction({ productoId, cantidad })`
- THEN la validación Zod pasa
- AND se procede a la lógica de negocio

#### Scenario: Payload sin productoId

- GIVEN un payload `{ cantidad: 5 }` sin `productoId`
- WHEN se invoca `restockProductoAction`
- THEN la validación Zod falla
- AND la acción retorna `{ success: false, error: { code: 'VALIDATION_ERROR' } }`

#### Scenario: Payload con tipoRestock inválido

- GIVEN `{ productoId: "p1", cantidad: 1, tipoRestock: "modo_invalido" }`
- WHEN se invoca `restockProductoAction`
- THEN la validación Zod falla
- AND retorna error de validación

---

### Requirement: Tenant isolation

El sistema **MUST** verificar que la operación se ejecute dentro del tenant del usuario
autenticado, usando `requireTenant(user)`.

#### Scenario: Usuario sin tenant

- GIVEN un usuario autenticado sin tenant asignado
- WHEN se invoca cualquier Server Action
- THEN `requireTenant` lanza `ActionError`
- AND la acción retorna `{ success: false, error: { code: 'TENANT_REQUIRED' } }`

---

### Requirement: Validación de producto existente

El sistema **MUST** verificar que el producto referenciado por `productoId` exista
en la base de datos antes de proceder con el restock.

#### Scenario: Producto existe

- GIVEN un `productoId` que existe en la base de datos
- WHEN se invoca `restockProductoAction`
- THEN la validación pasa
- AND se continúa con la actualización de stock

#### Scenario: Producto no existe

- GIVEN un `productoId` que NO existe
- WHEN se invoca `restockProductoAction`
- THEN la acción retorna `{ success: false, error: { code: 'NOT_FOUND', message: 'Producto no encontrado' } }`

---

### Requirement: Actualización de stock

El sistema **MUST** incrementar `producto.stock` en la cantidad especificada y
actualizar (upsert) el registro correspondiente en `StockUbicacion` para el almacén
del producto.

#### Scenario: Restock simple sin pago

- GIVEN un producto con `stock = 10` en almacén `alm-1`
- AND `cantidad = 5`, sin parámetros de pago
- WHEN se invoca `restockProductoAction`
- THEN `producto.stock` se actualiza a `15`
- AND se hace upsert de `StockUbicacion` para `alm-1` con `cantidad += 5`
- AND se crea un `GastoCompra` asociado al producto

#### Scenario: Restock con actualización de precio

- GIVEN un producto con `precioCosto = 100`, `precioVenta = 150`
- AND `cantidad = 3`, `precioCosto = 120`, `precioVenta = 180`
- WHEN se invoca `restockProductoAction`
- THEN `producto.stock` se incrementa
- AND `producto.precioCosto` se actualiza a `120`
- AND `producto.precioVenta` se actualiza a `180`

---

### Requirement: Flujo de pago completo (PAGO_COMPLETO)

Cuando `formaPago = "PAGO_COMPLETO"`, el sistema **MUST**:

1. Crear un `GastoCompra` con `estado = "PAGADA"`
2. Crear una `CompraProducto` asociada
3. Buscar o usar la `cuentaId` proporcionada (o el tipo de pago por defecto)
4. Verificar que la `CuentaBancaria` esté activa
5. Crear una `ReconciliacionVenta` (o equivalente) para registrar el egreso
6. Decrementar el saldo de la cuenta bancaria

#### Scenario: Pago completo con cuenta por defecto

- GIVEN `formaPago = "PAGO_COMPLETO"`, sin `cuentaId`
- AND existe un `TipoPago` activo con `cuentaDefecto`
- WHEN se invoca `restockProductoAction`
- THEN se usa la cuenta por defecto
- AND se decrementa el saldo de esa cuenta
- AND el `GastoCompra` queda en estado `PAGADA`

#### Scenario: Pago completo con moneda extranjera

- GIVEN `formaPago = "PAGO_COMPLETO"`, `moneda = "USD"`, `tasaCambio = 24`
- AND `precioCosto = 10` (USD), `cantidad = 5` → total = 50 USD
- WHEN se invoca `restockProductoAction`
- THEN `montoConvertido = 50 * 24 = 1200` (CUP)
- AND la cuenta bancaria se decrementa en `1200` CUP
- AND el `GastoCompra` registra ambos montos (original y convertido)

---

### Requirement: Flujo de pago parcial (PAGO_PARCIAL)

Cuando `formaPago = "PAGO_PARCIAL"`, el sistema **MUST**:

1. Crear un `GastoCompra` con `estado = "PENDIENTE"`
2. Crear una `CompraProducto` asociada
3. Crear una `CuentaPorPagar` con `montoDeuda = totalCost`, `saldoPendiente = totalCost`
4. NO decrementar ninguna cuenta bancaria

#### Scenario: Pago parcial crea deuda

- GIVEN `formaPago = "PAGO_PARCIAL"`, `cantidad = 10`, `precioCosto = 50`
- WHEN se invoca `restockProductoAction`
- THEN `GastoCompra.estado = "PENDIENTE"`
- AND se crea `CuentaPorPagar` con `montoDeuda = 500`, `saldoPendiente = 500`
- AND el saldo bancario NO se modifica

---

### Requirement: Manejo de tipoRestock

El sistema **MUST** soportar los modos de restock definidos por `tipoRestock`:

- `"auto"` (default): suma el stock al producto existente
- `"nueva_instancia"`: crea una nueva instancia del producto (copia) y aplica el restock a la copia
- `"sumar_stock"`: explícitamente suma al stock existente (igual que auto)

#### Scenario: tipoRestock = "nueva_instancia"

- GIVEN `tipoRestock = "nueva_instancia"` y un producto con `codigoInterno = "12345678901"`
- WHEN se invoca `restockProductoAction`
- THEN se crea un nuevo producto copia del original
- AND el restock se aplica a la nueva instancia
- AND el nuevo producto tiene un `codigoInterno` único

---

### Requirement: Frontend — restock-form.tsx

El componente `RestockForm` **MUST** llamar a `restockProductoAction` en lugar de
`useRestockProductoMutation().unwrap()` para procesar el envío del formulario.

El manejo de errores **MUST** adaptarse al formato `{ success, data?, error? }`
de las Server Actions.

#### Scenario: Restock exitoso desde el formulario

- GIVEN el formulario de restock completo y válido
- WHEN el usuario hace submit
- THEN se llama a `restockProductoAction(payload)`
- AND si `result.success === true`, se muestra toast de éxito
- AND se cierra el diálogo (si `onSuccess` callback)

#### Scenario: Error de validación desde el formulario

- GIVEN el formulario con datos inválidos
- WHEN el usuario hace submit
- THEN `restockProductoAction` retorna `{ success: false, error: { message: "..." } }`
- AND se muestra el mensaje de error en un toast
- AND el diálogo NO se cierra

---

### Requirement: Eliminación de productosApi.ts

Una vez que `useRestockProductoMutation` sea el último hook migrado, el archivo
`features/productos/api/productosApi.ts` **MUST** ser eliminado, junto con su
registro en el barrel `features/productos/index.ts`.

#### Scenario: productosApi.ts eliminado

- GIVEN todos los hooks RTKQ de productos migrados a Server Actions
- AND ningún archivo importa desde `productosApi.ts`
- WHEN se elimina el archivo
- THEN typecheck pasa sin errores
- AND el barrel solo exporta Server Actions + handlers legacy
