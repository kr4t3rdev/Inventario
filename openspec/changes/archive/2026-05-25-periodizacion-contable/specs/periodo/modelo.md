# Modelo de Período Contable

## Purpose

Define el modelo de datos, estados, jerarquía y transiciones válidas del período contable. Este spec establece la base sobre la cual operan el guard de escritura, los flujos de apertura/cierre, y la auditoría.

## Requirements

### Requirement: Estructura del Período

El sistema DEBE definir un modelo `PeriodoContable` con los siguientes campos obligatorios:

- `periodoId`: identificador único (string)
- `tenantId`: identificador del tenant (string)
- `tipo`: enum `DIARIO | MENSUAL | ANUAL`
- `fechaInicio`: fecha de inicio del período (DateTime en UTC)
- `fechaFin`: fecha de fin del período (DateTime en UTC)
- `estado`: enum `BORRADOR | ABIERTO | EN_CIERRE | CERRADO | APROBADO | REABIERTO`
- `createdAt`, `updatedAt`: timestamps automáticos

Campos opcionales:
- `motivoReapertura`: string, obligatorio cuando estado = `REABIERTO`
- `cerradoPor`: userId del usuario que cerró
- `cerradoAt`: timestamp del cierre
- `aprobadoPor`: userId del usuario que aprobó
- `aprobadoAt`: timestamp de la aprobación

#### Scenario: Creación de período diario

- GIVEN un tenant activo
- WHEN se crea un período de tipo `DIARIO` con `fechaInicio` y `fechaFin` en el mismo día calendario
- THEN el sistema crea el registro con estado `BORRADOR`
- AND `tenantId` corresponde al tenant del usuario creador

#### Scenario: Creación de período mensual

- GIVEN un tenant activo
- WHEN se crea un período de tipo `MENSUAL` con `fechaInicio` en el primer día del mes y `fechaFin` en el último día del mes
- THEN el sistema crea el registro con estado `BORRADOR`
- AND el período cubre exactamente el mes calendario completo

#### Scenario: Creación de período anual

- GIVEN un tenant activo
- WHEN se crea un período de tipo `ANUAL` con `fechaInicio` el 1 de enero y `fechaFin` el 31 de diciembre del mismo año
- THEN el sistema crea el registro con estado `BORRADOR`
- AND el período cubre exactamente el año calendario completo

### Requirement: Estados del Período

El sistema DEBE implementar los siguientes estados con semántica clara:

| Estado | Descripción | ¿Recibe escrituras? |
|--------|-------------|---------------------|
| `BORRADOR` | Período creado pero no activado | NO |
| `ABIERTO` | Período activo, acepta escrituras contables | SÍ |
| `EN_CIERRE` | Período en proceso de cierre (transitorio) | NO |
| `CERRADO` | Período cerrado, inmutable | NO |
| `APROBADO` | Período cerrado y aprobado, inmutable con máxima protección | NO |
| `REABIERTO` | Período reabierto con motivo, acepta escrituras correctivas | SÍ |

#### Scenario: Período nuevo comienza como BORRADOR

- GIVEN un período recién creado
- WHEN se consulta su estado inicial
- THEN el estado ES `BORRADOR`
- AND NO acepta escrituras contables

#### Scenario: Solo ABIERTO y REABIERTO reciben escrituras

- GIVEN un período en estado `ABIERTO`
- WHEN una operación contable intenta escribir con fecha dentro del rango del período
- THEN la operación ES permitida (pasa el guard)

- GIVEN un período en estado `REABIERTO`
- WHEN una operación contable intenta escribir con fecha dentro del rango del período
- THEN la operación ES permitida (pasa el guard)

#### Scenario: Estados no-writables bloquean escrituras

- GIVEN un período en estado `CERRADO`
- WHEN una operación contable intenta escribir con fecha dentro del rango del período
- THEN la operación ES rechazada con error `PERIODO_CERRADO`

### Requirement: Transiciones Válidas de Estado

El sistema DEBE permitir únicamente las siguientes transiciones de estado:

```
BORRADOR → ABIERTO
ABIERTO → EN_CIERRE
EN_CIERRE → CERRADO
CERRADO → APROBADO
APROBADO → REABIERTO (con motivo obligatorio)
REABIERTO → EN_CIERRE
REABIERTO → ABIERTO
```

Transiciones PROHIBIDAS:
- `BORRADOR → CERRADO` (salto de estado)
- `ABIERTO → CERRADO` (debe pasar por `EN_CIERRE`)
- `CERRADO → ABIERTO` (debe pasar por `REABIERTO`)
- `APROBADO → ABIERTO` (debe pasar por `REABIERTO`)
- Cualquier transición a `BORRADOR` (es estado inicial únicamente)

#### Scenario: Transición válida BORRADOR a ABIERTO

- GIVEN un período en estado `BORRADOR`
- WHEN se ejecuta la acción de apertura del período
- THEN el estado cambia a `ABIERTO`
- AND se registra la acción en `AuditoriaPeriodo` con tipo `APERTURA`

#### Scenario: Transición prohibida ABIERTO a CERRADO directo

- GIVEN un período en estado `ABIERTO`
- WHEN se intenta aplicar la transición directa a `CERRADO`
- THEN el sistema RECHAZA la transición con error `TRANSICION_INVALIDA`
- AND el estado permanece en `ABIERTO`

#### Scenario: Reapertura requiere motivo

- GIVEN un período en estado `APROBADO`
- WHEN se intenta reaperturar SIN proporcionar motivo
- THEN el sistema RECHAZA la reapertura con error `MOTIVO_REAPERTURA_REQUERIDO`

- GIVEN un período en estado `APROBADO`
- WHEN se intenta reaperturar CON motivo no vacío
- THEN el estado cambia a `REABIERTO`
- AND `motivoReapertura` se almacena
- AND se registra en `AuditoriaPeriodo` con tipo `REAPERTURA`

### Requirement: Jerarquía de Períodos

El sistema DEBE mantener una relación jerárquica implícita entre períodos:

- Un período `DIARIO` pertenece a un período `MENSUAL` si su fecha está dentro del rango mensual
- Un período `MENSUAL` pertenece a un período `ANUAL` si su fecha está dentro del rango anual
- La jerarquía se resuelve por rango de fechas, NO por relación explícita en el schema

#### Scenario: Período diario pertenece a mensual correcto

- GIVEN un período mensual Enero 2026 (2026-01-01 a 2026-01-31)
- AND un período diario 2026-01-15
- WHEN se consulta el padre mensual del período diario
- THEN el sistema identifica el período mensual Enero 2026 como padre

#### Scenario: Período mensual pertenece a anual correcto

- GIVEN un período anual 2026 (2026-01-01 a 2026-12-31)
- AND un período mensual Marzo 2026 (2026-03-01 a 2026-03-31)
- WHEN se consulta el padre anual del período mensual
- THEN el sistema identifica el período anual 2026 como padre

### Requirement: Unicidad y Solapamiento

El sistema NO DEBE permitir dos períodos del mismo tipo para el mismo tenant con fechas que se solapen.

#### Scenario: Solapamiento de períodos mensuales

- GIVEN un período mensual Enero 2026 ya existe para el tenant A
- WHEN se intenta crear otro período mensual con rango 2026-01-15 a 2026-02-15 para el mismo tenant
- THEN el sistema RECHAZA la creación con error `PERIODO_SOLAPADO`

#### Scenario: Períodos de distinto tipo pueden coexistir

- GIVEN un período mensual Enero 2026 existe para el tenant A
- WHEN se crea un período diario 2026-01-15 para el mismo tenant
- THEN el sistema PERMITE la creación (distinto tipo)

#### Scenario: Períodos de distinto tenant no interfieren

- GIVEN un período mensual Enero 2026 existe para el tenant A
- WHEN se crea un período mensual Enero 2026 para el tenant B
- THEN el sistema PERMITE la creación (distinto tenant)

### Requirement: Zona Horaria Contable

El sistema DEBE resolver todas las fechas de período usando la zona horaria contable del tenant.

- El tenant DEBE tener un campo `contabilidadTimezone` con default `America/Argentina/Buenos_Aires`
- Las comparaciones de fecha contra períodos SE HACEN en la zona horaria del tenant
- Los `DateTime` en Prisma se almacenan en UTC; la conversión ocurre en el guard

#### Scenario: Fecha resuelta en timezone del tenant

- GIVEN un tenant con `contabilidadTimezone = America/Argentina/Buenos_Aires`
- AND un período diario con `fechaInicio = 2026-03-15T03:00:00Z` (UTC, que es 2026-03-15 00:00 ART)
- WHEN una operación tiene timestamp `2026-03-15T04:00:00Z` (UTC, que es 2026-03-15 01:00 ART)
- THEN el sistema determina que la operación CAE dentro del período 2026-03-15

#### Scenario: Backdating por zona horaria detectado

- GIVEN un tenant con `contabilidadTimezone = America/Argentina/Buenos_Aires`
- AND un período diario 2026-03-15 ya CERRADO
- WHEN una operación llega con timestamp UTC `2026-03-16T02:00:00Z` (que en ART es 2026-03-15 23:00)
- THEN el sistema detecta que la fecha de negocio es 2026-03-15
- AND RECHAZA la operación con error `PERIODO_CERRADO`
