# Proposal: Soporte de Nuevos Tipos de Movimiento en Reportes Contables

## Intent

Los módulos `PrestamoCash` y `DeudaCash` generan reconciliaciones en `ReconciliacionVenta` usando `tipoReconciliacion = PRESTAMO_CASH | DEUDA_CASH`. Sin embargo, el route `/api/contabilidad/reportes/movimientos` y la ruta `/api/contabilidad/cuentas/[id]/historial` los mapean con `tipo: 'venta'` (sin distinguir). El filtro del dropdown en `MovimientosTable` y en `AccountTransactionHistory` no tiene las opciones "Préstamo Cash" ni "Deuda Cash", por lo que el usuario no puede filtrar ni identificar esos cobros/pagos en los reportes.

## Scope

### In Scope
- Mapear correctamente `tipoReconciliacion = PRESTAMO_CASH` → tipo `prestamo_cash` en el route de movimientos
- Mapear correctamente `tipoReconciliacion = DEUDA_CASH` → tipo `deuda_cash` en el route de movimientos
- Hacer lo mismo en `/api/contabilidad/cuentas/[id]/historial/route.ts`
- Agregar colores, ícono y label a `MovimientosTable` para los tipos `prestamo_cash` y `deuda_cash`
- Agregar `<SelectItem>` en el dropdown de tipo en `MovimientosTable`
- Agregar los mismos tipos al componente `AccountTransactionHistory` (pestaña "Por cuenta")
- Incluir los tipos en el select de filtro de `account-transaction-history.tsx`

### Out of Scope
- Cambios al schema de Prisma
- Creación de nuevas pantallas de detalle de préstamo/deuda
- Exportación PDF (ya funciona genéricamente)
- Modificar el módulo de Anticipos

## Approach

El campo `tipoReconciliacion` ya existe en `ReconciliacionVenta`. El route actual no lo selecciona ni lo usa para discriminar. El fix es: agregar `tipoReconciliacion` al `select{}` de Prisma en ambos routes, y en el `map()` sustituir `tipo: 'venta'` por una función que inspeccione `tipoReconciliacion`. En la UI: ampliar los `typeColors`, `typeIcons` y `typeLabels` con las dos nuevas claves, y agregar dos `<SelectItem>` en el dropdown de filtro.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/reportes/movimientos/route.ts` | Modified | Seleccionar `tipoReconciliacion`, mapear tipos prestamo_cash y deuda_cash |
| `src/app/api/contabilidad/cuentas/[id]/historial/route.ts` | Modified | Ídem en el historial por cuenta |
| `src/components/contabilidad/movimientos-table.tsx` | Modified | Colores, labels, íconos y opciones de filtro para los 2 tipos nuevos |
| `src/components/contabilidad/account-transaction-history.tsx` | Modified | Ídem para la pestaña "Por cuenta" |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reconciliaciones antiguas sin `tipoReconciliacion` explícito retornan `VENTA` por default en Prisma | Low | El enum tiene `@default(VENTA)` → retrocompatible |
| Duplicado de movimientos si la misma reconciliacion se cuenta dos veces (venta + prestamo) | Low | Se filtra por `tipoReconciliacion` en el map, no se agrega una query nueva |

## Rollback Plan

Revertir los cambios al `map()` en ambos routes y eliminar las 2 entradas de dropdown en la UI. No hay cambios de schema, por lo que no requiere migración.

## Dependencies

- Ninguna externa. El campo `tipoReconciliacion` y los modelos `PrestamoCash`/`DeudaCash` ya existen y tienen datos.

## Success Criteria

- [ ] En la pestaña "Movimientos", el dropdown muestra "Préstamo Cash" y "Deuda Cash" como opciones
- [ ] Al filtrar por "Préstamo Cash" se retornan solo reconciliaciones con `tipoReconciliacion = PRESTAMO_CASH`
- [ ] Al filtrar por "Deuda Cash" se retornan solo reconciliaciones con `tipoReconciliacion = DEUDA_CASH`
- [ ] En la pestaña "Por cuenta", los mismos filtros funcionan
- [ ] Los badges muestran un color distinto para `prestamo_cash` (purple/violet) y `deuda_cash` (amber/yellow)
- [ ] Los registros de tipo `venta` pura siguen mostrando "Venta" sin regresión
