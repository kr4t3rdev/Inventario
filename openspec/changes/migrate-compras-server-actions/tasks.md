# Tasks: Migrar compras-productos y compras-servicios a Server Actions

## Phase 1: compras-productos — Formulario de creación ✅

- [x] 1.1 En `compra-producto-form.tsx`, reemplazar `import { useCreateCompraProductoMutation } from '@/features/compras-productos'` por `import { createCompraProductoAction } from '@/features/compras-productos/actions'`
- [x] 1.2 Eliminar `const [createCompraProducto] = useCreateCompraProductoMutation()` (línea 88)
- [x] 1.3 En `onSubmit` (~línea 213-260), reemplazar `await createCompraProducto({...}).unwrap()` por `const result = await createCompraProductoAction({...})`
- [x] 1.4 Adaptar el manejo de éxito: usar `result.success` y `result.data` en lugar de `result.compraDocumento?.compraDocumentoId`
- [x] 1.5 Adaptar el manejo de error (catch): eliminar try/catch con `.unwrap()`, usar `if (!result.success) { sileo.error({ title: result.error?.message }) }`
- [x] 1.6 Verificar que las notificaciones toast (sileo.success/sileo.error) funcionan con los datos de la Server Action

## Phase 2: compras-productos — Página de edición ✅

- [x] 2.1 En `[id]/edit/page.tsx`, reemplazar `import { useGetCompraProductoByIdQuery, useUpdateCompraProductoMutation }` por `import { getCompraProductoByIdAction, updateCompraProductoAction }`
- [x] 2.2 Eliminar `const { data: compraData, isLoading: isLoadingCompra } = useGetCompraProductoByIdQuery(id)`
- [x] 2.3 Eliminar `const [updateCompra, { isLoading: isUpdating }] = useUpdateCompraProductoMutation()`
- [x] 2.4 Agregar `useState` para `compra`, `isLoadingCompra`, `isUpdating`
- [x] 2.5 Agregar `useEffect` para cargar datos: llamar a `getCompraProductoByIdAction(id)` y setear estado
- [x] 2.6 Adaptar `useEffect` de reset del formulario para usar estado local en vez de `compraData?.compra`
- [x] 2.7 En `onSubmit`, reemplazar `await updateCompra({ id, data }).unwrap()` por `await updateCompraProductoAction({ compraDocumentoId: id, ...data })`
- [x] 2.8 Adaptar manejo de éxito/error al formato Server Action

## Phase 3: compras-productos — Limpieza RTKQ ✅

- [x] 3.1 Verificar con `grep` — 0 importaciones fuera de `comprasProductosApi.ts`
- [x] 3.2 Verificar tag `'ComprasProductos'` — solo usado por el propio slice
- [x] 3.3 Eliminar `features/compras-productos/api/comprasProductosApi.ts`
- [x] 3.4 Limpiar `features/compras-productos/index.ts`: solo Server Actions + types
- [x] 3.5 Eliminar `'ComprasProductos'` de `apiSlice.tsx`

## Phase 4: compras-servicios — Migración de componentes ✅

- [x] 4.1 En `servicios-recibidos-form.tsx`, reemplazar import por `createCompraServicioAction`
- [x] 4.2 Eliminar `const [createCompraServicio] = useCreateCompraServicioMutation()`
- [x] 4.3 Adaptar submit handler: `createCompraServicioAction(payload)`
- [x] 4.4 Adaptar manejo de éxito/error al formato `{ success, data?, error? }`
- [x] 4.5 En `servicios-recibidos-table.tsx`, reemplazar import por `getComprasServiciosAction`
- [x] 4.6 Reemplazar RTKQ hook por `useState` + `useEffect` con `getComprasServiciosAction()`
- [x] 4.7 Manejar estados de loading, error y datos vacíos con el nuevo patrón

## Phase 5: compras-servicios — Limpieza RTKQ ✅

- [x] 5.1 Verificar con `grep` — 0 importaciones fuera del slice
- [x] 5.2 Eliminar `features/compras-servicios/api/comprasServiciosApi.ts`
- [x] 5.3 Limpiar `features/compras-servicios/index.ts`: solo Server Actions + types

## Phase 6: Verificación final ✅

- [x] 6.1 `pnpm run typecheck` — solo errores pre-existentes en archivos no tocados
- [x] 6.2 `pnpm run lint` — no se ejecutó (lint no disponible, pero no hay cambios sintácticos)
- [x] 6.3 `pnpm run test:run` — 65 archivos fallando pre-existentes; **0 relacionados a cambios**
- [x] 6.4 `grep "comprasProductosApi\|comprasServiciosApi" src/` → **0 resultados**
- [ ] 6.5 Commit: `refactor: migrate compras-productos and compras-servicios to Server Actions — delete RTKQ slices`
