# Proposal: Compound Product Enhancements

## Intent

El sistema de productos compuestos tiene brechas funcionales críticas:
- El hijo no tiene precio de venta propio ni precios por lista configurables
- El código EAN-13 preview aparece aunque la empresa no lo use (ruido visual)
- El stock del hijo no se sincroniza automáticamente al comprar/vender el padre
- Los productos hijo aparecen en compras y transferencias, donde no deben estar

## Scope

### In Scope
- Agregar `precioVenta` opcional en el hijo (campo en `CompoundProductSection` + schema + payload)
- Agregar `preciosPorLista` para el hijo en el formulario (estado local paralelo al padre)
- Ocultar preview de código de negocio del hijo cuando `usaEan13 === false`
- Sincronizar stock hijo ↔ padre en las API routes de compra, venta y transferencia
- Excluir productos hijo (`productoPadreId != null`) del selector en `CompraProductoForm`
- Excluir productos hijo del `ProductoSelector` en `TransferenciasForm`

### Out of Scope
- Cambiar el modelo Prisma para agregar campos extra al hijo (reutiliza la tabla `Producto`)
- Interfaz de gestión de relaciones padre-hijo fuera del formulario de creación
- Ajuste de precios hijo desde la vista de edición del padre

## Approach

1. **Schema + CompoundProductSection**: agregar `precioVentaHijo` (optional, `z.number().positive()`) y `preciosPorListaHijo` (estado fuera del schema) al form. El campo aparece condicionalmente junto a `cantidadEnPack`. El preview del código hijo se envuelve en `{usaEan13 && ...}`.

2. **API routes (stock sync)**: en `POST /api/compras-productos` — cuando el producto comprado tiene al menos un hijo (`productosHijos`), incrementar también el stock del hijo en `cantidad * cantidadEnPack`. Misma lógica en `POST /api/ventas` al decrementar (vender hijo descuenta del padre: `floor(cantidadVendida / cantidadEnPack)`). Las operaciones deben ser atómicas dentro del mismo `prisma.$transaction`.

3. **Filtros en selectores**: 
   - `CompraProductoForm` → filtrar `products` con `.filter(p => !p.productoPadreId)` 
   - `TransferenciasForm.ProductoSelector` → mismo filtro en `filteredProducts`

4. **Precios hijo en payload**: `addProducto` recibe `precioVentaHijo` y `preciosPorListaHijo[]`; la API route de creación los aplica al crear el producto hijo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/productos/compound-product-section.tsx` | Modified | Nuevo campo `precioVentaHijo`, toggle de preview EAN-13 |
| `src/components/productos/productos-form.tsx` | Modified | Pasar `usaEan13` como prop a `CompoundProductSection`; estado `preciosPorListaHijo`; incluirlos en submit payload |
| `src/lib/redux/services/productosApi.tsx` | Modified | Ampliar `CompoundProductPayload` con `precioVentaHijo` y `preciosPorListaHijo` |
| `src/app/api/productos/route.ts` | Modified | Aplicar `precioVentaHijo` y `preciosPorListaHijo` al `Producto` hijo en creación |
| `src/app/api/compras-productos/route.ts` | Modified | Sync stock hijo al comprar padre (dentro de `$transaction`) |
| `src/app/api/ventas/route.ts` | Modified | Sync stock padre al vender hijo (y viceversa) |
| `src/components/compras/compra-producto-form.tsx` | Modified | Filtrar productos hijo del selector |
| `src/components/transferencias/transferencias-form.tsx` | Modified | Filtrar productos hijo en `ProductoSelector.filteredProducts` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Lógica de sync stock introduce inconsistencia si la transacción falla a mitad | Med | Todo en `$transaction` — si falla, revierte completo |
| Productos hijo existentes sin `productoPadreId` indexado en la API de listado | Low | El campo ya existe en el modelo Prisma; solo agregar `.filter()` en cliente |
| `precioVentaHijo` vacío rompe ventas del hijo si queda en `0` | Low | Campo opcional; si no se ingresa, se usa `precioVenta / cantidadEnPack` como fallback |
| Cambio de filtros en transferencias afecta transferencias ya en progreso con hijos | Low | Los hijos en transferencias existentes no se tocan, solo se filtra en el form nuevo |

## Rollback Plan

Todos los cambios son aditivos o filtros en cliente. Para revertir:
1. Eliminar el campo `precioVentaHijo` del form y payload
2. Quitar los filtros `!p.productoPadreId` en los selectores
3. Revertir los bloques de sync stock en las API routes (el stock quedará desincronizado, requiere ajuste manual)

No hay cambios de schema Prisma — no hace falta migración de rollback.

## Dependencies

- El campo `productoPadreId` ya existe en el modelo `Producto` (Prisma) — no se requiere migración
- El campo `cantidadEnPack` ya existe y es confiable como multiplicador

## Success Criteria

- [ ] Al crear un producto compuesto con `precioVentaHijo`, el producto hijo se guarda con ese precio de venta
- [ ] Al crear sin `precioVentaHijo`, el precio del hijo = `precioVenta / cantidadEnPack`
- [ ] Los precios por lista del hijo se guardan correctamente en backend
- [ ] El preview del código hijo NO aparece cuando `usaEan13 === false`
- [ ] El selector de `CompraProductoForm` no muestra productos hijo
- [ ] El `ProductoSelector` de transferencias no muestra productos hijo
- [ ] Al comprar 1 unidad del padre (con `cantidadEnPack = 20`), el stock del hijo sube 20
- [ ] Al vender 20 unidades del hijo, el stock del padre baja 1
