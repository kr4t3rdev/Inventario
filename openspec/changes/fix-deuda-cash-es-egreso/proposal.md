# Proposal: Fix DeudaCash tratada como ingreso en lugar de egreso

## Intent

`DeudaCash` representa una deuda hacia un proveedor pagada desde la tarjeta/cuenta bancaria — es un **egreso** (gasto). Sin embargo, el sistema la clasificaba como `esIngreso: true` en el historial y la mostraba en verde con signo `+` en la UI, inflando incorrectamente el saldo y los totales de ingresos.

## Scope

### In Scope
- Corregir `esIngreso` en `historial/route.ts` para `DEUDA_CASH`
- Cambiar color de `deuda_cash` de amber → rojo en ambas tablas UI
- Cambiar icono de `TrendingUp` → `TrendingDown` para `deuda_cash`
- Eliminar `deuda_cash` de las condiciones de ingreso (signo `+`, verde)
- Eliminar `deuda_cash` de `isIncome` en el cálculo de totales

### Out of Scope
- Cambios al modelo Prisma o flujo de creación de `DeudaCash`
- `PrestamoCash` (sigue siendo ingreso — dinero que entra)

## Approach

Corrección puntual en 3 archivos. `esIngreso` en el route ya existe como campo booleano — solo condicionar con `tipoReconciliacion !== 'DEUDA_CASH'`. En la UI, mover `deuda_cash` al bloque de egresos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/cuentas/[id]/historial/route.ts` | Modified | `esIngreso: true` → condicional por tipoReconciliacion |
| `src/components/contabilidad/movimientos-table.tsx` | Modified | Color rojo, icono TrendingDown, sin signo `+` |
| `src/components/contabilidad/account-transaction-history.tsx` | Modified | Mismos cambios + isIncome corregido |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Saldos históricos ya calculados con `esIngreso: true` | Med | Esta ruta es de reporte, no altera el saldo real de `CuentaBancaria` |
| `prestamo_cash` afectado accidentalmente | Low | Condición específica `!== 'DEUDA_CASH'` |

## Rollback Plan

Revertir los 3 archivos modificados. Sin migraciones de DB — cambio es solo de presentación y lógica de reporte.

## Dependencies

- Ninguna externa

## Success Criteria

- [ ] `deuda_cash` muestra en rojo con signo `-` en pestaña Movimientos
- [ ] `deuda_cash` muestra en rojo con signo `-` en pestaña Por Cuenta
- [ ] Totales de ingresos del período NO incluyen montos de `deuda_cash`
- [ ] `prestamo_cash` sigue mostrando en verde con signo `+`
