# Tasks: Feature-Based Migration — Gestión

## Phase 1: Infrastructure (Foundation)

- [x] 1.1 Validar POC de VENTAS como patrón de referencia
- [ ] 1.2 Crear `src/features/` con 8 subdirectorios
- [ ] 1.3 Documentar patrón de Thin Route + Re-export
- [ ] 1.4 Verificar dependencias cruzadas entre features (productos ↔ categorías ↔ unidades, etc.)

## Phase 2: Core Implementation — Feature por Feature

### Feature 2.1: Puntos de Venta (menor complejidad)
- [ ] 2.1.1 Extraer lógica de `app/api/puntosDeVenta/route.tsx` + `[id]/route.ts` → `features/puntos-venta/api/handlers.ts`
- [ ] 2.1.2 Adelgazar `app/api/puntosDeVenta/route.tsx` a <15 líneas
- [ ] 2.1.3 Mover `lib/redux/services/puntosDeVentaApi.tsx` → `features/puntos-venta/api/puntosDeVentaApi.ts` + re-export
- [ ] 2.1.4 Crear `features/puntos-venta/types.ts` e `index.ts`
- [ ] 2.1.5 Copiar componentes `components/PtoVenta/` → `features/puntos-venta/components/` (fix imports relativos)
- [ ] 2.1.6 Correr tests de puntosDeVenta
- [ ] 2.1.7 `pnpm run lint`
- [ ] 2.1.8 `git add . && git commit -m "feat(puntos-venta): migrar a feature-based architecture"`

### Feature 2.2: Clientes
- [ ] 2.2.1 Extraer lógica de `app/api/cliente/route.ts` + `[id]/route.ts` → `features/clientes/api/handlers.ts`
- [ ] 2.2.2 Adelgazar `app/api/cliente/route.ts` a <15 líneas
- [ ] 2.2.3 Mover `lib/redux/services/ClienteApi.tsx` → `features/clientes/api/ClienteApi.ts` + re-export
- [ ] 2.2.4 Crear `features/clientes/types.ts` e `index.ts`
- [ ] 2.2.5 Copiar componentes `components/clientes/` → `features/clientes/components/` (fix imports)
- [ ] 2.2.6 Correr tests de cliente
- [ ] 2.2.7 `pnpm run lint`
- [ ] 2.2.8 `git add . && git commit -m "feat(clientes): migrar a feature-based architecture"`

### Feature 2.3: Proveedores (Vendors)
- [ ] 2.3.1 Extraer lógica de `app/api/vendors/route.ts` + `[id]/route.ts` → `features/vendors/api/handlers.ts`
- [ ] 2.3.2 Adelgazar `app/api/vendors/route.ts` a <15 líneas
- [ ] 2.3.3 Mover `lib/redux/services/vendorsApi.tsx` → `features/vendors/api/vendorsApi.ts` + re-export
- [ ] 2.3.4 Crear `features/vendors/types.ts` e `index.ts`
- [ ] 2.3.5 Copiar componentes `components/vendor/` → `features/vendors/components/` (fix imports)
- [ ] 2.3.6 Correr tests de vendors
- [ ] 2.3.7 `pnpm run lint`
- [ ] 2.3.8 `git add . && git commit -m "feat(vendors): migrar a feature-based architecture"`

### Feature 2.4: Unidades
- [ ] 2.4.1 Extraer lógica de `app/api/unidades/route.ts` + `[id]/route.ts` → `features/unidades/api/handlers.ts`
- [ ] 2.4.2 Adelgazar `app/api/unidades/route.ts` a <15 líneas
- [ ] 2.4.3 Mover `lib/redux/services/unidadesApi.tsx` → `features/unidades/api/unidadesApi.ts` + re-export
- [ ] 2.4.4 Crear `features/unidades/types.ts` e `index.ts`
- [ ] 2.4.5 Copiar componentes `components/unidad/` → `features/unidades/components/` (fix imports)
- [ ] 2.4.6 Correr tests de unidades
- [ ] 2.4.7 `pnpm run lint`
- [ ] 2.4.8 `git add . && git commit -m "feat(unidades): migrar a feature-based architecture"`

### Feature 2.5: Almacenes
- [ ] 2.5.1 Extraer lógica de `app/api/almacenes/route.ts` + `[id]/route.ts` → `features/almacenes/api/handlers.ts`
- [ ] 2.5.2 Adelgazar `app/api/almacenes/route.ts` a <15 líneas
- [ ] 2.5.3 Mover `lib/redux/services/almacenesApi.tsx` → `features/almacenes/api/almacenesApi.ts` + re-export
- [ ] 2.5.4 Crear `features/almacenes/types.ts` e `index.ts`
- [ ] 2.5.5 Copiar componentes `components/almacen/` → `features/almacenes/components/` (fix imports)
- [ ] 2.5.6 Correr tests de almacenes
- [ ] 2.5.7 `pnpm run lint`
- [ ] 2.5.8 `git add . && git commit -m "feat(almacenes): migrar a feature-based architecture"`

### Feature 2.6: Listas de Precios
- [ ] 2.6.1 Extraer lógica de `app/api/listas-precios/route.ts` + `[id]/route.ts` → `features/listas-precios/api/handlers.ts`
- [ ] 2.6.2 Adelgazar `app/api/listas-precios/route.ts` a <15 líneas
- [ ] 2.6.3 Mover `lib/redux/services/listasPreciosApi.ts` → `features/listas-precios/api/listasPreciosApi.ts` + re-export
- [ ] 2.6.4 Crear `features/listas-precios/types.ts` e `index.ts`
- [ ] 2.6.5 Correr tests de listas-precios
- [ ] 2.6.6 `pnpm run lint`
- [ ] 2.6.7 `git add . && git commit -m "feat(listas-precios): migrar a feature-based architecture"`

### Feature 2.7: Categorías (depende de productos, complejidad media)
- [ ] 2.7.1 Extraer lógica de `app/api/categorias/route.ts` + `[id]/route.ts` + `hierarchy/` → `features/categorias/api/handlers.ts`
- [ ] 2.7.2 Adelgazar `app/api/categorias/route.ts` a <15 líneas
- [ ] 2.7.3 Mover `lib/redux/services/categoriasApi.tsx` → `features/categorias/api/categoriasApi.ts` + re-export
- [ ] 2.7.4 Crear `features/categorias/types.ts` e `index.ts`
- [ ] 2.7.5 Copiar componentes `components/categorias/` → `features/categorias/components/` (fix imports)
- [ ] 2.7.6 Mover hooks `hooks/use-category-form.ts` y `use-category-validation.tsx` → `features/categorias/hooks/`
- [ ] 2.7.7 Correr tests de categorías
- [ ] 2.7.8 `pnpm run lint`
- [ ] 2.7.9 `git add . && git commit -m "feat(categorias): migrar a feature-based architecture"`

### Feature 2.8: Productos (mayor complejidad, sub-rutas)
- [ ] 2.8.1 Extraer lógica de `app/api/productos/route.ts` + `[id]/route.ts` + `bulk-stock-minimo/`, `restock/`, `stock-ubicacion/` → `features/productos/api/handlers.ts`
- [ ] 2.8.2 Adelgazar `app/api/productos/route.ts` a <15 líneas
- [ ] 2.8.3 Mover `lib/redux/services/productosApi.tsx` → `features/productos/api/productosApi.ts` + re-export
- [ ] 2.8.4 Crear `features/productos/types.ts` e `index.ts`
- [ ] 2.8.5 Copiar componentes `components/productos/` → `features/productos/components/` (fix imports)
- [ ] 2.8.6 Correr tests de productos
- [ ] 2.8.7 `pnpm run lint`
- [ ] 2.8.8 `git add . && git commit -m "feat(productos): migrar a feature-based architecture"`

## Phase 3: Verification

- [ ] 3.1 Correr typecheck completo (`pnpm run typecheck`)
- [ ] 3.2 Correr lint completo (`pnpm run lint`)
- [ ] 3.3 Verificar que no hay imports rotos en toda la codebase (`grep -r "from '@/lib/redux/services/" src/ | grep -v "re-export"`)
- [ ] 3.4 Verificar que `app/api/` solo tiene pasamanos (<20 líneas cada uno)
- [ ] 3.5 Commit final: `git commit --allow-empty -m "feat(gestion): migración completa a feature-based architecture"`

## Phase 4: Cleanup

- [ ] 4.1 Actualizar AGENTS.md con nueva estructura
- [ ] 4.2 Documentar que features restantes faltan por migrar
