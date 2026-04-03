# Delta for contabilidad/cuentas-por-cobrar

## ADDED Requirements

### Requirement: Comprobante Virtual para Préstamos

Cuando `tipoCuenta === 'PRESTAMO_CASH'`, el sistema MUST mostrar un identificador de comprobante en las columnas de factura de la tabla de cuentas por cobrar, en lugar de `-`.

- Columna "Factura": MUST mostrar `PREST-{idNumerico}` del préstamo asociado.
- Columna "ID Factura": MUST mostrar los últimos 8 caracteres del `cuentaPorCobrar.id` con tooltip del ID completo.

#### Scenario: Préstamo muestra comprobante en tabla

- GIVEN un préstamo cash con `idNumerico: 42` y `cuentaPorCobrarId: "clxyz123abc"`
- WHEN se renderiza la fila en la tabla de cuentas por cobrar
- THEN la columna "Factura" muestra `PREST-42`
- AND la columna "ID Factura" muestra `z123abc` con tooltip del ID completo

#### Scenario: Venta regular no se ve afectada

- GIVEN una cuenta por cobrar con `tipoCuenta: 'VENTA'` y `numeroFactura: 'F-001'`
- WHEN se renderiza la fila
- THEN las columnas de factura muestran los valores originales sin cambios

### Requirement: Filas Expandibles para Pagos de Préstamos

Las filas de préstamos en la tabla CxC MUST ser expandibles para mostrar el historial de pagos (reconciliaciones con `tipoReconciliacion: 'PRESTAMO_CASH'`).

#### Scenario: Expandir préstamo con pagos

- GIVEN un préstamo con 3 reconciliaciones registradas
- WHEN el usuario hace clic en el botón expander
- THEN se muestra la subtabla con las reconciliaciones agrupadas por transferencia
- AND cada fila muestra: ID transferencia, fecha, método, cuenta destino, cantidad de pagos, monto

#### Scenario: Expandir préstamo sin pagos

- GIVEN un préstamo sin reconciliaciones registradas
- WHEN el usuario hace clic en el botón expander
- THEN se muestra mensaje "No hay pagos registrados para este préstamo"

#### Scenario: Botón expander deshabilitado sin pagos

- GIVEN un préstamo sin reconciliaciones
- WHEN se renderiza la fila
- THEN el botón expander SHOULD estar deshabilitado con estilo visual atenuado

## MODIFIED Requirements

### Requirement: API Cuentas por Cobrar incluye reconciliaciones de préstamos

(Previously: La API solo retorna reconciliaciones anidadas en `factura.venta.reconciliaciones`, excluyendo préstamos que no tienen factura.)

El endpoint GET `/api/contabilidad/cuentas-por-cobrar` MUST incluir las reconciliaciones de préstamos en un campo normalizado cuando `tipoCuenta === 'PRESTAMO_CASH'`.

#### Scenario: Respuesta API para préstamo con pagos

- GIVEN un préstamo cash con 2 reconciliaciones en `ReconciliacionVenta`
- WHEN se consulta GET `/api/contabilidad/cuentas-por-cobrar`
- THEN la cuenta del préstamo incluye las reconciliaciones en un campo accesible al frontend
- AND cada reconciliación incluye: monto, fechaReconciliacion, tipoPago, cuentaBancaria, idTransferencia

#### Scenario: Respuesta API para préstamo sin pagos

- GIVEN un préstamo cash sin reconciliaciones
- WHEN se consulta el endpoint
- THEN la cuenta del préstamo incluye arreglo vacío de reconciliaciones
