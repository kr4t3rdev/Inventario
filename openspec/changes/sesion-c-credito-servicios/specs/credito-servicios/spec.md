# Spec Delta — credito-servicios (Sesión C)

## ADDED Requirements

### Requirement: Edición del límite de crédito del cliente

El sistema SHALL permitir actualizar `Cliente.limiteCredito` (entero ≥ 0 en centavos, o `null` = sin tope) desde la UI mediante una server action dedicada, gateada por el permiso `operaciones.clientes.limite-credito` (default manager, sensitive), con auditoría del valor anterior y el nuevo dentro de la misma transacción.

#### Scenario: Manager edita el límite desde la vista 360
- **WHEN** un usuario con `operaciones.clientes.limite-credito` guarda un nuevo límite en el dialog de la vista 360 del cliente
- **THEN** el campo se persiste, se registra `AuditLog` con `tipo: 'LIMITE_CREDITO_ACTUALIZADO'`, `valorAnterior` y `valorNuevo`, y la vista refresca el badge de excedido

#### Scenario: Usuario sin permiso no puede editar el tope
- **WHEN** un usuario sin el permiso intenta la action
- **THEN** recibe `FORBIDDEN` y no se persiste ni audita cambio alguno

#### Scenario: Límite nulo quita el tope
- **WHEN** se envía `limiteCredito: null`
- **THEN** el cliente queda sin tope y `superaLimiteCredito` deja de bloquear ventas a crédito para él

### Requirement: Enforcement del límite de crédito en venta de servicios a crédito

`createVentaServicioAction` SHALL validar el tope de crédito del cliente cuando `condicionPago === 'CREDITO'` (modo mixto y legacy), usando las reglas puras existentes (`saldoVivoCliente`, `superaLimiteCredito`), el permiso `ventas.venta.credito-override` para excederlo y auditoría `CREDITO_OVERRIDE` dentro de la transacción.

#### Scenario: Venta a crédito dentro del tope pasa
- **WHEN** se crea una venta de servicio a crédito y `saldoVivo + montoRequerido <= limiteCredito`
- **THEN** la venta y su CxC se crean sin alertas

#### Scenario: Venta a crédito sobre el tope se rechaza
- **WHEN** el requerido supera el tope y el usuario no tiene `ventas.venta.credito-override`
- **THEN** se rechaza con `CREDITO_EXCEDIDO` y no se crea ninguna fila (venta ni CxC)

#### Scenario: Override auditable
- **WHEN** el usuario con permiso de override crea la venta sobre el tope
- **THEN** la venta se crea y queda `AuditLog` con `tipo: 'CREDITO_OVERRIDE'`, límite, saldo y monto requerido

#### Scenario: Legacy con anticipos mide solo el remanente
- **WHEN** una venta legacy a crédito aplica anticipos que cubren parte del total
- **THEN** el monto requerido evaluado contra el tope es el remanente, no el total

### Requirement: Revalidación del límite al facturar un pedido

`VentaLifecycleService.facturarVenta` SHALL revalidar el tope de crédito cuando el cobro elegido implica crédito (`montoCredito > 0` o `metodoPago === 'CREDITO'`), dentro de la transacción y antes de crear la `Factura` o la CxC, con el mismo permiso de override y auditoría.

#### Scenario: Facturación a crédito sobre el tope se rechaza
- **WHEN** se factura una venta ENTREGADA con crédito que sumado al saldo vivo supera el tope sin override
- **THEN** se rechaza con `CREDITO_EXCEDIDO` y no se crean Factura ni CxC (la venta sigue ENTREGADA)

#### Scenario: Facturación a crédito con override
- **WHEN** el usuario tiene `ventas.venta.credito-override`
- **THEN** la facturación procede y la auditoría `CREDITO_OVERRIDE` queda dentro de la transacción de facturación

#### Scenario: Facturación al contado no evalúa tope
- **WHEN** la facturación no implica crédito (`montoRequerido = 0`)
- **THEN** no se consulta el límite ni el permiso de override

### Requirement: Costo de venta de servicios resuelto por el servidor

El costo de toda venta de servicios nueva SHALL ser el snapshot de `Servicios.costo` (costo estándar del catálogo) al momento de la venta; los payloads SHALL NOT poder fijarlo (los schemas dejan de aceptar `costo` y son strict), ni el update posterior modificarlo.

#### Scenario: Payload con costo manipulado es rechazado
- **WHEN** el payload de venta (mixto o legacy) incluye `costo`
- **THEN** se rechaza con `VALIDATION_ERROR` por schema strict

#### Scenario: El costo persistido es el del catálogo
- **WHEN** se crea una venta de servicio cuyo catálogo tiene `costo = X`
- **THEN** la fila se persiste con `costo = X` aunque el cliente no envíe costo

#### Scenario: El catálogo edita su costo estándar
- **WHEN** se actualiza un servicio del catálogo con un nuevo `costo`
- **THEN** las ventas futuras lo usan como snapshot y las filas históricas conservan el suyo

### Requirement: Atomicidad de la CxC en modo mixto

El modo mixto SHALL crear las filas `VentaServicios` y sus `CuentaPorCobrar` (y la auditoría de override si aplica) dentro de una única transacción Prisma interactiva.

#### Scenario: Fallo a mitad del modo mixto deja cero filas
- **WHEN** la creación de alguna CxC falla después de crear las ventas
- **THEN** toda la transacción se revierte: cero ventas y cero CxC

### Requirement: Update de venta de servicio coherente con su CxC

`updateVentaServicioAction` SHALL ajustar la CxC activa de la venta dentro de la misma transacción: `montoDeuda` al cambiar `cantidad`, `clienteId` al cambiar de cliente (con revalidación del tope del nuevo cliente usando la exclusión de la CxC propia), y SHALL rechazar cambios de cantidad con cobros registrados (`HAS_REFERENCES`) o con CxC `PAGADA` (`CXC_PAGADA`).

#### Scenario: Cambio de cantidad ajusta la deuda
- **WHEN** se actualiza la cantidad de una venta a crédito sin cobros
- **THEN** `ventaServicios.total` y `CuentaPorCobrar.montoDeuda` quedan con el nuevo total en la misma transacción

#### Scenario: Cobros registrados impiden renegociar la cantidad
- **WHEN** la venta tiene reconciliaciones y se intenta cambiar la cantidad
- **THEN** se rechaza con `HAS_REFERENCES` y nada cambia

#### Scenario: CxC pagada impide modificar el total
- **WHEN** la CxC está `PAGADA` y se intenta cambiar la cantidad
- **THEN** se rechaza con `CXC_PAGADA`

#### Scenario: Cambio de cliente revalida el tope
- **WHEN** una venta a crédito cambia de cliente y el nuevo cliente quedaría sobre su tope sin override
- **THEN** se rechaza con `CREDITO_EXCEDIDO`; con override se mueve la CxC y queda auditada

### Requirement: Delete de venta de servicio con protección de CxC

El borrado de una venta de servicio SHALL estar protegido contra CxC vivas: se rechaza con `VENTA_CON_CXC_ACTIVA` si existe una CxC no anulada; las CxC `ANULADA` se eliminan junto con la venta en la misma transacción; la FK `CuentaPorCobrar.ventaServicioId` SHALL ser `onDelete: Restrict`.

#### Scenario: Venta con CxC activa no se elimina
- **WHEN** se intenta eliminar una venta con CxC `PENDIENTE`/`PARCIAL`
- **THEN** se rechaza con `VENTA_CON_CXC_ACTIVA`, la venta y la CxC sobreviven

#### Scenario: Venta con CxC anulada se elimina limpia
- **WHEN** la única CxC de la venta está `ANULADA`
- **THEN** la transacción elimina la CxC anulada y la venta

#### Scenario: La FK impide huérfanas a nivel de base
- **WHEN** un writer futuro intenta borrar una venta referenciada por una CxC sin pasar por la action
- **THEN** la base de datos rechaza el delete (FK Restrict)

### Requirement: Factura-documento para ventas de servicios

El sistema SHALL emitir un documento de factura para ventas de servicios extendiendo `Factura` con `ventaServicioId` (1:1, unique) y numeración compartida de `SerieFacturacion`; la action `facturarVentaServicioAction` (permiso `ventas.servicios.facturar`) SHALL crear la factura una única vez por venta y SHALL enlazar la CxC existente (`facturaId`, `numeroFactura`, `fechaVencimiento`) sin crear deuda nueva. El cobro de la venta (`reconcileService`) SHALL marcar `PAGADA` la Factura y la CxC enlazadas.

#### Scenario: Facturar una venta de servicio con cliente
- **WHEN** se factura una venta con cliente sin factura previa
- **THEN** se crea `Factura` con número de serie, `ventaServicioId`, total persistido y estado `PENDIENTE` (o `PAGADA` si ya estaba reconciliada)

#### Scenario: Doble facturación rechazada
- **WHEN** la venta ya tiene factura
- **THEN** se rechaza con `VENTA_YA_FACTURADA`

#### Scenario: Venta sin cliente no se factura
- **WHEN** la venta no tiene `clienteId`
- **THEN** se rechaza con `FACTURA_REQUIERE_CLIENTE`

#### Scenario: El cobro cierra factura y CxC
- **WHEN** se reconcilia (cobra) una venta de servicio facturada a crédito
- **THEN** Factura y CxC pasan a `PAGADA` dentro de la misma transacción del cobro

#### Scenario: Sin permiso no se factura
- **WHEN** un usuario sin `ventas.servicios.facturar` intenta facturar
- **THEN** recibe `FORBIDDEN`
