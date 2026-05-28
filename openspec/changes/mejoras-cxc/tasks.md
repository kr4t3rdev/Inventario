# Mejoras Cuentas por Cobrar — Tareas

Estimación de líneas totales: ~380 líneas (< 400, PR único)

## Tareas por orden de dependencia

### T1: Schema — agregar campo search
**Archivo:** `src/features/contabilidad/schemas-cuentas.ts`
Agregar `search: z.string().optional()` a `getCuentasPorCobrarSchema`.

### T2: Actions — búsqueda textual + aging + métricas + tipado
**Archivo:** `src/features/contabilidad/actions-cuentas.ts`
- Agregar filtro `search` en `getCuentasPorCobrarAction` (OR sobre cliente.nombre y numeroFactura)
- Agregar `diasTranscurridos` y `rangoAntiguedad` a `CuentaPorCobrarEnriquecida`
- Implementar `getCxcMetricsAction` con total pendiente, vencidas, por vencer, total cuentas
- Refactor `enriquecerCuentaPorCobrar` para tipado fuerte

### T3: Índice — exportar nueva action
**Archivo:** `src/features/contabilidad/index.ts`
Exportar `getCxcMetricsAction` y su tipo.

### T4: UI — reemplazar columna Pagado por Pendiente
**Archivo:** `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx`
- Eliminar columna `montoPagado`
- Renombrar columna "Saldo" a "Pendiente"
- Agregar columna "Antigüedad" con AgingBadge
- Props: agregar `page`, `totalPages`, `onPageChange`

### T5: Página — dashboard + paginación real + búsqueda server-side
**Archivo:** `src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx`
- Reemplazar `limit: 1000` por paginación server-side con `page`/`limit` state
- Agregar cards de dashboard con métricas
- Búsqueda ahora dispara refetch con `search` parameter

### T6: Tests — createCuentaPorCobrarAction
**Archivo:** `src/features/contabilidad/api/__tests__/cuentas-por-cobrar-create.test.ts`
Testear AUTH_REQUIRED, NOT_FOUND, DUPLICATE, creación exitosa.
