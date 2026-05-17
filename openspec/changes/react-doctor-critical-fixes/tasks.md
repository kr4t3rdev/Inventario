# Tasks: react-doctor-critical-fixes

> Implementation checklist. Check off as completed.

---

## Task 1: Extraer StockChange de VentaInter

**Archivos**: `venta-Inter.tsx`, `stock-change-dialog.tsx` (nuevo)
**Riesgo**: Bajo
**Estimado**: 10 min

- [x] ~~1.1 Leer `venta-Inter.tsx` línea 69+ e identificar la función `StockChange`~~
- [x] ~~1.2 Analizar dependencias: solo usa `setCarrito` (estable)~~
- [x] ~~1.3 Envolver con `useCallback` en vez de extraer a archivo (la función no es un componente React sino una función helper)~~
- [x] ~~1.4 Verificar build: `pnpm run build` y `npx tsc --noEmit`~~
- [x] ~~1.5 Commit~~

> **Nota**: React Doctor marcó `StockChange` como "nested component" por el nombre PascalCase, pero es una función helper de 5 líneas que solo usa `setCarrito`. Se resolvió con `useCallback` en vez de extraer a archivo nuevo — mismo beneficio (no se recrea en cada render), menos boilerplate.

---

## Task 2: Agregar aria-controls a combobox

**Archivos**: 3 archivos
**Riesgo**: Muy bajo
**Estimado**: 5 min

- [ ] 2.1 `src/features/transferencias/components/transferencias-form.tsx:126`
  - Identificar `role="combobox"` y su `role="listbox"` asociado
  - Agregar `aria-controls` apuntando al ID del listbox
- [ ] 2.2 `src/features/gastosDE/components/VendorCombobox.tsx:32`
  - Mismo proceso
- [ ] 2.3 `src/app/busy/contabilidad/analisis-cuenta-cliente/page.tsx:202`
  - Mismo proceso
- [ ] 2.4 Verificar build: `pnpm run build`
- [ ] 2.5 Commit: `fix: add required aria-controls to combobox roles for accessibility`

---

## Task 3A: Reemplazar index como key — Batch A (riesgo bajo)

**Archivos**: Listas de datos de servidor con IDs claros
**Riesgo**: Bajo (IDs obvios: ventaId, productoId, id)
**Estimado**: 10 min

- [ ] 3A.1 `src/features/ventas/components/ventas-table.tsx:272,282`
- [ ] 3A.2 `src/features/ventas/components/pv-interface.tsx:154,567`
- [ ] 3A.3 `src/features/reportes-financieros/components/reporte-general.tsx:224`
- [ ] 3A.4 `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx:147`
- [ ] 3A.5 `src/features/contabilidad/components/prestamos-cash/prestamos-cash-table.tsx:231`
- [ ] 3A.6 `src/features/contabilidad/components/resumen-financiero.tsx:368,388`
- [ ] 3A.7 `src/features/reportes-financieros/components/reporte-por-categoria.tsx:72,136`
- [ ] 3A.8 `src/features/reportes-financieros/components/reporte-venta-diaria.tsx:443,852`
- [ ] 3A.9 Verificar build: `pnpm run build`
- [ ] 3A.10 Commit: `fix: replace index keys with stable IDs in server-data lists (batch A)`

---

## Task 3B: Reemplazar index como key — Batch B (riesgo medio)

**Archivos**: Components de feature con tipos mixtos
**Riesgo**: Medio (verificar tipo de datos para key correcta)
**Estimado**: 15 min

- [ ] 3B.1 `src/features/ventas/components/producto-card.tsx:37`
- [ ] 3B.2 `src/features/gastosDE/components/gasto-conceptos-content.tsx:157`
- [ ] 3B.3 `src/features/contabilidad/components/anticipos/reportes-anticipos.tsx:181,289`
- [ ] 3B.4 `src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx:507`
- [ ] 3B.5 `src/features/servicios/components/servicios-recibidos-table.tsx:97`
- [ ] 3B.6 `src/features/contabilidad/components/tipos-pago-config-page.tsx:39`
- [ ] 3B.7 `src/features/contabilidad/components/reconciliacion/reconciliacion-hub-client.tsx:55,58,204`
- [ ] 3B.8 `src/features/empleados/components/empleados-form.tsx:169`
- [ ] 3B.9 `src/features/gastosDE/components/gastosDE-content.tsx:317`
- [ ] 3B.10 `src/features/gastosDE/components/gasto-elementos-content.tsx:148`
- [ ] 3B.11 `src/features/notificaciones/components/panel-notificaciones.tsx:178`
- [ ] 3B.12 `src/features/productos/components/product-photo-upload.tsx:107`
- [ ] 3B.13 `src/features/productos/components/restock-history.tsx:329`
- [ ] 3B.14 `src/features/vendors/components/vendor-page-client.tsx:160`
- [ ] 3B.15 `src/features/productos/components/bulk-stock-minimo-manager.tsx:372`
- [ ] 3B.16 `src/features/servicios/components/servicios-content.tsx:164`
- [ ] 3B.17 `src/features/cuadre-diario/components/cuadre-diario.tsx:130`
- [ ] 3B.18 Verificar build: `pnpm run build`
- [ ] 3B.19 Commit: `fix: replace index keys with stable IDs in feature components (batch B)`

---

## Task 3C: Reemplazar index como key — Batch C (pages, dialogs, UI)

**Archivos**: Resto de archivos - pages, dialogs, tablas varias
**Riesgo**: Medio (verificar tipo de datos)
**Estimado**: 15 min

- [ ] 3C.1 `src/app/busy/cliente/page.tsx:162`
- [ ] 3C.2 `src/app/busy/reparaciones/ordenes/new/page.tsx:286,604`
- [ ] 3C.3 `src/app/busy/sugerencias/wanda-dashboard/page.tsx:329`
- [ ] 3C.4 `src/components/ui/animations.tsx:318`
- [ ] 3C.5 `src/features/admin/components/migrate-cuentas-por-pagar-button.tsx:197`
- [ ] 3C.6 `src/components/stock-bajo-table.tsx:87`
- [ ] 3C.7 `src/features/categorias/components/category-move-dialog.tsx:329`
- [ ] 3C.8 `src/features/contabilidad/components/cierres/CierresTable.tsx:58`
- [ ] 3C.9 `src/app/busy/reparaciones/page.tsx:270`
- [ ] 3C.10 `src/features/contabilidad/components/deudas-cash/deudas-cash-table.tsx:143`
- [ ] 3C.11 `src/app/busy/invoice/page.tsx:304,314`
- [ ] 3C.12 `src/app/busy/reparaciones/ordenes/[id]/page.tsx:1112,1226`
- [ ] 3C.13 `src/features/gastosDE/components/GastoDEForm.tsx:107`
- [ ] 3C.14 `src/features/admin/components/tenant-users-skeleton.tsx:25,50`
- [ ] 3C.15 `src/features/contabilidad/components/capital/capital-table.tsx:60`
- [ ] 3C.16 `src/features/empleados/components/empleados-nomina-content.tsx:392`
- [ ] 3C.17 `src/features/mermas/components/mermas-table.tsx:154,164`
- [ ] 3C.18 `src/features/facturas/components/facturas-content.tsx:304`
- [ ] 3C.19 `src/app/busy/contabilidad/page.tsx:73,79`
- [ ] 3C.20 Verificar build: `pnpm run build`
- [ ] 3C.21 Commit: `fix: replace index keys with stable IDs in pages and dialogs (batch C)`

---

## Review Workload Forecast

- Líneas estimadas de cambio: ~150-200 (58 keys reemplazadas en ~30 archivos)
- 400-line budget risk: **Low** ✅
- Chained PRs recommended: **No** ✅
- Decision needed before apply: **No** ✅

---

## Final verification

- [ ] Build: `pnpm run build` exitoso
- [ ] Lint: `pnpm run lint` exitoso
- [ ] React Doctor ya no reporta: `no-nested-component-definition`, `role-has-required-aria-props`, `no-array-index-as-key`
