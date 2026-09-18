# Ofertas y Promociones

> Gestiona cotizaciones comerciales con cliente, vencimiento, items mixtos y facturación posterior.

## Qué hace

Este módulo trabaja como una capa previa a la venta. Permite crear ofertas con productos y servicios, numerarlas secuencialmente por tenant, seguir su estado y convertirlas luego en factura y operación comercial real.

## Qué incluye

- listado y detalle de ofertas
- creación con cliente e items mixtos
- numeración secuencial tipo `OF-000001`
- actualización de estado y observaciones
- borrado de ofertas
- facturación de oferta con serie, cuenta, vencimiento y anticipo opcional

## Cuándo usarlo

- Cuando querés enviar o registrar una propuesta antes de vender.
- Cuando necesitás cotizar una mezcla de productos y servicios.
- Cuando una oferta aprobada debe convertirse en factura.

## Reglas importantes

- El acceso depende de la feature `ofertas`.
- Cada tenant genera su propio consecutivo de ofertas.
- Una oferta `RECHAZADA` no puede facturarse, y una `FACTURADA` no debe repetirse.
- Al facturarla puede crear turno activo, aplicar anticipo y marcar la oferta como facturada.

## Qué conviene cuidar

- Revisá vencimiento y estado antes de tomar una oferta vieja como base de facturación.
- Si la oferta mezcla servicios y productos, después cada parte impacta módulos distintos.
- La oferta no reemplaza la venta: es un paso previo comercial.

## Rutas y referencias

- `/busy/ofertas`
- `/busy/ofertas/new`
- `/busy/ofertas/[id]`
- `src/features/ofertas/actions.ts`
- `src/features/ofertas/services/facturar-oferta-workflow.ts`

## En una frase

Es el puente entre una propuesta comercial y una venta/factura concreta.
