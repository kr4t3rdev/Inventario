# Proposal: Comprobante y Detalle de Pagos para Préstamos en Cuentas por Cobrar

## Intent

Los préstamos cash en la tabla de cuentas por cobrar muestran `-` en las columnas "ID Factura" y "Factura" porque no tienen factura asociada. Además, las filas de préstamos no son expandibles — el expander depende de `factura?.venta?.reconciliaciones`, que no existe para préstamos. El usuario necesita: (1) un identificador visual equivalente a factura ("comprobante") y (2) poder ver los pagos realizados al préstamo directamente desde esta tabla.

## Scope

### In Scope
- Generar y mostrar un "Comprobante" e "ID Comprobante" para préstamos en las columnas de factura
- Hacer expandibles las filas de préstamos para mostrar pagos (reconciliaciones con `tipoReconciliacion: PRESTAMO_CASH`)
- Incluir reconciliaciones del préstamo en la respuesta del API de cuentas por cobrar

### Out of Scope
- Modelo Prisma de "Comprobante" — se genera como label virtual (ej: `PREST-{idNumerico}`)
- Modificar el flujo de pago de préstamos (ya funciona vía `/prestamos-cash/{id}/pagar`)
- Cambiar la tabla dedicada de préstamos cash (`prestamos-cash-table.tsx`)

## Approach

1. **API**: En el GET de cuentas por cobrar, cuando `tipoCuenta === 'PRESTAMO_CASH'`, incluir las reconciliaciones del préstamo asociado (`prestamoCash.reconciliaciones`) en un campo normalizado para que el frontend las consuma igual que las de ventas.
2. **Columnas**: En las columnas "ID Factura" y "Factura", cuando es préstamo, mostrar `PREST-{idNumerico}` como comprobante y el ID truncado de `cuentaPorCobrar`.
3. **Expander**: Modificar la lógica de `tienePagos` y `PagosExpandidos` para que también funcione con reconciliaciones de préstamos (no solo de `factura.venta.reconciliaciones`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` | Modified | Incluir reconciliaciones de préstamos en respuesta |
| `src/components/contabilidad/cuentas-por-cobrar-table.tsx` | Modified | Columnas comprobante, expander para préstamos, `PagosExpandidos` |
| `src/app/models/model.ts` | Modified | Agregar campo `reconciliacionesPrestamo` a interface `CuentaPorCobrar` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance: N+1 al cargar reconciliaciones de préstamos | Low | Un solo include en query Prisma existente |
| Confusión UI: usuario piensa que "comprobante" es una factura real | Low | Badge "Préstamo" ya visible + prefix `PREST-` diferenciador |

## Rollback Plan

Revertir los 3 archivos afectados. No hay migración de BD ni cambio de schema — rollback es puramente código.

## Dependencies

- Ninguna externa. Las reconciliaciones de préstamos ya existen en `ReconciliacionVenta` con `tipoReconciliacion: PRESTAMO_CASH`.

## Success Criteria

- [ ] Préstamos muestran `PREST-{idNumerico}` en columna Factura e ID truncado en columna ID Factura
- [ ] Filas de préstamos son expandibles y muestran tabla de pagos idéntica a la de ventas
- [ ] Préstamos sin pagos muestran mensaje "Sin pagos registrados" al expandir
- [ ] No hay regresión en filas de ventas regulares
