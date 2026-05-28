# Tasks: Tipos TRIMESTRAL y SEMESTRAL en Períodos Contables

## Tareas

**Total**: 5 fases, ~8 tareas atómicas
**Estimación**: ~150 líneas modificadas + migración
**Tag**: `t2-trimestral-semestral`

---

### Fase 1: Schema + Migración

Duración estimada: 5 min
Archivos: `prisma/schema.prisma`
Requiere: —

- [ ] **1.1** — Agregar `TRIMESTRAL` y `SEMESTRAL` al enum `TipoPeriodo` en `prisma/schema.prisma`
- [ ] **1.2** — Ejecutar `prisma migrate dev --name add-trimestral-semestral`
- [ ] **1.3** — Ejecutar `prisma generate` y verificar typecheck

**Criterio de éxito**: `pnpm run typecheck` pasa, `src/generated/prisma/index.d.ts` incluye los nuevos valores.

---

### Fase 2: Service — Jerarquía y Códigos

Duración estimada: 15 min
Archivos: `src/lib/services/periodo-contable-service.ts`, `src/lib/services/periodo-contable-types.ts`
Requiere: Fase 1

- [ ] **2.1** — En `periodo-contable-service.ts`: agregar `case TipoPeriodo.TRIMESTRAL` y `case TipoPeriodo.SEMESTRAL` en `generarCodigoPeriodo()` con formatos `T-{year}-T{1..4}` y `S-{year}-S{1..2}`
- [ ] **2.2** — En `periodo-contable-types.ts`: agregar cases en `generarLabelPeriodo()` para TRIMESTRAL (`T1 2026`) y SEMESTRAL (`S1 2026`)
- [ ] **2.3** — En `periodo-contable-service.ts`: actualizar `_hijoTipo()` para la nueva jerarquía: `ANUAL→SEMESTRAL→TRIMESTRAL→MENSUAL→DIARIO`
- [ ] **2.4** — En `periodo-contable-service.ts`: actualizar `resolverPeriodoPadre()` para mapear los nuevos tipos a su padre
- [ ] **2.5** — En `periodo-contable-service.ts`: actualizar `resolverPeriodoActivo()` para incluir `TRIMESTRAL` y `SEMESTRAL` en el orden de búsqueda

**Criterio de éxito**: `generarCodigoPeriodo('TRIMESTRAL', new Date('2026-01-15')) === 'T-2026-T1'`
**Criterio de éxito**: `_hijoTipo('ANUAL') === 'SEMESTRAL'`, `_hijoTipo('SEMESTRAL') === 'TRIMESTRAL'`
**Criterio de éxito**: `resolverPeriodoPadre()` encuentra el SEMESTRAL para un TRIMESTRAL

---

### Fase 3: UI — Labels y Selects

Duración estimada: 10 min
Archivos: ver lista abajo
Requiere: Fase 2

- [ ] **3.1** — En `periodos-page-client.tsx`: agregar `TRIMESTRAL: "Trimestral"` y `SEMESTRAL: "Semestral"` en `TIPO_LABELS`
- [ ] **3.2** — En `periodos-page-client.tsx`: agregar items en el Select de filtro de tipo
- [ ] **3.3** — En `cerrar-periodo-dialog.tsx`: agregar labels en `TIPO_LABELS`
- [ ] **3.4** — En `reabrir-periodo-dialog.tsx`: agregar labels en `TIPO_LABELS`
- [ ] **3.5** — En `abrir-periodo-dialog.tsx`: agregar items `<SelectItem value="TRIMESTRAL">` y `<SelectItem value="SEMESTRAL">`
- [ ] **3.6** — En `periodo-activo-indicator.tsx`: agregar cases TRIMESTRAL y SEMESTRAL en `formatPeriodoLabel()`

**Criterio de éxito**: El Select de tipo en el diálogo de apertura muestra "Trimestral" y "Semestral"
**Criterio de éxito**: El header muestra "T1 2026" para un período trimestral activo

---

### Fase 4: Tests

Duración estimada: 15 min
Archivos: `src/features/contabilidad/__tests__/actions-periodos.test.ts`
Requiere: Fase 2

- [ ] **4.1** — Test: `abrirPeriodoAction` con tipo `TRIMESTRAL` crea el período correctamente
- [ ] **4.2** — Test: `abrirPeriodoAction` con tipo `SEMESTRAL` crea el período correctamente
- [ ] **4.3** — Test: códigos generados correctamente para TRIMESTRAL y SEMESTRAL
- [ ] **4.4** — Test: `resolverPeriodoPadre` resuelve correctamente TRIMESTRAL→SEMESTRAL y SEMESTRAL→ANUAL
- [ ] **4.5** — Test: jerarquía de cierre: cerrar SEMESTRAL falla si tiene TRIMESTRALes hijos abiertos

**Criterio de éxito**: `pnpm run test:run` 100% pasando

---

### Fase 5: Post-implementation Fragility Scan

Duración estimada: 10 min
Requiere: Fase 4

- [ ] **5.1** — Ejecutar todos los tests (`pnpm run test:run`)
- [ ] **5.2** — Re-leer y analizar `periodo-contable-service.ts`, `actions-periodos.ts`, `periodo-contable-types.ts`, `periodo-contable-guard.ts` en busca de puntos frágiles
- [ ] **5.3** — Re-leer `periodo-snapshot-service.ts` y `apertura-periodo-service.ts` para detectar dependencias del enum TipoPeriodo
- [ ] **5.4** — Compilar informe de puntos frágiles

**Criterio de éxito**: Informe documentado de puntos frágiles encontrados post-implementación
