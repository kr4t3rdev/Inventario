# Listas de Precios

> Define listas de precios alternativas por tenant y las vincula con puntos de venta para cambiar el precio aplicado en caja.

## Qué hace

Este módulo permite crear y mantener listas de precios separadas del precio base del producto. Cada lista puede marcarse como predeterminada y además mostrar cuántos puntos de venta y precios específicos la están usando.

## Qué incluye

- listado de listas del tenant
- alta, edición y borrado
- una lista por defecto
- conteo de puntos de venta y precios asociados
- vínculo operativo con puntos de venta

## Cuándo usarlo

- Cuando necesitás precios distintos según canal o caja.
- Cuando querés cambiar qué lista usa un punto de venta.
- Cuando el precio base del producto ya no alcanza para todos los escenarios comerciales.

## Reglas importantes

- El acceso depende de la feature `listas-precios`.
- Solo puede existir una lista predeterminada por tenant.
- No se puede borrar una lista que siga asociada a un punto de venta.
- El módulo cambia precios aplicados, no stock ni catálogo base.
- **Cadena de prioridad al vender**: lista asignada al cliente > lista asignada al punto de venta > precio base del producto. El servidor valida esa prioridad en cada venta ([detalle](../ventas/integridad-precios.md)).
- La lista del cliente se asigna en la ficha del cliente (`Cliente.listaPrecioId`) y se aplica en el POS y en las ofertas.
- Nota: la marca "predeterminada" (`esDefault`) por ahora solo es administrativa; no entra en la cadena de resolución (previsto en LP-1).

## Qué conviene cuidar

- Cambiar la lista por defecto o la lista asociada a un POS impacta ventas nuevas.
- Conviene distinguir bien listas promocionales, mayoristas o por canal.

## Rutas y referencias

- `/busy/listas-precios`
- `src/features/listas-precios/actions.ts`
- `openspec/changes/archive/2026-09-12-ventas-precio-server-lp0/` (LP-0: integridad de precios server-side)

## En una frase

Te permite separar la estrategia de precios del precio base del producto.
