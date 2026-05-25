# Snapshots y Auditoría

## Purpose

Define los requisitos de inmutabilidad de snapshots de cierre y trazabilidad completa de todas las transiciones de estado del período contable.

## Requirements

### Requirement: Snapshot de Saldos al Cierre

El sistema DEBE capturar un snapshot de los saldos de cuentas bancarias al momento de cerrar un período. El snapshot es inmutable una vez creado.

#### Scenario: Snapshot se crea al cerrar período

- GIVEN un período mensual en estado `EN_CIERRE`
- AND existen 3 cuentas bancarias activas para el tenant
- WHEN el cierre se completa (transición a `CERRADO`)
- THEN se crea un registro `SaldoSnapshot` por cada cuenta bancaria
- AND cada snapshot incluye: `cuentaBancariaId`, `saldo` actual, `moneda`, `createdAt`
- AND los snapshots están vinculados al período cerrado

#### Scenario: Snapshot es inmutable

- GIVEN un `SaldoSnapshot` creado para un período cerrado
- WHEN se intenta modificar el saldo del snapshot
- THEN el sistema RECHAZA la modificación
- AND el snapshot permanece con los valores originales

#### Scenario: Snapshot captura saldo en el momento exacto del cierre

- GIVEN una cuenta bancaria con saldo $50,000 ARS
- AND el período se cierra a las 23:59:59 del último día del mes
- WHEN el snapshot se crea
- THEN el saldo capturado es $50,000 ARS (el valor en ese instante)
- AND cambios posteriores al saldo de la cuenta NO afectan el snapshot

### Requirement: Registro de Auditoría de Transiciones

El sistema DEBE registrar TODA transición de estado de un período en `AuditoriaPeriodo`. No existe transición sin registro de auditoría.

Acciones registrables:
- `APERTURA`: BORRADOR → ABIERTO
- `CIERRE`: ABIERTO/EN_CIERRE → CERRADO
- `APROBACION`: CERRADO → APROBADO
- `REAPERTURA`: APROBADO → REABIERTO

#### Scenario: Auditoría de apertura

- GIVEN un período en estado `BORRADOR`
- WHEN se abre el período
- THEN se crea un registro `AuditoriaPeriodo` con:
  - `accion = APERTURA`
  - `usuario = userId del operador`
  - `createdAt = timestamp actual`

#### Scenario: Auditoría de cierre

- GIVEN un período en estado `ABIERTO`
- WHEN se cierra el período
- THEN se crea un registro `AuditoriaPeriodo` con:
  - `accion = CIERRE`
  - `usuario = userId del operador`
  - `metadata = { snapshotsCreados: N, operacionesEnPeriodo: M }`

#### Scenario: Auditoría de reapertura con motivo

- GIVEN un período en estado `APROBADO`
- WHEN se reapertura con motivo "Corrección de factura #1234 duplicada"
- THEN se crea un registro `AuditoriaPeriodo` con:
  - `accion = REAPERTURA`
  - `usuario = userId del operador`
  - `motivo = "Corrección de factura #1234 duplicada"`
  - `metadata = { estadoAnterior: "APROBADO", estadoNuevo: "REABIERTO" }`

#### Scenario: Toda transición genera auditoría

- GIVEN cualquier transición de estado válida
- WHEN la transición se ejecuta
- THEN SIEMPRE se crea un registro en `AuditoriaPeriodo`
- AND NO existe forma de transitar sin registro de auditoría

### Requirement: Timeline de Auditoría

El sistema DEBE permitir consultar el historial completo de transiciones de un período ordenado cronológicamente.

#### Scenario: Consulta de timeline de un período

- GIVEN un período que ha sido abierto, cerrado, aprobado y reaperturado
- WHEN se consulta su timeline de auditoría
- THEN se retornan los registros en orden cronológico:
  1. APERTURA (timestamp, usuario)
  2. CIERRE (timestamp, usuario, metadata)
  3. APROBACION (timestamp, usuario)
  4. REAPERTURA (timestamp, usuario, motivo)

#### Scenario: Timeline incluye metadatos de cierre

- GIVEN un período cerrado con snapshot de saldos
- WHEN se consulta el registro de auditoría del cierre
- THEN el campo `metadata` incluye la cantidad de snapshots creados
- AND la cantidad de operaciones que existían en el período al momento del cierre

### Requirement: Inmutabilidad Post-Aprobación

El sistema DEBE garantizar que un período en estado `APROBADO` es completamente inmutable. Ninguna operación de escritura contable puede afectar sus datos sin una reapertura previa.

#### Scenario: Escritura directa en período aprobado — BLOQUEADA

- GIVEN un período en estado `APROBADO`
- WHEN una Server Action intenta crear un registro con fecha dentro del período
- THEN el guard rechaza con error `PERIODO_APROBADO`
- AND el mensaje indica que debe reaperturarse con motivo

#### Scenario: Escritura directa en período cerrado — BLOQUEADA

- GIVEN un período en estado `CERRADO`
- WHEN un handler legacy intenta actualizar un registro con fecha dentro del período
- THEN el middleware rechaza con error `PERIODO_CERRADO`

### Requirement: Integridad del Snapshot

El sistema DEBE garantizar que el snapshot de saldos refleja fielmente el estado de las cuentas en el momento del cierre.

#### Scenario: Snapshot con múltiples monedas

- GIVEN un tenant con cuentas en ARS y USD
- WHEN se cierra un período
- THEN se crea un `SaldoSnapshot` por cada cuenta en su moneda correspondiente
- AND cada snapshot registra la moneda explícitamente

#### Scenario: Snapshot con cuenta sin saldo

- GIVEN una cuenta bancaria con saldo $0
- WHEN se cierra un período
- THEN se crea un `SaldoSnapshot` con `saldo = 0`
- AND el snapshot existe (no se omiten cuentas con saldo cero)
