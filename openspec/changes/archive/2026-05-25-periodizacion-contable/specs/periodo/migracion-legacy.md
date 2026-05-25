# Migración Legacy — Coexistencia con CierreContable

## Purpose

Define cómo coexiste el nuevo modelo `PeriodoContable` con el sistema existente `CierreContable` durante la fase de transición, incluyendo compatibilidad con campos string de período existentes y plan de deprecación.

## Requirements

### Requirement: Coexistencia de Modelos

El sistema DEBE permitir que `PeriodoContable` (nuevo) y `CierreContable` (legacy) coexistan sin conflicto durante la migración.

#### Scenario: Ambos modelos existen simultáneamente

- GIVEN el schema incluye `PeriodoContable` (nuevo) y `GastosDE` con campo `periodo` string (legacy)
- WHEN se ejecuta `prisma migrate`
- THEN la migración es aditiva (no modifica modelos existentes)
- AND los campos string de período en modelos legacy permanecen funcionales

#### Scenario: Campo string legacy sigue funcionando

- GIVEN un `GastosDE` con `periodo = "2026-03"` (formato string legacy)
- WHEN se consulta o edita el registro
- THEN el campo `periodo` string sigue accesible y funcional
- AND NO se pierde data existente

### Requirement: Mapeo entre Período String y PeriodoContable

El sistema DEBE poder resolver un período string legacy (ej: `"2026-03"`) al `PeriodoContable` correspondiente.

#### Scenario: Resolución de período string a PeriodoContable

- GIVEN un `GastosDE` con `periodo = "2026-03"`
- WHEN el sistema necesita validar el período
- THEN busca un `PeriodoContable` de tipo `MENSUAL` con rango que cubra marzo 2026
- AND usa el estado del `PeriodoContable` para la validación del guard

#### Scenario: Período string sin PeriodoContable correspondiente

- GIVEN un `GastosDE` con `periodo = "2025-06"`
- AND no existe `PeriodoContable` para junio 2025
- WHEN el sistema intenta validar el período
- THEN el sistema DEBE crear el `PeriodoContable` en estado `BORRADOR`
- AND luego abrirlo automáticamente para permitir la operación legacy
- O bien rechazar la operación si la política lo exige

### Requirement: CierreContable Legacy con Guard Aplicado

El sistema DEBE aplicar el `PeriodoGuard` a las operaciones de `CierreContable` existente, incluyendo la corrección del bug de `tenantId`.

#### Scenario: calcularEstadisticasCierre con tenantId correcto

- GIVEN `calcularEstadisticasCierre` se ejecuta para un tenant específico
- WHEN calcula estadísticas
- THEN TODAS las queries incluyen `where: { tenantId }`
- AND los resultados son correctos para ese tenant

#### Scenario: CierreContable respeta períodos cerrados

- GIVEN un período mensual ya `CERRADO`
- WHEN `calcularEstadisticasCierre` intenta recalcular para ese período
- THEN el guard rechaza el recálculo
- AND se retorna error indicando que el período está cerrado

### Requirement: Deprecación Gradual de Handlers Legacy

El sistema DEBE mantener los handlers legacy funcionales con el guard aplicado, pero marcarlos como deprecated para eliminación futura.

#### Scenario: Handler legacy marcado como deprecated

- GIVEN un API Route legacy de contabilidad
- WHEN el código del handler es revisado
- THEN incluye un comentario `@deprecated` indicando la fecha de deprecación planificada
- AND el guard está aplicado correctamente

#### Scenario: Log de uso de handler legacy

- GIVEN un handler legacy es invocado
- WHEN se ejecuta
- THEN se loguea un WARNING indicando que el handler está deprecated
- AND el log incluye el endpoint y timestamp para tracking de uso

### Requirement: Migración de Datos Históricos — No Automática

Los períodos existentes en campos string NO se migran automáticamente a `PeriodoContable`. La migración es manual o se planifica como cambio separado.

#### Scenario: Datos legacy no se migran automáticamente

- GIVEN existen 500 registros `GastosDE` con campo `periodo` string
- WHEN se ejecuta la migración de schema
- THEN los 500 registros permanecen con su campo `periodo` string intacto
- AND NO se crean `PeriodoContable` automáticamente para los períodos existentes

#### Scenario: Migración planificada como cambio separado

- GIVEN la coexistencia está funcionando
- WHEN se planifica la deprecación completa del campo string
- THEN se crea un cambio separado con:
  - Script de migración que crea `PeriodoContable` para cada período string único
  - Actualización de referencias en modelos legacy
  - Eliminación del campo string después de verificación

### Requirement: Validación Dual durante Transición

Durante la fase de transición, el sistema DEBE validar contra AMBOS sistemas: el guard nuevo Y las validaciones legacy existentes.

#### Scenario: Validación dual en reconciliación

- GIVEN una reconciliación usa el campo `periodo` string legacy
- AND el nuevo `PeriodoGuard` está activo
- WHEN se ejecuta la reconciliación
- THEN se valida contra el guard nuevo PRIMERO
- AND si pasa, se aplica la validación legacy existente
- AND ambas deben pasar para que la operación sea exitosa

#### Scenario: Conflicto entre validación legacy y guard nuevo

- GIVEN la validación legacy permite una operación
- AND el guard nuevo la rechaza (período cerrado)
- WHEN se ejecuta la operación
- THEN el guard nuevo PREVALECE
- AND la operación se rechaza
- AND se loguea el conflicto para análisis

### Requirement: Campo contabilidadTimezone en Tenant

El sistema DEBE agregar el campo `contabilidadTimezone` al modelo `Tenant` con default `America/Argentina/Buenos_Aires`.

#### Scenario: Tenant sin timezone configurada usa default

- GIVEN un tenant NO tiene `contabilidadTimezone` configurado
- WHEN el guard resuelve una fecha
- THEN usa `America/Argentina/Buenos_Aires` como timezone por defecto

#### Scenario: Tenant con timezone personalizada

- GIVEN un tenant tiene `contabilidadTimezone = "America/New_York"`
- WHEN el guard resuelve una fecha
- THEN usa `America/New_York` para la conversión
- AND las comparaciones de período son consistentes con esa zona
