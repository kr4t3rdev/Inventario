# Tasks: Compound Product Enhancements

## Phase 1: Tipos e interfaces

- [x] 1.1 En `src/lib/redux/services/productosApi.tsx`, agregar `precioVentaHijo?: number` y `preciosPorListaHijo?: Array<{listaPrecioId: string; precio: number}>` a `CompoundProductPayload`

## Phase 2: Formulario — campos del hijo

- [x] 2.1 En `src/components/productos/compound-product-section.tsx`, agregar prop `usaEan13: boolean` a `CompoundProductSectionProps`
- [x] 2.2 En `compound-product-section.tsx`, envolver el bloque de preview del código hijo (`Label "Código del producto hijo (preview)"` + grid + Input read-only) en `{usaEan13 && (...)}`
- [x] 2.3 En `compound-product-section.tsx`, agregar campo `Input` de `precioVentaHijo` (type number, optional) debajo de `nombreHijo`; mostrar solo cuando `isCompound === true`; leer/escribir via `form.setValue('precioVentaHijo', ...)`
- [x] 2.4 En `compound-product-section.tsx`, agregar grid de `preciosPorListaHijo`: recibe `listasPrecios` como prop y `preciosPorListaHijo / onPreciosPorListaHijoChange` como estado controlado externo; mismo patrón que el grid del padre
- [x] 2.5 En `src/components/productos/productos-form.tsx`, agregar `precioVentaHijo` al `productosSchema` con `z.preprocess((v) => ..., z.number().positive().optional())`
- [x] 2.6 En `productos-form.tsx`, agregar estado `preciosPorListaHijo: Record<string, string>` (inicializado vacío; no hay edición de hijo)
- [x] 2.7 En `productos-form.tsx`, incluir `precioVentaHijo` en `defaultValues` y pasarlo en el `payload` dentro de `onSubmit` solo cuando `esCompuesto === true`
- [x] 2.8 En `productos-form.tsx`, pasar `usaEan13` como prop a `<CompoundProductSection>`, junto con `listasPrecios`, `preciosPorListaHijo` y `onPreciosPorListaHijoChange`
- [x] 2.9 En `productos-form.tsx`, incluir `preciosPorListaHijo: buildPreciosPayload(preciosPorListaHijo)` en el payload de `addProducto` cuando `esCompuesto === true`

## Phase 3: API de creación — guardar precios del hijo

- [x] 3.1 En `src/app/api/productos/route.ts`, extraer `precioVentaHijo` y `preciosPorListaHijo` del body en ambas ramas (con y sin EAN-13)
- [x] 3.2 En la **rama sin EAN-13**, calcular `childPrecioVenta = precioVentaHijo > 0 ? precioVentaHijo : childPrices.precioVentaUnitario` y usarlo al crear el hijo con `prisma.producto.create`
- [x] 3.3 En la **rama sin EAN-13**, si `preciosPorListaHijo` es array no vacío, agregar `precios: { create: preciosPorListaHijo.map(...) }` al `prisma.producto.create` del hijo
- [x] 3.4 Repetir 3.2 y 3.3 en la **rama con EAN-13** donde se crea el producto hijo

## Phase 4: Sync de stock en compras

- [x] 4.1 En `src/app/api/compras-productos/route.ts`, cambiar el `findUnique` del producto para incluir `productosHijos: { select: { id: true, cantidadEnPack: true } }`
- [x] 4.2 Dentro del `prisma.$transaction`, después del `update` de stock del padre, agregar: si `producto.productosHijos.length > 0`, hacer `tx.producto.update` en el primer hijo con `stock: { increment: data.cantidad * producto.cantidadEnPack }`

## Phase 5: Sync de stock en ventas

- [x] 5.1 En `src/app/api/ventas/route.ts`, en `crearVentaIndividual`: fetch del producto con `select: { id, precioVenta, productoPadreId, cantidadEnPack }`
- [x] 5.2 En `crearVentaIndividual`, dentro del `prisma.$transaction`, tras `tx.venta.create`: si `producto.productoPadreId`, calcular `parentDecrement = Math.floor(cantidad / producto.cantidadEnPack!)` y si `>= 1`, ejecutar `tx.producto.update` en el padre con `stock: { decrement: parentDecrement }`
- [x] 5.3 En `crearVentaUnica`, en el loop de `productosConPrecio`: incluir `productoPadreId` y `cantidadEnPack` en el `select` de cada item
- [x] 5.4 En `crearVentaUnica`, dentro del `prisma.$transaction`, tras `tx.venta.create`: iterar items con `productoPadreId` y aplicar el mismo `floor` + `tx.producto.update` en el padre para cada uno

## Phase 6: Filtros de selectores

- [x] 6.1 En `src/components/compras/compra-producto-form.tsx`, filtrar el array `products` con `.filter(p => !p.productoPadreId)` antes de pasarlo al selector
- [x] 6.2 En `src/components/transferencias/transferencias-form.tsx`, en `ProductoSelector.filteredProducts`, agregar condición `&& !p.productoPadreId` en el `.filter()`

## Phase 7: Testing

- [x] 7.1 En `src/components/productos/__tests__/productos-form.test.tsx`, agregar test: render con `usaEan13=false` + `esCompuesto=true` → preview código hijo no visible en DOM
- [x] 7.2 Agregar test: `CompraProductoForm` con lista de productos que incluye hijo (`productoPadreId` seteado) → hijo no aparece en opciones del selector
- [x] 7.3 Agregar test: `ProductoSelector` de transferencias con hijo en la lista → hijo no aparece en `filteredProducts`
- [x] 7.4 Agregar test de integración en API route `POST /api/compras-productos`: comprar padre con `cantidadEnPack=20` → hijo recibe `stock increment 20`
- [x] 7.5 Agregar test: `POST /api/ventas` venta de hijo con `cantidad=24, cantidadEnPack=24` → padre recibe `stock decrement 1`
- [x] 7.6 Agregar test: `POST /api/ventas` venta de hijo con `cantidad=15, cantidadEnPack=20` → padre stock sin cambio (floor=0)
