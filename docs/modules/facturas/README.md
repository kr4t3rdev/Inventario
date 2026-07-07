# Facturación

> Lista, consulta, actualiza y exporta facturas generadas por las ventas del tenant, con filtros por estado, cliente, serie y fechas.

## Qué hace

Este módulo trabaja sobre las facturas ya emitidas dentro del sistema. Permite revisar el documento, su serie, cliente, venta asociada y estado, además de actualizar datos operativos como vencimiento, términos de pago, método de pago u observaciones.

## Operaciones principales

- listar facturas con paginación
- filtrar por estado, cliente, serie y rango de fechas
- buscar por número de factura, cliente o producto vendido
- consultar detalle por ID
- actualizar estado y metadatos de la factura
- eliminar facturas cuando corresponde
- exportar documentos en PDF o CSV

## Cuándo usarlo

- Cuando necesitás revisar una factura emitida y su relación con la venta.
- Cuando querés cambiar estado, vencimiento o términos de pago.
- Cuando hace falta descargar una factura en formato documental o tabular.

## Reglas importantes

- El acceso depende de la feature `facturacion`.
- La pantalla de facturas no crea la factura desde cero: normalmente consume documentos generados desde ventas u otros flujos del sistema.
- El número visible combina serie y consecutivo de factura.
- Las exportaciones PDF/CSV usan relaciones con cliente, serie y venta asociada.

## Qué conviene cuidar

- Antes de cambiar estado, verificá que coincida con el cobro y la conciliación real.
- Si una factura parece inconsistente, revisá la venta asociada y la serie usada.
- El borrado impacta el historial documental del tenant.

## Relación con otros módulos

- **Ventas**: muchas facturas nacen desde la venta.
- **Series de facturación**: definen prefijo y consecutivo.
- **Mi Empresa**: aporta datos legales y bancarios para el documento final.

## Referencias útiles

- `src/app/busy/facturas/page.tsx`
- `src/features/facturas/actions.ts`
- `src/features/facturas/components/facturas-content.tsx`
- `src/features/facturas/api/handlers.ts`

## En una frase

Es el panel documental para revisar y mantener las facturas emitidas por el negocio.
