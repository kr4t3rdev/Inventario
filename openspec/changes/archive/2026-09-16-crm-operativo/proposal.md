# CRM-OP — CRM operativo (Gap 6)

## Decisión ejecutiva

No se clona el CRM de Odoo (pipeline kanban, leads, scoring) — no es lo que un taller o tienda
cubana necesita. En su lugar, se construye lo que el mercado real requiere para vender a crédito
sin ceguera: **vista 360 del cliente**, **límite de crédito** con enforcement en la creación de la
venta, y **seguimiento de cobros pendientes** con notas/recordatorios sobre CxC.

## Problema

- Un cliente puede comprar mil veces a crédito sin que nada le avise al vendedor que el límite
  se rebasó.
- No hay historial consolidado ni notas de contacto: la deuda vive solo en números.
- Los anticipos ya existen, pero no aparecen al decidir si se confía más crédito.

## Alcance operacional

1. **Vista 360**: al abrir el cliente, todo en un panel — compras, devoluciones, pagos, anticipos,
   CxC viva, contactos.
2. **Límite de crédito**: campo por cliente (`limiteCredito`, centavos, null = sin tope) y
   enforcement server-side al registrar venta a crédito o pedido. Superar el tope bloquea la venta
   salvo que el manager autorice con permiso (`operaciones.clientes.credito.override`, sensitive).
3. **Seguimiento de cobros**: etiqueta libre por cliente + nota/recordatorio simple con fecha.
   Nada de calendarios ni correos.

## No-goals

- Sin kanban ni pipeline comercial.
- Sin lead/quote scoring, sin marketing automation.
- Sin duplicar CxC (usa el modelo existente).
- Sin cambios en la venta; solo la guarda al crear.

## Criteria de aceptación

1. Cliente con límite 100; saldo 70; intento de venta a crédito por 50 → rechazada por defecto;
   con permiso override → pasa auditada.
2. El contexto para el tope lo calcula el servidor (ventas ENTREGADA/FACTURADA + saldo CxC por
   devoluciones).
3. Vista 360: abre el cliente y mostrar saldos, historial de compras, notas y últimos contactos.
4. Seguimiento: nota + recordatorio editable por cliente; las notas no tienen fecha futura
   obligatoria.
