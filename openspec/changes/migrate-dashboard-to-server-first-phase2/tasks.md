# Tasks: Migrar Dashboard a Server-First (Phase 2)

## Phase 1: Corregir shell ownership

- [ ] 1.1 Refactorizar `src/app/busy/dashboard/page.tsx` para eliminar `SidebarProvider` y `SidebarInset`
- [ ] 1.2 Verificar que la ruta dashboard quede renderizada como contenido hijo del shell definido en `src/app/busy/layout.tsx`
- [ ] 1.3 Documentar el patrón “layout owns shell, page owns content” dentro del change

## Phase 2: Restaurar widgets en `src/features/dashboard/components/`

- [ ] 2.1 Crear `section-cards.tsx` como widget presentacional server-first usando el contrato actual de dashboard stats
- [ ] 2.2 Crear `top-products-table.tsx` como widget presentacional server-first usando `productosMasVendidos`
- [ ] 2.3 Crear `transferencias-stats.tsx` como widget presentacional server-first usando `transferenciasStats`
- [ ] 2.4 Crear `stock-bajo-table.tsx` en el feature dashboard y migrar la responsabilidad del widget legacy
- [ ] 2.5 Crear `chart-area-interactive.tsx` como client island consumiendo props serializables
- [ ] 2.6 Crear `stock-distribution-chart.tsx` como client island consumiendo props serializables
- [ ] 2.7 Crear `index.ts` barrel para exportar todos los widgets del dashboard

## Phase 3: Migrar `stock-bajo-table` fuera del fetch client-side

- [ ] 3.1 Eliminar el patrón `useEffect() + getDashboardStatsAction()` del widget legacy
- [ ] 3.2 Asegurar que el widget nuevo reciba `productosStockBajo` por props o renderice server-side
- [ ] 3.3 Mantener el comportamiento visual útil (alerta, tabla, badges) sin loading artificial client-side

## Phase 4: Implementar composición server-first del dashboard

- [ ] 4.1 Convertir `src/app/busy/dashboard/page.tsx` en wrapper server-first
- [ ] 4.2 Resolver `getDashboardStatsAction({})` una sola vez y manejar correctamente `{ success, data, error }`
- [ ] 4.3 Preparar slices de datos serializables para cada widget según el contrato actual de la action
- [ ] 4.4 Si las animaciones del page lo requieren, extraer un `dashboard-shell.tsx` client para motion y mantener los datos fuera de ese boundary

## Phase 5: Limpiar imports legacy rotos

- [ ] 5.1 Remover todos los `dynamic()` imports a widgets legacy inexistentes desde `@/components/*`
- [ ] 5.2 Reemplazar esos imports por imports feature-based válidos
- [ ] 5.3 Confirmar que no quedan referencias a rutas borradas de widgets del dashboard

## Phase 6: Verificación técnica

- [ ] 6.1 Ejecutar `pnpm run typecheck`
- [ ] 6.2 Ejecutar `pnpm run lint`
- [ ] 6.3 Ejecutar `pnpm run test:run`
- [ ] 6.4 Verificar manualmente que el layout del dashboard no duplica shell ni genera `<main>` anidados
- [ ] 6.5 Verificar manualmente que charts/motion sigan funcionando dentro de sus client boundaries
