# Puntos de Venta

> Administra las cajas o sucursales desde donde se vende, incluyendo ubicación y lista de precios asociada.

## Qué hace

Este módulo define las ubicaciones comerciales desde las que opera el sistema. Cada punto de venta puede tener nombre, ubicación y una lista de precios propia. Sobre esta entidad se apoyan ventas, turnos y consultas de productos por ubicación.

## Qué incluye

- listado y detalle de puntos de venta
- alta, edición y borrado
- asignación opcional de lista de precios
- uso operativo en ventas y turnos

## Cuándo usarlo

- Cuando abrís una nueva caja o sucursal.
- Cuando necesitás separar operaciones por ubicación comercial.
- Cuando querés asignar una lista de precios específica a una caja.
- Cuando una venta o un turno deben vincularse a un POS concreto.

## Reglas importantes

- nombre del punto de venta
- ubicación o dirección
- lista de precios opcional
- tipo operativo de caja, consumido por el flujo de turnos

## Qué conviene cuidar

- Asignar lista de precios requiere que el plan tenga habilitado ese feature.
- Si no hay lista de precios asociada, el POS usa el precio base del producto.
- El POS no reemplaza al almacén: define el punto comercial, mientras el stock se resuelve por ubicación.
- Cambios en el POS impactan directamente en ventas y turnos.

## Rutas y referencias

- `/busy/puntosDeVenta`
- `/busy/puntosDeVenta/new`
- `/busy/puntosDeVenta/update/[id]`
- `src/features/puntos-venta/actions.ts`
- `src/features/puntos-venta/components/pvtoVenta-form.tsx`
- `src/app/api/ventas/punto-venta/[puntoDeVentaId]/productos/route.ts`
- `src/app/api/ventas/punto-venta/[puntoDeVentaId]/turno-activo/route.ts`

## Relación con otros módulos

- **Ventas**: determina desde dónde se vende y qué stock se consulta.
- **Turnos POS**: cada turno pertenece a un punto de venta.
- **Listas de precios**: puede modificar el precio aplicado en caja.
- **Productos por ubicación**: expone productos y stock del POS.

## En una frase

Define desde qué caja se vende, con qué precios y bajo qué contexto operativo.
