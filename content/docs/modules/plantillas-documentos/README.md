# Plantillas de Documentos

> Permite crear, activar, editar y reutilizar plantillas para generar documentos repetitivos más rápido.

## Qué hace

Este módulo organiza plantillas reutilizables para contratos, facturas, remisiones, reportes y otros documentos. Desde la vista principal se puede ver el catálogo, activar o desactivar plantillas, eliminar las que ya no sirven y abrir el flujo para generar documentos a partir de una plantilla.

## Qué incluye

- listar plantillas disponibles
- crear una nueva plantilla
- editar una plantilla existente
- activar o desactivar una plantilla
- eliminar plantillas
- generar un documento usando una plantilla concreta

## Reglas importantes

- La vista actual usa endpoints legacy y `Authorization: Bearer` desde cliente.
- Desactivar una plantilla no la elimina, solo la saca de circulación.
- El historial de documentos generados depende del uso posterior de cada plantilla.

## Tipos visibles en la UI

- `CONTRATO_VENTA`
- `CONTRATO_PROVEEDOR`
- `CONTRATO_EMPLEADO`
- `FACTURA`
- `NOTA_CREDITO`
- `NOTA_DEBITO`
- `REMISION`
- `ORDEN_COMPRA`
- `REPORTE`
- `OTRO`

## Cuándo usarlo

- Cuando necesitás estandarizar documentos frecuentes.
- Cuando querés reducir trabajo manual al emitir contratos o reportes.
- Cuando una plantilla ya quedó obsoleta y hay que desactivarla sin borrarla.

## Qué conviene cuidar

- Conviene mantener nombres y categorías claras para no duplicar plantillas con el mismo propósito.
- Si una plantilla queda obsoleta, suele ser mejor desactivarla antes que borrarla sin revisar dependencias.

## Rutas y referencias

- `/busy/plantillas-documentos`
- `/busy/plantillas-documentos/new`
- `/busy/plantillas-documentos/[plantillaId]`
- `/busy/plantillas-documentos/[plantillaId]/generar`
- `src/app/busy/plantillas-documentos/page.tsx`

## En una frase

Te da una base reutilizable para producir documentos consistentes sin arrancar desde cero cada vez.
