# Tasks: Migrar transferencias a server-first

## 1. Inventory and contract alignment
- [ ] 1.1 Confirm the current transfer data shape used by `src/features/reportes-financieros/components/reporte-movimientos.tsx`
- [ ] 1.2 Confirm the stock-by-location data shape used by `src/features/transferencias/components/transferencias-form.tsx`
- [ ] 1.3 Verify whether `src/features/productos/actions.ts` already covers all stock-by-location cases needed by the transfer form

## 2. Migrate report consumption
- [ ] 2.1 Replace `useGetTransferenciasQuery` in `src/features/reportes-financieros/components/reporte-movimientos.tsx` with server-first data input
- [ ] 2.2 Preserve the existing filter, chart, PDF and CSV behavior after the data source change
- [ ] 2.3 Keep the component contract stable for the rest of the report UI

## 3. Migrate transfer form stock source
- [ ] 3.1 Replace `useGetStockPorUbicacionQuery` in `src/features/transferencias/components/transferencias-form.tsx` with server-resolved stock data
- [ ] 3.2 Keep stock validation and stock warnings aligned with the current UX
- [ ] 3.3 Ensure the form still handles origin/destination changes without a client cache dependency

## 4. Simplify transfer content refresh
- [ ] 4.1 Remove the dynamic import refresh path in `src/features/transferencias/components/transferencias-content.tsx`
- [ ] 4.2 Keep cancelation and list refresh working through `revalidatePath('/busy/transferencias')`
- [ ] 4.3 Preserve the current toast messages and error handling

## 5. Remove dead RTK Query slice
- [ ] 5.1 Re-run a workspace search for `useGetTransferenciasQuery`, `useGetTransferenciaQuery`, `useAddTransferenciaMutation`, `useUpdateTransferenciaMutation`, and `useDeleteTransferenciaMutation`
- [ ] 5.2 If no consumers remain, delete `src/features/transferencias/api/transferenciasApi.ts`
- [ ] 5.3 Remove any barrel exports or imports that still reference the slice

## 6. Verify
- [ ] 6.1 Run targeted tests for transferencias components and report rendering
- [ ] 6.2 Run a focused lint or typecheck on touched files
- [ ] 6.3 Re-scan the workspace to confirm the transferencias RTK hooks are no longer used
