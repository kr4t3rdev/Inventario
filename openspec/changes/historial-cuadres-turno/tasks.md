# Tasks: Historial de Cuadres por Turno

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 320-430 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 historial + action + tests / PR 2 readonly detail + warning + tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Publicar historial de cuadres cerrados | PR 1 | Base main; incluye action, page client y estados vacío/carga |
| 2 | Endurecer detalle readonly para turnos cerrados | PR 2 | Depende de PR 1 solo por navegación; incluye warning y tests |

## Phase 1: Foundation

- [x] 1.1 Crear `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/actions-historial.ts` con `withAction`, filtro `estado: 'CERRADO'`, último arqueo y total de ventas por turno.
- [x] 1.2 Exportar `getCuadresCerradosAction` y el tipo `CuadreCerradoListItem` desde `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/index.ts`.
- [x] 1.3 Extender `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/actions-cuadre.ts` para devolver `turno.estado` y `turno.fechaCierre`.

## Phase 2: Core Implementation

- [x] 2.1 Crear `/Users/arturo/Documents/Proyecto Inventario/TCP/src/app/busy/sales/cuadres/page.tsx` como entry server que cargue el historial inicial.
- [x] 2.2 Crear `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/components/cuadres-history-page-client.tsx` con shell tipo auditoría, tabla desktop y cards mobile.
- [x] 2.3 Mostrar por fila PV, empleado, fecha de cierre, total ventas, diferencia del último arqueo y CTA `Ver cuadre`.
- [x] 2.4 Modificar `/Users/arturo/Documents/Proyecto Inventario/TCP/src/app/busy/sales/cuadre/[turnoId]/page.tsx` para calcular `isReadOnly` cuando el turno esté cerrado.
- [x] 2.5 En modo readonly, ocultar `Cerrar Turno` y `Repetir Arqueo`, mostrar badge “Consulta histórica” y advertencia: “El bloque de inventario no es un snapshot histórico exacto”.

## Phase 3: Integration / Wiring

- [x] 3.1 Asegurar navegación desde el historial a `/busy/sales/cuadre/[turnoId]` manteniendo contexto `?from=history` si aporta retorno claro.
- [x] 3.2 Ajustar estados vacío/error/carga del historial siguiendo el patrón visual de reportes financieros existente.
- [x] 3.3 Verificar que el detalle siga funcionando para turnos abiertos sin regresiones del flujo actual de cierre.

## Phase 4: Testing

- [x] 4.1 Agregar casos Vitest en `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/__tests__/actions.test.ts` para listar solo turnos cerrados y tolerar empleado/arqueo nulos.
- [x] 4.2 Agregar casos en `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/turnos-pos/__tests__/actions-cuadre.test.ts` para payload de turno cerrado con `estado` y `fechaCierre`.
- [x] 4.3 Cubrir con Testing Library el modo readonly: badge visible, warning histórico visible y botones mutables ausentes.

## Phase 5: Cleanup / Verification

- [x] 5.1 Ejecutar `pnpm run test:run` focalizado sobre `turnos-pos` y corregir regresiones antes de commitear.
- [x] 5.2 Separar commits por work unit: `feat(turnos-pos): add closed shift settlement history` y `feat(turnos-pos): lock closed settlement detail view`.
