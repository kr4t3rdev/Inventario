# Delta for contabilidad/deudas-cash

## ADDED Requirements

### Requirement: API Deudas Cash incluye pagos

El endpoint GET de deudas cash MUST incluir los pagos asociados (vía `cuentaPorPagar.pagos`) con `tipoPago` y `cuentaBancaria` en el response.

#### Scenario: Deuda con pagos incluye historial

- GIVEN una deuda con 2 pagos registrados vía cuentaPorPagar
- WHEN se consulta la API de deudas cash
- THEN cada pago incluye: monto, fecha, tipoPago, cuentaBancaria, referencia

#### Scenario: Deuda sin pagos retorna array vacío

- GIVEN una deuda sin pagos registrados
- WHEN se consulta la API
- THEN el campo de pagos es un array vacío

### Requirement: Filas expandibles con historial de pagos

La tabla de deudas cash MUST mostrar un botón expander por fila que revele el historial de pagos agrupados por referencia/transferencia.

#### Scenario: Expandir deuda con pagos

- GIVEN una deuda con 2 pagos en 2 referencias distintas
- WHEN el usuario hace clic en el botón expander
- THEN se muestra subtabla con: referencia, fecha, método pago, cuenta, importe

#### Scenario: Expandir deuda sin pagos

- GIVEN una deuda sin pagos registrados
- WHEN el usuario hace clic en expander
- THEN muestra "No hay pagos registrados para esta deuda"

#### Scenario: Botón expander deshabilitado sin pagos

- GIVEN una deuda sin pagos
- WHEN se renderiza la fila
- THEN el botón expander SHOULD estar deshabilitado visualmente
