# Compras Productos: Migración a Server Actions

## Purpose

Eliminar las dependencias de RTK Query en el feature `compras-productos`, 
migrando el formulario de creación y la página de edición a usar las Server Actions 
que ya existen en `features/compras-productos/actions.ts`.

## Requirements

### Requirement: Formulario de creación usa Server Action

El componente `CompraProductoForm` **MUST** usar `createCompraProductoAction` en lugar de
`useCreateCompraProductoMutation` para procesar el envío del formulario.

#### Scenario: Creación exitosa de compra

- GIVEN el formulario completo con proveedor, 2 productos con cantidades y costos
- AND forma de pago `PAGO_COMPLETO`
- WHEN el usuario hace submit
- THEN se llama a `createCompraProductoAction(payload)`
- AND si `result.success === true`, se muestra toast de éxito
- AND se redirige a `/busy/compras-productos`

#### Scenario: Error de validación desde el formulario

- GIVEN el formulario con datos inválidos (sin proveedor)
- WHEN el usuario hace submit
- THEN `createCompraProductoAction` retorna `{ success: false, error: { message: "..." } }`
- AND se muestra el mensaje de error en un toast
- AND NO se redirige

#### Scenario: Compra con pago parcial

- GIVEN forma de pago `PAGO_PARCIAL`, estado `PENDIENTE`
- WHEN el usuario hace submit exitoso
- THEN se muestra toast indicando que se generó cuenta por pagar
- AND se redirige a `/busy/compras-productos`

#### Scenario: Compra con anticipo

- GIVEN forma de pago `ANTICIPO_PAGO`, anticipoPagoId válido
- WHEN el usuario hace submit exitoso
- THEN se muestra toast indicando compra con anticipo
- AND se redirige a `/busy/compras-productos`

---

### Requirement: Página de edición usa Server Actions

La página `EditCompraProductoPage` **MUST** usar `getCompraProductoByIdAction` para cargar
los datos y `updateCompraProductoAction` para guardar los cambios.

#### Scenario: Carga de datos de compra existente

- GIVEN un `compraDocumentoId` válido en la URL
- WHEN la página se monta
- THEN se llama a `getCompraProductoByIdAction(id)`
- AND los datos se cargan en el formulario (numeroFactura, formaPago, estado, descripción)
- AND se muestra el resumen de la compra (proveedor, total, productos)

#### Scenario: Compra no encontrada

- GIVEN un `compraDocumentoId` que no existe
- WHEN se llama a `getCompraProductoByIdAction(id)`
- THEN la acción lanza `ActionError` con código `NOT_FOUND`
- AND la página muestra un estado de error

#### Scenario: Actualización exitosa

- GIVEN el formulario con datos modificados (nuevo número de factura)
- WHEN el usuario hace submit
- THEN se llama a `updateCompraProductoAction({ compraDocumentoId, ...data })`
- AND si `result.success === true`, se muestra toast de éxito
- AND se redirige a `/busy/compras-productos`

#### Scenario: Error al actualizar

- GIVEN un error del servidor al actualizar
- WHEN se llama a `updateCompraProductoAction`
- THEN la acción retorna `{ success: false, error: { message: "..." } }`
- AND se muestra toast de error
- AND NO se redirige

---

### Requirement: Eliminación de comprasProductosApi.ts

Una vez que ningún componente importe hooks de `comprasProductosApi`, el archivo
**MUST** ser eliminado. El barrel `features/compras-productos/index.ts` **MUST** 
solo exportar Server Actions y types.

#### Scenario: Barrel limpio post-migración

- GIVEN todos los hooks RTKQ migrados a Server Actions
- AND `grep` confirma 0 imports de `comprasProductosApi` fuera del archivo mismo
- WHEN se elimina `comprasProductosApi.ts`
- THEN el barrel exporta solo:
  - `getComprasProductosAction`, `getCompraProductoByIdAction`, `createCompraProductoAction`, `updateCompraProductoAction`, `deleteCompraProductoAction`
  - `CompraDocumento`, `CompraDocumentoItem`, `CompraDocumentoResponse`, `CompraProducto` (types)
- AND typecheck pasa sin errores

---

### Requirement: Tag de invalidación se preserva o elimina correctamente

El tag `ComprasProductos` en `apiSlice.tsx` **MUST** verificarse antes de eliminar.
Si otros features lo usan para invalidación de caché, se mantiene. Si no, se elimina.

#### Scenario: Tag usado solo por el slice eliminado

- GIVEN `grep` muestra que `ComprasProductos` solo aparece en `comprasProductosApi.ts` y `apiSlice.tsx`
- WHEN se elimina `comprasProductosApi.ts`
- THEN se elimina también el tag `'ComprasProductos'` de `apiSlice.tsx`

#### Scenario: Tag usado por otros features

- GIVEN otro feature (ej: `productosApi`) invalida `ComprasProductos`
- WHEN se elimina `comprasProductosApi.ts`
- THEN el tag se mantiene en `apiSlice.tsx`
