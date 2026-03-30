# Delta for Contabilidad - Gestión de Anticipos UI

## ADDED Requirements

### Requirement: Página de Gestión de Anticipos

The system MUST proporcionar una interfaz de usuario en el módulo de Contabilidad para gestionar anticipos de pago y cobro, incluyendo creación, consulta, ejecución y reversión.

#### Scenario: Acceder a la página de gestión de anticipos

- GIVEN el usuario tiene acceso al módulo de Contabilidad
- WHEN navega a Contabilidad y selecciona la opción "Anticipos"
- THEN el sistema muestra la página de gestión de anticipos
- AND muestra una tabla con los anticipos existentes

#### Scenario: Filtrar anticipos por tipo

- GIVEN el usuario está en la página de gestión de anticipos
- WHEN selecciona el filtro "Tipo" y elige "PAGO"
- THEN la tabla muestra únicamente anticipos de pago
- AND cuando elige "COBRO" muestra únicamente anticipos de cobro

#### Scenario: Filtrar anticipos por estado

- GIVEN el usuario está en la página de gestión de anticipos
- WHEN selecciona el filtro "Estado" y elige "RESERVADO"
- THEN la tabla muestra únicamente anticipos en estado reservado

### Requirement: Crear Anticipo desde UI

The system MUST permitir crear anticipos de pago y cobro directamente desde la interfaz de usuario, validando todos los datos requeridos.

#### Scenario: Crear anticipo de pago válido

- GIVEN el usuario está en el formulario de crear anticipo
- AND selecciona tipo "PAGO"
- AND selecciona un contrato activo con proveedor
- AND ingresa un monto mayor que cero
- AND selecciona una cuenta de origen
- WHEN hace clic en "Crear"
- THEN el sistema crea el anticipo en estado RESERVADO
- AND muestra mensaje de éxito

#### Scenario: Crear anticipo de cobro válido

- GIVEN el usuario está en el formulario de crear anticipo
- AND selecciona tipo "COBRO"
- AND selecciona un contrato activo con cliente
- AND ingresa un monto mayor que cero
- WHEN hace clic en "Crear"
- THEN el sistema crea el anticipo en estado RESERVADO

#### Scenario: Validar campos requeridos al crear anticipo

- GIVEN el usuario está en el formulario de crear anticipo
- WHEN intenta guardar sin completar los campos requeridos
- THEN el sistema muestra errores de validación
- AND no permite guardar hasta completar los datos

### Requirement: Ver Detalle de Anticipo

The system MUST mostrar el detalle completo de un anticipo, incluyendo todos sus movimientos históricos.

#### Scenario: Ver detalle de anticipo

- GIVEN existe un anticipo en el sistema
- WHEN el usuario hace clic en ver detalle del anticipo
- THEN el sistema muestra: monto original, saldo disponible, estado, vigencia, contraparte, contrato
- AND muestra el historial de movimientos (CREACION_RESERVA, EJECUCION, REVERSO, ANULACION)

### Requirement: Ejecución Parcial de Anticipo

The system MUST permitir ejecutar un anticipo por un monto menor al saldo disponible, dejando el anticipo en estado RESERVADO con saldo restante.

#### Scenario: Ejecutar anticipo parcialmente

- GIVEN existe un anticipo en estado RESERVADO con saldo de 1000 CUP
- AND el usuario ejecuta el anticipo por 600 CUP
- WHEN confirma la ejecución parcial
- THEN el sistema crea el movimiento de EJECUCION por 600 CUP
- AND el saldo disponible queda en 400 CUP
- AND el anticipo permanece en estado RESERVADO

#### Scenario: Ejecutar anticipo totalmente

- GIVEN existe un anticipo en estado RESERVADO con saldo de 1000 CUP
- AND el usuario ejecuta el anticipo por 1000 CUP
- WHEN confirma la ejecución
- THEN el sistema cambia el estado a EJECUTADO
- AND el saldo disponible queda en 0

#### Scenario: Confirmar ejecución parcial

- GIVEN el usuario intenta ejecutar un anticipo por menos del saldo disponible
- WHEN el sistema detecta que es ejecución parcial
- THEN debe mostrar confirmación explícita: "Está a punto de ejecutar parcialmente este anticipo. ¿Desea continuar?"
- AND el usuario debe confirmar para proceder

### Requirement: Reporte de Anticipos por Cliente

The system MUST generar un reporte de todos los anticipos de cobro asociados a un cliente específico.

#### Scenario: Generar reporte por cliente

- GIVEN existen anticipos de cobro para múltiples clientes
- WHEN el usuario solicita el reporte por cliente
- THEN el sistema muestra: cliente, anticipos activos, ejecutados, total cobrado, saldo pendiente
- AND permite filtrar por período de fecha

#### Scenario: Exportar reporte por cliente

- GIVEN el usuario está viendo el reporte por cliente
- WHEN hace clic en "Exportar CSV"
- THEN el sistema descarga un archivo CSV con los datos del reporte

### Requirement: Reporte de Anticipos por Proveedor

The system MUST generar un reporte de todos los anticipos de pago asociados a un proveedor específico.

#### Scenario: Generar reporte por proveedor

- GIVEN existen anticipos de pago para múltiples proveedores
- WHEN el usuario solicita el reporte por proveedor
- THEN el sistema muestra: proveedor, anticipos activos, ejecutados, total pagado, saldo pendiente
- AND permite filtrar por período

### Requirement: Resumen de Anticipos

The system MUST mostrar un resumen ejecutivo de todos los anticipos en el sistema.

#### Scenario: Ver resumen de anticipos

- GIVEN existen anticipos de pago y cobro en diferentes estados
- WHEN el usuario accede al resumen
- THEN el sistema muestra: total anticipos por tipo, totales por estado, totales por moneda
- AND muestra gráfico o tabla de evolución en el tiempo

## MODIFIED Requirements

### Requirement: Ejecución de Anticipo (Modificado)

The system DEBE permitir ejecutar anticipos de forma parcial, además de la ejecución total existente.

(Previously: Solo permitía ejecución total. Ahora permite ejecución parcial.)

#### Scenario: Ejecutar anticipo con cobertura total (sin cambios)

- GIVEN existe un anticipo RESERVADO con saldo 1000
- AND se ejecuta por exactamente 1000
- THEN el anticipo pasa a EJECUTADO con saldo 0 (comportamiento existente)

#### Scenario: Ejecutar anticipo con cobertura parcial (NUEVO)

- GIVEN existe un anticipo RESERVADO con saldo 1000
- AND se ejecuta por 500
- THEN el anticipo queda RESERVADO con saldo 500
- AND el movimiento registra el monto ejecutado
