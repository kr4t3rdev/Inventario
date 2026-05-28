# Proposal: Tipos TRIMESTRAL y SEMESTRAL en Períodos Contables

## Intent

Agregar los tipos de período `TRIMESTRAL` y `SEMESTRAL` al sistema de períodos contables, completando la jerarquía temporal desde DIARIO hasta ANUAL. Esto permite que empresas con cierres trimestrales o semestrales (reportes fiscales, balances parciales, auditorías internas) puedan crear y cerrar períodos en esos rangos sin tener que usar MENSUAL como workaround.

## Rationale

Actualmente la jerarquía es:
```
ANUAL → MENSUAL → DIARIO
```

No hay forma nativa de crear un período que abarque exactamente un trimestre (Enero-Marzo) o un semestre (Enero-Junio). Los usuarios que necesitan reportes trimestrales se ven forzados a:
1. Crear 3 períodos mensuales y agregarlos manualmente
2. O crear un período anual que no les da el detalle trimestral que necesitan

Con TRIMESTRAL y SEMESTRAL, la jerarquía completa queda:
```
ANUAL → SEMESTRAL → TRIMESTRAL → MENSUAL → DIARIO
```

## Scope

### Incluye

1. **Schema**: Agregar `TRIMESTRAL` y `SEMESTRAL` al enum `TipoPeriodo` en Prisma
2. **Jerarquía**: Actualizar `_hijoTipo()`, `resolverPeriodoPadre()`, `resolverPeriodoActivo()` para incluir los nuevos niveles
3. **Códigos**: Actualizar `generarCodigoPeriodo()` con formatos `T-2026-T1`, `S-2026-S1`
4. **Labels**: Actualizar `generarLabelPeriodo()` con nombres en español
5. **UI**: Agregar opciones en diálogos de apertura y labels en componentes
6. **Guard**: Actualizar orden de resolución de período activo
7. **Tests**: Suite completa para las nuevas transiciones y jerarquía
8. **Migración**: Prisma migration del enum

### Excluye

- Períodos `SEMANAL` (no hay demanda, agrega complejidad innecesaria)
- Lógica diferencial de categoría fiscal para trimestral/semestral (EXTRAORDINARIO, RECTIFICATIVO)
- Cierre automático de trimestres (se puede agregar después)
- Compresión de snapshots históricos

## Files Affected

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar `TRIMESTRAL`, `SEMESTRAL` al enum `TipoPeriodo` |
| `src/lib/services/periodo-contable-types.ts` | Sin cambios (re-export de Prisma) |
| `src/lib/services/periodo-contable-service.ts` | `_hijoTipo()`, `resolverPeriodoPadre()`, `resolverPeriodoActivo()`, `generarCodigoPeriodo()` |
| `src/features/contabilidad/components/periodos/abrir-periodo-dialog.tsx` | Agregar items al Select |
| `src/features/contabilidad/components/periodos/periodos-page-client.tsx` | Agregar `TIPO_LABELS` |
| `src/features/contabilidad/components/periodos/cerrar-periodo-dialog.tsx` | Agregar `TIPO_LABELS` |
| `src/features/contabilidad/components/periodo-activo-indicator.tsx` | Agregar case en `formatPeriodoLabel()` |
| `src/features/contabilidad/__tests__/actions-periodos.test.ts` | Tests para TRIMESTRAL y SEMESTRAL |

## Rollback Plan

1. **Si la migration falla**: `prisma db push` no tiene rollback automático. Se revierte con `prisma migrate reset` (solo dev) o restaurando la DB del backup.
2. **Si el código falla en runtime**: Los valores nuevos en un enum de Prisma son retrocompatibles con queries existentes mientras no se filtren por tipo. Los períodos existentes siguen funcionando. Rollback = revertir el código y hacer `prisma db push` con el enum original.
3. **Si un test falla**: Corregir el test o el código según el error. No hay riesgo de datos porque los tests usan mocks.

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Prisma enum migration no soporta `db push` con cambios en enum PostgreSQL | Baja | Usar `prisma migrate dev` que genera ALTER TYPE |
| Jerarquía incorrecta al resolver período padre | Media | Tests exhaustivos de resolución con fechas reales |
| UI muestra labels incorrectos | Baja | Mapeo centralizado de labels |
| Períodos legacy interfieren con nueva jerarquía | Baja | La búsqueda legacy por fechas sigue funcionando como fallback |
