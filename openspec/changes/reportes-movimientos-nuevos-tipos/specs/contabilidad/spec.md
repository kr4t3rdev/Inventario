# Reportes Contables — Tipos de Movimiento: Préstamo Cash y Deuda Cash

## Purpose

Especifica el comportamiento de los endpoints de reportes y los componentes UI al clasificar, filtrar y mostrar movimientos del tipo `prestamo_cash` y `deuda_cash` presentes en `ReconciliacionVenta`.

---

## Requirements

### Requirement: Clasificación correcta de reconciliaciones por tipoReconciliacion

The API endpoints MUST map each `ReconciliacionVenta` to its semantic movement type using the `tipoReconciliacion` field, not a fixed `'venta'` label.

#### Scenario: Reconciliación de préstamo cash retorna tipo correcto

- GIVEN existe una `ReconciliacionVenta` con `tipoReconciliacion = PRESTAMO_CASH`
- WHEN se consulta `GET /api/contabilidad/reportes/movimientos`
- THEN el registro retorna con `tipo: 'prestamo_cash'`
- AND `descripcion` identifica el préstamo (id del préstamo o cliente)

#### Scenario: Reconciliación de deuda cash retorna tipo correcto

- GIVEN existe una `ReconciliacionVenta` con `tipoReconciliacion = DEUDA_CASH`
- WHEN se consulta `GET /api/contabilidad/reportes/movimientos`
- THEN el registro retorna con `tipo: 'deuda_cash'`
- AND `descripcion` identifica la deuda (id de deuda o proveedor)

#### Scenario: Reconciliación de venta pura no regresiona

- GIVEN existe una `ReconciliacionVenta` con `tipoReconciliacion = VENTA` o sin campo explícito
- WHEN se consulta `GET /api/contabilidad/reportes/movimientos`
- THEN el registro retorna con `tipo: 'venta'`
- AND el comportamiento es idéntico al anterior al cambio

#### Scenario: Historial por cuenta clasifica correctamente

- GIVEN una cuenta tiene reconciliaciones de los tres tipos
- WHEN se consulta `GET /api/contabilidad/cuentas/{id}/historial`
- THEN cada registro aparece con su `tipoMovimiento` correcto (`venta`, `prestamo_cash`, `deuda_cash`)

---

### Requirement: Filtrado por tipo en endpoint de movimientos

The API endpoint `GET /api/contabilidad/reportes/movimientos` MUST filter by `tipoMovimiento=prestamo_cash` and `tipoMovimiento=deuda_cash` and return only matching records.

#### Scenario: Filtrar por prestamo_cash devuelve solo esos registros

- GIVEN existen movimientos de tipo `prestamo_cash`, `deuda_cash` y `venta`
- WHEN se consulta con `tipoMovimiento=prestamo_cash`
- THEN solo se retornan registros con `tipo: 'prestamo_cash'`
- AND el total de paginación refleja únicamente esos registros

#### Scenario: Filtrar por deuda_cash devuelve solo esos registros

- GIVEN existen movimientos de múltiples tipos
- WHEN se consulta con `tipoMovimiento=deuda_cash`
- THEN solo se retornan registros con `tipo: 'deuda_cash'`

#### Scenario: Sin filtro retorna todos los tipos incluyendo los nuevos

- GIVEN existen registros de todos los tipos
- WHEN se consulta sin parámetro `tipoMovimiento`
- THEN la respuesta incluye registros de tipo `prestamo_cash` y `deuda_cash` junto a los existentes

---

### Requirement: Filtrado por tipo en historial de cuenta

The API endpoint `GET /api/contabilidad/cuentas/{id}/historial` MUST accept `tipoMovimiento=prestamo_cash` and `tipoMovimiento=deuda_cash`.

#### Scenario: Filtrar historial por prestamo_cash

- GIVEN la cuenta tiene reconciliaciones de varios tipos
- WHEN se consulta con `tipoMovimiento=prestamo_cash`
- THEN solo retorna transacciones con `tipoMovimiento: 'prestamo_cash'`

#### Scenario: Filtrar historial por deuda_cash

- GIVEN la cuenta tiene reconciliaciones de varios tipos
- WHEN se consulta con `tipoMovimiento=deuda_cash`
- THEN solo retorna transacciones con `tipoMovimiento: 'deuda_cash'`

---

### Requirement: UI muestra opciones de filtro para nuevos tipos

The `MovimientosTable` component MUST include `Préstamo Cash` and `Deuda Cash` as selectable options in the movement type filter dropdown.

#### Scenario: Dropdown contiene ambas opciones nuevas

- GIVEN el usuario está en la pestaña "Movimientos" de Reportes
- WHEN abre el selector de tipo de movimiento
- THEN ve las opciones "Préstamo Cash" y "Deuda Cash" junto a las existentes

#### Scenario: Seleccionar Préstamo Cash filtra la tabla

- GIVEN hay movimientos de tipo `prestamo_cash` en el sistema
- WHEN el usuario selecciona "Préstamo Cash" en el filtro
- THEN la tabla muestra solo registros de ese tipo con badge distintivo

#### Scenario: Seleccionar Deuda Cash filtra la tabla

- GIVEN hay movimientos de tipo `deuda_cash` en el sistema
- WHEN el usuario selecciona "Deuda Cash" en el filtro
- THEN la tabla muestra solo registros de ese tipo con badge distintivo

---

### Requirement: UI muestra badges diferenciados para nuevos tipos

The `MovimientosTable` and `AccountTransactionHistory` components MUST display a visually distinct badge for `prestamo_cash` and `deuda_cash` types.

#### Scenario: Badge de prestamo_cash tiene color violeta

- GIVEN un movimiento de tipo `prestamo_cash` está en la tabla
- WHEN se renderiza su badge de tipo
- THEN muestra el label "Préstamo Cash" con estilo de color violeta/purple

#### Scenario: Badge de deuda_cash tiene color ámbar

- GIVEN un movimiento de tipo `deuda_cash` está en la tabla
- WHEN se renderiza su badge de tipo
- THEN muestra el label "Deuda Cash" con estilo de color ámbar/yellow

---

### Requirement: Pestaña "Por cuenta" soporta filtro de nuevos tipos

The `AccountTransactionHistory` component MUST include the same two new type options in its filter dropdown.

#### Scenario: Filtro por tipo en historial de cuenta funciona para nuevos tipos

- GIVEN la cuenta tiene transacciones de tipo `prestamo_cash` o `deuda_cash`
- WHEN el usuario selecciona ese tipo en el filtro
- THEN la tabla muestra solo esas transacciones con badge correcto
