# Mejoras Cuentas por Cobrar — Propuesta

## Resumen

Mejoras integrales al módulo de Cuentas por Cobrar (CxC) para agregar funcionalidades críticas de gestión de cobranza: dashboard de métricas, búsqueda textual, antigüedad de saldos, paginación real, y fortalecimiento de tipos y tests.

## Cambios Propuestos

| # | Mejora | Prioridad | Complejidad | Archivos Afectados |
|---|--------|-----------|-------------|-------------------|
| 1 | Reemplazar columna "Pagado" por "Saldo Pendiente" | Alta | Baja | `cuentas-por-cobrar-table.tsx` |
| 2 | Dashboard de métricas (total pendiente, vencidas, etc.) | Alta | Media | `page.tsx` (CxC page) |
| 3 | Búsqueda textual por cliente y factura | Alta | Baja | `schemas-cuentas.ts`, `actions-cuentas.ts`, `page.tsx` |
| 4 | Aging de saldos (antigüedad 0-30, 31-60, 61-90, 90+) | Media | Media | `actions-cuentas.ts`, `cuentas-por-cobrar-table.tsx` |
| 5 | Paginación real en UI (reemplazar limit:1000) | Media | Media | `page.tsx`, `cuentas-por-cobrar-table.tsx` |
| 6 | Tests de createCuentaPorCobrarAction | Media | Baja | Nuevo test file |
| 7 | Tipado fuerte en enriquecerCuentaPorCobrar | Baja | Baja | `actions-cuentas.ts` |

## Enfoque

- Usar Server Actions existentes sin crear nuevas rutas API.
- Mantener compatibilidad con el contrato actual de `CuentaPorCobrarEnriquecida`.
- Seguir el patrón establecido de CxP para aging y búsqueda.

## Riesgos

- El cambio de columna "Pagado" por "Pendiente" puede confundir usuarios existentes → mitigar moviendo la columna, no eliminando datos.
- Paginación real cambia el fetching actual → mantener `limit` default alto pero paginable.
- Ningún cambio es riesgoso individualmente.
