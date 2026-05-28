# Design: Implementación de TRIMESTRAL y SEMESTRAL

## Estrategia

**Capa por capa, de abajo hacia arriba**: Schema → Service → Actions → UI → Tests.

Cada fase produce un commit atómico con tests que pasan antes de pasar a la siguiente.

## Capas de Implementación

### Fase 1: Schema + Migración (1 commit)

**Archivos**: `prisma/schema.prisma`

1. Agregar `TRIMESTRAL` y `SEMESTRAL` al enum `TipoPeriodo`
2. Ejecutar `prisma migrate dev --name add-trimestral-semestral`
3. Ejecutar `prisma generate`
4. Verificar que `src/generated/prisma/index.d.ts` incluya los nuevos valores

**Test de verificación**: compilar TypeScript (`pnpm run typecheck`)

### Fase 2: Service — Jerarquía y Códigos (1 commit)

**Archivo**: `src/lib/services/periodo-contable-service.ts`

Cambiar en orden:

1. **`generarCodigoPeriodo()`**: agregar cases TRIMESTRAL y SEMESTRAL
2. **`generarLabelPeriodo()`**: agregar cases TRIMESTRAL y SEMESTRAL (en `periodo-contable-types.ts`)
3. **`_hijoTipo()`**: ANUAL → SEMESTRAL → TRIMESTRAL → MENSUAL → DIARIO
4. **`resolverPeriodoPadre()`**: mapear nuevos tipos a su padre
5. **`resolverPeriodoActivo()`**: incluir TRIMESTRAL y SEMESTRAL en orden de búsqueda

**Tests unitarios**: test específico de jerarquía y códigos.

### Fase 3: UI — Labels y Selects (1 commit)

**Archivos**:
- `src/features/contabilidad/components/periodos/abrir-periodo-dialog.tsx`
- `src/features/contabilidad/components/periodos/periodos-page-client.tsx`
- `src/features/contabilidad/components/periodos/cerrar-periodo-dialog.tsx`
- `src/features/contabilidad/components/periodos/reabrir-periodo-dialog.tsx`
- `src/features/contabilidad/components/periodo-activo-indicator.tsx`

Agregar labels y opciones. No hay lógica nueva, solo mapeo visual.

### Fase 4: Tests de Integración (1 commit)

**Archivo**: `src/features/contabilidad/__tests__/actions-periodos.test.ts`

Agregar tests para:
- `abrirPeriodoAction` con tipo TRIMESTRAL y SEMESTRAL
- `cerrarPeriodoAction` con jerarquía TRIMESTRAL→MENSUAL
- Verificar que `generarCodigoPeriodo` produce los códigos correctos
- Verificar que `resolverPeriodoPadre` encuentra el padre correcto

### Fase 5: Post-implementation fragility scan

Ejecutar los tests existentes, verificar que no haya regresiones, y hacer un scan de puntos frágiles.

## Orden de Commits

```
1. feat(periodos): add TRIMESTRAL and SEMESTRAL to TipoPeriodo enum
2. feat(periodos): hierarchy, codes and labels for TRIMESTRAL/SEMESTRAL
3. feat(periodos): UI labels and selects for new period types
4. test(periodos): integration tests for TRIMESTRAL/SEMESTRAL
5. chore(periodos): post-implementation fragility scan
```

## Validación en Cada Commit

Cada commit MUST pasar:
1. `pnpm run typecheck` — sin errores de tipo
2. `pnpm run test:run` — todos los tests pasando
3. `pnpm run lint` — sin errores de linter

El pipeline de CI fallará si alguno de estos falla, así que se verifica localmente antes de cada commit.
