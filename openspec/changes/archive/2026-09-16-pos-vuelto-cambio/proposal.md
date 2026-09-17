# VC — Vuelto/cambio en el POS (Gap 3)

## Decisión ejecutiva

El POS gana un **panel de cobro** que captura método de pago y monto recibido en efectivo,
calcula el vuelto en tiempo real y exige recibido ≥ porción en efectivo antes de permitir
cobrar. Persistencia mínima en `Venta`: **`montoRecibidoEfectivo`** y **`cambioDevuelto`**
(Int, centavos, nullables). El `montoEfectivo` existente sigue siendo *lo retenido que cuenta
el turno*; el nuevo par documenta lo entregado y lo devuelto sin alterar arqueo ni cuadre.

Origen: verificación Ventas vs Odoo (2026-09-14, memoria `ventas-vs-odoo-verificacion`,
gap 3: "vuelto/cambio inexistente en el POS").

## Problema

Hoy el POS muestra el total y permite varios métodos de pago, pero **no hay input de
"recibido" ni cálculo de vuelto**: el cajero debe hacer la resta mental ante un cliente que
paga un billete grande. Además, dos vacíos que el plan ataja para que el vuelto tenga sentido:

1. El flujo rápido del POS (`pv-interface.tsx` → `processVenta`) ni siquiera envía
   `metodoPago`/montos: las ventas de mostrador quedan con metadatos de pago `null`, lo que
   deja al arqueo sin desglose real por método para esas ventas (el esquema del POS sí lo
   soporta; la UI nunca lo captura).
2. Sin monto recibido no hay defensa contra cobros por menos del total en efectivo ni evidencia
   de caja del cambio entregado (disputa típica: "yo entregué un billete de 100").

## Propuesta

1. **Campos nuevos en `Venta`**: `montoRecibidoEfectivo Int?`, `cambioDevuelto Int?`
   (centavos; la moneda es la de la venta — hoy CUP en POS). Ambos nullables: ventas
   viejas y ventas sin efectivo quedan intactas por `db push`.
2. **Panel de cobro** en el POS (diálogo antes de procesar o sección del carrito):
   método de pago (SELECT), monto recibido en efectivo (solo si el método incluye efectivo),
   vuelto calculado vivo (`recibido − a cobrar en efectivo`), bloqueo de cobro si el recibido
   es insuficiente. Envía `metodoPago`, `montoEfectivo` y los campos nuevos. El flujo con
   factura reusa el mismo panel.
3. **Server**: Zod valida coherencia (`cambio = recibido − montoEfectivo`, `recibido ≥
   montoEfectivo` cuando hay efectivo); el servicio persiste tal cual. Sin truco: el servidor
   no recalcula el cambio fuera del schema porque es presentación (el valor cobrado sí se
   re-resuelve, eso ya lo hace LP-0).
4. **Arqueo/cuadre SIN cambios de fórmula**: ambos suman `montoEfectivo` (lo retenido), que es
   exactamente lo que el cajero se queda tras entregar el vuelto. El panel no altera el total
   del turno; solo lo documenta. Evidencia y regresión en tests del cuadre/arqueo.
5. **Ticket**: el PDF/recibo de venta muestra "Recibido $X / Cambio $Y" cuando existan
   (buscar el generador de ticket de la venta — `src/features/ventas` u `ofertas`/print).

## No-goals

- Sin vuelto en moneda distinta (USD) ni conversión en caja (siguiente iteración si aparece).
- Sin desglose de denominaciones del recibido (el arqueo ya cuenta denominaciones al cerrar).
- Sin propinas ni redondeos, sin múltiples pagos parciales, sin cambios en anulación/devoluciones
  (las devoluciones ya tienen su reembolso; el vuelto no genera movimientos extra).
- Sin cambios en mobile (la app móvil conserva su contrato actual; el backend tolera nulls).

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Schema | `prisma/schema.prisma` + migración | 2 columnas en `Venta` |
| Validación | `src/features/ventas/schemas.ts` | campos + refinamiento de cobro |
| Servicio | `venta-mutation-service.ts` | persistir recibido/cambio (mundo Int; sin FX) |
| UI cobro | `pv-interface.tsx` (+1 componente nuevo `pos-cobro-dialog.tsx`) | método + recibido + vuelto live + bloqueo |
| Ticket | generador de ticket/recibo | líneas recibido/cambio condicionales |
| Tests | `pos-cobro.test.ts`, servicio, schema | RED→GREEN |

## Criterios de aceptación

1. Cobro en efectivo con recibido > total → venta guarda `montoRecibidoEfectivo` y
   `cambioDevuelto = recibido − montoEfectivo`; el POS muestra el vuelto antes de confirmar.
2. Recibido < porción en efectivo → cobro bloqueado con mensaje claro, sin crear la venta.
3. Tarjeta/transferencia/crédito: sin vuelto; los campos quedan `null`.
4. El esperado del arqueo y las pantallas del cuadre NO cambian (regresión de sus tests verde).
5. Ventas históricas (sin los campos) se dibujan normal (`null` = sin dato), sin backfill.
6. El ticket muestra recibido/cambio solo cuando hay dato; sin cambio visible si tarjeta.
