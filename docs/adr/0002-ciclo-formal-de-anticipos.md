# ADR-0002: Ciclo formal de anticipos con financiación explícita

**Estado:** Propuesto
**Fecha:** 2026-11-01
**Especificación vinculada:** `docs/plan-ct1-integracion-capa-formal-2026-10-27.md` (S4-d)
**Decisores:** Producto e ingeniería

## Contexto

El alta actual de anticipos representa una reserva comercial, no necesariamente
una recepción o entrega efectiva de dinero. Sin embargo, el saldo se podía
consumir de inmediato, y los eventos contables disponibles requieren un asiento
de origen antes de contabilizar su aplicación. Además, el flujo necesita
conservar la valoración funcional y su evidencia FX para evitar recalcularla
durante la aplicación.

## Decisión

- Mantener el alta contractual como reserva sin movimiento de tesorería y con
  saldo disponible cero.
- Registrar por separado la recepción del anticipo de cliente o la entrega al
  proveedor. Admitir financiación parcial, actualizar la cuenta elegida,
  persistir importe funcional y evidencia FX, y emitir el evento formal dentro
  de la misma transacción.
- Permitir aplicaciones comerciales solo hasta el saldo financiado. Valorar
  cada aplicación con el costo funcional promedio ponderado persistido de las
  financiaciones y emitir el evento formal de aplicación en la misma transacción.
- Mantener los saldos a favor originados por notas de crédito en su flujo
  separado.
- Requerir conciliación para saldos históricos positivos sin evidencia de
  financiación; no inferir automáticamente un origen de efectivo.
- Mantener el gate global del emisor no Cash (`off/shadow/enforce`) sin cambiar
  su valor predeterminado.

## Consecuencias

- Una reserva no aumenta el saldo de una cuenta ni puede aplicarse hasta que
  existan movimientos explícitos de financiación.
- Los movimientos parciales conservan trazabilidad de cuenta, tipo de pago y
  valoración FX de cada financiación.
- Los registros históricos sin evidencia quedan bloqueados para aplicación
  hasta que se concilien; la migración no altera esos saldos.
- La acción de ejecución directa deja de ser válida; la aplicación debe ocurrir
  desde el flujo transaccional del documento comercial.

## Alternativas consideradas

- Tratar el alta como movimiento de efectivo: se descartó porque el alta puede
  ser solo una reserva y no tiene confirmación de recepción/entrega.
- Emitir solo el asiento de aplicación: se descartó porque dejaría el saldo de
  anticipos sin su asiento formal de origen.
- Convertir automáticamente los saldos históricos en fondos recibidos: se
  descartó porque no existe evidencia suficiente para afirmar que el efectivo
  se movió o identificar su valoración.
