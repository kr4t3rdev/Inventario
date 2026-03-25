# Tasks: Productos Compuestos (Cajas/Conjuntos)

## Phase 1: Foundation / Database

- [x] 1.1 Modificar `prisma/schema.prisma` - Agregar campo `esCompuesto Boolean @default(false)` al modelo Producto
- [x] 1.2 Modificar `prisma/schema.prisma` - Agregar campo `cantidadEnPack Int?` al modelo Producto
- [x] 1.3 Modificar `prisma/schema.prisma` - Agregar campo `productoPadreId String?` con self-reference al modelo Producto
- [x] 1.4 Modificar `prisma/schema.prisma` - Agregar relaciones `productoPadre Producto? @relation("ProductoCompuesto")` y `productosHijos Producto[] @relation("ProductoCompuesto")`
- [x] 1.5 Modificar `prisma/schema.prisma` - Agregar índices `@@index([esCompuesto])` y `@@index([productoPadreId])`
- [x] 1.6 Ejecutar `npx prisma generate` para regenerar el cliente de Prisma
- [x] 1.7 Crear migración de base de datos con `npx prisma migrate dev --name add_compound_product_fields`

## Phase 2: API Layer

- [x] 2.1 Modificar `src/app/models/model.ts` - Agregar interfaz `CompoundProductConfig` y tipos relacionados
- [x] 2.2 Modificar `src/app/api/productos/route.ts` - Agregar validación de campos compuestos en POST
- [x] 2.3 Modificar `src/app/api/productos/route.ts` - Agregar lógica de creación de producto hijo dentro de transacción
- [x] 2.4 Modificar `src/app/api/productos/route.ts` - Implementar cálculo de precio: `precioHijo = Math.round(precioPadre / cantidad)`
- [x] 2.5 Modificar `src/app/api/productos/route.ts` - Agregar heredación de categoría, unidad y almacén al producto hijo
- [x] 2.6 Modificar `src/app/api/productos/[id]/route.ts` - Agregar validación al DELETE: rechazar si es compuesto y tiene hijos
- [x] 2.7 Modificar `src/app/api/productos/route.ts` - Agregar filtro opcional `esCompuesto` al GET

## Phase 3: Redux/State Management

- [x] 3.1 Modificar `src/lib/redux/services/productosApi.tsx` - Agregar tipo `CreateCompoundProductoPayload`
- [x] 3.2 Modificar `src/lib/redux/services/productosApi.tsx` - Agregar endpoint `useCrearProductoCompuestoMutation` si la respuesta es diferente

## Phase 4: Frontend - Components

- [x] 4.1 Crear `src/components/productos/compound-product-section.tsx` - Componente de sección de productos compuestos
- [x] 4.2 Crear `src/components/productos/compound-product-section.tsx` - Agregar checkbox "Es Producto Compuesto" con AnimatePresence
- [x] 4.3 Crear `src/components/productos/compound-product-section.tsx` - Agregar Select para producto secundario (solo productos no compuestos)
- [x] 4.4 Crear `src/components/productos/compound-product-section.tsx` - Agregar Input numérico para cantidad en pack
- [x] 4.5 Crear `src/components/productos/compound-product-section.tsx` - Agregar Input para código de negocio del hijo
- [x] 4.6 Crear `src/components/productos/compound-product-section.tsx` - Agregar Input para nombre del hijo (ej: "Cigarro (unidad)")
- [x] 4.7 Crear `src/components/productos/compound-product-section.tsx` - Agregar preview de precio calculado con fórmula
- [x] 4.8 Crear `src/components/productos/compound-product-section.tsx` - Agregar validación: cantidad > 0, producto secundario requerido
- [x] 4.9 Crear `src/components/productos/compound-product-section.tsx` - Aplicar estilos visuales (gradiente, animaciones framer-motion)
- [x] 4.10 Modificar `src/components/productos/productos-form.tsx` - Importar y renderizar `CompoundProductSection` después de la sección de precios
- [x] 4.11 Modificar `src/components/productos/productos-form.tsx` - Agregar estado `isCompound` y handler de toggle
- [x] 4.12 Modificar `src/components/productos/productos-form.tsx` - Agregar campos compuestos al schema Zod
- [x] 4.13 Modificar `src/components/productos/productos-form.tsx` - Incluir campos compuestos en el payload de submit

## Phase 5: Testing

- [x] 5.1 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: creación de producto compuesto exitosamente
- [x] 5.2 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: validación de cantidad = 0 debe fallar
- [x] 5.3 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: validación sin producto secundario debe fallar
- [x] 5.4 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: precio hijo calculado correctamente (divisible)
- [x] 5.5 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: precio hijo con redondeo (no divisible)
- [x] 5.6 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: código de negocio hijo debe ser único
- [x] 5.7 Crear `src/__tests__/api/productos/compound-product.test.ts` - Test: eliminación de padre con hijos debe fallar

## Phase 6: Integration Verification

- [x] 6.1 Verificar que el formulario muestra la sección compuesta solo cuando el checkbox está marcado
- [x] 6.2 Verificar que al crear un compuesto se generan correctamente padre e hijo
- [x] 6.3 Verificar que el hijo aparece en el listado de productos con su código único
- [x] 6.4 Verificar que no se puede eliminar un producto padre que tiene hijos
- [x] 6.5 Verificar que el precio del hijo se muestra correcto en el formulario

## Phase 7: Cleanup / Polish

- [x] 7.1 Agregar comentarios JSDoc al componente `CompoundProductSection`
- [x] 7.2 Verificar que no hay errores de TypeScript
- [x] 7.3 Ejecutar `pnpm run lint` y corregir warnings
- [x] 7.4 Verificar build con `pnpm run build`
