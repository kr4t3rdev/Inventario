# Tasks: Migrar Cuentas por Pagar/Cobrar a Server Actions + Bug Fixes

## Phase 1: Foundation — Schemas y Server Actions

- [ ] 1.1 Crear `src/features/contabilidad/actions/schemas.ts` con los 6 Zod schemas: `getCuentasPorCobrarSchema`, `getCuentasPorPagarSchema`, `createCuentaPorCobrarSchema`, `createCuentaPorPagarSchema`, `pagarCuentaPorPagarSchema`, `updateCuentaPorCobrarSchema`
- [ ] 1.2 Crear `src/features/contabilidad/actions/cuentas-por-cobrar.ts` con Server Actions: `getCuentasPorCobrarAction`, `createCuentaPorCobrarAction`, `updateCuentaPorCobrarAction`. Todas con `requireTenant(user)`, cálculo de `totalPagadoFactura`/`saldoFactura` con normalización multi-moneda. Types: `CuentaPorCobrarConCalculo`, `GetCuentasPorCobrarResult`
- [ ] 1.3 Crear `src/features/contabilidad/actions/cuentas-por-pagar.ts` con Server Actions: `getCuentasPorPagarAction` (paginación server-side con `skip`/`take`, filtros, cálculo de `rangoAntiguedad`/`diasTranscurridos`), `createCuentaPorPagarAction`, `pagarCuentaPorPagarAction` (con `applyPagoGastoWorkflow`). Types: `GetCuentasPorPagarResult`, `PagarCuentaPorPagarResult`
- [ ] 1.4 Actualizar `src/features/contabilidad/index.ts` barrel para exportar las nuevas Server Actions

## Phase 2: Migración de Pages y Componentes

- [ ] 2.1 Refactorizar `src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx`: convertir a Server Component para data fetching inicial con `getCuentasPorCobrarAction`, extraer Client Component para interactividad (filtros, reconciliación), eliminar import de `useGetCuentasPorCobrarQuery`
- [ ] 2.2 Refactorizar `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx`: cambiar de RTK Query a recibir `{ cuentas, isLoading, error, onPagar }` como props, eliminar `useGetCuentasPorCobrarQuery` interno, mantener interactividad client-side (filtros, expanded rows)
- [ ] 2.3 Refactorizar `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx`: convertir a hybrid pattern (Server Component wrapper + Client Component para filtros/paginación/pago), usar `getCuentasPorPagarAction` en lugar de `useGetCuentasPorPagarQuery`, mantener `ReconciliacionGastosForm` como mecanismo de pago
- [ ] 2.4 Actualizar barrel exports de `src/lib/redux/services/cuentasPorCobrarApi.tsx` y `cuentasPorPagarApi.tsx`: agregar `@deprecated` JSDoc comments en los hooks exportados, indicando que se deben usar las Server Actions

## Phase 3: Cleanup

- [ ] 3.1 Eliminar `src/features/contabilidad/components/pagar-cuenta-por-pagar-dialog.tsx` — componente muerto que no se usa (la page usa `ReconciliacionGastosForm` directamente)
- [ ] 3.2 Verificar que ninguna importación referencia `PagarCuentaPorPagarDialog` en todo el proyecto. Si hay imports residuales, actualizarlas
- [ ] 3.3 Actualizar `src/features/contabilidad/api/__tests__/cuentas-por-cobrar.test.ts` para testear la Server Action `getCuentasPorCobrarAction` en lugar del handler HTTP (mantener test de tenant isolation: solo devuelve cuentas del tenant del usuario)
- [ ] 3.4 Actualizar `src/features/contabilidad/api/__tests__/cuentas-por-pagar-pagar.test.ts` para testear la Server action `pagarCuentaPorPagarAction` en lugar del handler HTTP (mantener tests: auth, 404, workflow exitoso, MONTO_EXCEDE_SALDO)
- [ ] 3.5 Actualizar `src/features/contabilidad/api/__tests__/cuentas-por-cobrar-id.test.ts` para testear `updateCuentaPorCobrarAction`
- [ ] 3.6 Ejecutar `pnpm run typecheck` y `pnpm run lint` para verificar que no hay errores de tipos ni imports rotos

## Phase 4: Verification

- [ ] 4.1 Ejecutar `pnpm run test:run` para verificar que todos los tests pasan
- [ ] 4.2 Verificar manualmente que la page de CxC carga datos correctamente (Server Action con tenant isolation)
- [ ] 4.3 Verificar manualmente que la page de CxP carga con paginación server-side correcta
- [ ] 4.4 Verificar que el flujo de pago en CxP (via ReconciliacionGastosForm) funciona correctamente
- [ ] 4.5 Verificar que el flujo de pago en CxC (via ReconciliacionVentasForm) funciona correctamente