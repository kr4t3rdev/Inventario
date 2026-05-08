# Proposal: Migrar useRestockProductoMutation a Server Action

## Intent

`useRestockProductoMutation` es el **último hook RTK Query** que queda en el feature `productos`.
Su handler `restockProductoHandler` (820 líneas, `features/productos/api/handlers.ts:1289-2109`)
es el más complejo de todo el feature porque entrelaza:

- Actualización de stock + StockUbicacion
- Creación de `GastoCompra` + `CompraProducto`
- Flujo de pagos (PAGO_COMPLETO/PAGO_PARCIAL) con reconciliación bancaria
- Creación de `CuentaPorPagar` cuando es pago parcial
- Conversión de monedas (CUP, MLC, USD, EUR)
- Workflow de creación de nueva instancia de producto (`tipoRestock`)

Migrarlo a Server Action permite **eliminar `productosApi.ts`** completamente,
cerrando la migración RTKQ → Server Actions del feature productos.

## Scope

### In Scope

- Crear `restockProductoAction` en `features/productos/actions.ts`
- Implementar validación Zod del payload de restock
- Replicar la lógica core: actualización de stock + StockUbicacion + GastoCompra
- Replicar el flujo de pagos: reconciliación bancaria + CuentaPorPagar
- Replicar el manejo de monedas y tasas de cambio
- Migrar `restock-form.tsx` (821 líneas) de `useRestockProductoMutation` a `restockProductoAction`
- Escribir tests unitarios para la Server Action (Vitest)
- Eliminar `useRestockProductoMutation` y `productosApi` del barrel
- Eliminar `productosApi.ts` si ningún otro consumidor queda

### Out of Scope

- Migrar otros hooks RTKQ de otros features (almacenes, puntos-venta, etc.)
- Eliminar el handler API route `restockProductoHandler` (tests existentes dependen de él)
- Modificar la UI del formulario de restock
- Cambiar la lógica de negocio del restock

## Approach

### Fase 1: Server Action core

Extraer la lógica de `restockProductoHandler` línea por línea a una Server Action
con `withAction` + `requireTenant`, usando el mismo patrón que las otras 7 acciones
ya migradas en `features/productos/actions.ts`.

**Estructura de la acción:**

```
restockProductoAction(input) {
  1. zod.parse(input)          → validación del payload
  2. requireTenant(user)        → tenant isolation
  3. validateProducto()         → el producto existe y tiene datos válidos
  4. executeWorkflow()          → nueva instancia si tipoRestock lo requiere
  5. updateStock()              → actualizar producto.stock + stockUbicacion
  6. createGastoCompra()        → registro contable de la compra
  7. handlePayment()            → reconciliación bancaria o cuentaPorPagar
  8. revalidatePath()           → invalidar caché de la página
  9. return { success, data }   → respuesta estandarizada
}
```

### Fase 2: Migrar el frontend

Reemplazar `restockProducto(payload).unwrap()` por `restockProductoAction(payload)`
en `restock-form.tsx`, adaptando el manejo de errores al formato `{ success, error }`.

### Fase 3: Limpieza

Eliminar `useRestockProductoMutation` del barrel y verificar que `productosApi.ts`
pueda ser eliminado completamente.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/productos/actions.ts` | Modified | Agregar `restockProductoAction` (~200 líneas) |
| `features/productos/schemas.ts` | Modified | Agregar `restockSchema` (Zod) |
| `features/productos/components/restock-form.tsx` | Modified | Reemplazar hook RTKQ por Server Action |
| `features/productos/index.ts` | Modified | Eliminar `useRestockProductoMutation`, exportar `restockProductoAction` |
| `features/productos/api/productosApi.ts` | Removed | Último hook migrado → eliminar archivo |
| `features/productos/__tests__/actions.test.ts` | Modified | Agregar tests para restockProductoAction |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper flujo de pagos (PAGO_PARCIAL crea CuentaPorPagar) | Medium | Replicar lógica exacta del handler; tests cubren ambos paths |
| Error en conversión de monedas (tasaCambio, montoConvertido) | Medium | Tests con distintas monedas (CUP, MLC, USD) |
| Regresión en tipoRestock (nueva_instancia, sumar_stock) | Low | Tests para cada modo de restock |
| `productosApi.ts` tiene tags de invalidación usados por otros features | Low | Verificar con grep antes de eliminar |
| Handler original usa `authenticateUser` manual, no `withAuth` | Low | `withAction` ya maneja autenticación automáticamente |

## Rollback Plan

1. Revertir el commit de migración
2. Restaurar `productosApi.ts` desde git history
3. Revertir `restock-form.tsx` a usar `useRestockProductoMutation`
4. El handler API route `restockProductoHandler` **no se elimina** en esta migración,
   por lo que el endpoint REST sigue funcionando como fallback

## Dependencies

- `withAction` de `@/lib/server-actions` (ya existe)
- `requireTenant` de `@/lib/services/tenant-scope` (ya existe)
- `upsertStockUbicacion` de `@/lib/services/stock-ubicacion-service` (ya existe, usado por el handler)
- Prisma models: `Producto`, `StockUbicacion`, `GastoCompra`, `CompraProducto`, `CuentaBancaria`, `CuentaPorPagar`, `TipoPago`, `TasaCambio`

## Success Criteria

- [ ] `restockProductoAction` pasa todos los tests unitarios (cobertura > 80%)
- [ ] `restock-form.tsx` funciona igual que antes (crear restock con y sin pago)
- [ ] Typecheck: 0 errores nuevos
- [ ] `productosApi.ts` puede ser eliminado (0 consumidores externos)
- [ ] `useRestockProductoMutation` ya no aparece en ningún import fuera de `productosApi.ts`
- [ ] Barrel de `@/features/productos` exporta 8 Server Actions, 0 hooks RTKQ
