# Inicialización de empresa

## Requisitos

### Requirement: Estado inicial sin historial
El sistema MUST permitir cargar el estado operativo vigente sin respaldo ni facturas históricas, respetando permisos y capacidades efectivas del tenant.

#### Scenario: Saldo bancario existente
- **GIVEN** una empresa con 100000 CUP en una cuenta a la fecha de corte
- **WHEN** registra su saldo inicial
- **THEN** el saldo MUST quedar disponible sin crear una inyección de capital, préstamo ni anticipo ficticio.

#### Scenario: Inventario y obligaciones
- **GIVEN** productos en existencia y saldos pendientes externos
- **WHEN** se cargan con sus datos conocidos
- **THEN** MUST poder operarse posteriormente sin crear compras, ventas o movimientos de tesorería ficticios.

### Requirement: Apertura conciliada
La confirmación MUST conciliar por cuenta y moneda los saldos operativos y el asiento equilibrado en moneda funcional con tasas necesarias.

#### Scenario: Diferencia pendiente
- **GIVEN** un borrador con datos incompletos o diferencia contable
- **WHEN** se intenta confirmar
- **THEN** MUST conservar el borrador, indicar la diferencia y no crear una apertura parcial.

### Requirement: Seguridad e idempotencia
El sistema MUST aislar tenants, validar permisos en servidor y evitar duplicados incluso con reintentos o solicitudes concurrentes.

#### Scenario: Reintento
- **GIVEN** una confirmación exitosa
- **WHEN** se repite con la misma clave y contenido
- **THEN** MUST devolver el resultado previo sin duplicar registros; contenido distinto MUST rechazarse.

#### Scenario: Evidencia consumida
- **GIVEN** una solicitud de apertura consumida
- **WHEN** un cliente intenta actualizarla o eliminarla directamente
- **THEN** MUST rechazarse en la base de datos, incluso si la apertura no incluye cuentas bancarias.
