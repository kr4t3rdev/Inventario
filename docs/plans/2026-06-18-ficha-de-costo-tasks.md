# Tasks: Módulo Ficha de Costo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700-950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 cálculo+tests → PR2 actions+ruta → PR3 UI+PDF |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Capa de cálculo pura + tests | PR 1 | Base autónoma; sin UI |
| 2 | Actions + page route + wiring inicial | PR 2 | Depende de PR 1 |
| 3 | UI completa + PDF + polish | PR 3 | Depende de PR 2 |

## Phase 1: Foundation

- [x] T-001 RED: crear `src/features/ficha-costo/__tests__/cost-calculator.test.ts` con escenarios FR-001, FR-002, FR-004 y FR-006.
  Verificación: `pnpm test -- src/features/ficha-costo/__tests__/cost-calculator.test.ts` falla primero.
- [x] T-002 crear `src/features/ficha-costo/lib/cost-calculator.ts` con `calcularCPP`, `calcularCostoMateriales`, `normalizarMoneda`, `calcularMargen`.
  Archivos: `src/features/ficha-costo/lib/cost-calculator.ts`. Verificación: tests unitarios en verde.
- [ ] T-003 refactorizar helpers/tipos compartidos de ficha de costo para evitar duplicación entre actions y UI.
  Archivos: `src/features/ficha-costo/lib/*`. Verificación: lint + tests unitarios.

## Phase 2: Data / Server Actions

- [x] T-004 RED: crear `src/features/ficha-costo/__tests__/actions.test.ts` para tenant isolation, producto inexistente, sin compras, moneda mixta.
  Verificación: `pnpm test -- src/features/ficha-costo/__tests__/actions.test.ts` falla primero.
- [x] T-005 implementar `src/features/ficha-costo/actions.ts` con `getFichaCostoAction` y batch CPP lookup para compuestos.
  Depends on: T-002. Archivos: `actions.ts`. Verificación: tests de actions en verde.
- [ ] T-006 implementar `getHistorialCostosAction` con filtros y paginación de 20 items.
  Archivos: `actions.ts`. Verificación: escenarios FR-003 cubiertos.
- [ ] T-007 implementar `getComposicionCostoAction` con inputs manuales de MO/indirectos sin persistencia.
  Archivos: `actions.ts`. Verificación: escenarios FR-002 cubiertos.

## Phase 3: Routing / Integration

- [x] T-008 crear `src/app/busy/products/[id]/ficha-costo/page.tsx` y `src/features/ficha-costo/components/ficha-costo-page.tsx`.
  Depends on: T-005. Verificación: acceso directo por URL + 404 para producto inexistente.
- [x] T-009 modificar `src/app/busy/products/[id]/page.tsx` (o componente equivalente) para agregar botón “Ver ficha de costo”.
  Depends on: T-008. Verificación: navegación FR-005 funcionando.

## Phase 4: UI

- [ ] T-010 RED: crear `src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx` para loading, empty, error, tabs y margen.
  Verificación: test falla primero.
- [x] T-011 implementar `ficha-costo-view.tsx`, `ficha-costo-header.tsx`, `resumen-costo.tsx`, `indicador-margen.tsx`.
  Depends on: T-008. Verificación: FR-001 y FR-004 visibles en UI.
- [ ] T-012 implementar `composicion-costo.tsx` e `historial-costos.tsx` con filtros, paginación y accesibilidad.
  Depends on: T-006, T-007. Verificación: FR-002, FR-003 y NFR-003 cubiertos.
- [ ] T-013 implementar `ficha-costo-pdf.tsx` con export del resumen e historial resumido.
  Depends on: T-011, T-012. Verificación: FR-007.

## Phase 5: Verification / Cleanup

- [x] T-014 ejecutar suite focal: unit + actions + UI + lint; corregir rounding, warnings y estados vacíos.
  Verificación: `pnpm test -- src/features/ficha-costo` y `pnpm run lint`.
- [x] T-015 validar budget de review y preparar corte por work units para Apply.
  Verificación: diff estimado por unidad y orden final de implementación.
