# Tasks: Migrar 10 RTK Query APIs a Server Actions

## Tanda 1: Empleados + Pago Salario ✅

- [x] 1.1 `empleados/page.tsx`: reemplazar 4 hooks + mutations → Server Actions + useState/useEffect
- [x] 1.2 `empleados-form.tsx`: reemplazar 3 hooks → Server Actions
- [x] 1.3 `enhanced-empleados-form.tsx`: reemplazar 3 hooks → Server Actions
- [x] 1.4 `nomina-view.tsx`: eliminar `useGetPagoSalariosQuery` (dead code, data no usado)
- [x] 1.5 Eliminar `empleadosApi.ts` y `pagoSalarioApi.ts`
- [x] 1.6 Limpiar barrels y tag `PagoSalarios` de apiSlice (Empleados se mantiene, usado por contabilidadApi)

## Tanda 2: GastosDE + GastosConceptos ✅

- [x] 2.1 Implementar `updateGastoConceptoAction` y `updateGastoElementoAction`
- [x] 2.2 `GastoDEForm.tsx`: reemplazar 5 hooks → Server Actions + useState/useEffect
- [x] 2.3 `GastoConceptoForm.tsx`: reemplazar 2 hooks → Server Actions
- [x] 2.4 `GastoElementoForm.tsx`: reemplazar 2 hooks → Server Actions
- [x] 2.5 3 páginas de conceptos/elementos: reemplazar `useGetGastoConceptoQuery` → Server Actions
- [x] 2.6 Eliminar RTKQ slices (features + lib/redux)
- [x] 2.7 Limpiar barrel y tags (`GastosConceptos`, `GastosElementos` removidos; `GastosDE` preservado)

## Tanda 3: Facturas ✅

- [x] 3.1 `analisis-cuenta-cliente/page.tsx` (2 copias): reemplazar `useGetFacturasQuery` → `getFacturasAction` + useEffect
- [x] 3.2 `actualizar-estado-factura.tsx`: reemplazar `useUpdateFacturaMutation` → `updateFacturaAction`
- [x] 3.3 Eliminar `facturasApi.ts` (features + lib/redux duplicates)
- [x] 3.4 Limpiar barrel y tag `Facturas` de apiSlice

## Tanda 4: Notificaciones ✅

- [x] 4.1 `panel-notificaciones.tsx`: reemplazar `useGetNotificacionesQuery` + `useMarcarNotificacionLeidaMutation` → Server Actions
- [x] 4.2 `badge-notificaciones.tsx`: reemplazar `useGetNotificacionesQuery` → `getNotificacionesAction` + useEffect
- [x] 4.3 `notificaciones/page.tsx`: reemplazar 3 hooks → Server Actions con refresco post-mutación
- [x] 4.4 Eliminar `notificacionesApi.ts` (features + lib/redux)
- [x] 4.5 Limpiar barrel (tag `Notificaciones` preservado — usado por transferencias, mermas, adminApi)

## Tanda 5: Configuración + Cuadre Diario ✅

- [x] 5.1 Crear Server Actions: `getCuentasBancariasAction`, `getNextSerieNumberAction`, `getCuadreDiarioAction`
- [x] 5.2 `reparaciones/ordenes/[id]/page.tsx`: reemplazar 2 hooks → Server Actions + useEffect
- [x] 5.3 `cuadre-diario.tsx`: reemplazar `useGetCuadreDiarioQuery` → `getCuadreDiarioAction` + loadData/refetch
- [x] 5.4 Eliminar `configuracionApi.ts` y `cuadreDiarioApi.ts` (features + lib/redux)
- [x] 5.5 Limpiar barrel y tag `CuadreDiario` (Configuracion preservado)

## Tanda 6: Dashboard ✅

- [x] 6.1 Crear `getDashboardStatsAction` replicando lógica del handler (1509→~200 líneas)
- [x] 6.2 `stock-bajo-table.tsx`: reemplazar `useGetDashboardStatsQuery` → `getDashboardStatsAction` + useEffect
- [x] 6.3 Actualizar test `stock-bajo-table-minimum-stock.test.tsx` (async mock → mockResolvedValue)
- [x] 6.4 Eliminar `dashboardApi.ts` (features + lib/redux)
- [x] 6.5 Limpiar barrel (tag `Dashboard` preservado — usado por ofertasApi, ventasApi, mermasApi)

## Tanda 7: Órdenes Reparación ✅

- [x] 7.1 Implementar `facturarOrdenReparacion` y `getTecnicosStats` en `lib/api/reparaciones/ordenes.ts`
- [x] 7.2 `ordenes/page.tsx`: migrar `useGetOrdenesQuery` → `getOrdenesReparacion` + useEffect
- [x] 7.3 `historial/page.tsx`: migrar `useGetOrdenesQuery` → `getOrdenesReparacion` + useEffect
- [x] 7.4 `tecnicos/page.tsx`: migrar `useGetTecnicosStatsQuery` → `getTecnicosStats` + useEffect
- [x] 7.5 `ordenes/new/page.tsx`: migrar `useCreateOrdenMutation` → `addOrdenReparacion` + arreglar `reparacionesApi` broken import
- [x] 7.6 `ordenes/[id]/page.tsx`: migrar 3 hooks → funciones directas + useEffect + arreglar `reparacionesApi` broken import
- [x] 7.7 Eliminar `ordenesReparacionApi.ts` RTKQ slice
- [x] 7.8 Limpiar tags: `OrdenesReparacion`, `EquiposReparacion`, `Defectaciones` removidos de apiSlice
- [ ] Bonus: `reparaciones/page.tsx` — página de configuración ya rota (reparacionesApi eliminado previamente). Requiere migración separada a `lib/api/reparaciones/`.
