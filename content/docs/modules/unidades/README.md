# Unidades de Medida

> Mantiene el catálogo tenant-scoped de unidades de medida usadas por productos y formularios del inventario.

## Qué hace

Este módulo define cómo se expresa cantidad dentro del sistema: piezas, cajas, kilos, litros u otras unidades propias del tenant. Aunque parezca pequeño, es un dato estructural de productos, compras, producción y stock.

## Cuándo usarlo

- Cuando registras nuevos productos, categorías o proveedores.
- Cuando quieres revisar existencias, precios o movimientos entre almacenes.
- Cuando necesitas corregir diferencias o mantener el inventario actualizado.
- Cuando el tenant necesita crear una unidad nueva no existente en su catálogo.

## Reglas importantes

- Las unidades son tenant-scoped en esta versión.
- Nombre y símbolo deben ser únicos dentro del tenant.
- El sistema valida la unicidad antes de guardar y la respalda con restricciones de base de datos.
- No se puede eliminar una unidad si todavía está en uso por productos.
- Por defecto, las unidades nuevas quedan como `UNKNOWN`; también se puede definir una dimensión al crearlas.
- Se permite clasificar una unidad `UNKNOWN` ya referenciada solo si todas sus conversiones usan una dimensión compatible; no se recalculan existencias ni registros históricos.
- Una unidad conocida no puede cambiar de dimensión mientras tenga productos o conversiones asociadas.

## Configuración de dimensiones

- Las dimensiones disponibles son cantidad, masa, volumen, longitud, área y desconocida (`UNKNOWN`).
- La dimensión se puede seleccionar al crear o editar una unidad; `UNKNOWN` es el valor predeterminado.
- La clasificación de una unidad `UNKNOWN` valida las conversiones donde actúa como unidad de origen o base. Si el otro extremo es desconocido o incompatible, se rechaza el cambio; la identidad de una unidad consigo misma se conserva.
- Una unidad conocida en uso tampoco puede volver a `UNKNOWN`.
- Las actualizaciones antiguas que omiten la dimensión conservan su valor actual. Las solicitudes que la incluyen se comparan con una lectura dentro de la transacción, incluso si parecen no cambiarla.
- Los conflictos concurrentes no se reintentan automáticamente. Si un guardado falla, vuelve a cargar la unidad para confirmar su dimensión antes de reintentar.
- Esta configuración no administra factores por producto ni añade selección de unidades a compras: son incrementos posteriores.

El estado de implementación, las pruebas y los pendientes de publicación se registran en `openspec/changes/unit-dimension-configuration/`.

## Qué conviene cuidar

- Cambiar símbolo o nombre de una unidad repercute en formularios y lectura operativa.
- Antes de borrar, revisa las dependencias porque la protección `IN_USE` es esperable.
- Conviene mantener el catálogo corto y consistente para no ensuciar el inventario.

## Rutas y referencias

- `/busy/unidad`
- `/busy/unidad/new`
- `/busy/unidad/update/[id]`
- `src/features/unidades/actions.ts`
- `src/features/unidades/validators.ts`

## En una frase

Define el idioma cuantitativo del inventario para que productos y movimientos hablen igual.
