# Delta for contabilidad/cuentas-por-cobrar

## REMOVED Requirements

### Requirement: Comprobante Virtual para Préstamos

(Reason: Préstamos ya no se muestran en CxC — tienen tabla dedicada en `/busy/contabilidad/prestamos-cash`)

### Requirement: Filas Expandibles para Pagos de Préstamos

(Reason: Funcionalidad movida a `prestamos-cash-table.tsx`)

## MODIFIED Requirements

### Requirement: API Cuentas por Cobrar excluye préstamos

(Previously: El endpoint retorna TODAS las cuentas por cobrar incluyendo `tipoCuenta: 'PRESTAMO_CASH'` con reconciliaciones)

El endpoint GET `/api/contabilidad/cuentas-por-cobrar` MUST excluir registros con `tipoCuenta: 'PRESTAMO_CASH'` del resultado.

#### Scenario: API no retorna préstamos

- GIVEN 5 cuentas por cobrar: 3 VENTA + 2 PRESTAMO_CASH
- WHEN se consulta GET `/api/contabilidad/cuentas-por-cobrar`
- THEN retorna solo las 3 cuentas con `tipoCuenta: 'VENTA'`

#### Scenario: Filtro se combina con estado

- GIVEN 2 ventas PENDIENTE + 1 venta PAGADA + 1 préstamo PENDIENTE
- WHEN se consulta con `?estado=PENDIENTE`
- THEN retorna solo las 2 ventas PENDIENTE

### Requirement: Tabla CxC sin lógica de préstamos

(Previously: La tabla tenía detección `tipoCuenta === 'PRESTAMO_CASH'` para renderizar badge PREST-, botón comprobante, y expandir reconciliaciones de préstamos)

La tabla CxC MUST renderizar solo cuentas de ventas. MUST NOT contener lógica condicional para préstamos.

#### Scenario: Tabla sin badge PREST-

- GIVEN las columnas de la tabla CxC
- WHEN se renderizan todas las filas
- THEN ninguna fila muestra badge `PREST-{id}`
- AND todas las filas usan `numeroFactura` estándar
