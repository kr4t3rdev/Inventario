# Delta for Contabilidad

## ADDED Requirements

### Requirement: Registro de Pago Anticipado a Proveedor

The system MUST permitir crear un pago anticipado asociado a un contrato y un proveedor, manteniendo el importe en estado reservado hasta su ejecución en una compra de producto o servicio.

#### Scenario: Crear pago anticipado válido para proveedor

- GIVEN existe un contrato activo con un proveedor válido
- AND el usuario tiene permisos para registrar operaciones contables
- WHEN el usuario crea un pago anticipado con monto mayor que cero, moneda, fecha, referencia externa y cuenta/tarjeta de origen
- THEN el sistema registra el pago anticipado en estado `RESERVADO`
- AND el sistema guarda la relación con contrato y proveedor
- AND el sistema no genera reconciliación de gasto en este paso

#### Scenario: Rechazo de pago anticipado con datos inválidos

- GIVEN el usuario está en el formulario de pago anticipado
- WHEN intenta guardar un pago anticipado con monto menor o igual a cero, sin proveedor, sin contrato o sin cuenta/tarjeta de origen válida
- THEN el sistema SHALL rechazar la operación con error de validación
- AND el sistema SHALL no crear el registro contable

### Requirement: Máquina de Estados de Anticipos

The system MUST aplicar una máquina de estados explícita para pagos y cobros anticipados, garantizando transiciones válidas y bloqueando transiciones inválidas.

#### Scenario: Transición válida de estado

- GIVEN existe un anticipo en estado `RESERVADO` con saldo disponible
- WHEN el anticipo se aplica de forma completa a una compra o factura
- THEN el sistema cambia el estado a `EJECUTADO`
- AND el saldo disponible del anticipo queda en cero

#### Scenario: Bloqueo de transición inválida

- GIVEN existe un anticipo en estado `ANULADO`
- WHEN un usuario intenta ejecutarlo en una compra o factura
- THEN el sistema SHALL rechazar la operación por estado no elegible
- AND el sistema SHALL mantener el estado `ANULADO` sin cambios

### Requirement: Disponibilidad de Pago Anticipado en Formas de Pago de Compra

The system MUST exponer los pagos anticipados reservados y elegibles como opción de forma de pago en la creación de compras de productos y servicios.

#### Scenario: Mostrar pagos anticipados elegibles en compra

- GIVEN existen pagos anticipados en estado `RESERVADO` para el proveedor de la compra
- WHEN el usuario abre el formulario de compra de producto o servicio
- THEN el sistema muestra `Pago anticipado` como forma de pago
- AND el sistema lista únicamente anticipos compatibles por proveedor, moneda y saldo disponible

#### Scenario: No mostrar anticipos agotados o ejecutados

- GIVEN existen pagos anticipados con saldo cero o estado `EJECUTADO` o `ANULADO`
- WHEN el usuario abre el selector de forma de pago
- THEN el sistema SHALL ocultar esos anticipos de la lista seleccionable

### Requirement: Regla de Elegibilidad de Anticipos

The system MUST validar elegibilidad de anticipo antes de exponerlo o ejecutarlo, considerando contraparte, estado, saldo, moneda y vigencia.

#### Scenario: Anticipo elegible para operación destino

- GIVEN existe un anticipo `RESERVADO` con saldo mayor que cero
- AND el anticipo pertenece a la misma contraparte de la operación destino
- AND la moneda es compatible con la operación
- WHEN el usuario consulta formas de pago
- THEN el sistema incluye el anticipo en la lista de opciones

#### Scenario: Anticipo no elegible por incompatibilidad

- GIVEN existe un anticipo con contraparte distinta o moneda no compatible o sin vigencia
- WHEN el usuario intenta seleccionarlo manualmente
- THEN el sistema SHALL rechazar la selección
- AND el sistema SHALL informar la causa exacta de no elegibilidad

### Requirement: Ejecución de Pago Anticipado en Compra con Cobertura Completa

The system MUST ejecutar el pago anticipado cuando se selecciona como forma de pago y el saldo cubre el total de la compra, registrando la reconciliación de gasto y afectación de cuentas/tarjetas.

#### Scenario: Ejecutar pago anticipado por monto completo

- GIVEN existe una compra pendiente de pago
- AND el usuario selecciona un pago anticipado reservado con saldo suficiente
- WHEN confirma la compra con cobertura total mediante anticipo
- THEN el sistema cambia el anticipo a estado `EJECUTADO` o actualiza su saldo a cero
- AND el sistema crea la reconciliación de gasto correspondiente
- AND el sistema registra el movimiento de ingreso o descuento sobre la cuenta/tarjeta asociada
- AND el sistema marca la compra como pagada según reglas vigentes

#### Scenario: Bloquear ejecución parcial no permitida

- GIVEN el total de la compra es mayor que el saldo disponible del anticipo seleccionado
- WHEN el usuario intenta confirmar la compra con ese anticipo como único medio de pago
- THEN el sistema SHALL rechazar la ejecución por cobertura incompleta
- AND el sistema SHALL informar el saldo faltante y mantener el anticipo en `RESERVADO`

### Requirement: Idempotencia en la Ejecución de Anticipos

The system MUST garantizar idempotencia para evitar doble aplicación financiera cuando se repite una misma solicitud de ejecución.

#### Scenario: Reintento con misma clave idempotente

- GIVEN una solicitud de ejecución de anticipo ya fue procesada exitosamente
- WHEN el cliente reenvía la solicitud con la misma clave idempotente
- THEN el sistema devuelve el mismo resultado de la primera ejecución
- AND el sistema SHALL no duplicar reconciliación ni movimientos contables

#### Scenario: Reintento con payload diferente y misma clave

- GIVEN existe una clave idempotente previamente usada
- WHEN se envía una solicitud con la misma clave pero datos distintos
- THEN el sistema SHALL rechazar la operación por conflicto idempotente
- AND el sistema SHALL no alterar saldos ni estados existentes

### Requirement: Registro de Cobro Anticipado a Cliente

The system MUST permitir crear un cobro anticipado asociado a contrato y cliente, manteniéndolo reservado hasta su aplicación en una venta facturada.

#### Scenario: Crear cobro anticipado válido para cliente

- GIVEN existe un contrato activo con un cliente válido
- AND el usuario tiene permisos para registrar cobros
- WHEN registra un cobro anticipado con monto mayor que cero, moneda y referencia de operación
- THEN el sistema crea el cobro anticipado en estado `RESERVADO`
- AND el sistema relaciona el cobro con contrato y cliente
- AND el sistema no crea reconciliación de venta en este paso

#### Scenario: Rechazar cobro anticipado sin cliente o contrato

- GIVEN el usuario completa el formulario de cobro anticipado
- WHEN intenta guardar sin cliente o sin contrato
- THEN el sistema SHALL devolver error de validación obligatorio
- AND el sistema SHALL no persistir el cobro anticipado

### Requirement: Disponibilidad de Cobro Anticipado en Facturación de Venta

The system MUST mostrar los cobros anticipados reservados como forma de pago en el formulario de creación de factura de venta para productos, servicios o combinados.

#### Scenario: Mostrar cobros anticipados en formulario de factura

- GIVEN existen cobros anticipados reservados para el cliente seleccionado
- WHEN el usuario crea una factura de venta
- THEN el sistema muestra `Cobro anticipado` entre las formas de pago
- AND el sistema lista solo cobros con saldo disponible y moneda compatible

#### Scenario: Restringir cobros de otro cliente

- GIVEN existen cobros anticipados de múltiples clientes
- WHEN el usuario factura para un cliente específico
- THEN el sistema SHALL permitir seleccionar únicamente cobros pertenecientes a ese cliente

### Requirement: Ejecución de Cobro Anticipado desde Oferta Aceptada

The system MUST ejecutar cobro anticipado durante el flujo contrato -> cliente -> cobro anticipado -> oferta -> aceptación -> factura, cuando la factura se liquida completamente con anticipo.

#### Scenario: Oferta aceptada con cobro anticipado total

- GIVEN existe una oferta aceptada que genera una factura de venta
- AND el usuario selecciona cobro anticipado como forma de pago en la factura
- WHEN confirma el pago total con anticipo
- THEN el sistema ejecuta el cobro anticipado y actualiza su estado/saldo
- AND el sistema crea reconciliación de venta
- AND el sistema registra ingreso o descuento de tarjeta/cuenta según configuración del tipo de pago

#### Scenario: Intentar ejecutar cobro no reservado en oferta

- GIVEN el cobro anticipado fue anulado o ya ejecutado
- WHEN el usuario intenta usarlo al facturar una oferta aceptada
- THEN el sistema SHALL bloquear la operación
- AND el sistema SHALL requerir selección de otra forma de pago válida

### Requirement: Ejecución de Cobro Anticipado en Factura Directa

The system MUST ejecutar cobro anticipado durante el flujo contrato -> cliente -> cobro anticipado -> factura directa, cuando la factura se paga de forma completa con anticipo.

#### Scenario: Factura directa pagada con cobro anticipado

- GIVEN el usuario crea una factura directa de producto, servicio o ambos
- AND selecciona cobro anticipado compatible como forma de pago
- WHEN confirma el cobro total
- THEN el sistema aplica el anticipo a la factura
- AND el sistema crea reconciliación de venta con trazabilidad al cobro anticipado
- AND el sistema marca la factura como pagada

#### Scenario: Evitar doble ejecución concurrente del mismo cobro

- GIVEN dos usuarios intentan aplicar el mismo cobro anticipado simultáneamente
- WHEN ambas operaciones compiten por el mismo saldo reservado
- THEN el sistema SHALL garantizar atomicidad transaccional
- AND el sistema SHALL permitir solo una ejecución exitosa
- AND la segunda operación SHALL fallar con error de concurrencia controlado

### Requirement: Validación de Moneda y Conversión Controlada

The system MUST validar moneda de anticipo contra moneda de compra/factura y aplicar conversión únicamente con tasa vigente y auditable cuando corresponda.

#### Scenario: Ejecución en misma moneda

- GIVEN el anticipo y la operación destino comparten moneda
- WHEN se ejecuta el anticipo
- THEN el sistema aplica el monto nominal sin conversión
- AND el sistema registra la operación con tasa efectiva igual a 1

#### Scenario: Ejecución con moneda distinta y tasa no válida

- GIVEN el anticipo y la operación destino están en monedas distintas
- WHEN no existe tasa vigente o la tasa es inválida para la fecha de ejecución
- THEN el sistema SHALL bloquear la ejecución
- AND el sistema SHALL exigir una tasa válida antes de continuar

### Requirement: Reversión Contable y Anulación Segura

The system MUST requerir reversión contable antes de anular o modificar documentos que ya ejecutaron anticipos, preservando integridad y trazabilidad.

#### Scenario: Reversión previa a anulación de documento reconciliado

- GIVEN una compra o factura ya ejecutó un anticipo y tiene reconciliación asociada
- WHEN el usuario solicita anular el documento
- THEN el sistema exige registrar primero la reversión contable correspondiente
- AND el sistema restaura el saldo/estado del anticipo según la reversión aplicada

#### Scenario: Bloqueo de anulación sin reversión

- GIVEN existe una operación reconciliada con anticipo aplicado
- WHEN se intenta anular directamente sin reversión
- THEN el sistema SHALL rechazar la anulación
- AND el sistema SHALL mantener intacta la trazabilidad financiera

### Requirement: Trazabilidad, Auditoría y Consistencia de Anticipos

The system MUST mantener trazabilidad integral desde el anticipo (pago o cobro) hasta la compra/factura reconciliada, incluyendo historial de estados y referencias cruzadas.

#### Scenario: Consultar historial completo de anticipo ejecutado

- GIVEN existe un anticipo ejecutado en una operación de compra o venta
- WHEN un usuario consulta el detalle del anticipo
- THEN el sistema muestra contrato, contraparte, documento destino, reconciliación asociada, método de pago y usuario ejecutor
- AND el sistema muestra fechas de creación, reserva y ejecución

#### Scenario: Integridad referencial al eliminar documentos relacionados

- GIVEN existe un anticipo vinculado a documentos contables
- WHEN se intenta eliminar o anular un documento ya reconciliado con ese anticipo
- THEN el sistema SHALL aplicar reglas de integridad que impidan romper trazabilidad
- AND el sistema SHALL exigir reversión contable previa cuando aplique

### Requirement: Libro de Movimientos de Anticipos

The system MUST mantener un libro cronológico de movimientos de cada anticipo para auditoría financiera, conciliación y análisis.

#### Scenario: Registrar movimientos al crear y ejecutar

- GIVEN se crea un anticipo y luego se ejecuta
- WHEN un auditor consulta el historial del anticipo
- THEN el sistema muestra movimientos de `CREACION_RESERVA` y `EJECUCION`
- AND cada movimiento incluye fecha, usuario, importe, documento origen/destino y balance antes/después

#### Scenario: Registrar movimientos al revertir

- GIVEN existe una reversión por anulación de documento reconciliado
- WHEN se consulta el historial del anticipo
- THEN el sistema SHALL incluir un movimiento `REVERSO`
- AND el sistema SHALL mostrar la referencia cruzada a la operación revertida

### Requirement: Criterios de Verificación Funcional para Riesgos Críticos

The system SHALL proveer criterios verificables para validar que los riesgos de concurrencia, idempotencia, moneda y reversión están controlados.

#### Scenario: Verificación de concurrencia e idempotencia

- GIVEN un entorno de pruebas funcionales
- WHEN se ejecutan pruebas de solicitudes simultáneas y reintentos idempotentes
- THEN el sistema demuestra ausencia de doble aplicación financiera
- AND el sistema evidencia consistencia de estados, saldos y reconciliaciones

#### Scenario: Verificación de moneda y reversión

- GIVEN un conjunto de casos con múltiples monedas y anulaciones
- WHEN se prueban conversiones válidas/ inválidas y reversión previa obligatoria
- THEN el sistema SHALL demostrar bloqueo correcto en casos inválidos
- AND el sistema SHALL demostrar restauración consistente de saldo y estado en reversos válidos
