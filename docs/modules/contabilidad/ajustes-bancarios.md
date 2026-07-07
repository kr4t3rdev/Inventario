# Ajustes Bancarios, Anticipos, Deudas y Prestamos

> Reune operaciones especiales que corrigen o extienden el circuito financiero normal: ajustes manuales, anticipos, prestamos cash y deudas cash.

## Que hace

Este bloque agrupa herramientas para cuando el flujo estandar de ventas, gastos y transferencias no alcanza. Sirve para registrar ingresos o egresos manuales en cuentas, adelantar fondos, modelar prestamos o deudas en efectivo y registrar sus pagos posteriores.

## Que incluye

- **Ajustes bancarios**: ingresos o egresos manuales con cuenta, motivo y descripcion.
- **Anticipos**: reservas o adelantos asociados a relaciones comerciales.
- **Prestamos cash**: prestamos otorgados y sus pagos.
- **Deudas cash**: deudas asumidas y sus cancelaciones.

## Cuando usarlo

- Cuando aparece un movimiento bancario que no nace de un flujo estandar del sistema.
- Cuando necesitas registrar una salida o entrada manual en cuenta.
- Cuando la empresa presta o recibe dinero fuera del circuito comercial habitual.

## Reglas importantes

- Ajustes bancarios pasan por `withPeriodValidation`, asi que respetan bloqueos por periodo.
- Prestamos y deudas cash son features separadas del plan.
- Los pagos de prestamos y deudas generan reconciliaciones posteriores.
- Un ajuste manual no deberia reemplazar una operacion que ya tiene flujo especifico en el sistema.

## Que conviene cuidar

- Antes de ajustar, verifica si el caso no corresponde mejor a conciliacion, transferencia o gasto normal.
- Documenta bien motivo y descripcion porque estos registros suelen revisarse en auditoria.
- No mezcles cash modules con operaciones estandar si queres reportes limpios.

## Referencias utiles

- `src/features/contabilidad/actions-ajustes-bancarios.ts`
- `src/features/contabilidad/actions-anticipos.ts`
- `src/features/contabilidad/actions-prestamos-cash.ts`
- `src/features/contabilidad/actions-deudas-cash.ts`
- `src/app/busy/contabilidad/ajustes/page.tsx`
- `src/app/busy/contabilidad/anticipos/page.tsx`
- `src/app/busy/contabilidad/prestamos-cash/page.tsx`
- `src/app/busy/contabilidad/deudas-cash/page.tsx`

## En una frase

Cubre las excepciones financieras que no entran limpias en el circuito normal de conciliacion y cuentas.
