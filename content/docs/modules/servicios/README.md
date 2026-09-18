# Servicios

> Mantiene el catálogo de servicios del tenant y sirve de base para vender, comprar, ofertar y costear servicios.

## Qué hace

Este módulo administra el maestro de servicios, no solo las ventas. Desde acá se crean, editan y eliminan servicios con nombre, descripción, precio y moneda. El catálogo luego se reutiliza en servicios prestados, servicios recibidos, ofertas y ficha de costo.

## Qué incluye

- listado de servicios del tenant
- alta, edición y detalle por ID
- control de moneda y precio
- validación de referencias antes de eliminar
- acceso a historial de servicios prestados desde la vista principal

## Cuándo usarlo

- Cuando querés mantener ordenado el catálogo de lo que la empresa ofrece o consume como servicio.
- Cuando necesitás definir precio y descripción antes de vender o registrar un servicio recibido.
- Cuando una oferta o ficha de costo necesita reutilizar un servicio existente.

## Reglas importantes

- El acceso depende de la feature `servicios`.
- Crear, editar o eliminar servicios requiere rol manager para mutations.
- Un servicio no se puede borrar si está referenciado por ventas, compras u ofertas.
- La vista principal combina catálogo e historial de ventas de servicio.

## Qué conviene cuidar

- Si el catálogo está mal, después se rompen varios módulos a la vez.
- La moneda del servicio impacta compras de servicio y ficha de costo.
- Borrar referencias vivas está bloqueado por diseño; eso es una protección, no un bug.

## Rutas y referencias

- `/busy/servicios`
- `/busy/servicios/new`
- `/busy/servicios/update/[id]`
- `/busy/servicios/prestados`
- `/busy/servicios/recibidos`
- `src/features/servicios/actions.ts`

## En una frase

Es el catálogo maestro que conecta la operación comercial y contable de los servicios.
