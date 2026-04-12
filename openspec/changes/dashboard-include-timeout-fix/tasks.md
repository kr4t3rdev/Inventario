# Tasks: dashboard-include-timeout-fix

## Estado: COMPLETADO ✅

---

## Checklist

### Fase 1 — Diagnóstico (completado)

- [x] Identificar queries N+1 en `productosMasVendidos` (5 `findUnique` con `include: { categoria: true }`)
- [x] Identificar `findMany` con `include: { categoria: true, unidad: true }` en `todosLosProductos`
- [x] Confirmar campos usados por el frontend: `categoria.nombre`, `unidad.simbolo` en `StockBajoTable`
- [x] Confirmar campos usados en `TopProductsTable`: `id`, `nombre`, `categoria`, `ventas`, `ingresos`, `stock`

### Fase 2 — Fix `productosMasVendidos` (completado)

- [x] Extraer los `productoIds` del array `productosVentas`
- [x] Reemplazar `Promise.all` + 5 × `findUnique` por 1 `findMany` con `where: { id: { in: topProductoIds } }`
- [x] Agregar `select: { id, nombre, stock, categoria: { select: { nombre } } }`
- [x] Construir `Map<id, producto>` para lookup O(1)
- [x] Adaptar el `.map()` final a usar el Map en lugar de la Promise

### Fase 3 — Fix `todosLosProductos` / `productosStockBajo` (completado)

- [x] Cambiar `include: { categoria: true, unidad: true }` por `select` limitado
- [x] `select: { id, nombre, stock, stockMinimo, categoria: { nombre }, unidad: { simbolo } }`
- [x] Verificar que `ProductoConRelaciones` inferido sigue compatible con los tipos del array `productosStockBajo`
- [x] Verificar que `grupo.representante` spread en `productosStockBajo.push(...)` incluye los campos necesarios

### Fase 4 — Verificación (pendiente)

- [ ] Ejecutar tests: `pnpm test -- src/components/__tests__/stock-bajo-table-minimum-stock.test.tsx`
- [ ] Confirmar cero errores TypeScript en `src/app/api/dashboard/stats/route.ts`
- [ ] Deploy a producción y verificar que los gráficos del Dashboard cargan

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/api/dashboard/stats/route.ts` | Fix N+1 productosMasVendidos + select limitado en todosLosProductos |
| `src/app/api/productos/stock-ubicacion/route.ts` | select limitado — eliminó include vendor y almacen completos |

---

## Fase 4 - Tests y verificación (completado)

- [x] Tests `stock-bajo-table-minimum-stock.test.tsx`: 9/9 ✅
- [x] Cero errores TypeScript en `dashboard/stats/route.ts` ✅
- [x] Cero errores TypeScript en `productos/stock-ubicacion/route.ts` ✅
