# Tasks: Migrar Productos a Server Components

## Phase 1: Cleanup y contratos base

- [ ] 1.1 Ajustar `src/features/productos/actions.ts` para envolver `updateProductoAction` en `prisma.$transaction` junto con los upserts de `precioProducto`.
- [ ] 1.2 Extraer o unificar en `src/features/productos/components/restock-history.tsx` un contrato de datos estable para historial de restock que no dependa de RTK Query.
- [ ] 1.3 Refactorizar `src/features/productos/components/restock-history-dialog.tsx` para eliminar la dependencia de `useGetRestockHistoryQuery`.
- [ ] 1.4 Definir/ajustar tipos compartidos para historial de restock en `src/features/productos/types.ts` o un módulo shared equivalente.

## Phase 2: Server-first del listado de Productos

- [ ] 2.1 Convertir `src/app/busy/products/page.tsx` a Server Component y mover allí la obtención inicial de productos.
- [ ] 2.2 Resolver en server los datos base que hoy se cargan en cliente para la página de Productos.
- [ ] 2.3 Pasar los datos iniciales al árbol client por props en lugar de `useEffect`/fetch cliente.
- [ ] 2.4 Mantener `src/features/productos/components/enhanced-data-table.tsx` como client island, pero alimentado con props server-provided.

## Phase 3: Server-first del formulario de Productos

- [ ] 3.1 Modificar `src/features/productos/components/productos-form.tsx` para recibir catálogos y defaults desde un wrapper server.
- [ ] 3.2 Eliminar fetch client-side de catálogos en `productos-form.tsx` donde sea posible, reemplazándolo por props.
- [ ] 3.3 Ajustar `src/features/productos/components/product-filters.tsx` para que opere con datos precargados y sin fetch innecesario.
- [ ] 3.4 Verificar que `src/features/productos/components/cost-history-dialog.tsx` siga funcionando como client island independiente.

## Phase 4: Depuración de RTK Query residual

- [ ] 4.1 Auditar y eliminar imports/exports RTK Query específicos de Productos que queden sin consumidores.
- [ ] 4.2 Revisar `src/features/productos/index.ts` para retirar cualquier export obsoleto relacionado con el flujo migrado.
- [ ] 4.3 Verificar si `src/features/productos/api/*` puede reducirse o eliminarse sin romper otros consumidores.

## Phase 5: Testing y verificación

- [ ] 5.1 Escribir/ajustar tests unitarios para `updateProductoAction` con transacción en `src/features/productos/__tests__/actions.test.ts`.
- [ ] 5.2 Escribir test para el contrato de historial de restock en `src/features/productos/components/restock-history*.test.tsx` o helper equivalente.
- [ ] 5.3 Verificar que `/busy/products` renderiza como Server Component sin regresiones funcionales.
- [ ] 5.4 Verificar flujo end-to-end de crear, editar, restock y listar productos con la nueva arquitectura.
- [ ] 5.5 Ejecutar typecheck y tests focalizados sobre los archivos tocados.
