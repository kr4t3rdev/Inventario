# Apertura, Cierre y Reapertura de Períodos

## Purpose

Define los flujos completos de apertura, cierre y reapertura de períodos contables, incluyendo validaciones de jerarquía, transiciones de estado, y requisitos de auditoría.

## Requirements

### Requirement: Apertura de Período Diario

El sistema DEBE permitir abrir un período diario que esté en estado `BORRADOR` o `REABIERTO`.

#### Scenario: Apertura exitosa de período diario

- GIVEN un período diario en estado `BORRADOR` para la fecha 2026-03-15
- WHEN un usuario con permisos contables ejecuta la apertura
- THEN el estado cambia a `ABIERTO`
- AND se registra en `AuditoriaPeriodo` con acción `APERTURA`, usuario y timestamp

#### Scenario: Apertura de período ya abierto

- GIVEN un período diario ya en estado `ABIERTO`
- WHEN se intenta abrir nuevamente
- THEN el sistema RECHAZA con error `PERIODO_YA_ABIERTO`

### Requirement: Cierre de Período Diario

El sistema DEBE permitir cerrar un período diario que esté en estado `ABIERTO`. El cierre pasa por el estado transitorio `EN_CIERRE`.

#### Scenario: Cierre exitoso de período diario

- GIVEN un período diario en estado `ABIERTO`
- WHEN un usuario con permisos contables ejecuta el cierre
- THEN el estado cambia a `EN_CIERRE`
- AND el sistema calcula el snapshot de saldos
- AND luego cambia a `CERRADO`
- AND `cerradoPor` y `cerradoAt` se registran
- AND se registra en `AuditoriaPeriodo` con acción `CIERRE`

#### Scenario: Cierre falla si hay operaciones pendientes

- GIVEN un período diario en estado `ABIERTO`
- AND existen operaciones contables sin reconciliar dentro del período
- WHEN se intenta cerrar el período
- THEN el sistema DEBE advertir al usuario sobre operaciones pendientes
- AND el usuario DEBE confirmar que desea cerrar a pesar de las pendientes
- AND si confirma, el cierre procede normalmente

### Requirement: Apertura de Período Mensual

El sistema DEBE permitir abrir un período mensual que esté en estado `BORRADOR`.

#### Scenario: Apertura exitosa de período mensual

- GIVEN un período mensual en estado `BORRADOR` para marzo 2026
- WHEN un usuario con permisos contables ejecuta la apertura
- THEN el estado cambia a `ABIERTO`
- AND se registra en `AuditoriaPeriodo` con acción `APERTURA`

### Requirement: Cierre de Período Mensual — Validación de Hijos

El sistema NO DEBE permitir cerrar un período mensual si existen períodos diarios hijos en estado `ABIERTO` dentro de su rango.

#### Scenario: Cierre mensual con diarios abiertos — RECHAZADO

- GIVEN un período mensual marzo 2026 en estado `ABIERTO`
- AND existen 5 períodos diarios dentro de marzo que están `ABIERTO`
- WHEN se intenta cerrar el período mensual
- THEN el sistema RECHAZA con error `HIJOS_ABIERTOS`
- AND el mensaje indica cuántos períodos diarios están aún abiertos
- AND el estado del mensual permanece `ABIERTO`

#### Scenario: Cierre mensual con todos los diarios cerrados — EXITOSO

- GIVEN un período mensual marzo 2026 en estado `ABIERTO`
- AND TODOS los períodos diarios dentro de marzo están `CERRADO` o `APROBADO`
- WHEN se intenta cerrar el período mensual
- THEN el estado cambia a `EN_CIERRE`
- AND el sistema calcula el snapshot de saldos del mes
- AND luego cambia a `CERRADO`
- AND se registra en `AuditoriaPeriodo` con acción `CIERRE`

### Requirement: Apertura de Período Anual

El sistema DEBE permitir abrir un período anual que esté en estado `BORRADOR`.

#### Scenario: Apertura exitosa de período anual

- GIVEN un período anual en estado `BORRADOR` para 2026
- WHEN un usuario con permisos contables ejecuta la apertura
- THEN el estado cambia a `ABIERTO`
- AND se registra en `AuditoriaPeriodo` con acción `APERTURA`

### Requirement: Cierre de Período Anual — Validación de Hijos

El sistema NO DEBE permitir cerrar un período anual si existen períodos mensuales hijos en estado `ABIERTO` dentro de su rango.

#### Scenario: Cierre anual con meses abiertos — RECHAZADO

- GIVEN un período anual 2026 en estado `ABIERTO`
- AND existen 3 períodos mensuales dentro de 2026 que están `ABIERTO`
- WHEN se intenta cerrar el período anual
- THEN el sistema RECHAZA con error `HIJOS_ABIERTOS`
- AND el mensaje indica cuántos períodos mensuales están aún abiertos
- AND el estado del anual permanece `ABIERTO`

#### Scenario: Cierre anual con todos los meses cerrados — EXITOSO

- GIVEN un período anual 2026 en estado `ABIERTO`
- AND TODOS los 12 períodos mensuales dentro de 2026 están `CERRADO` o `APROBADO`
- WHEN se intenta cerrar el período anual
- THEN el estado cambia a `EN_CIERRE`
- AND el sistema calcula el snapshot anual
- AND luego cambia a `CERRADO`
- AND se registra en `AuditoriaPeriodo` con acción `CIERRE`

### Requirement: Aprobación de Período

El sistema DEBE permitir aprobar un período que esté en estado `CERRADO`. La aprobación es irreversible excepto vía reapertura.

#### Scenario: Aprobación exitosa

- GIVEN un período en estado `CERRADO`
- WHEN un usuario con permisos de aprobación ejecuta la aprobación
- THEN el estado cambia a `APROBADO`
- AND `aprobadoPor` y `aprobadoAt` se registran
- AND se registra en `AuditoriaPeriodo` con acción `APROBACION`

#### Scenario: Aprobación de período no cerrado

- GIVEN un período en estado `ABIERTO`
- WHEN se intenta aprobar directamente
- THEN el sistema RECHAZA con error `TRANSICION_INVALIDA`
- AND el mensaje indica que el período debe estar cerrado primero

### Requirement: Reapertura de Período

El sistema DEBE permitir reaperturar un período en estado `APROBADO` únicamente con motivo obligatorio y registro de auditoría.

#### Scenario: Reapertura con motivo válido

- GIVEN un período mensual en estado `APROBADO`
- WHEN un usuario con permisos de reapertura proporciona un motivo no vacío
- THEN el estado cambia a `REABIERTO`
- AND `motivoReapertura` se almacena
- AND se registra en `AuditoriaPeriodo` con acción `REAPERTURA`, motivo, usuario y timestamp

#### Scenario: Reapertura sin motivo — RECHAZADO

- GIVEN un período en estado `APROBADO`
- WHEN se intenta reaperturar SIN motivo o con motivo vacío
- THEN el sistema RECHAZA con error `MOTIVO_REAPERTURA_REQUERIDO`

#### Scenario: Reapertura de período no aprobado

- GIVEN un período en estado `CERRADO` (no aprobado)
- WHEN se intenta reaperturar
- THEN el sistema RECHAZA con error `TRANSICION_INVALIDA`
- AND el mensaje indica que solo períodos aprobados pueden reaperturarse

### Requirement: Reconciliación con Período Cerrado

El sistema NO DEBE permitir que una reconciliación use un período ya cerrado.

#### Scenario: Reconciliación intenta usar mes cerrado — RECHAZADO

- GIVEN un período mensual febrero 2026 en estado `CERRADO`
- WHEN una reconciliación intenta registrar una transacción con fecha en febrero 2026
- THEN el sistema RECHAZA con error `PERIODO_CERRADO`
- AND la reconciliación NO se ejecuta

### Requirement: Corrección Post-Cierre

El sistema NO DEBE permitir modificaciones directas a un período cerrado o aprobado. La única vía es reapertura con auditoría.

#### Scenario: Corrección post-cierre solo vía reapertura

- GIVEN un período mensual en estado `APROBADO`
- WHEN un usuario necesita corregir un registro dentro del período
- THEN el sistema NO permite la modificación directa
- AND el usuario DEBE reaperturar el período con motivo
- AND luego realizar la corrección
- AND toda la secuencia queda registrada en `AuditoriaPeriodo`
