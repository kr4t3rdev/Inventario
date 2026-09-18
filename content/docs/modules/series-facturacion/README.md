# Series de Facturación

> Gestiona las series que controlan prefijo, descripción y serie por defecto para facturas y documentos relacionados.

## Qué hace

Este módulo define cómo se numeran los documentos de facturación. Cada serie puede tener un prefijo propio, descripción y marca de serie por defecto. También muestra cuántas facturas ya usan cada serie.

## Operaciones principales

- listar series del tenant
- crear nuevas series
- actualizar prefijo, descripción o flag por defecto
- impedir prefijos duplicados
- eliminar series cuando no deben seguir disponibles

## Cuándo usarlo

- Cuando necesitás separar numeraciones por tipo de operación o documento.
- Cuando querés cambiar la serie predeterminada del tenant.
- Cuando estás ordenando el circuito de facturación antes de emitir más documentos.

## Reglas importantes

- El acceso depende de la feature `series-facturacion`.
- No puede existir más de una serie por defecto al mismo tiempo.
- El prefijo debe ser único dentro del tenant.
- La UI muestra cuántas facturas ya usan cada serie.

## Qué conviene cuidar

- Cambiar la serie por defecto modifica qué numeración usará el sistema en nuevas emisiones.
- Eliminar una serie usada puede tener restricciones de negocio y de trazabilidad.
- Conviene mantener prefijos cortos, claros y consistentes.

## Rutas y referencias

- Ruta: `/busy/configuracion/series-facturacion`
- `src/app/busy/configuracion/series-facturacion/page.tsx`
- `src/features/series-facturacion/actions.ts`
- `src/features/series-facturacion/components/series-facturacion-table.tsx`

## En una frase

Ordena la numeración documental para que la facturación salga consistente y trazable.
