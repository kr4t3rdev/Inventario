# Transferencias

> Mueve stock entre almacenes y puntos de venta con estados, validaciones de disponibilidad y trazabilidad completa.

## Qué hace

Este módulo permite mover mercadería entre ubicaciones operativas. Soporta origen y destino tanto en almacenes como en puntos de venta, calcula stock disponible según el tipo de ubicación y gestiona el ciclo de estado de la transferencia.

## Qué incluye

- listado y detalle de transferencias
- creación con múltiples productos
- validación de origen y destino
- soporte para almacén -> almacén, almacén -> punto de venta, punto de venta -> almacén y punto de venta -> punto de venta
- aprobación, completado y rechazo
- resincronización y reversión de stock según estado

## Cuándo usarlo

- Cuando necesitás reubicar stock entre depósitos o cajas.
- Cuando querés abastecer un punto de venta desde almacén.
- Cuando necesitás dejar trazado quién movió qué, desde dónde y hacia dónde.

## Reglas importantes

- El origen y destino no pueden ser iguales.
- Los estados posibles incluyen `PENDIENTE`, `APROBADA`, `EN_TRANSITO`, `COMPLETADA`, `RECHAZADA` y `CANCELADA`.
- No todos los cambios de estado mueven stock: eso depende de en qué estado esté la transferencia.
- Para punto de venta, el stock disponible se calcula distinto que para almacén.

## Qué conviene cuidar

- Si completás o cancelás mal una transferencia, podés desbalancear ubicaciones.
- Antes de mover desde punto de venta, revisá ventas descontadas y stock disponible real.
- Este módulo es sensible porque toca stock en dos ubicaciones a la vez.

## Rutas y referencias

- `/busy/transferencias`
- `/busy/transferencias/new`
- `/busy/transferencias/edit/[id]`
- `src/features/transferencias/actions.ts`

## En una frase

Es el orquestador de movimientos internos de stock entre depósitos y puntos de venta.
