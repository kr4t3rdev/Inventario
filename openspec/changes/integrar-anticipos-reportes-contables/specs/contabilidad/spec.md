# Delta for Contabilidad

## ADDED Requirements

### Requirement: Proyección de movimientos de anticipo en reportes contables

The system MUST incluir en los reportes contables los movimientos de anticipo que representan impacto bancario real, de forma que sean visibles en la pestaña de movimientos y en el historial por cuenta.

#### Scenario: Mostrar ejecución de anticipo en movimientos

- GIVEN existe un `AnticipoMovimiento` de tipo `EJECUCION`
- WHEN el usuario consulta el reporte de movimientos contables
- THEN el sistema MUST mostrar ese movimiento en la tabla
- AND el registro MUST identificar el anticipo y su saldo antes/después

#### Scenario: Mostrar reverso de anticipo en historial por cuenta

- GIVEN existe un `AnticipoMovimiento` de tipo `REVERSO` asociado a una cuenta
- WHEN el usuario consulta el historial de esa cuenta
- THEN el sistema MUST mostrar el reverso en la tabla
- AND el registro MUST conservar la trazabilidad al anticipo original

#### Scenario: Excluir la creación de reserva

- GIVEN existe un `AnticipoMovimiento` de tipo `CREACION_RESERVA`
- WHEN el usuario consulta movimientos o historial por cuenta
- THEN el sistema SHALL no mostrar ese movimiento como movimiento bancario

### Requirement: Clasificación y etiquetas de movimiento de anticipo

The system MUST clasificar los movimientos de anticipo con tipos diferenciados y etiquetas comprensibles para la UI contable.

#### Scenario: Etiquetar ejecución de anticipo

- GIVEN un movimiento de anticipo con tipo `EJECUCION`
- WHEN se renderiza en la tabla de movimientos o por cuenta
- THEN el sistema MUST mostrar una etiqueta de anticipo de ejecución
- AND el movimiento MUST conservar una referencia legible al anticipo

#### Scenario: Etiquetar reverso de anticipo

- GIVEN un movimiento de anticipo con tipo `REVERSO`
- WHEN se renderiza en la tabla de movimientos o por cuenta
- THEN el sistema MUST mostrar una etiqueta de reverso de anticipo
- AND el movimiento MUST conservar una referencia legible al anticipo

### Requirement: Trazabilidad bancaria unificada

The system MUST mantener trazabilidad completa de los movimientos contables mostrando el evento, su contraparte y su relación con la cuenta bancaria afectada.

#### Scenario: Consulta de trazabilidad completa

- GIVEN una cuenta bancaria con anticipos ejecutados o revertidos
- WHEN el usuario consulta `GET /api/contabilidad/cuentas/{id}/historial`
- THEN el sistema MUST incluir los movimientos de anticipo junto a ventas, gastos, transferencias y ajustes
- AND cada fila MUST mantener fecha, monto, moneda y referencia consistente

#### Scenario: Orden cronológico consistente

- GIVEN existen movimientos bancarios de distintos tipos en la misma cuenta
- WHEN el usuario consulta movimientos contables
- THEN el sistema MUST mantener el orden cronológico descendente
- AND los movimientos de anticipo MUST integrarse sin romper el orden existente
