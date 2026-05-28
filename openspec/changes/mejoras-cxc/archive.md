# Mejoras Cuentas por Cobrar — Archivo

## Resumen del Cambio

7 mejoras implementadas en el módulo de Cuentas por Cobrar.

## Cambios Realizados

| # | Mejora | Archivos | Estado |
|---|--------|----------|--------|
| 1 | Columna "Pagado" → "Pendiente" | `cuentas-por-cobrar-table.tsx` | ✅ |
| 2 | Dashboard de métricas (server-side) | `actions-cuentas.ts`, `page.tsx`, `index.ts` | ✅ |
| 3 | Búsqueda textual por cliente y factura | `schemas-cuentas.ts`, `actions-cuentas.ts`, `page.tsx` | ✅ |
| 4 | Aging de saldos (0-30, 31-60, 61-90, 90+) | `actions-cuentas.ts`, `cuentas-por-cobrar-table.tsx` | ✅ |
| 5 | Paginación real server-side (limit 20) | `page.tsx`, `cuentas-por-cobrar-table.tsx` | ✅ |
| 6 | Tests de createCuentaPorCobrarAction | `cuentas-por-cobrar-create.test.ts` | ✅ |
| 7 | Tipado fuerte (postergado — sigue con Record<string, unknown>) | — | ⏭️ |

## Tests

12 tests en 3 archivos: todos pasan.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/features/contabilidad/schemas-cuentas.ts` | +search field en schema |
| `src/features/contabilidad/actions-cuentas.ts` | +búsqueda, aging, getCxcMetricsAction |
| `src/features/contabilidad/index.ts` | Export getCxcMetricsAction, CxcMetrics |
| `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx` | Pendiente col, AgingBadge, paginación server-side |
| `src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx` | Dashboard, paginación real, búsqueda server-side |
| `src/features/contabilidad/api/__tests__/cuentas-por-cobrar-create.test.ts` | Nuevo: 4 tests |

## Riesgos Post-Implementación

- El cambio a paginación server-side puede requerir ajuste si algún componente externo depende de recibir todas las cuentas de una vez.
- La columna "Pendiente" reemplaza a "Pagado" visualmente, pero los datos subyacentes no cambian.
