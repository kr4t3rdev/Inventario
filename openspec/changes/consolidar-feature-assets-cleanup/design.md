# Design: Consolidar Feature Assets y Limpieza Post-Migración

## Technical Approach

El enfoque es un refactor estructural en 5 fases secuenciales, cada una con commit independiente y validación. No se modifica lógica de negocio — solo ubicaciones de archivos e imports.

### Fases

1. **Fase 1a — Consolidar imports de componentes en `app/busy/`**: Reemplazar ~21 imports `@/components/<feature>/` → `@/features/<feature>/components/` donde el componente ya existe en destino.
2. **Fase 1b — Migrar imports de Redux API slices**: Reemplazar 103 imports desde `@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>`.
3. **Fase 1c — Migrar imports de servicios workflow**: Reemplazar 65 imports desde `@/lib/services/<service>` → `@/features/<feature>/api/handlers` o ruta directa del feature.
4. **Fase 2 — Migrar hooks a features**: Mover hooks con owner de dominio a `src/features/<feature>/hooks/` y actualizar imports.
5. **Fase 3 — Copiar componentes faltantes**: Copiar componentes de `src/components/<feature>/` que no existen en `src/features/<feature>/components/`.
6. **Fase 4 — Cleanup final**: Eliminar directorios duplicados en `src/components/`, eliminar re-exports en `lib/`, validar con `typecheck` + `test:run`.

## Architecture Decisions

### Decision: Hooks shared permanecen en `src/hooks/`

**Choice**: Hooks genuinamente cross-cutting (`use-debounce`, `use-mobile`, `use-pagination`, etc.) permanecen en `src/hooks/`.
**Alternatives considered**: Mover todo a `src/shared/hooks/`.
**Rationale**: El costo de mover ~12 hooks shared y actualizar todos sus consumers no justifica el beneficio. `src/hooks/` ya es una convención establecida en el proyecto para utilidades React. Solo los hooks con owner de dominio se migran.

### Decision: No mover componentes shared (`data-table`, `animations`, `cards`, `Loaders`)

**Choice**: Componentes que no pertenecen a un dominio específico permanecen en `src/components/`.
**Alternatives considered**: Crear `src/shared/components/`.
**Rationale**: Igual que con hooks, el costo de reubicar componentes shared no está justificado por este cambio. El objetivo es co-locar assets feature-specific, no reestructurar todo el codebase.

### Decision: Copiar, no mover, en Fase 3

**Choice**: Los componentes faltantes se COPIAN a `src/features/` antes de actualizar imports; los originales se eliminan solo en Fase 4 tras validación.
**Alternatives considered**: Mover directamente.
**Rationale**: Mitiga riesgo de imports rotos. Si un import se nos escapa, el componente original sigue existiendo y TypeScript no falla. La deuda de duplicación se resuelve al final.

### Decision: Actualizar re-exports ANTES de eliminarlos

**Choice**: Fases 1b y 1c migran todos los consumers ANTES de tocar los re-exports.
**Alternatives considered**: Eliminar re-exports primero y dejar que el compilador encuentre los imports rotos.
**Rationale**: El compilador encontraría ~168 imports rotos simultáneamente (103 + 65), lo que haría difícil rastrear y fixear. Migrando consumers primero, cada cambio es verificable incrementalmente.

### Decision: Preservar `apiSlice.tsx` en `src/lib/redux/services/`

**Choice**: `apiSlice.tsx` (infrastructure de Redux Toolkit Query) permanece en `src/lib/redux/services/`.
**Alternatives considered**: Mover a `src/shared/redux/`.
**Rationale**: Es infraestructura shared que define la base de todas las API slices. No pertenece a ningún feature. Mantenerlo en `lib/` es apropiado.

## Data Flow

No cambia. Este es un refactor estructural puro.

```
Antes:
  app/busy/page.tsx ──→ @/components/productos/productos-form
                     ──→ @/lib/redux/services/productosApi
                     ──→ @/hooks/use-category-form

Después:
  app/busy/page.tsx ──→ @/features/productos/components/productos-form
                     ──→ @/features/productos/api/productosApi
                     ──→ @/features/categorias/hooks/use-category-form
```

## File Changes

### Fase 1a: Consolidar imports de componentes en app/busy/

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/products/edit/[id]/page.tsx` | Modify | 4 imports: `@/components/productos/*` → `@/features/productos/components/*` |
| `src/app/busy/products/bulk-stock-minimo/page.tsx` | Modify | 1 import: `@/components/productos/bulk-stock-minimo-manager` → `@/features/productos/components/bulk-stock-minimo-manager` |
| `src/app/busy/produccion/page.tsx` | Modify | 3 imports: `@/components/produccion/*` → `@/features/produccion/components/*` (tras copiar) |
| `src/app/busy/servicios/prestados/page.tsx` | Modify | 1 import: `@/components/servicios` → `@/features/servicios/components/` (tras copiar index) |
| `src/app/busy/servicios/recibidos/page.tsx` | Modify | 1 import: `@/components/servicios` → `@/features/servicios/components/` (tras copiar index) |
| `src/app/busy/contabilidad/*/page.tsx` (6 files) | Modify | Imports `@/components/contabilidad/*` → `@/features/contabilidad/components/*` (tras copiar) |
| `src/app/busy/compras-productos/new/page.tsx` | Modify | 1 import: `@/components/compras/compra-producto-form` → `@/features/compras-productos/components/compra-producto-form` (tras copiar) |
| `src/app/busy/compras-productos/page.tsx` | Modify | 1 import: `@/components/data-table` → se evalúa si es shared |
| `src/app/busy/configuracion/catalogo/page.tsx` | Modify | 1 import: `@/components/catalog/defectaciones-editor-panel` → `@/features/configuracion/components/defectaciones-editor-panel` (tras copiar) |
| `src/app/busy/configuracion/usuarios/page.tsx` | Modify | 1 import: `@/components/tenant-users/tenant-users-page` → `@/features/tenant-users/components/tenant-users-page` (tras copiar) |
| `src/app/busy/cuadre/page.tsx` | Modify | 1 import: `@/components/cuadre_diario/cuadre-page-client` → `@/features/cuadre-diario/components/cuadre-page-client` (tras copiar) |
| `src/app/busy/reportes/page.tsx` | Modify | 1 import: `@/components/reportes/reportes-page-client` → `@/features/reportes-financieros/components/reportes-page-client` (tras copiar) |

### Fase 1b: Migrar imports de Redux API slices

| File | Action | Description |
|------|--------|-------------|
| ~51 files en `src/components/` | Modify | Imports `@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>` |
| ~16 files en `src/app/busy/` | Modify | Imports `@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>` |
| ~32 files en `src/features/` | Modify | Imports `@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>` |
| ~4 files en `src/lib/` | Modify | Imports `@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>` |

### Fase 1c: Migrar imports de servicios workflow

| File | Action | Description |
|------|--------|-------------|
| ~40 files en `src/app/api/contabilidad/` | Modify | Imports `@/lib/services/<workflow>` → `@/features/contabilidad/api/<workflow>` |
| ~8 files en `src/app/api/produccion/` | Modify | Imports `@/lib/services/<workflow>` → `@/features/produccion/api/<workflow>` |
| ~4 files en `src/app/api/anticipos/`, `mi-empresa/` | Modify | Imports `@/lib/services/<workflow>` → feature directo |
| ~8 files en `src/app/api/contabilidad/**/__tests__/` | Modify | Imports de tests a servicios |
| ~5 files en `src/lib/services/` | Evaluate | Determinar si son re-export o shared genuine |

### Fase 2: Migrar hooks a features

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/use-category-form.ts` | Move | → `src/features/categorias/hooks/use-category-form.ts` |
| `src/hooks/use-category-validation.tsx` | Move | → `src/features/categorias/hooks/use-category-validation.tsx` |
| `src/hooks/use-admin-users-filters.ts` | Move | → `src/features/admin/hooks/use-admin-users-filters.ts` |
| `src/hooks/use-ventas.tsx` | Move | → `src/features/ventas/hooks/use-ventas.tsx` |
| `src/hooks/use-transferencias.tsx` | Move | → `src/features/transferencias/hooks/use-transferencias.tsx` |
| `src/hooks/use-profile.ts` | Move | → `src/features/profile/hooks/use-profile.ts` |
| `src/hooks/use-real-time-exchange.ts` | Move | → `src/features/exchange/hooks/use-real-time-exchange.ts` |
| `src/hooks/use-treasury-integration.ts` | Move | → `src/features/contabilidad/hooks/use-treasury-integration.ts` |
| `src/hooks/use-notifications.ts` | Move | → `src/features/notificaciones/hooks/use-notifications.ts` |
| ~15 consumer files | Modify | Actualizar imports de hooks movidos |

### Fase 3: Copiar componentes faltantes a features

| File | Action | Description |
|------|--------|-------------|
| `src/components/compras/compra-producto-form.tsx` | Copy | → `src/features/compras-productos/components/compra-producto-form.tsx` |
| `src/components/contabilidad/contabilidad-breadcrumb.tsx` | Copy | → `src/features/contabilidad/components/contabilidad-breadcrumb.tsx` |
| `src/components/contabilidad/deudas-cash-stats-widget.tsx` | Copy | → `src/features/contabilidad/components/deudas-cash-stats-widget.tsx` |
| `src/components/contabilidad/reconciliacion-gastos-form.tsx` | Copy | → `src/features/contabilidad/components/reconciliacion-gastos-form.tsx` |
| `src/components/contabilidad/reconciliacion-gastos-page.tsx` | Copy | → `src/features/contabilidad/components/reconciliacion-gastos-page.tsx` |
| `src/components/contabilidad/reconciliacion-servicios-page.tsx` | Copy | → `src/features/contabilidad/components/reconciliacion-servicios-page.tsx` |
| `src/components/contabilidad/reconciliacion-ventas-page.tsx` | Copy | → `src/features/contabilidad/components/reconciliacion-ventas-page.tsx` |
| `src/components/produccion/production-dialogs.tsx` | Copy | → `src/features/produccion/components/production-dialogs.tsx` |
| `src/components/produccion/recipe-editor-dialog.tsx` | Copy | → `src/features/produccion/components/recipe-editor-dialog.tsx` |
| `src/components/produccion/recipe-output-selector.tsx` | Copy | → `src/features/produccion/components/recipe-output-selector.tsx` |
| `src/components/servicios/index.tsx` (o equivalente) | Copy | → `src/features/servicios/components/index.tsx` |
| `src/components/catalog/defectaciones-editor-panel.tsx` | Copy | → `src/features/configuracion/components/defectaciones-editor-panel.tsx` |
| `src/components/tenant-users/tenant-users-page.tsx` | Copy | → `src/features/tenant-users/components/tenant-users-page.tsx` |
| `src/components/cuadre_diario/cuadre-page-client.tsx` | Copy | → `src/features/cuadre-diario/components/cuadre-page-client.tsx` |
| `src/components/reportes/reportes-page-client.tsx` | Copy | → `src/features/reportes-financieros/components/reportes-page-client.tsx` |

### Fase 4: Cleanup final

| File | Action | Description |
|------|--------|-------------|
| `src/components/productos/` | Delete | Duplicado de `src/features/productos/components/` |
| `src/components/contabilidad/` | Delete | Duplicado de `src/features/contabilidad/components/` |
| `src/components/produccion/` | Delete | Duplicado de `src/features/produccion/components/` |
| `src/components/servicios/` | Delete | Duplicado de `src/features/servicios/components/` |
| `src/components/compras/` | Delete | Migrado a `src/features/compras-productos/components/` |
| `src/components/catalog/` | Delete | Migrado a `src/features/configuracion/components/` |
| `src/components/tenant-users/` | Delete | Migrado a `src/features/tenant-users/components/` |
| `src/components/cuadre_diario/` | Delete | Migrado a `src/features/cuadre-diario/components/` |
| `src/components/reportes/` | Delete | Migrado a `src/features/reportes-financieros/components/` |
| `src/lib/redux/services/*` (excepto `apiSlice.tsx`) | Delete | Re-exports sin consumers |
| `src/lib/services/*` (excepto shared genuine) | Delete | Re-exports sin consumers |

## Interfaces / Contracts

No hay cambios en interfaces o contratos. Este es un refactor puro de ubicación.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | N/A | No lógica cambia |
| Integration | N/A | No lógica cambia |
| E2E | N/A | No lógica cambia |
| Structural | Resolución de imports | `pnpm run typecheck` después de cada fase |
| Structural | Lint compliance | `pnpm run lint` después de cada fase |
| Structural | Tests existentes | `pnpm run test:run` al finalizar |
| Structural | Validación de imports prohibidos | `grep` scripts para verificar cero imports cruzados |

## Migration / Rollout

### Rollout Plan

1. Crear rama `feat/consolidar-feature-assets`
2. Ejecutar Fase 1a → commit
3. Ejecutar Fase 1b → commit
4. Ejecutar Fase 1c → commit
5. Ejecutar Fase 2 → commit
6. Ejecutar Fase 3 → commit
7. Ejecutar Fase 4 → commit
8. PR con descripción detallada de cada fase

### Rollback Plan

Cada fase tiene commit independiente. Si algo falla post-merge:
- Revert individual por fase
- O revert completo de la rama
- Backup branch `backup/pre-cleanup` antes de Fase 4

## Open Questions

- [ ] ¿`data-table` es feature-specific o shared? Revisar su uso en `app/busy/compras-productos/page.tsx`.
- [ ] ¿Algunos servicios en `src/lib/services/` (ej: `tenant-scope.ts`, `audit-log-service.ts`) son genuinamente shared o deberían vivir en un feature? Se decidirá durante Fase 1c.
- [ ] ¿`src/components/__tests__/` contiene tests de componentes que pertenecen a features? Evaluar migración.

## Mapping de Re-exports a Features

### `src/lib/redux/services/` → Features

| Re-export File | Feature Destino | API File en Feature |
|---|---|---|
| `ventasApi.tsx` | `ventas/` | `api/ventasApi.tsx` |
| `productosApi.tsx` | `productos/` | `api/productosApi.tsx` |
| `contabilidadApi.tsx` | `contabilidad/` | `api/contabilidadApi.tsx` |
| `comprasProductosApi.tsx` | `compras-productos/` | `api/comprasProductosApi.tsx` |
| `comprasServiciosApi.ts` | `compras-servicios/` | `api/comprasServiciosApi.ts` |
| `serviciosApi.tsx` | `servicios/` | `api/serviciosApi.tsx` |
| `ventaServiciosApi.ts` | `venta-servicios/` | `api/ventaServiciosApi.ts` |
| `produccionApi.ts` | `produccion/` | `api/produccionApi.ts` |
| `empleadosApi.tsx` | `empleados/` | `api/empleadosApi.tsx` |
| `pagoSalarioApi.tsx` | `pago-salario/` | `api/pagoSalarioApi.tsx` |
| `profileApi.tsx` | `profile/` | `api/profileApi.tsx` |
| `adminApi.tsx` | `admin/` | `api/adminApi.tsx` |
| `almacenesApi.tsx` | `almacenes/` | `api/almacenesApi.tsx` |
| `categoriasApi.tsx` | `categorias/` | `api/categoriasApi.tsx` |
| `unidadesApi.tsx` | `unidades/` | `api/unidadesApi.tsx` |
| `vendorsApi.tsx` | `vendors/` | `api/vendorsApi.tsx` |
| `clientesApi.tsx` | `clientes/` | `api/clientesApi.tsx` |
| `transferenciasApi.tsx` | `transferencias/` | `api/transferenciasApi.tsx` |
| `mermasApi.tsx` | `mermas/` | `api/mermasApi.tsx` |
| `ofertasApi.tsx` | `ofertas/` | `api/ofertasApi.tsx` |
| `contratosApi.tsx` | `contratos/` | `api/contratosApi.tsx` |
| `facturasApi.tsx` | `facturas/` | `api/facturasApi.tsx` |
| `seriesFacturacionApi.tsx` | `series-facturacion/` | `api/seriesFacturacionApi.tsx` |
| `puntosDeVentaApi.tsx` | `puntos-venta/` | `api/puntosDeVentaApi.tsx` |
| `listasPreciosApi.ts` | `listas-precios/` | `api/listasPreciosApi.ts` |
| `cuentasPorCobrarApi.tsx` | `cxc/` | `api/cuentasPorCobrarApi.tsx` |
| `cuentasPorPagarApi.tsx` | `cxp/` | `api/cuentasPorPagarApi.tsx` |
| `deudasCashApi.tsx` | `deudas-cash/` | `api/deudasCashApi.tsx` |
| `prestamosCashApi.tsx` | `prestamos-cash/` | `api/prestamosCashApi.tsx` |
| `exchangeIntelligenceApi.ts` | `exchange/` | `api/exchangeIntelligenceApi.ts` |
| `dashboardApi.tsx` | `dashboard/` | `api/dashboardApi.tsx` |
| `cuadreDiarioApi.ts` | `cuadre-diario/` | `api/cuadreDiarioApi.ts` |
| `notificacionesApi.tsx` | `notificaciones/` | `api/notificacionesApi.tsx` |
| `reparacionesApi.tsx` | `reparaciones/` | `api/reparacionesApi.tsx` |
| `configuracionApi.ts` | `configuracion/` | `api/configuracionApi.ts` |
| `gastosDEApi.tsx` | `gastosDE/` | `api/gastosDEApi.tsx` |
| `gastoCompraApi.ts` | `gastos-compra/` | `api/gastoCompraApi.ts` |
| `GastosCompraApi.tsx` | `gastos-compra/` | `api/GastosCompraApi.tsx` |
| `stockUbicacionApi.tsx` | `productos/` | `api/stockUbicacionApi.tsx` |
| `productosUbicacionApi.tsx` | `productos/` | `api/productosUbicacionApi.tsx` |
| `gastosConceptosApi.tsx` | `gastosDE/` | `api/gastosConceptosApi.tsx` |
| `ClienteApi.tsx` | `clientes/` | `api/ClienteApi.tsx` |
| `reportes-financieros.tsx` | `reportes-financieros/` | `api/reportes-financieros.tsx` |

### `src/lib/services/` → Features

| Service File | Feature Destino | File en Feature |
|---|---|---|
| `anticipos-workflow.ts` | `contabilidad/` | `api/anticipos-workflow.ts` |
| `pago-gastos-workflow.ts` | `contabilidad/` | `api/pago-gastos-workflow.ts` |
| `cierreContableService.ts` | `contabilidad/` | `api/cierreContableService.ts` |
| `exchange_intelligence_service.ts` | `exchange/` | `api/exchange_intelligence_service.ts` |
| `exchange_intelligence_kpis.ts` | `exchange/` | `api/exchange_intelligence_kpis.ts` |
| `currency-conversion-service.ts` | `exchange/` | `api/currency-conversion-service.ts` |
| `stock-ubicacion-service.ts` | `productos/` | `api/stock-ubicacion-service.ts` |
| `facturacion-ventas-workflow.ts` | `facturas/` | `api/facturacion-ventas-workflow.ts` |
| `treasury_integration_service.ts` | `contabilidad/` | `api/treasury_integration_service.ts` |
| `scheduled-report-scheduler.ts` | `reportes-financieros/` | `api/scheduled-report-scheduler.ts` |
| `export-service.ts` | `reportes-financieros/` | `api/export-service.ts` |
| `export-types.ts` | `reportes-financieros/` | `api/export-types.ts` |
| `cache-invalidation-service.ts` | **shared?** | Evaluar |
| `audit-log-service.ts` | **shared?** | Evaluar |
| `tenant-scope.ts` | **shared?** | Evaluar |
| `anticipos-guards.ts` | `contabilidad/` | `api/anticipos-guards.ts` |
| `anticipos-workflow.types.ts` | `contabilidad/` | `api/anticipos-workflow.types.ts` |
