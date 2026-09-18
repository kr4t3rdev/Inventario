# Reconciliacion Bancaria

> Vincula ventas, servicios y gastos con cobros o pagos reales para que los saldos contables reflejen lo que ya paso por caja o banco.

## Que hace

Este submodulo concentra las operaciones pendientes de conciliar y permite registrar movimientos financieros contra ellas. No trabaja solo con extractos bancarios: tambien resuelve pagos parciales, saldos pendientes y trazabilidad por cuenta, moneda y fecha.

## Que concilia

- **Ventas**: calcula `saldoPendiente` en base a total menos pagos ya reconciliados.
- **Servicios**: detecta servicios aun no conciliados.
- **Gastos**: incluye gastos directos, pagos de salario, compras de servicio y costos de venta servicio.

## Cuando usarlo

- Cuando una venta ya fue cobrada, total o parcialmente, y queres reflejarlo.
- Cuando necesitas registrar el pago real de un gasto pendiente.
- Cuando queres bajar el volumen de operaciones abiertas antes del cierre del periodo.

## Reglas importantes

- Una venta puede seguir apareciendo pendiente aunque ya tenga conciliaciones, si todavia conserva saldo.
- El sistema distingue entre operaciones fuente y registros de conciliacion.
- Los montos pueden normalizarse por moneda o tasa de cambio segun el caso.
- Reconciliar cambia dashboards, pendientes y reportes posteriores.

## Que conviene cuidar

- Revisa cuenta, monto y moneda antes de confirmar.
- No asumas que "sin reconciliar" significa "sin pagos previos".
- Si una operacion parece inconsistente, revisa pagos parciales y tipo de gasto involucrado.

## Referencias utiles

- `src/features/contabilidad/actions-reconciliacion.ts`
- `src/app/busy/contabilidad/reconciliacion/page.tsx`
- `src/app/busy/contabilidad/reconciliacion/ventas/page.tsx`
- `src/app/busy/contabilidad/reconciliacion/servicios/page.tsx`
- `src/app/busy/contabilidad/reconciliacion/gastos/page.tsx`

## En una frase

Convierte operaciones pendientes en movimientos conciliados con trazabilidad real de cobro o pago.
