# Production Module: Canonical Unit Normalization & Error Consistency

**Status**: Specification Phase  
**Last Updated**: 2026-04-10  
**Author**: SDD Workflow

## Goal

Definir un comportamiento explícito para unidades en producción basado en **compatibilidad por categoría + unidad canónica por producto**, y alinear backend, UI y contratos de error para evitar reglas contradictorias entre receta, catálogo y cálculo de costos.

## Scope

### In Scope
1. Normalización a unidad canónica del producto al guardar ingredientes de receta
2. Validación por categoría física (`mass`, `volume`, `unit`) en lugar de igualdad exacta de símbolo
3. Respuesta estructurada para normalizaciones, warnings y errores bloqueantes
4. Consistencia entre crear y editar receta
5. Clarificación semántica para unidades `null` / vacías

### Out of Scope
- Cambios a schema Prisma
- Nuevas familias de unidades fuera de mass / volume / unit
- Migración masiva automática de recetas históricas
- Rediseño completo de UI

## Requirements

### Requirement 1: Canonical Product Unit
El sistema **MUST** tratar la unidad del catálogo (`producto.unidad.simbolo`) como la unidad operativa canónica para cada producto usado en producción.

#### Scenario: Ingrediente compatible con símbolo distinto
- GIVEN un producto con unidad canónica `kg`
- WHEN el usuario carga el ingrediente en `g`
- THEN el sistema MUST aceptarlo si pertenece a la misma categoría física
- AND MUST normalizar y persistir la cantidad en unidad canónica del producto

#### Scenario: Ingrediente ya expresado en unidad canónica
- GIVEN un producto con unidad canónica `L`
- WHEN el usuario carga el ingrediente en `L`
- THEN el sistema MUST persistir la cantidad sin conversión adicional

### Requirement 2: Category Compatibility Validation
El sistema **MUST** validar compatibilidad por categoría física y **MUST NOT** exigir coincidencia exacta de símbolo cuando exista conversión segura.

#### Scenario: Compatibilidad masa a masa
- GIVEN un producto canónico `kg`
- WHEN la receta usa `g`
- THEN la validación MUST considerarlo compatible

#### Scenario: Incompatibilidad entre categorías
- GIVEN un producto canónico `kg`
- WHEN la receta usa `L`
- THEN la API MUST rechazar la operación con error bloqueante
- AND MUST NOT persistir cambios parciales

### Requirement 3: Null and Unknown Unit Semantics
El sistema **MUST** tratar `null`, vacío o símbolo desconocido como entrada no normalizable cuando el producto canónico pertenece a `mass` o `volume`.

#### Scenario: Producto medible sin unidad declarada
- GIVEN un producto canónico `ml`
- WHEN el ingrediente llega sin unidad
- THEN la API MUST rechazarlo con mensaje accionable

#### Scenario: Producto discreto sin unidad declarada
- GIVEN un producto canónico `unidad`
- WHEN el ingrediente llega sin unidad
- THEN el sistema MUST interpretarlo como compatible

### Requirement 4: Atomic Recipe Ingredient Persistence
El sistema **MUST** persistir ingredientes y costo de receta de forma atómica después de validar y normalizar todas las unidades.

#### Scenario: Normalización exitosa
- GIVEN una receta válida con todos sus ingredientes compatibles
- WHEN la API procesa la actualización
- THEN MUST recalcular costo con cantidades normalizadas
- AND MUST guardar ingredientes y costo en una sola transacción

#### Scenario: Error en un ingrediente
- GIVEN un lote de ingredientes donde uno es incompatible
- WHEN la API procesa la actualización
- THEN MUST abortar la operación completa
- AND MUST devolver detalle por ingrediente inválido

### Requirement 5: Explicit UI Feedback
La UI **MUST** reflejar el mismo criterio que el backend para crear y editar recetas.

#### Scenario: Normalización informativa
- GIVEN un ingrediente compatible pero no canónico
- WHEN el usuario selecciona una unidad convertible
- THEN la UI SHOULD informar que se guardará en la unidad canónica del producto

#### Scenario: Bloqueo consistente create/edit
- GIVEN un ingrediente incompatible o no normalizable
- WHEN el usuario intenta crear o editar una receta
- THEN la UI MUST bloquear ambas acciones de la misma manera

### Requirement 6: Structured API Contract
La API **MUST** distinguir entre error bloqueante, warning informativo y normalización aplicada.

#### Scenario: Respuesta con normalizaciones
- GIVEN ingredientes compatibles convertidos a unidad canónica
- WHEN la operación es exitosa
- THEN la respuesta SHOULD incluir un arreglo `unitNormalizations`

#### Scenario: Respuesta con errores de validación
- GIVEN ingredientes incompatibles
- WHEN la operación falla
- THEN la respuesta MUST incluir `error`
- AND SHOULD incluir `unitErrors[]` con `productoId`, `providedUnit`, `canonicalUnit` y `reason`

## Success Criteria

- [ ] La spec deja explícito que la regla es compatibilidad por categoría + unidad canónica
- [ ] `kg ↔ g` y `L ↔ ml` quedan permitidos y normalizados
- [ ] `kg ↔ L` queda bloqueado
- [ ] `null`/vacío deja de tener semántica ambigua para productos medibles
- [ ] Crear y editar receta comparten la misma política de bloqueo
- [ ] El contrato API diferencia éxito con normalización vs error bloqueante
