# Proposal: Migrar compras-productos y compras-servicios a Server Actions puras

## Intent

Eliminar las últimas dependencias de RTK Query en los features `compras-productos` y `compras-servicios`,
migrando los componentes que aún usan hooks RTKQ a las Server Actions que YA existen en ambos features.

**Contexto previo**: La feature `gastos-compra` fue eliminada por ser código muerto (cero consumidores). 
El modelo Prisma `GastoCompra` y su type se mantienen porque son la capa de datos usada por múltiples features.

## Scope

### In Scope

**compras-productos:**
- Migrar `compra-producto-form.tsx` de `useCreateCompraProductoMutation` → `createCompraProductoAction`
- Migrar `[id]/edit/page.tsx` de `useGetCompraProductoByIdQuery` + `useUpdateCompraProductoMutation` → `getCompraProductoByIdAction` + `updateCompraProductoAction`
- Eliminar `comprasProductosApi.ts` (RTK Query slice)
- Limpiar barrel `index.ts`: remover exports RTKQ, mantener solo Server Actions + types
- Eliminar el tag `ComprasProductos` de `apiSlice.tsx` si ningún otro feature lo usa

**compras-servicios:**
- Migrar `servicios/components/servicios-recibidos-form.tsx` de `useCreateCompraServicioMutation` → `createCompraServicioAction`
- Migrar `servicios/components/servicios-recibidos-table.tsx` de `useGetComprasServiciosQuery` → `getComprasServiciosAction`
- Eliminar `comprasServiciosApi.ts` (RTK Query slice)
- Limpiar barrel `index.ts`: remover exports RTKQ, mantener solo Server Actions + types

### Out of Scope

- Crear páginas UI nuevas para compras-servicios (los componentes ya existen en feature `servicios`)
- Migrar otros hooks RTKQ de otros features
- Modificar la lógica de negocio de las Server Actions (ya implementada y funcionando)
- Eliminar los handlers HTTP (se mantienen como fallback para consumidores externos)
- Modificar el modelo Prisma `GastoCompra` o `CompraDocumento`

## Approach

### Fase 1: compras-productos — formulario de creación

Reemplazar `useCreateCompraProductoMutation` en `compra-producto-form.tsx` (línea 88, submit en línea 221) 
por `createCompraProductoAction`. Adaptar el manejo de errores del formato RTKQ 
(`.unwrap()` + catch con `error?.data?.error`) al formato Server Action (`result.success` + `result.error?.message`).

### Fase 2: compras-productos — página de edición

Reemplazar `useGetCompraProductoByIdQuery` (línea 68) por `getCompraProductoByIdAction` con `useEffect` + `useState`.
Reemplazar `useUpdateCompraProductoMutation` (línea 69) por `updateCompraProductoAction`.

### Fase 3: compras-productos — limpieza

Eliminar `comprasProductosApi.ts`, remover los 5 hooks RTKQ del barrel, limpiar `apiSlice.tsx`.

### Fase 4: compras-servicios — migración de componentes

Migrar `servicios-recibidos-form.tsx` y `servicios-recibidos-table.tsx` de RTKQ a Server Actions.

### Fase 5: compras-servicios — limpieza

Eliminar `comprasServiciosApi.ts`, remover los 4 hooks RTKQ del barrel, limpiar `apiSlice.tsx`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/compras-productos/components/compra-producto-form.tsx` | Modified | Migrar submit a Server Action (~30 líneas) |
| `app/busy/compras-productos/[id]/edit/page.tsx` | Modified | Migrar fetch + update a Server Actions |
| `features/compras-productos/api/comprasProductosApi.ts` | Removed | RTKQ slice ya no necesario |
| `features/compras-productos/index.ts` | Modified | Remover exports RTKQ |
| `features/servicios/components/servicios-recibidos-form.tsx` | Modified | Migrar submit a Server Action |
| `features/servicios/components/servicios-recibidos-table.tsx` | Modified | Migrar fetch a Server Action |
| `features/compras-servicios/api/comprasServiciosApi.ts` | Removed | RTKQ slice ya no necesario |
| `features/compras-servicios/index.ts` | Modified | Remover exports RTKQ |
| `lib/redux/services/apiSlice.tsx` | Modified | Remover tags `ComprasProductos` (si no usado) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper flujo de anticipos en formulario de compra | Low | `createCompraProductoAction` ya soporta anticipos; solo cambia la capa de llamada |
| `ComprasProductos` tag usado por otros features | Low | Verificar con grep antes de eliminar |
| `comprasServiciosApi` usado fuera de feature servicios | Low | Ya verificado: solo 2 componentes en `servicios/` |
| `getCompraProductoByIdAction` retorna distinto al handler HTTP | Low | La Server Action ya existe y es usada internamente; verificar que el edit page reciba los datos esperados |
| Regresión en validación del formulario | Low | El schema Zod se mantiene idéntico; solo cambia quién procesa el submit |

## Rollback Plan

1. Revertir el commit de migración
2. Restaurar `comprasProductosApi.ts` y `comprasServiciosApi.ts` desde git history
3. Revertir los componentes modificados a usar hooks RTKQ
4. Los handlers HTTP **no se eliminan**, por lo que los endpoints REST siguen como fallback

## Dependencies

- `withAction` de `@/lib/server-actions` (ya existe)
- `requireTenant` de `@/lib/services/tenant-scope` (ya existe)
- `createCompraProductoAction`, `updateCompraProductoAction`, `getCompraProductoByIdAction` en `features/compras-productos/actions.ts` (ya existen)
- `createCompraServicioAction`, `getComprasServiciosAction` en `features/compras-servicios/actions.ts` (ya existen)

## Success Criteria

- [ ] `compra-producto-form.tsx` crea compras usando `createCompraProductoAction` (no RTKQ)
- [ ] `[id]/edit/page.tsx` carga y actualiza usando Server Actions (no RTKQ)
- [ ] `servicios-recibidos-form.tsx` crea usando `createCompraServicioAction`
- [ ] `servicios-recibidos-table.tsx` lista usando `getComprasServiciosAction`
- [ ] `comprasProductosApi.ts` eliminado — 0 consumidores externos
- [ ] `comprasServiciosApi.ts` eliminado — 0 consumidores externos
- [ ] Barrels de ambos features solo exportan Server Actions + types
- [ ] Typecheck: 0 errores nuevos
- [ ] Tests existentes pasan (o se adaptan mínimamente)
