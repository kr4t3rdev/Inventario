# Tasks: Toast-Sileo Migration

## Phase 1: Infrastructure Setup

- [ ] 1.1 Install `sileo` package - run `pnpm add sileo` or `npm install sileo`
- [ ] 1.2 Create `src/lib/toast.ts` - wrapper that exports `sileo` as `toast` with backward-compatible API
- [ ] 1.3 Create `src/components/ui/sileo.tsx` - Toaster component with theme support and position "top-right"
- [ ] 1.4 Update `src/components/ui/sonner.tsx` - re-export Sileo's Toaster for backward compat with existing imports
- [ ] 1.5 Verify wrapper works - create temp test file calling `toast.success()`, `toast.error()`, `toast.warning()`
- [ ] 1.6 Run `pnpm typecheck` to ensure no TypeScript errors in new files

## Phase 2: Core Implementation - Wrapper

- [ ] 2.1 Implement `toast.success()` wrapper - delegates to `sileo.success({ title: message, description })`
- [ ] 2.2 Implement `toast.error()` wrapper - delegates to `sileo.error({ title: message, description })`
- [ ] 2.3 Implement `toast.warning()` wrapper - delegates to `sileo.warning({ title: message, description })`
- [ ] 2.4 Implement `toast.info()` wrapper - delegates to `sileo.info({ title: message, description })`
- [ ] 2.5 Implement `toast.show()` wrapper - delegates to `sileo.show(options)`
- [ ] 2.6 Implement `toast.promise()` wrapper - delegates to `sileo.promise(promise, options)`
- [ ] 2.7 Implement `toast.dismiss()` wrapper - delegates to `sileo.dismiss(id)`
- [ ] 2.8 Implement `toast.clear()` wrapper - delegates to `sileo.clear(position)`
- [ ] 2.9 Export types `SileoOptions` and `SileoPromiseOptions` from wrapper

## Phase 3: Module Migration (Incremental)

### Module 3A: Shared/UI Components (Low Risk)

- [ ] 3A.1 Update `src/components/categorias/delete-category-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3A.2 Update `src/components/categorias/category-move-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3A.3 Update `src/components/ui/sonner.tsx` - verify re-export works

### Module 3B: Productos/Inventory

- [ ] 3B.1 Update `src/components/productos/productos-form.tsx` - change import to `@/lib/toast`
- [ ] 3B.2 Update `src/components/productos/restock-form.tsx` - change import to `@/lib/toast`
- [ ] 3B.3 Update `src/components/productos/bulk-stock-minimo-manager.tsx` - change import to `@/lib/toast`
- [ ] 3B.4 Update `src/components/productos/product-photo-upload.tsx` - change import to `@/lib/toast`
- [ ] 3B.5 Update `src/app/busy/products/page.tsx` - change import to `@/lib/toast`

### Module 3C: Ventas/Punto de Venta

- [ ] 3C.1 Update `src/components/ventas/pv-interface.tsx` - change import to `@/lib/toast`

### Module 3D: Servicios

- [ ] 3D.1 Update `src/components/servicios/servicios-form.tsx` - change import to `@/lib/toast`
- [ ] 3D.2 Update `src/components/servicios/servicios-recibidos-form.tsx` - change import to `@/lib/toast`
- [ ] 3D.3 Update `src/components/servicios/servicios-prestados-form.tsx` - change import to `@/lib/toast`
- [ ] 3D.4 Update `src/app/busy/servicios/page.tsx` - change import to `@/lib/toast`

### Module 3E: Empleados

- [ ] 3E.1 Update `src/components/empleados/empleados-form.tsx` - change import to `@/lib/toast`
- [ ] 3E.2 Update `src/components/empleados/nomina-view.tsx` - change import to `@/lib/toast`
- [ ] 3E.3 Update `src/components/empleados/vacaciones-form.tsx` - change import to `@/lib/toast`
- [ ] 3E.4 Update `src/components/empleados/asistencia-form.tsx` - change import to `@/lib/toast`
- [ ] 3E.5 Update `src/components/empleados/enhanced-empleados-form.tsx` - change import to `@/lib/toast`
- [ ] 3E.6 Update `src/components/empleados/enhanced-asistencia-form.tsx` - change import to `@/lib/toast`
- [ ] 3E.7 Update `src/components/empleados/work-schedule-manager.tsx` - change import to `@/lib/toast`
- [ ] 3E.8 Update `src/components/empleados/attendance-history-view.tsx` - change import to `@/lib/toast`

### Module 3F: Contabilidad

- [ ] 3F.1 Update `src/components/contabilidad/capital/capital-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.2 Update `src/components/contabilidad/cuentas-table.tsx` - change import to `@/lib/toast`
- [ ] 3F.3 Update `src/components/contabilidad/cuenta-bancaria-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.4 Update `src/components/contabilidad/cuentas-por-cobrar-table.tsx` - change import to `@/lib/toast`
- [ ] 3F.5 Update `src/components/contabilidad/cuentas-por-pagar-table.tsx` - change import to `@/lib/toast`
- [ ] 3F.6 Update `src/components/contabilidad/tipos-pago-config-page.tsx` - change import to `@/lib/toast`
- [ ] 3F.7 Update `src/components/contabilidad/tipos-pago-table.tsx` - change import to `@/lib/toast`
- [ ] 3F.8 Update `src/components/contabilidad/reportes-analytics-page.tsx` - change import to `@/lib/toast`
- [ ] 3F.9 Update `src/components/contabilidad/exchange-manager.tsx` - change import to `@/lib/toast`
- [ ] 3F.10 Update `src/components/contabilidad/transferencia-bancaria-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.11 Update `src/components/contabilidad/resumen-financiero.tsx` - change import to `@/lib/toast`
- [ ] 3F.12 Update `src/components/contabilidad/moneda-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.13 Update `src/components/contabilidad/conversion-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3F.14 Update `src/components/contabilidad/enhanced-form-wrapper.tsx` - change import to `@/lib/toast`
- [ ] 3F.15 Update `src/components/contabilidad/tasa-cambio-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.16 Update `src/components/contabilidad/historial-tasas-table.tsx` - change import to `@/lib/toast`
- [ ] 3F.17 Update `src/components/contabilidad/ajuste-bancario-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.18 Update `src/components/contabilidad/reconciliacion-ventas-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.19 Update `src/components/contabilidad/reconciliacion-servicios-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.20 Update `src/components/contabilidad/reconciliacion-gastos-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.21 Update `src/components/contabilidad/tipo-pago-form.tsx` - change import to `@/lib/toast`
- [ ] 3F.22 Update `src/components/contabilidad/toast-notifications.tsx` - change import to `@/lib/toast`
- [ ] 3F.23 Update `src/components/contabilidad/export-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3F.24 Update `src/components/contabilidad/pagar-cuenta-por-pagar-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3F.25 Update `src/components/contabilidad/capital/pago-deuda-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3F.26 Update `src/components/contabilidad/exchange-intelligence/*` - all files (save-scenario-dialog, debt-payment-actions, threshold-configuration, export-dropdown, saved-scenarios-list)
- [ ] 3F.27 Update `src/app/busy/contabilidad/cuentas/page.tsx` - change import to `@/lib/toast`
- [ ] 3F.28 Update `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx` - change import to `@/lib/toast`

### Module 3G: Clientes

- [ ] 3G.1 Update `src/components/clientes/clientes-form.tsx` - change import to `@/lib/toast`
- [ ] 3G.2 Update `src/components/clientes/cliente-logo-upload.tsx` - change import to `@/lib/toast`

### Module 3H: Compras

- [ ] 3H.1 Update `src/components/compras/compra-producto-form.tsx` - change import to `@/lib/toast`
- [ ] 3H.2 Update `src/app/busy/compras-productos/page.tsx` - change import to `@/lib/toast`
- [ ] 3H.3 Update `src/app/busy/compras-productos/[id]/edit/page.tsx` - change import to `@/lib/toast`

### Module 3I: Gastos

- [ ] 3I.1 Update `src/components/gastoDE/GastoDEForm.tsx` - change import to `@/lib/toast`
- [ ] 3I.2 Update `src/app/busy/gastosDE/page.tsx` - change import to `@/lib/toast`

### Module 3J: Ofertas

- [ ] 3J.1 Update `src/components/ofertas/oferta-form.tsx` - change import to `@/lib/toast`
- [ ] 3J.2 Update `src/components/ofertas/ofertas-table.tsx` - change import to `@/lib/toast`
- [ ] 3J.3 Update `src/components/ofertas/quick-offer-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3J.4 Update `src/app/busy/ofertas/[id]/page.tsx` - change import to `@/lib/toast`

### Module 3K: PtoVenta

- [ ] 3K.1 Update `src/components/PtoVenta/pvtoVenta-form.tsx` - change import to `@/lib/toast`

### Module 3L: Admin/Auth/Otros

- [ ] 3L.1 Update `src/contexts/auth-context.tsx` - change import to `@/lib/toast`
- [ ] 3L.2 Update `src/app/busy/perfil/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.3 Update `src/app/busy/planes/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.4 Update `src/app/busy/licencias/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.5 Update `src/app/busy/notificaciones/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.6 Update `src/app/busy/listas-precios/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.7 Update `src/components/admin/create-user-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3L.8 Update `src/components/admin/edit-user-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3L.9 Update `src/components/admin/user-monitoring-panel.tsx` - change import to `@/lib/toast`
- [ ] 3L.10 Update `src/components/admin/admin-users-table.tsx` - change import to `@/lib/toast`
- [ ] 3L.11 Update `src/components/admin/migrate-cuentas-por-pagar-button.tsx` - change import to `@/lib/toast`
- [ ] 3L.12 Update `src/hooks/use-category-validation.tsx` - change import to `@/lib/toast`
- [ ] 3L.13 Update `src/components/mi-empresa/mi-empresa-form.tsx` - change import to `@/lib/toast`
- [ ] 3L.14 Update `src/components/unidad/unidad-form.tsx` - change import to `@/lib/toast`
- [ ] 3L.15 Update `src/components/facturas/actualizar-estado-factura.tsx` - change import to `@/lib/toast`
- [ ] 3L.16 Update `src/components/file-upload.tsx` - change import to `@/lib/toast`
- [ ] 3L.17 Update `src/components/series-facturacion/series-facturacion-table.tsx` - change import to `@/lib/toast`
- [ ] 3L.18 Update `src/components/transferencias/transferencias-form.tsx` - change import to `@/lib/toast`
- [ ] 3L.19 Update `src/app/busy/transferencias/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.20 Update `src/components/contratos/new-version-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3L.21 Update `src/components/contratos/add-firma-dialog.tsx` - change import to `@/lib/toast`
- [ ] 3L.22 Update `src/app/busy/contratos/[id]/page.tsx` - change import to `@/lib/toast`
- [ ] 3L.23 Update `src/components/vendor/vendor-form.tsx` - change import to `@/lib/toast`
- [ ] 3L.24 Update `src/components/vendor/vendor-logo-upload.tsx` - change import to `@/lib/toast`
- [ ] 3L.25 Update `src/components/economia/presupuesto-manager.tsx` - change import to `@/lib/toast`

### Module 3M: Restaurante

- [ ] 3M.1 Update `src/app/busy/restaurante/kds/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.2 Update `src/app/busy/restaurante/caja/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.3 Update `src/app/busy/restaurante/ticket/[id]/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.4 Update `src/app/busy/restaurante/pos/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.5 Update `src/app/busy/restaurante/produccion/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.6 Update `src/app/busy/restaurante/recetas/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.7 Update `src/app/busy/restaurante/carta/page.tsx` - change import to `@/lib/toast`
- [ ] 3M.8 Update `src/components/restaurante/mesas-board.tsx` - change import to `@/lib/toast`

### Module 3N: Reparaciones

- [ ] 3N.1 Update `src/app/busy/reparaciones/ordenes/new/page.tsx` - change import to `@/lib/toast`
- [ ] 3N.2 Update `src/app/busy/reparaciones/ordenes/[id]/page.tsx` - change import to `@/lib/toast`

### Module 3O: Token/Lib

- [ ] 3O.1 Update `src/lib/token.ts` - uses dynamic import of sonner, change to `@/lib/toast`

## Phase 4: Testing

- [ ] 4.1 Update `src/components/servicios/__tests__/servicios-form.test.tsx` - change mock from `vi.mock('sonner', ...)` to `vi.mock('sileo', ...)`
- [ ] 4.2 Run `pnpm test -- src/components/servicios/__tests__/servicios-form.test.tsx` to verify tests pass
- [ ] 4.3 Run `pnpm test` to verify all tests pass
- [ ] 4.4 Verify all toast usages work correctly in affected components

## Phase 5: Cleanup

- [ ] 5.1 Search for any remaining `from 'sonner'` imports - grep pattern: `import.*toast.*from ['"]sonner['"]`
- [ ] 5.2 If any remaining imports found, update them to `@/lib/toast`
- [ ] 5.3 Remove `sonner` from `package.json` dependencies
- [ ] 5.4 Delete `src/components/ui/sonner.tsx` (or keep as simple re-export if needed for other imports)
- [ ] 5.5 Run `pnpm build` to verify production build works
- [ ] 5.6 Run `pnpm lint` to verify no linting errors

## Verification Checklist

- [ ] All `toast.success()` calls work
- [ ] All `toast.error()` calls work
- [ ] All `toast.warning()` calls work
- [ ] All `toast()` generic calls work
- [ ] `toast.promise()` works (if used)
- [ ] Dark mode works correctly
- [ ] Animations render correctly
- [ ] All tests pass
- [ ] Production build succeeds
