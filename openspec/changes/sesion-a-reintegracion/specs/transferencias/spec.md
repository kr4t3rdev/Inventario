# Spec delta: transferencias — agregado de stock de punto de venta

## ADDED Requirements

### Requirement: El agregado de stock de PV ignora transferencias sin efecto

El cálculo de stock disponible en un punto de venta **SHALL** excluir las
transferencias canceladas, rechazadas y eliminadas lógicamente.

#### Scenario: Transferencia cancelada no descuenta stock

- **WHEN** existe una transferencia con estado `CANCELADA` o `RECHAZADA`
- **THEN** el agregado de stock del PV no la cuenta ni como entrada ni como salida

### Requirement: El agregado de stock usa lo recibido, no lo enviado

El cálculo **SHALL** aportar `cantidadRecibida` (no `cantidad`) por las filas con
recepción, porque el stock solo se mueve al recibir.

#### Scenario: Recepción parcial

- **GIVEN** una transferencia `PARCIAL` con `cantidad` 10 y `cantidadRecibida` 4
- **WHEN** se calcula el stock del PV destino
- **THEN** aporta 4 unidades (no 10)

#### Scenario: Transferencia en tránsito sin recepción

- **GIVEN** una transferencia `EN_TRANSITO` sin recepciones
- **WHEN** se calcula el stock del PV
- **THEN** aporta 0 unidades (el stock no se ha movido)

### Requirement: Las ventas anuladas no consumen stock del PV

El cálculo **SHALL** excluir las ventas `ANULADA` y las eliminadas lógicamente
del consumo de stock del punto de venta.

#### Scenario: Venta anulada

- **GIVEN** una venta `ANULADA` con items del producto en el PV
- **WHEN** se calcula el stock disponible
- **THEN** esa venta no descuenta unidades
