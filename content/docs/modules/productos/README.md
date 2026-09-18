# Productos

> Administra el catálogo, el stock por ubicación y, cuando aplica, la generación de códigos EAN-13 basada en CLAS.

## Qué hace

Este módulo resuelve la gestión del catálogo comercial y logístico. Carga productos, precios y ubicaciones disponibles, pero además adapta su comportamiento cuando la empresa trabaja con EAN-13: cambia validaciones, bloquea parte de la taxonomía al editar y genera el código de negocio a partir de segmentos CLAS y proveedor.

## Qué incluye

- listado principal de productos del tenant
- stock por almacén y por punto de venta
- edición y alta con validaciones de negocio
- soporte para listas de precios y ubicaciones
- carga masiva de stock mínimo
- modo EAN-13 con código generado automáticamente

## Cuándo usarlo

- Cuando cargás nuevos productos, categorías o proveedores.
- Cuando querés revisar stock, precios o movimientos entre almacenes.
- Cuando necesitás corregir diferencias o mantener el inventario actualizado.
- Cuando tu empresa trabaja con clasificación CLAS y necesita emitir EAN-13.

## Reglas importantes

- La página carga productos, almacenes, puntos de venta y la configuración `usaCodigoEan13` del tenant en el servidor.
- Si `usaCodigoEan13=true`, el formulario exige datos extra y genera el código a partir de proveedor + taxonomía CLAS.
- En modo EAN-13, categoría y subcategoría pueden quedar bloqueadas al editar un producto ya emitido.
- El encabezado principal de la tabla cambia entre `codigoInterno` y `codigoNegocio` según el modo activo.

## Qué conviene cuidar

- Revisá unidad, categoría y precio antes de guardar.
- Si un producto ya existe, buscá primero antes de crear otro.
- No olvides comprobar el almacén correcto.
- El flujo EAN-13 depende de configuraciones de proveedor y categorías válidas.
- Stock y catálogo no son lo mismo: el producto puede existir pero no estar disponible en cierta ubicación.
- El modo EAN-13 no es solo visual; altera validaciones y persistencia.

## Relación con otros módulos

- **Categorías**: aporta secciones y específicos CLAS.
- **Mi Empresa**: define si el tenant opera con EAN-13.
- **Puntos de venta / Almacenes**: aportan ubicaciones donde se consulta stock.
- **Proveedores**: proveen segmentos para generar el código.

## Referencias útiles

- `src/app/busy/products/page.tsx`
- `src/features/productos/actions-crud.ts`
- `src/features/productos/components/productos-content.tsx`
- `src/features/productos/components/productos-form.tsx`

## En una frase

Es el catálogo vivo del negocio, con reglas normales o EAN-13 según cómo opere la empresa.
