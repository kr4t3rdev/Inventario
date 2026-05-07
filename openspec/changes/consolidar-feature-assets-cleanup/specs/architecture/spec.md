# Architecture Specification: Feature Asset Consolidation

## Purpose

Este documento establece los requisitos estructurales para completar la migración a Feature-Based Architecture. La migración previa movió ~40 features a `src/features/` pero dejó deuda técnica en forma de duplicados, imports cruzados y re-exports activos. Este spec define los criterios de consolidación.

## Requirements

### Requirement: Co-locación de Componentes de Dominio

Todo componente React que pertenezca a un dominio de negocio específico DEBE residir en `src/features/<feature>/components/`.

**Componentes excluidos (shared):**
- `src/components/ui/` — Design system (shadcn/ui)
- `src/components/animations/` — Animaciones reutilizables
- `src/components/cards/` — Tarjetas genéricas
- `src/components/Loaders/` — Indicadores de carga
- `src/components/data-table/` — Tabla genérica (shared, no pertenece a un feature)

#### Scenario: Import desde ubicación feature

- GIVEN un componente `ProductoForm` que pertenece al dominio de productos
- WHEN un page en `app/busy/` necesita usar `ProductoForm`
- THEN el import DEBE ser `from '@/features/productos/components/productos-form'`
- AND NO DEBE existir import desde `@/components/productos/productos-form`

#### Scenario: Componente copiado a feature

- GIVEN un componente `CompraProductoForm` que reside en `src/components/compras/`
- AND el feature `compras-productos` existe en `src/features/compras-productos/`
- WHEN se ejecuta la consolidación
- THEN el componente DEBE copiarse a `src/features/compras-productos/components/`
- AND los imports internos del componente DEBEN usar `@/` en lugar de rutas relativas

### Requirement: Co-locación de Hooks de Dominio

Todo hook React que pertenezca a un dominio de negocio específico DEBE residir en `src/features/<feature>/hooks/`.

**Hooks genuinamente shared (permanecen centralizados):**
- `use-debounce` — Utilidad genérica
- `use-mobile` — Detección de viewport
- `use-pagination` — Paginación genérica
- `use-breakpoints` — Breakpoints responsivos
- `use-cache` / `use-cache-persistence` — Cache genérica
- `use-error-handler` — Manejo de errores genérico
- `use-loading-states` — Estados de carga genéricos
- `use-retry-mechanism` — Reintentos genéricos
- `use-is-mounted` — Ciclo de vida genérico
- `use-keyboard-shortcuts` — Atajos de teclado genéricos
- `use-input-validation` — Validación de input genérica
- `use-table-filters` — Filtros de tabla genéricos

**Hooks con owner de dominio (migrar a feature):**
- `use-category-form` / `use-category-validation` → `categorias/`
- `use-admin-users-filters` → `admin/`
- `use-ventas` → `ventas/`
- `use-transferencias` → `transferencias/`
- `use-profile` → `profile/`
- `use-real-time-exchange` → `exchange/` (contabilidad)
- `use-treasury-integration` → `contabilidad/`
- `use-notifications` → `notificaciones/`

#### Scenario: Hook migrado a feature

- GIVEN el hook `useCategoryForm` reside en `src/hooks/use-category-form.ts`
- AND es consumido por `src/components/categorias/category-form.tsx`
- WHEN se ejecuta la migración de hooks
- THEN `useCategoryForm` DEBE moverse a `src/features/categorias/hooks/use-category-form.ts`
- AND todos los imports DEBEN actualizarse a `@/features/categorias/hooks/use-category-form`

### Requirement: Eliminación de Re-exports de Compatibilidad

Los archivos de re-export en `src/lib/redux/services/` y `src/lib/services/` existen actualmente como shims de backward compatibility. Una vez que ningún consumer los importe directamente, DEBEN eliminarse.

#### Scenario: Re-export sin consumers

- GIVEN el archivo `src/lib/redux/services/ventasApi.tsx` que re-exporta desde `@/features/ventas/api/ventasApi`
- AND existen 103 imports activos a `@/lib/redux/services/<api>` en el codebase
- WHEN todos los consumers se actualizan a importar directamente desde `@/features/<feature>/api/`
- THEN el directorio `src/lib/redux/services/` DEBE eliminarse
- EXCEPTO `apiSlice.tsx` si es shared infrastructure

#### Scenario: Servicio workflow sin consumers

- GIVEN el archivo `src/lib/services/anticipos-workflow.ts` que re-exporta desde `@/features/contabilidad/api/anticipos-workflow`
- AND existen 65 imports activos a `@/lib/services/<service>` en el codebase
- WHEN todos los consumers se actualizan a importar directamente desde features
- THEN los archivos de re-export DEBEN eliminarse
- AND los servicios genuinamente shared (ej: `tenant-scope.ts`, `audit-log-service.ts`) DEBEN evaluarse si migran a `src/shared/services/`

### Requirement: Validación Estructural Post-Migración

El sistema DEBE validar que no queden imports cruzados después de la consolidación.

#### Scenario: TypeScript compila limpio

- GIVEN la consolidación completada
- WHEN se ejecuta `pnpm run typecheck`
- THEN NO DEBE haber errores de resolución de módulos relacionados con imports movidos

#### Scenario: Linter pasa limpio

- GIVEN la consolidación completada
- WHEN se ejecuta `pnpm run lint`
- THEN NO DEBE haber errores de imports no resueltos

#### Scenario: Tests pasan

- GIVEN la consolidación completada
- WHEN se ejecuta `pnpm run test:run`
- THEN NO DEBE haber fallos de tests causados por imports movidos

#### Scenario: Grep validation — cero imports feature-specific desde @/components/

- GIVEN la consolidación completada
- WHEN se ejecuta `grep -r "from '@/components/[^/]\+/" src/app src/components src/features --include="*.tsx" --include="*.ts"`
- THEN NO DEBE haber resultados que no sean `ui/`, `animations/`, `cards/`, `Loaders/` o `data-table/`

#### Scenario: Grep validation — cero imports desde re-exports muertos

- GIVEN la eliminación de re-exports completada
- WHEN se ejecuta `grep -r "from '@/lib/redux/services/" src --include="*.tsx" --include="*.ts"`
- THEN NO DEBE haber resultados
- AND `grep -r "from '@/lib/services/" src --include="*.tsx" --include="*.ts"` NO DEBE tener resultados excepto posibles imports dentro de `src/lib/services/` mismo

## Success Criteria

- [ ] Todo componente feature-specific reside en `src/features/<feature>/components/`
- [ ] Todo hook feature-specific reside en `src/features/<feature>/hooks/`
- [ ] Cero imports desde `@/components/<feature>/` (feature-specific) en `src/app/`, `src/components/`, `src/features/`
- [ ] `src/hooks/` solo contiene hooks genuinamente shared o está vacío
- [ ] `src/lib/redux/services/` eliminado o reducido a infraestructura shared (`apiSlice.tsx`)
- [ ] `src/lib/services/` eliminado o reducido a servicios genuinamente shared
- [ ] `pnpm run typecheck` pasa sin errores nuevos
- [ ] `pnpm run lint` pasa sin errores nuevos
- [ ] `pnpm run test:run` pasa sin fallos nuevos
