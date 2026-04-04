# Delta for contabilidad/prestamos-cash

## ADDED Requirements

### Requirement: API Préstamos Cash incluye reconciliaciones

El endpoint GET de préstamos cash MUST incluir `reconciliaciones` con `tipoPago` y `cuentaBancaria` en el response de cada préstamo.

#### Scenario: Préstamo con pagos incluye reconciliaciones

- GIVEN un préstamo con 3 reconciliaciones registradas
- WHEN se consulta la API de préstamos cash
- THEN cada reconciliación incluye: monto, fechaReconciliacion, tipoPago, cuentaBancaria, idTransferencia

#### Scenario: Préstamo sin pagos retorna array vacío

- GIVEN un préstamo sin reconciliaciones
- WHEN se consulta la API
- THEN el campo reconciliaciones es un array vacío

### Requirement: Filas expandibles con historial de pagos

La tabla de préstamos cash MUST mostrar un botón expander por fila que revele el historial de pagos (reconciliaciones) agrupados por transferencia.

#### Scenario: Expandir préstamo con pagos

- GIVEN un préstamo con 3 reconciliaciones en 2 transferencias
- WHEN el usuario hace clic en el botón expander
- THEN se muestra subtabla con: ID transferencia, fecha, método pago, cuenta destino, cantidad pagos, importe

#### Scenario: Expandir préstamo sin pagos

- GIVEN un préstamo sin reconciliaciones
- WHEN el usuario hace clic en expander
- THEN muestra "No hay pagos registrados para este préstamo"

#### Scenario: Botón expander deshabilitado sin pagos

- GIVEN un préstamo sin reconciliaciones
- WHEN se renderiza la fila
- THEN el botón expander SHOULD estar deshabilitado visualmente
