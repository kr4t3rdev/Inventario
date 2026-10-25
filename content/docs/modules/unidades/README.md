# Unidades de Medida

> Mantiene el catálogo tenant-scoped de unidades de medida usadas por productos y formularios del inventario.

## Qué hace

Este módulo define cómo se expresa cantidad dentro del sistema: piezas, cajas, kilos, litros u otras unidades propias del tenant. Aunque parezca pequeño, es un dato estructural de productos, compras, producción y stock.

## Cuándo usarlo

- Cuando cargás nuevos productos, categorías o proveedores.
- Cuando querés revisar stock, precios o movimientos entre almacenes.
- Cuando necesitás corregir diferencias o mantener el inventario actualizado.
- Cuando el tenant necesita crear una unidad nueva no existente en su catálogo.

## Reglas importantes

- Las unidades son tenant-scoped en esta versión.
- Nombre y símbolo deben ser únicos dentro del tenant.
- El sistema hace pre-check de unicidad y también protege contra race conditions.
- No se puede eliminar una unidad si todavía está en uso por productos.
- Por defecto, las unidades nuevas quedan como `UNKNOWN`.

## Qué conviene cuidar

- Cambiar símbolo o nombre de una unidad repercute en formularios y lectura operativa.
- Antes de borrar, revisá dependencias porque la protección `IN_USE` es esperable.
- Conviene mantener el catálogo corto y consistente para no ensuciar el inventario.

## Rutas y referencias

- `/busy/unidad`
- `/busy/unidad/new`
- `/busy/unidad/update/[id]`
- `src/features/unidades/actions.ts`
- `src/features/unidades/validators.ts`

## En una frase

Define el idioma cuantitativo del inventario para que productos y movimientos hablen igual.
