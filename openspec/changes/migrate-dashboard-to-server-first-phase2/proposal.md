# Proposal: Migrar Dashboard a Server-First (Phase 2)

## Intent

El dashboard principal (`src/app/busy/dashboard/page.tsx`) quedó en un estado intermedio de migración:

- duplica `SidebarProvider` + `SidebarInset` que ya pertenecen a `src/app/busy/layout.tsx`
- importa dinámicamente cinco widgets históricos eliminados en `a665f8f`
- mantiene `stock-bajo-table.tsx` como Client Component con `useEffect()` para leer una Server Action
- no usa `src/features/dashboard/components/`, que hoy está vacío

Esta change completa la migración del dashboard a una arquitectura **server-first**, con fetch centralizado en servidor, widgets feature-based y client boundaries chicos solo donde hagan falta (charts / motion interactivo).

## Scope

### In Scope
1. Eliminar la duplicación de shell en `src/app/busy/dashboard/page.tsx`
2. Convertir la ruta dashboard a composición server-first:
   - page/server wrapper para datos
   - client shell solo si es necesario para `framer-motion`
3. Recuperar y reubicar los widgets perdidos en `src/features/dashboard/components/`
4. Migrar `stock-bajo-table` fuera del patrón `useEffect() + getDashboardStatsAction()`
5. Consumir `getDashboardStatsAction()` como fuente actual de datos del dashboard
6. Reemplazar imports legacy rotos de `@/components/*` por imports feature-based válidos

### Out of Scope
- No reescribir la lógica de negocio principal de `getDashboardStatsAction()` salvo mínimos adapters de shape si fueran necesarios
- No migrar otras páginas bajo `src/app/busy/*`
- No eliminar `src/features/dashboard/api/handlers.ts`
- No cambiar modelos Prisma ni contratos de base de datos
- No hacer build como parte de esta change

## Approach

### Fase 1: Limpiar ownership del shell
- remover `SidebarProvider` y `SidebarInset` del dashboard page
- dejar el shell exclusivamente en `src/app/busy/layout.tsx`
- separar claramente layout shell vs dashboard content

### Fase 2: Restaurar widgets en arquitectura feature-based
- recrear widgets históricos dentro de `src/features/dashboard/components/`
- clasificar cada widget por boundary real:
  - **Server/presentational**: `section-cards`, `top-products-table`, `transferencias-stats`, `stock-bajo-table`
  - **Client islands**: `chart-area-interactive`, `stock-distribution-chart`

### Fase 3: Centralizar fetch de datos
- obtener `dashboardStats` una sola vez desde el page server wrapper
- pasar slices serializables por props a los widgets
- evitar waterfalls y llamados duplicados desde cada widget

### Fase 4: Preservar UX sin romper boundaries
- mantener motion/charting solo dentro de componentes client justificados
- usar imports estáticos feature-based
- usar `Suspense` únicamente si aporta valor real a la UX

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/busy/dashboard/page.tsx` | Major Refactor | Pasa a composición server-first y deja de duplicar el shell |
| `src/app/busy/layout.tsx` | No Change / Verification | Sigue siendo dueño del shell sidebar/header/auth |
| `src/features/dashboard/components/` | New | Nuevo hogar de los widgets del dashboard |
| `src/components/stock-bajo-table.tsx` | Migrated/Deprecated | Su responsabilidad migra al feature dashboard |
| `src/features/dashboard/actions.ts` | Minor | Puede requerir adapters o tipos compartidos, no reescritura total |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mezclar RSC con `framer-motion` en el mismo boundary | High | separar server wrapper y client shell/islands |
| Asumir un contrato de datos distinto al real de `getDashboardStatsAction()` | High | basar widgets solo en el shape actual verificado |
| Reintroducir widgets como client fetchers | Medium | prohibir `useEffect()` para fetch en widgets server-first |
| Quedar con imports legacy rotos | High | reemplazo explícito de todos los imports dinámicos de `@/components/*` |
| Cambios visuales no deseados por quitar wrappers duplicados | Medium | validación manual del layout final |

## Rollback Plan

1. Revertir `src/app/busy/dashboard/page.tsx`
2. Eliminar `src/features/dashboard/components/` creados por esta change
3. Restaurar temporalmente el widget existente si hiciera falta (`stock-bajo-table.tsx` legacy)
4. Revertir adapters de datos en `src/features/dashboard/actions.ts`

## Dependencies

- `src/features/dashboard/actions.ts`
- `src/app/busy/layout.tsx`
- `src/components/ui/animations.tsx`
- `src/components/ui/chart.tsx`
- `recharts`
- `framer-motion`

## Success Criteria

- [ ] `src/app/busy/dashboard/page.tsx` ya no duplica `SidebarProvider` ni `SidebarInset`
- [ ] el dashboard deja de importar widgets borrados desde `@/components/*`
- [ ] los widgets viven en `src/features/dashboard/components/`
- [ ] `stock-bajo-table` deja de usar `useEffect()` para leer dashboard stats
- [ ] la ruta usa fetch server-first con una sola lectura principal de `getDashboardStatsAction()`
- [ ] charts y motion quedan limitados a client boundaries justificados
- [ ] `pnpm run typecheck`, `pnpm run lint` y `pnpm test:run` pasan para lo tocado
