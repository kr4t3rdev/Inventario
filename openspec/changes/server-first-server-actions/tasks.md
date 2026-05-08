# Tasks: Server-First con Server Actions (Next.js 15+ Nativo)

## Phase 1: Infraestructura

- [ ] 1.1 Crear `src/lib/server-actions/types.ts` con interfaces `ActionResponse`, `ActionError`, `ServerAction`
- [ ] 1.2 Crear `src/lib/server-actions/with-action.ts` con wrapper que maneje ZodError, PrismaError y errores genéricos
- [ ] 1.3 Crear `src/lib/server-actions/get-current-user.ts` para obtener usuario desde cookies/session en Server Actions
- [ ] 1.4 Crear `src/lib/server-actions/index.ts` como barrel export
- [ ] 1.5 Crear `src/lib/server-actions/__tests__/with-action.test.ts` - test unitario del wrapper con mocks

## Phase 2: Feature Piloto - Categorías

### 2A: Server Actions

- [ ] 2.1 Crear `src/features/categorias/actions.ts` con:
  - `getCategoriasAction()` - retorna categorías del tenant
  - `createCategoriaAction(formData)` - crea categoría con validación
  - `updateCategoriaAction(id, formData)` - actualiza categoría
  - `deleteCategoriaAction(id)` - elimina categoría con validación de dependencias
- [ ] 2.2 Extraer lógica de validación de `src/lib/categoria-validation.ts` a schema Zod compartido `src/features/categorias/schemas.ts`
- [ ] 2.3 Crear `src/features/categorias/actions.test.ts` - test unitario de cada Server Action con Prisma mock

### 2B: Server Component (Listado)

- [ ] 2.4 Crear `src/app/busy/categorias/page.tsx` como Server Component que llame `getCategoriasAction()`
- [ ] 2.5 Crear `src/features/categorias/components/category-list-server.tsx` - Server Component que recibe categorías como props
- [ ] 2.6 Modificar `src/features/categorias/components/category-form.tsx`:
  - Reemplazar `useAddCategoriaMutation()` por `useTransition()` + `createCategoriaAction()`
  - Reemplazar `useUpdateCategoriaMutation()` por `updateCategoriaAction()`
  - Agregar manejo de respuesta con toast
- [ ] 2.7 Modificar `src/features/categorias/components/subcategory-form.tsx`:
  - Usar Server Actions para create/update
  - Mantener `'use client'` porque usa React Hook Form

### 2C: Integración y Limpieza

- [ ] 2.8 Verificar que `src/app/busy/categorias/page.tsx` renderice sin errores (sin 'use client')
- [ ] 2.9 Verificar que el formulario de crear categoría funcione end-to-end
- [ ] 2.10 Verificar que el formulario de editar categoría funcione end-to-end
- [ ] 2.11 Verificar que eliminar categoría funcione con revalidación de cache
- [ ] 2.12 Documentar patrón en `IMPLEMENTATION_GUIDE.md` (categorías como ejemplo)

## Phase 3: Feature Piloto - Productos

### 3A: Server Actions

- [ ] 3.1 Crear `src/features/productos/schemas.ts` con schema Zod para validación de productos
- [ ] 3.2 Crear `src/features/productos/actions.ts` con:
  - `getProductosAction(filters)` - listado con filtros opcionales
  - `createProductoAction(formData)` - creación con categorías
  - `updateProductoAction(id, formData)` - actualización
  - `deleteProductoAction(id)` - eliminación
- [ ] 3.3 Crear `src/features/productos/actions.test.ts`

### 3B: Server Component y Formularios

- [ ] 3.4 Modificar `src/app/busy/products/page.tsx` - convertir a Server Component
- [ ] 3.5 Modificar `src/features/productos/components/productos-form.tsx` - usar Server Actions
- [ ] 3.6 Modificar `src/features/productos/components/restock-dialog.tsx` - usar `updateStockAction()`
- [ ] 3.7 Verificar end-to-end: crear producto, editar, eliminar

## Phase 4: Feature Piloto - Ventas

### 4A: Server Actions

- [ ] 4.1 Crear `src/features/ventas/schemas.ts` con schema Zod para líneas de venta
- [ ] 4.2 Crear `src/features/ventas/actions.ts` con:
  - `getVentasAction(filters)` - listado con filtros de fecha
  - `createVentaAction(data)` - creación transaccional completa
  - `anularVentaAction(id)` - anulación con restricciones
- [ ] 4.3 Crear `src/features/ventas/actions.test.ts` - test de transacciones

### 4B: Server Component y POS

- [ ] 4.4 Modificar `src/app/busy/ventas/page.tsx` - convertir a Server Component
- [ ] 4.5 Modificar `src/features/ventas/components/venta-form.tsx` - usar Server Actions
- [ ] 4.6 Modificar `src/features/ventas/components/pv-interface.tsx` - mantener 'use client' pero usar `createVentaAction()`
- [ ] 4.7 Verificar end-to-end: crear venta, listar, anular

## Phase 5: Validación y Documentación

- [ ] 5.1 Ejecutar `pnpm run typecheck` y corregir errores
- [ ] 5.2 Ejecutar `pnpm run lint` y corregir errores
- [ ] 5.3 Ejecutar `pnpm run test:run` y verificar que tests pasen
- [ ] 5.4 Medir bundle size antes/después con `next bundle-analyzer`
- [ ] 5.5 Escribir `openspec/changes/server-first-server-actions/IMPLEMENTATION_GUIDE.md` con:
  - Paso a paso para crear una nueva Server Action
  - Cuándo usar Server Component vs Client Component
  - Patrón de error handling
  - Ejemplos de código
- [ ] 5.6 Actualizar README del proyecto con arquitectura Server-First

## Dependencias entre Tareas

```
Phase 1 (Infra)
  ├─→ Phase 2A (Categorías Actions)
  │     ├─→ Phase 2B (Categorías UI)
  │     └─→ Phase 2C (Categorías Verify)
  ├─→ Phase 3A (Productos Actions)
  │     └─→ Phase 3B (Productos UI)
  └─→ Phase 4A (Ventas Actions)
        └─→ Phase 4B (Ventas UI)
              └─→ Phase 5 (Validación)
```

## Criterios de Completado por Fase

### Phase 1 completada cuando:
- `withAction()` pasa tests unitarios
- Wrapper maneja ZodError, PrismaError, Error genérico
- Tipos exportados correctamente

### Phase 2 completada cuando:
- `/busy/categorias` funciona como Server Component
- Crear/editar/eliminar categoría usa Server Actions
- Tests de actions pasan
- RTK Query ya no se usa en categorías

### Phase 3 completada cuando:
- `/busy/products` funciona como Server Component
- CRUD de productos usa Server Actions
- Tests pasan

### Phase 4 completada cuando:
- `/busy/ventas` funciona como Server Component
- Crear/anular venta usa Server Actions
- POS usa Server Actions para guardar
- Tests pasan

### Phase 5 completada cuando:
- typecheck y lint pasan sin errores
- Tests existentes siguen pasando
- Documentación escrita
- Métricas de bundle size recolectadas
