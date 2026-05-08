# Proposal: Server-First con Server Actions (Next.js 15+ Nativo)

## Intent

Hoy tenemos **49 API routes** + **RTK Query slices** + **React Query** (ambos en package.json). Eso son **tres capas de HTTP** para leer una tabla. Además, usamos Redux para data fetching que podría hacerse directamente en el servidor con Prisma.

El problema real:
- Cada page.tsx tiene `'use client'` innecesariamente
- Las mutaciones hacen POST a `/api/ventas` en lugar de usar Server Actions
- Los Server Components no aprovechan `await prisma.venta.findMany()` directo
- RTK Query maneja cache que Next.js 15+ ya maneja mejor con Server Components

Esta propuesta migra progresivamente a **Server Actions + Server Components**, reduciendo bundle size, eliminando waterfalls y simplificando el código.

## Scope

### In Scope
1. **Crear Server Actions base** para CRUD de 3 features piloto (ventas, productos, categorías)
2. **Convertir page.tsx a Server Components** donde sea posible (sacar `'use client'`)
3. **Reemplazar RTK Query mutations** con Server Actions en features piloto
4. **Documentar patrón** para que el equipo pueda replicar en otras features
5. **Crear utilidades compartidas** para Server Actions (manejo de errores, revalidación de cache)

### Out of Scope
- No eliminar RTK Query completamente (se mantiene para estado global real: auth, theme, etc.)
- No migrar todas las features (solo 3 pilotos)
- No cambiar la base de datos ni modelos Prisma
- No refactorizar la lógica de negocio (solo cambiar el transporte: API → Server Actions)
- No tocar features complejas con websockets o polling (contabilidad en tiempo real)

## Approach

### Fase 1: Infraestructura
- Crear `src/lib/server-actions/` con utilidades:
  - `withAction()` wrapper para manejo de errores estándar
  - `revalidate()` helper para invalidar rutas
  - Tipos compartidos para respuestas de Server Actions

### Fase 2: Feature Piloto - Categorías
- Crear `src/features/categorias/actions.ts`:
  - `createCategoriaAction()`
  - `updateCategoriaAction()`
  - `deleteCategoriaAction()`
  - `getCategoriasAction()`
- Convertir `src/app/busy/categorias/page.tsx` a Server Component
- Actualizar `category-form.tsx` para usar `useTransition()` + Server Actions
- Verificar que `subcategory-form.tsx` también funcione

### Fase 3: Feature Piloto - Productos
- Crear `src/features/productos/actions.ts`:
  - CRUD básico + stock management
- Convertir listado a Server Component
- Mantener formulario como Client Component (usa React Hook Form) pero con Server Action en `onSubmit`

### Fase 4: Feature Piloto - Ventas
- Crear `src/features/ventas/actions.ts`:
  - Crear venta (transacción compleja con líneas)
  - Listar ventas con filtros
- Convertir dashboard/listado a Server Component
- Dejar el POS (punto de venta) como Client Component por su naturaleza interactiva

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/server-actions/` | New | Utilidades compartidas para Server Actions |
| `src/features/categorias/` | Modified | Nuevo `actions.ts`, page.tsx como Server Component |
| `src/features/productos/` | Modified | Nuevo `actions.ts`, page.tsx como Server Component |
| `src/features/ventas/` | Modified | Nuevo `actions.ts`, page.tsx como Server Component |
| `src/app/busy/categorias/` | Modified | Eliminar `'use client'`, usar Server Actions |
| `src/app/busy/products/` | Modified | Eliminar `'use client'`, usar Server Actions |
| `src/app/busy/ventas/` | Modified | Eliminar `'use client'`, usar Server Actions |
| `package.json` | Modified | Evaluar si se puede eliminar React Query si ya no se usa |
| `src/lib/redux/services/` | No change | Se mantiene RTK Query para estado global (auth, theme) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Server Actions no manejan bien archivos multipart | Low | Usar `formData` nativo de Next.js 15.1+ o mantener API route solo para uploads |
| Formularios complejos con validación Zod requieren duplicar schema | Med | Crear schemas compartidos en `src/lib/schemas/` que usen tanto client como server |
| Error handling inconsistente entre Server Actions y API routes | Med | El wrapper `withAction()` estandariza errores con formato `{success: boolean, data/error}` |
| RTK Query cache se pierde al migrar | Low | Documentar que Next.js cachea Server Components automáticamente; usar `revalidatePath()` |
| Team no familiarizado con Server vs Client boundary | Med | Documentar patrón claramente; dejar ejemplos en features piloto |

## Rollback Plan

Si algo sale mal:
1. Las Server Actions son archivos `.ts` nuevos (no se borran APIs existentes inicialmente)
2. Cada feature piloto se puede revertir independientemente volviendo a importar RTK Query
3. Los page.tsx originales se pueden recuperar del git history
4. Las API routes se mantienen activas durante toda la migración (no se eliminan hasta verificar)
5. Feature flag simple: si falla, importar el hook RTK Query anterior

## Dependencies

- Next.js 15.1+ (para soporte completo de Server Actions con revalidación)
- TypeScript strict (ya está configurado)
- Zod (ya está instalado)

## Success Criteria

- [ ] Los page.tsx de categorías, productos y ventas funcionan como Server Components (sin `'use client'`)
- [ ] Las operaciones CRUD usan Server Actions en lugar de POST a /api/
- [ ] El bundle size del cliente se reduce (medible con `next bundle-analyzer`)
- [ ] Los tests existentes siguen pasando (o se actualizan con el nuevo patrón)
- [ ] Documentación escrita en `openspec/changes/server-first-server-actions/IMPLEMENTATION_GUIDE.md`
- [ ] El equipo puede crear una nueva Server Action en < 10 minutos siguiendo el patrón

## Tradeoffs

### Pro
- Menos código (no necesitas slice + handler + route + hook)
- Menos bundles (Server Components no envían JS al cliente)
- Menos waterfalls (Prisma directo, sin HTTP intermedio)
- Mejor UX (menos loading spinners, más renderizado instantáneo)

### Contra
- Requiere entender bien Server vs Client boundary
- Los formularios complejos siguen siendo Client Components
- Las validaciones deben correr en ambos lados (Zod ayuda)
- Debugging de Server Actions es diferente a debugging de API routes
