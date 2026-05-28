# Spec: Jerarquía y Resolución — Tipos TRIMESTRAL y SEMESTRAL

## Resolución de Período Activo

**Given** una fecha de negocio, `resolverPeriodoActivo()` MUST buscar en el siguiente orden:

1. DIARIO (mayor granularidad)
2. MENSUAL
3. TRIMESTRAL ← nuevo
4. SEMESTRAL ← nuevo
5. ANUAL (menor granularidad)

Retorna el primer período encontrado (el más específico).

## Resolución de Período Padre

**Given** un período de tipo `hijo`, `resolverPeriodoPadre()` MUST retornar el padre según:

| Tipo hijo | Tipo padre buscado |
|-----------|-------------------|
| DIARIO    | MENSUAL |
| MENSUAL   | TRIMESTRAL ← nuevo |
| TRIMESTRAL | SEMESTRAL ← nuevo |
| SEMESTRAL  | ANUAL |
| ANUAL      | null (sin padre) |

**Escenario**: Se crea un MENSUAL "M-2026-04" con fecha 01/04/2026–30/04/2026.

- **Given** existe un TRIMESTRAL "T-2026-T2" con fechas 01/04/2026–30/06/2026
- **When** se resuelve el padre
- **Then** MUST retornar el periodoId de "T-2026-T2"

**Escenario**: Se crea un TRIMESTRAL "T-2026-T1" con fechas 01/01/2026–31/03/2026.

- **Given** existe un SEMESTRAL "S-2026-S1" con fechas 01/01/2026–30/06/2026
- **When** se resuelve el padre
- **Then** MUST retornar el periodoId de "S-2026-S1"

## Validación de Hijos al Cerrar

**Given** un período padre (ej: SEMESTRAL) que se quiere cerrar:

- **Then** MUST verificar que TODOS sus subperíodos hijos directos (TRIMESTRALes) estén en estado CERRADO o APROBADO
- **Then** MUST verificar que no haya hijos legacy (sin periodoPadreId) abiertos dentro del rango de fechas

Esta validación ya existe en `cerrarPeriodo()` y usa `periodoPadreId`. Los nuevos tipos heredan esta validación automáticamente.

## `_hijoTipo()`

**Given** un tipo de período padre:

| Padre | Hijo |
|-------|------|
| ANUAL | SEMESTRAL ← cambiado |
| SEMESTRAL | TRIMESTRAL ← nuevo |
| TRIMESTRAL | MENSUAL ← nuevo |
| MENSUAL | DIARIO |
| DIARIO | DIARIO (default) |

**Nota**: Esto cambia el comportamiento actual donde `_hijoTipo(ANUAL)` retornaba `MENSUAL`. Ahora retorna `SEMESTRAL`. Esto es correcto porque la jerarquía se ensanchó: ANUAL → SEMESTRAL → TRIMESTRAL → MENSUAL.

Esta función se usa en la validación de hijos legacy (sin periodoPadreId). Los períodos legacy existentes (MENSUAL sin padre) no se ven afectados porque la validación legacy usa `tipo` y fechas, no jerarquía explícita.
