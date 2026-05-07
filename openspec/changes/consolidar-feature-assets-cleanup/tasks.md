# Tasks: Consolidar Feature Assets y Limpieza Post-Migración
## Estado: Ejecución Parcial — Pendiente typecheck manual

## Phase 0: Foundation — Copiar Componentes Faltantes

- [x] 0.1 Copiar componentes de `contabilidad/` a `src/features/contabilidad/components/` (6 archivos)
- [x] 0.2 Copiar componentes de `produccion/` a `src/features/produccion/components/` (3 archivos)
- [x] 0.3 Copiar componentes de `servicios/` a `src/features/servicios/components/` (6 archivos + index.ts)
- [x] 0.4 Copiar componentes varios a features: `compras/`, `catalog/`, `tenant-users/`→admin, `cuadre_diario/`, `reportes/`
- [x] 0.5 Verificar `data-table` → **shared, se queda en src/components/**
- [ ] 0.6 **Validar Phase 0**: `pnpm run typecheck` — **(pendiente: requiere Node.js)**

## Phase 1: Consolidar Imports de Componentes en app/busy/

- [x] 1.1 Actualizar 4 imports de productos en `products/edit/[id]/page.tsx`
- [x] 1.2 Actualizar 1 import de productos en `products/bulk-stock-minimo/page.tsx`
- [x] 1.3 Actualizar 3 imports de produccion en `produccion/page.tsx`
- [x] 1.4 Actualizar imports de servicios en `servicios/prestados/` y `servicios/recibidos/`
- [x] 1.5 Actualizar 7 imports de contabilidad en páginas de `contabilidad/`
- [x] 1.6 Actualizar imports en `compras-productos/new/`, `configuracion/catalogo/`, `configuracion/usuarios/`, `cuadre/`, `reportes/`
- [ ] 1.7 **Validar Phase 1**: `pnpm run typecheck`

## Phase 2: Migrar Imports de Redux API Slices

- [x] 2.1 Identificar 18 re-exports en `src/lib/redux/services/` (tabla de mapping a features)
- [x] 2.2 Aplicar `sed` batch para reemplazar 236 imports (`@/lib/redux/services/<api>` → `@/features/<feature>/api/<api>`)
- [x] 2.3 Verificar: **cero imports remaining** a los 18 re-exports
- [ ] 2.4 **Validar Phase 2**: `pnpm run typecheck`

## Phase 3: Migrar Re-export de Servicios Workflow

- [x] 3.1 Identificar único re-export: `facturacion-ventas-workflow.ts`
- [x] 3.2 Actualizar 3 consumers en `features/servicios/api/`, `features/ofertas/api/`, `lib/services/__tests__/`
- [x] 3.3 Eliminar `src/lib/services/facturacion-ventas-workflow.ts`
- [x] 3.4 Nota: los demás archivos en `lib/services/` son ORIGINALES (no re-exports), están fuera de scope

## Phase 4: Migrar Hooks a Features

- [x] 4.1 Identificar hooks con consumers: `useCategoryForm` (10), `useCategoryValidation` (5)
- [x] 4.2 Actualizar 6 imports en `features/categorias/components/` y `components/categorias/`
- [x] 4.3 Verificar: **cero imports remaining** a hooks migrados
- [x] 4.4 Identificar 7 hooks sin consumers (dead code): se quedan en `src/hooks/` por ahora

## Phase 5: Cleanup Final — Eliminar Re-exports y Duplicados Seguros

- [x] 5.1 Verificar **cero consumers** para cada re-export antes de eliminar
- [x] 5.2 Eliminar 18 re-exports en `src/lib/redux/services/` (todos con `export * from '@/features/...'`)
- [x] 5.3 Verificar **cero consumers** para directorios de componentes antes de eliminar
- [x] 5.4 Eliminar `src/components/compras/` (0 consumers)
- [x] 5.5 Eliminar `src/components/catalog/` (0 consumers)
- [x] 5.6 Eliminar `src/components/tenant-users/` (0 consumers, migrado a admin)
- [x] 5.7 Eliminar `src/components/cuadre_diario/` (0 consumers)
- [ ] 5.8 **Validar Phase 5**: `pnpm run typecheck`

## Phase 6: Trabajo Pendiente (No Ejecutado)

- [ ] 6.1 **`src/components/productos/`**: 12 imports still use this dir (pages: new, list, demo; plus internal cross-refs)
- [ ] 6.2 **`src/components/contabilidad/`**: 65 imports still use this dir (only 6 of ~64 components migrated)
- [ ] 6.3 **`src/components/produccion/`**: 2 internal cross-refs within produccion components
- [ ] 6.4 **`src/components/servicios/`**: 2 pages still import `servicios-form` from components/
- [ ] 6.5 **`src/components/reportes/`**: 3 internal cross-refs (features reportes still depend on components/reportes)
- [ ] 6.6 **`src/hooks/`**: 7 dead hooks still present (zero consumers)
- [ ] 6.7 **`src/lib/services/`**: 15 original services (not re-exports) still in lib/
- [ ] 6.8 **Validación final completa**: `pnpm run typecheck` + `pnpm run lint` + `pnpm run test:run`

## Resumen de lo Ejecutado

| Fase | Archivos Modificados | Archivos Eliminados | Estado |
|------|---------------------|---------------------|--------|
| 0 — Copiar componentes | 16 archivos creados en features | - | ✅ |
| 1 — Imports app/busy/ | 17 archivos modificados | - | ✅ |
| 2 — Redux API slices | 230 archivos procesados (236 imports) | - | ✅ |
| 3 — Re-export workflow | 3 archivos modificados | 1 eliminado | ✅ |
| 4 — Hooks | 6 archivos modificados | - | ✅ |
| 5 — Cleanup | - | 18 re-exports + 4 directorios + 1 workflow | ✅ |
| 6 — Pendiente | - | - | ⏳ |

**Total**: ~250+ archivos tocados, ~260 imports migrados, 23 archivos/directorios eliminados.
