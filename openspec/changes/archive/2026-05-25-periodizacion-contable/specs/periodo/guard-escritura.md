# Guard de Escritura

## Purpose

Define las reglas de validación del servicio `PeriodoGuard` que intercepta TODA escritura contable y verifica que el período correspondiente esté en estado writable (`ABIERTO` o `REABIERTO`). Este guard es el mecanismo central de protección contra escrituras en períodos cerrados.

## Requirements

### Requirement: Intercepción Universal de Escrituras

El sistema DEBE validar TODA operación de escritura contable a través de `PeriodoGuard.assertWritable()` antes de ejecutar la lógica de negocio.

Puntos de intercepción obligatorios:
- Wrapper `withAction` de Server Actions
- Middleware de API Routes legacy (`withPeriodoGuard`)
- Workflows de servicio que ejecutan escrituras directas

#### Scenario: Server Action pasa por el guard

- GIVEN una Server Action que crea/modifica un registro contable
- WHEN la action es invocada con un parámetro de fecha
- THEN `PeriodoGuard.assertWritable()` se ejecuta ANTES de la lógica de negocio
- AND si el período está cerrado, la action retorna `{ success: false, error: { code: 'PERIODO_CERRADO' } }`

#### Scenario: API Route legacy pasa por el guard

- GIVEN un API Route legacy que acepta POST/PUT/PATCH para datos contables
- WHEN el handler es invocado
- THEN el middleware `withPeriodoGuard` se ejecuta ANTES del handler
- AND si el período está cerrado, retorna HTTP 409 con mensaje de error

#### Scenario: Handler legacy intenta escribir sin pasar por guard

- GIVEN un handler legacy que NO ha sido envuelto con `withPeriodoGuard`
- WHEN se ejecuta un test de integración que invoca el endpoint directamente
- THEN el sistema DEBE detectar el bypass y bloquear la escritura
- AND el test DEBE fallar indicando que el endpoint no está protegido

### Requirement: Resolución de Período por Fecha

El sistema DEBE determinar el período activo correspondiente a una fecha dada, considerando:

1. La fecha se convierte a la zona horaria del tenant (`contabilidadTimezone`)
2. Se busca un período del tipo correspondiente (diario, mensual, anual) cuyo rango contenga la fecha
3. Si no existe período para esa fecha, el sistema DEBE crear uno en estado `BORRADOR` y luego abrirlo automáticamente, o rechazar la operación según configuración

#### Scenario: Fecha cae en período abierto

- GIVEN un período mensual `ABIERTO` con rango 2026-03-01 a 2026-03-31
- WHEN `assertWritable` se llama con fecha `2026-03-15`
- THEN la validación PASA (no lanza error)
- AND el período activo es el mensual de marzo

#### Scenario: Fecha cae en período cerrado

- GIVEN un período mensual `CERRADO` con rango 2026-02-01 a 2026-02-28
- WHEN `assertWritable` se llama con fecha `2026-02-15`
- THEN la validación FALLA con error `PERIODO_CERRADO`
- AND el mensaje indica el período y su estado actual

#### Scenario: Fecha no tiene período asociado

- GIVEN no existe ningún período para la fecha `2026-06-15`
- WHEN `assertWritable` se llama con esa fecha
- THEN el sistema DEBE rechazar la operación con error `PERIODO_NO_EXISTE`
- AND el mensaje indica que se debe crear y abrir el período primero

### Requirement: Validación por Tipo de Operación

El sistema DEBE distinguir entre operaciones de caja (cash basis) y devengo (accrual basis) para validar contra el período correcto:

- **Caja (cash basis)**: valida contra el período que contiene `fechaReconciliacion` (cuando entró/salió el dinero)
- **Devengo (accrual basis)**: valida contra el período que contiene `createdAt` o fecha de negocio (`fechaCompra`, `fechaServicio`)

#### Scenario: Operación de caja valida contra fecha de reconciliación

- GIVEN un gasto reconciliado con `fechaReconciliacion = 2026-03-15`
- AND `createdAt = 2026-02-20`
- WHEN se valida la operación de caja
- THEN el sistema valida contra el período de marzo 2026 (fecha de reconciliación)
- AND si marzo está cerrado, la operación se rechaza

#### Scenario: Operación de devengo valida contra fecha de negocio

- GIVEN una compra con `fechaCompra = 2026-02-20`
- AND `fechaReconciliacion = 2026-03-15`
- WHEN se valida la operación de devengo
- THEN el sistema valida contra el período de febrero 2026 (fecha de negocio)
- AND si febrero está cerrado, la operación se rechaza

### Requirement: Feature Flag de Bypass

El sistema DEBE soportar un feature flag `PERIODO_GUARD_ENABLED` para desactivar la validación en caso de emergencia.

- Cuando `PERIODO_GUARD_ENABLED = false`: el guard bypassa la validación y loguea un WARNING
- Cuando `PERIODO_GUARD_ENABLED = true` (default): el guard aplica todas las reglas normalmente
- El bypass SOLO debe usarse para rollback de emergencia, NO como configuración permanente

#### Scenario: Guard desactivado permite escritura en período cerrado

- GIVEN `PERIODO_GUARD_ENABLED = false`
- AND un período mensual `CERRADO`
- WHEN una operación contable intenta escribir con fecha en el período cerrado
- THEN la operación SE PERMITE
- AND se loguea un WARNING indicando que el guard está desactivado

#### Scenario: Guard activado bloquea escritura en período cerrado

- GIVEN `PERIODO_GUARD_ENABLED = true`
- AND un período mensual `CERRADO`
- WHEN una operación contable intenta escribir con fecha en el período cerrado
- THEN la operación SE RECHAZA con error `PERIODO_CERRADO`

### Requirement: Caché de Períodos Activos

El sistema DEBE implementar caché en memoria de períodos activos por tenant con TTL de 5 minutos para evitar queries adicionales en cada escritura.

#### Scenario: Caché hit para período activo

- GIVEN un tenant ha consultado su período activo hace 2 minutos
- WHEN `assertWritable` se llama nuevamente para el mismo tenant
- THEN el sistema usa el valor cacheado (no hace query a DB)

#### Scenario: Caché expirado refresca desde DB

- GIVEN un tenant ha consultado su período activo hace 6 minutos
- WHEN `assertWritable` se llama nuevamente para el mismo tenant
- THEN el sistema hace una query a DB para obtener el período actualizado
- AND actualiza el caché con el nuevo valor

### Requirement: Error Claro al Usuario

El sistema DEBE retornar errores descriptivos cuando el guard rechaza una operación:

| Código de Error | Mensaje |
|-----------------|---------|
| `PERIODO_CERRADO` | "El período {tipo} {fecha} está cerrado. No se permiten modificaciones." |
| `PERIODO_APROBADO` | "El período {tipo} {fecha} está aprobado. Debe reaperturarse con motivo para modificar." |
| `PERIODO_NO_EXISTE` | "No existe un período contable para la fecha {fecha}. Cree y abra el período primero." |
| `PERIODO_EN_CIERRE` | "El período {tipo} {fecha} está en proceso de cierre. Intente más tarde." |

#### Scenario: Error legible en Server Action

- GIVEN un período cerrado para marzo 2026
- WHEN una Server Action es rechazada por el guard
- THEN el error retornado incluye el código `PERIODO_CERRADO`
- AND el mensaje es "El período MENSUAL 2026-03 está cerrado. No se permiten modificaciones."

#### Scenario: Error legible en API Route

- GIVEN un período cerrado para marzo 2026
- WHEN un API Route legacy es rechazado por el guard
- THEN la respuesta HTTP es 409 Conflict
- AND el body JSON incluye `{ error: { code: "PERIODO_CERRADO", message: "..." } }`
