# Tasks: Separar Préstamos y Deudas de CxC/CxP

## Phase 1: APIs — Includes de datos en tablas dedicadas

- [ ] 1.1 `src/app/api/contabilidad/prestamos-cash/route.ts` — Add nested include: `reconciliaciones: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } }` dentro del include existente de prestamoCash
- [ ] 1.2 `src/app/api/contabilidad/deudas-cash/route.ts` — Change `cuentaPorPagar: true` → `cuentaPorPagar: { include: { pagos: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaPago: 'desc' } } } }`

## Phase 2: APIs — Filtros de exclusión en CxC/CxP

- [ ] 2.1 `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` — Add `tipoCuenta: { not: 'PRESTAMO_CASH' }` al whereClause. Remover bloque `prestamoCash` del include. Remover lógica `esPrestamo` del mapper (líneas ~138-164): `_reconciliaciones` normalization, `prestamoCashData`
- [ ] 2.2 `src/app/api/contabilidad/cuentas-por-pagar/route.ts` — Add `tipoDeuda: { not: 'DEUDA_CASH' }` al whereClause. Remover bloque `deudaCash` del include

## Phase 3: Frontend — Expandable rows en tablas dedicadas

- [ ] 3.1 `src/components/contabilidad/prestamos-cash/prestamos-cash-table.tsx` — Add import `getExpandedRowModel`, `ChevronDown`, `ChevronRight`, `Tooltip*`. Add component `PagosExpandidos` que consume `row.original.reconciliaciones` agrupando por `idTransferencia`. Add expander column. Wire `getExpandedRowModel()` en useReactTable. Render expanded row en TableBody
- [ ] 3.2 `src/components/contabilidad/deudas-cash/deudas-cash-table.tsx` — Mismo patrón que 3.1 pero consume `row.original.cuentaPorPagar?.pagos` agrupando por `referencia`. Mensaje vacío: "No hay pagos registrados para esta deuda"

## Phase 4: Frontend — Limpieza CxC/CxP tables

- [ ] 4.1 `src/components/contabilidad/cuentas-por-cobrar-table.tsx` — Remove: todas las ~12 referencias a `esPrestamo`/`PRESTAMO_CASH`, badge `PREST-{id}`, descarga comprobante préstamo, condicional acciones préstamo, `_reconciliaciones` fallback en PagosExpandidos. Simplificar PagosExpandidos (solo reconciliaciones de factura.venta)
- [ ] 4.2 `src/components/contabilidad/cuentas-por-pagar-table.tsx` — Remove: bloque `DEUDA_CASH` en `handleOpenPago` (líneas 91-99), import `PagoDeudaModal`, estados `selectedDeuda`/`openPagoDeuda`, render de `<PagoDeudaModal />`

## Phase 5: Verificación manual

- [ ] 5.1 Verificar CxC no muestra registros PRESTAMO_CASH y tabla funciona sin errores
- [ ] 5.2 Verificar CxP no muestra registros DEUDA_CASH y pago usa siempre PagarCuentaPorPagarDialog
- [ ] 5.3 Verificar expander en prestamos-cash-table muestra reconciliaciones agrupadas
- [ ] 5.4 Verificar expander en deudas-cash-table muestra pagos agrupados
