> **Sincronizado el 2026-09-26 (Sesión B, change `transferencias-cierre-flujo`):** la migración server-first está implementada en el código actual. Verificado hoy: 0 referencias a hooks RTK de transferencias en src/, el slice `src/features/transferencias/api/` no existe, el content usa revalidatePath, tests de transferencias (62) y reportes-financieros (46) en verde, eslint scoped 0 errores.

# Tasks: Migrar transferencias a server-first

## 1. Inventory and contract alignment
- [x] 1.1 Confirm the current transfer data shape used by `src/features/reportes-financieros/components/reporte-movimientos.tsx`
- [x] 1.2 Confirm the stock-by-location data shape used by `src/features/transferencias/components/transferencias-form.tsx`
- [x] 1.3 Verify whether `src/features/productos/actions.ts` already covers all stock-by-location cases needed by the transfer form

## 2. Migrate report consumption
- [x] 2.1 Replace `useGetTransferenciasQuery` in `src/features/reportes-financieros/components/reporte-movimientos.tsx` with server-first data input
- [x] 2.2 Preserve the existing filter, chart, PDF and CSV behavior after the data source change
- [x] 2.3 Keep the component contract stable for the rest of the report UI

## 3. Migrate transfer form stock source
- [x] 3.1 Replace `useGetStockPorUbicacionQuery` in `src/features/transferencias/components/transferencias-form.tsx` with server-resolved stock data
- [x] 3.2 Keep stock validation and stock warnings aligned with the current UX
- [x] 3.3 Ensure the form still handles origin/destination changes without a client cache dependency

## 4. Simplify transfer content refresh
- [x] 4.1 Remove the dynamic import refresh path in `src/features/transferencias/components/transferencias-content.tsx`
- [x] 4.2 Keep cancelation and list refresh working through `revalidatePath('/busy/transferencias')`
- [x] 4.3 Preserve the current toast messages and error handling

## 5. Remove dead RTK Query slice
- [x] 5.1 Re-run a workspace search for `useGetTransferenciasQuery`, `useGetTransferenciaQuery`, `useAddTransferenciaMutation`, `useUpdateTransferenciaMutation`, and `useDeleteTransferenciaMutation`
- [x] 5.2 If no consumers remain, delete `src/features/transferencias/api/transferenciasApi.ts`
- [x] 5.3 Remove any barrel exports or imports that still reference the slice

## 6. Verify
- [x] 6.1 Run targeted tests for transferencias components and report rendering
- [x] 6.2 Run a focused lint or typecheck on touched files
- [x] 6.3 Re-scan the workspace to confirm the transferencias RTK hooks are no longer used
