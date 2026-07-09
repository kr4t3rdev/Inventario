# Contabilidad

> Centraliza reconciliación, cuentas bancarias, periodos, transferencias, ajustes, reportes y módulos avanzados como exchange, anticipos, préstamos y deudas cash.

## Qué hace

Este módulo no es una sola pantalla sino un hub financiero completo. Desde el dashboard de contabilidad se accede a conciliación de ventas, servicios y gastos, cuentas bancarias, periodos contables, cierres, auditoría, reportes y herramientas de caja avanzada.

## Áreas principales

- **Reconciliación**: detecta ventas, servicios y gastos pendientes de conciliar.
- **Cuentas bancarias**: administra saldos, movimientos e historial por cuenta.
- **Transferencias**: mueve fondos entre cuentas con validaciones y comprobantes.
- **Ajustes manuales**: corrige diferencias y registra notas contables operativas.
- **Periodos contables**: apertura, cierre, aprobación, reapertura y bloqueos de escritura.
- **Exchange**: monedas, tasas y conversiones.
- **Reportes**: resumen, movimientos, impacto cambiario y vistas analíticas.
- **Módulos especializados**: anticipos, préstamos cash, deudas cash, cuentas por cobrar/pagar, capital y facturas vencidas.

## Cuándo usarlo

- Cuando cerrás periodos, hacés conciliaciones o revisás balances.
- Cuando querés entender en qué se fue el dinero y cómo quedó cada cuenta.
- Cuando necesitás reportes para tomar decisiones con más confianza.
- Cuando necesitás bloquear escrituras en periodos cerrados o aprobados.
- Cuando querés auditar qué operaciones siguen pendientes de conciliar.

## Reglas importantes

- Muchas mutaciones pasan por `withPeriodValidation`, así que un periodo cerrado puede frenar operaciones aunque el formulario siga visible.
- La reconciliación calcula pendientes reales, no solo listas simples: en ventas usa saldo pendiente y no solo ausencia de registros.
- Algunos submódulos dependen de features del plan, por ejemplo `deudas-cash`, `prestamos-cash` o capacidades multi-moneda.
- El módulo expone auditoría y trazabilidad, no solo CRUD financiero.

## Qué conviene cuidar

- Trabajá con periodos claros para no mezclar movimientos.
- Revisá cada ajuste antes de cerrar un periodo.
- Si hay diferencias, buscá primero la causa antes de corregir.
- En reconciliación, una operación puede seguir pendiente aunque tenga pagos parciales.
- Los periodos aprobados agregan una capa extra de control frente a los cerrados.
- Exchange, anticipos y cash modules impactan saldos y reportes globales.

## Rutas clave

- `/busy/contabilidad`
- `/busy/contabilidad/reconciliacion`
- `/busy/contabilidad/cuentas`
- `/busy/contabilidad/transferencias`
- `/busy/contabilidad/ajustes`
- `/busy/contabilidad/periodos`
- `/busy/contabilidad/exchange`
- `/busy/contabilidad/reportes`

## Referencias útiles

- `src/app/busy/contabilidad/page.tsx`
- `src/features/contabilidad/actions-reconciliacion.ts`
- `src/features/contabilidad/actions-periodos.ts`
- `src/features/contabilidad/actions-cuentas-bancarias.ts`
- `src/features/contabilidad/actions-exchange.ts`
- `src/features/contabilidad/actions-deudas-cash.ts`

## En una frase

Es el centro operativo y de control para que las finanzas queden conciliadas, auditables y cerrables por periodo.
