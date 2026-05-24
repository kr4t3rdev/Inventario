# Tasks: Tanda 2 — Apertura Formal, Jerarquía y Aprobación Multinivel

## Overview

**Total de tasks**: 8
**Orden**: Schema → Services → Actions → UI → Tests
**Estimación**: ~700 líneas

---

## Phase 1: Schema + Migración

- [ ] 1.1 Agregar campos a `PeriodoContable`: `codigo`, `periodoPadreId`, `abiertoPorId`, `fechaApertura`, `reabiertoPorId`, `fechaReapertura`, `segundoAprobadorId`, `aperturaAutomatica`
- [ ] 1.2 Agregar modelo `AperturaPeriodo` con 7 saldos + relaciones
- [ ] 1.3 Agregar self-relation `PeriodoHierarchy` en PeriodoContable
- [ ] 1.4 Cambiar unique constraint a `@@unique([tenantId, codigo])`
- [ ] 1.5 Ejecutar `prisma db push`

## Phase 2: Services

- [ ] 2.1 En `periodo-contable-service.ts`: agregar `generarCodigoPeriodo(tipo, fechaInicio)` basado en `buildPeriodCode` de la rama
- [ ] 2.2 En `periodo-contable-service.ts`: actualizar `abrirPeriodo` para:
  - Generar `codigo` y `periodoPadreId` (buscar padre por fechas)
  - Registrar `abiertoPorId`, `fechaApertura`
  - Cambiar estado de BORRADOR a ABIERTO explícitamente
- [ ] 2.3 En `periodo-contable-service.ts`: actualizar `cerrarPeriodo` para validar que todos los `subperiodos` (hijos) estén CERRADOS/APROBADOS
- [ ] 2.4 En `periodo-contable-service.ts`: actualizar `aprobarPeriodo` para validar que quien cierra no es quien aprueba (multilevel), y registrar `segundoAprobadorId` en segunda aprobación
- [ ] 2.5 En `periodo-contable-service.ts`: actualizar `reabrirPeriodo` para registrar `reabiertoPorId`, `fechaReapertura`
- [ ] 2.6 Crear `src/lib/services/apertura-periodo-service.ts`: `deriveOpeningBalances()` y `createAperturaPeriodo()` para arrastrar saldos del período anterior

## Phase 3: Actions

- [ ] 3.1 Actualizar `abrirPeriodoAction` para: generar codigo, crear AperturaPeriodo con saldos, usar nuevo flujo BORRADOR→ABIERTO
- [ ] 3.2 Actualizar `aprobarPeriodoAction` con validación multinivel
- [ ] 3.3 Actualizar `listarPeriodosAction` para incluir jerarquía (periodoPadreId, subperiodos count)
- [ ] 3.4 Actualizar `obtenerPeriodoAction` para incluir apertura + subperiodos

## Phase 4: UI

- [ ] 4.1 Mostrar `codigo` en listado (reemplaza fechas como identificador principal)
- [ ] 4.2 Mostrar jerarquía (badge de período padre)
- [ ] 4.3 Mostrar info de apertura en detalle/timeline
- [ ] 4.4 Mostrar info de aprobación (quién cerró, quién aprobó, segunda aprobación)

## Phase 5: Testing

- [ ] 5.1 Actualizar tests de acciones para nuevo flujo (codigo, apertura, jerarquía)
- [ ] 5.2 Actualizar tests de servicio para jerarquía y multinivel
- [ ] 5.3 Tests de `apertura-periodo-service.ts`
