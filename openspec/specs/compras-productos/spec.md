# Módulo de Compras de Productos - Especificación Completa

## Propósito

Este documento establece la especificación completa del módulo de compras de productos del sistema de gestión de inventario TCP. El módulo permite registrar compras de productos a proveedores, gestionar el inventario automáticamente y controlar los pagos asociados.

## Requisitos del Sistema

### Requisito: Creación de Compras de Productos

El sistema DEBE permitir crear registros de compras de productos asociados a un proveedor y un producto existente.

**Datos requeridos para la compra:**
- Producto (obligatorio)
- Proveedor (obligatorio)
- Precio de costo unitario (obligatorio, mayor a 0)
- Cantidad (obligatoria, entero positivo)
- Número de factura (opcional)
- URL de factura (opcional)
- Forma de pago (obligatoria)
- Estado de pago (obligatorio)
- Descripción (opcional, máximo 500 caracteres)
- Fecha de vencimiento de pago (opcional, solo para pagos parciales)

**Formas de pago válidas:**
- PAGO_PARCIAL
- PAGO_COMPLETO
- ANTICIPO_PAGO

#### Escenario: Compra a pago completo

- GIVEN existe un producto "Widget A" con stock actual de 10 unidades
- AND existe un proveedor "Proveedor XYZ" con contrato activo
- WHEN el usuario registra una compra de 50 unidades a precio costo 100 CUP
- AND selecciona forma de pago "PAGO_COMPLETO"
- THEN el sistema registra la compra con estado "PAGADA"
- AND crea un registro de GastoCompra por 5000 CUP
- AND incrementa el stock del producto a 60 unidades
- AND actualiza el precio de costo según el método de promedio ponderado

#### Escenario: Compra a pago parcial

- GIVEN existe un producto "Widget B" con stock de 20 unidades
- AND existe un proveedor "Proveedor ABC" con contrato activo
- WHEN el usuario registra una compra de 30 unidades a precio costo 50 CUP
- AND selecciona forma de pago "PAGO_PARCIAL"
- AND indica fecha de vencimiento para 30 días
- THEN el sistema registra la compra con estado "PENDIENTE"
- AND crea un registro de GastoCompra por 1500 CUP
- AND crea una CuentaPorPagar vinculada al gasto por 1500 CUP
- AND incrementa el stock del producto a 50 unidades

#### Escenario: Compra con anticipo

- GIVEN existe un pago anticipado RESERVADO de 2000 CUP para el proveedor "Proveedor XYZ"
- AND existe un producto "Material C" con stock de 0
- WHEN el usuario registra una compra de 20 unidades a precio costo 100 CUP (total 2000)
- AND selecciona forma de pago "ANTICIPO_PAGO"
- AND selecciona el anticipo disponible
- THEN el sistema registra la compra con estado "PAGADA"
- AND ejecuta el anticipo, marcando el gasto como reconciliado
- AND incrementa el stock del producto

---

### Requisito: Validación de Contrato de Proveedor

El sistema DEBE validar el estado del contrato del proveedor y mostrar advertencias cuando corresponda, pero NO debe bloquear la creación de la compra.

**Comportamiento:**
- Si el proveedor NO tiene contrato activo: mostrar ADVERTENCIA en la UI, permitir la compra
- Si el contrato está VENCIDO: mostrar ADVERTENCIA en la UI, permitir la compra
- Si el contrato está próximo a vencer (dentro de los días configurados): mostrar ADVERTENCIA pero permitir la compra
- Los días de aviso se configuran en el sistema (valor por defecto: 30 días)
- La advertencia se muestra mediante Sileo (sileo.warning)

#### Escenario: Proveedor sin contrato

- GIVEN existe un proveedor "Proveedor Nuevo" sin contratos
- WHEN el usuario registra una compra
- THEN el sistema permite la compra
- AND muestra advertencia: "El proveedor no tiene un contrato activo"

#### Escenario: Proveedor con contrato vencido

- GIVEN existe un proveedor "Proveedor Viejo" con contrato con fechaFin anterior a hoy
- WHEN el usuario registra una compra
- THEN el sistema permite la compra
- AND muestra advertencia: "El contrato del proveedor está vencido"

#### Escenario: Proveedor con contrato próximo a vencer

- GIVEN existe un proveedor con contrato que vence en 15 días
- AND la configuración del sistema indica 30 días de aviso
- WHEN el usuario registra una compra
- THEN el sistema permite la compra
- AND muestra advertencia: "Advertencia: El contrato del proveedor vence en 15 días"
- AND la advertencia se incluye en la respuesta de la API

---

### Requisito: Duplicación de Facturas

El sistema DEBE prevenir la creación de compras duplicadas basadas en el número de factura y proveedor.

**Comportamiento:**
- Si se proporciona número de factura y ya existe una compra con el mismo número para el mismo proveedor: RECHAZAR con error 409
- Si el número de factura está vacío o es whitespace: permitir (no validar duplicados)

#### Escenario: Factura duplicada

- GIVEN ya existe una compra con número de factura "FACT-001" del proveedor "Proveedor XYZ"
- WHEN el usuario intenta crear otra compra con el mismo número de factura
- THEN el sistema rechaza la compra
- AND retorna error 409 con mensaje "Ya existe una compra con este número de factura para el mismo proveedor"
- AND retorna el ID de la compra existente

---

### Requisito: Actualización de Inventario

El sistema DEBE actualizar automáticamente el inventario del producto al registrar una compra.

**Comportamiento:**
- Incrementar el campo `stock` del producto por la cantidad comprada
- Upsert (crear o actualizar) el registro en StockUbicacion para el almacén del producto
- Recalcular el precio de costo usando el método de promedio ponderado

#### Escenario: Actualización de stock

- GIVEN un producto con stock actual de 100
- AND precio de costo actual de 50 CUP
- WHEN se registra una compra de 50 unidades a 60 CUP cada una
- THEN el nuevo stock es 150
- AND el nuevo precio de costo se calcula: ((100 * 50) + (50 * 60)) / 150 = 53.33 CUP

---

### Requisito: Método de Cálculo de Precio de Costo

El sistema DEBE calcular el nuevo precio de costo usando el método de promedio ponderado.

**Fórmula:**
```
precioCostoNuevo = ((stockAntes * precioCostoActual) + (cantidadCompra * costoUnitario)) / (stockAntes + cantidadCompra)
```

**Casos especiales:**
- Si stockAntes es 0: el nuevo precio de costo es el costo unitario de la compra
- Si cantidadCompra es 0 o negativa: error de validación

---

### Requisito: Listado de Compras con Filtros

El sistema DEBE permitir listar las compras de productos con filtros opcionales.

**Parámetros de consulta disponibles:**
- search: búsqueda por número de factura, nombre de producto o nombre de proveedor
- tipoOperacion: RESTOCK o REGULAR
- estado: PENDIENTE o PAGADA
- formaPago: PAGO_PARCIAL, PAGO_COMPLETO, ANTICIPO_PAGO
- proveedorId: filtro por proveedor específico
- fechaDesde: fecha mínima de compra
- fechaHasta: fecha máxima de compra
- montoMin: monto mínimo total
- montoMax: monto máximo total
- page: número de página (default 1)
- limit: registros por página (default 20, máximo 100)

**Respuesta paginada:**
- Lista de compras con datos del producto y proveedor
- Metadatos de paginación: page, limit, total, totalPages, hasNext, hasPrev

---

### Requisito: Exportación de Compras

El sistema DEBE permitir exportar las compras de productos a formatos utilizables.

**Endpoints disponibles:**
- GET /api/compras-productos/export - Exportación general

---

## Modelo de Datos

### Entidad: CompraProducto

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| compraProductoId | String | Sí | ID único (CUID) |
| productoId | String | Sí | FK a Producto |
| proveedorId | String | Sí | FK a Vendor |
| numeroFactura | String | No | Número de factura del proveedor |
| facturaUrl | String | No | URL del documento de factura |
| cantidad | Int | Sí | Cantidad de unidades compradas |
| precioUnitario | Int | Sí | Precio de costo por unidad |
| total | Int | Sí | Total de la compra (cantidad * precioUnitario) |
| formaPago | String | Sí | Forma de pago seleccionada |
| estado | String | Sí | Estado de pago (PENDIENTE/PAGADA) |
| tipoOperacion | String | No | Tipo de operación (REGULAR/RESTOCK), default REGULAR |
| descripcion | String | No | Descripción de la compra |
| fechaCompra | DateTime | Sí | Fecha de registro de la compra |
| gastoCompraId | String | No | FK única a GastoCompra |
| cuentaPorPagarId | String | No | FK única a CuentaPorPagar |
| createdById | String | No | FK a Usuario que creó |
| deletedAt | DateTime | No | Soft delete |

### Entidad: GastoCompra

| Campo | Tipo | Descripción |
|-------|------|-------------|
| gastoCompraId | String | ID único |
| productoId | String | FK al producto |
| vendorId | String | FK al proveedor |
| cantidad | Int | Cantidad comprada |
| precioUnitario | Int | Precio unitario |
| total | Int | Total del gasto |
| fechaCompra | DateTime | Fecha de compra |
| descripcion | String | Descripción |
| periodo | String | Período contable (YYYY-MM) |
| numeroFactura | String | Número de factura |

---

## Reglas de Negocio

### Regla 1: Consistencia Estado-FormaPago

- Si formaPago es PAGO_COMPLETO o ANTICIPO_PAGO: el estado DEBE ser PAGADA
- Si formaPago es PAGO_PARCIAL: el estado DEBE ser PENDIENTE
- El sistema fuerza esta consistencia automáticamente

### Regla 2: Creación de CuentaPorPagar

- Solo se crea CuentaPorPagar cuando formaPago es PAGO_PARCIAL
- La cuenta por pagar se vincula al GastoCompra generado
- El saldo pendiente inicial es igual al monto total

### Regla 3: Anticipos

- Los anticipos solo pueden ejecutarse si el monto del anticipo cubre el total de la compra
- Al ejecutar anticipo, se crea automáticamente la reconciliación del gasto

---

## Casos de Error

| Código | Mensaje | Causa |
|--------|---------|-------|
| 400 | Estado no coincide con la forma de pago | Inconsistencia estado-formaPago |
| 400 | La cantidad debe ser mayor a 0 | Cantidad inválida |
| 400 | Seleccione un producto | Producto no seleccionado |
| 400 | Seleccione un proveedor | Proveedor no seleccionado |
| 400 | El precio de costo debe ser mayor a 0 | Precio inválido |
| 404 | El producto seleccionado no existe | Producto no encontrado |
| 409 | Ya existe una compra con este número de factura... | Factura duplicada |
| 500 | Error al crear compra de producto | Error interno |

**Nota:** La validación de contrato de proveedor ahora solo muestra advertencias (no bloquea).

---

## Notificaciones UI

El módulo DEBE utilizar la biblioteca **Sileo** para todas las notificaciones en la interfaz de usuario.

**Métodos de Sileo utilizados:**
- `sileo.success({ title: '...' })` - Para operaciones exitosas
- `sileo.warning({ title: '...' })` - Para advertencias (contratos, etc.)
- `sileo.error({ title: '...' })` - Para errores

**Componentes actualizados:**
- `src/components/compras/compra-producto-form.tsx`
- `src/app/busy/compras-productos/page.tsx`
- `src/app/busy/compras-productos/[id]/edit/page.tsx`

## Historial de Cambios

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.1 | 2026-03-27 | Cambios: validación de contrato ahora es solo warning (no bloquea), uso de Sileo en vez de Sonner |
| 1.0 | 2026-03-27 | Versión inicial - especificación completa del módulo |
