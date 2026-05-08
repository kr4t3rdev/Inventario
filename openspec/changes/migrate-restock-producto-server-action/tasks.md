# Tasks: Migrar useRestockProductoMutation a Server Action

## Phase 1: Schema + Server Action

- [x] 1.1 Agregar `restockSchema` en `features/productos/schemas.ts` con Zod: validar `productoId`, `cantidad`, `precioCosto`, `precioVenta`, `descripcion`, `numeroFactura`, `facturaUrl`, `formaPago`, `estado`, `moneda`, `tasaCambio`, `montoConvertido`, `monedaOriginal`, `montoOriginal`, `cuentaId`, `tipoRestock`
- [x] 1.2 Crear `restockProductoAction` en `features/productos/actions.ts` con `withAction` + `requireTenant`:
  - Validar input con `restockSchema.parse()`
  - Verificar existencia del producto (`prisma.producto.findUnique`)
  - Si `tipoRestock === "nueva_instancia"`, ejecutar workflow de creación de instancia (replicar `executeProductInstanceCreationWorkflow` del handler)
  - Actualizar `producto.stock += cantidad` y `precioCosto/precioVenta` si vienen
  - Hacer upsert de `StockUbicacion` para el almacén del producto
  - Crear `GastoCompra` + `CompraProducto`
  - Si `formaPago === "PAGO_COMPLETO"`: reconciliación bancaria + decremento de `CuentaBancaria.saldo`
  - Si `formaPago === "PAGO_PARCIAL"`: crear `CuentaPorPagar`
  - `revalidatePath('/busy/products')`
  - Retornar `{ success: true, data: { producto, gastoCompra } }`
- [x] 1.3 Manejar conversión de monedas: si `moneda` no es CUP, calcular `montoConvertido = totalCost * tasaCambio` y registrar ambos montos

## Phase 2: Frontend — restock-form.tsx

- [x] 2.1 Reemplazar `import { useRestockProductoMutation } from "@/features/productos"` por `import { restockProductoAction } from "@/features/productos/actions"`
- [x] 2.2 Eliminar `const [restockProducto] = useRestockProductoMutation()`
- [x] 2.3 En el submit handler (~línea 254), reemplazar `await restockProducto(restockRequest).unwrap()` por `const result = await restockProductoAction(restockRequest)`
- [x] 2.4 Adaptar manejo de errores (~línea 261-280): usar `result.success` y `result.error?.message` en lugar de `error.data.error.message`
- [x] 2.5 Verificar que `onSuccess()` se llame después de un restock exitoso

## Phase 3: Tests

- [x] 3.1 Escribir test unitario en `features/productos/__tests__/actions.test.ts`: `describe('restockProductoAction')`
- [x] 3.2 Test: restock simple (solo cantidad) → stock incrementa, `StockUbicacion` actualizado
- [x] 3.3 Test: restock con `PAGO_COMPLETO` → `GastoCompra` en estado PAGADA, cuenta bancaria decrementada
- [x] 3.4 Test: restock con `PAGO_PARCIAL` → `GastoCompra` en estado PENDIENTE, `CuentaPorPagar` creada
- [x] 3.5 Test: restock con moneda extranjera → `montoConvertido` calculado correctamente
- [x] 3.6 Test: producto no existe → error `NOT_FOUND`
- [x] 3.7 Test: payload inválido → error `VALIDATION_ERROR`
- [x] 3.8 Test: `tipoRestock = "nueva_instancia"` → nuevo producto creado, original intacto

## Phase 4: Limpieza

- [x] 4.1 Eliminar `useRestockProductoMutation` del barrel `features/productos/index.ts`
- [x] 4.2 Agregar `restockProductoAction` al barrel export
- [x] 4.3 Verificar con `grep` que `useRestockProductoMutation` no tenga consumidores fuera de `productosApi.ts` → 0 resultados
- [x] 4.4 Eliminar `features/productos/api/productosApi.ts`
- [x] 4.5 Verificar que `productosApi` no se importa desde ningún otro lugar → 0 resultados
- [ ] 4.6 `pnpm run typecheck` → 0 errores nuevos
- [ ] 4.7 `pnpm run test:run` → tests pasan
- [ ] 4.8 Commit: `refactor: migrate restockProducto to Server Action — delete productosApi.ts`
