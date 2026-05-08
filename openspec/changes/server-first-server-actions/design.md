# Design: Server-First con Server Actions (Next.js 15+ Nativo)

## Technical Approach

Migrar progresivamente 3 features piloto (categorías, productos, ventas) de API routes + RTK Query a Server Actions + Server Components. El patrón es:

1. **Listados**: Convertir `page.tsx` a Server Component con fetch directo a Prisma
2. **Mutaciones**: Crear `actions.ts` en cada feature con Server Actions
3. **Formularios**: Mantener como Client Components (necesitan React Hook Form + interactividad) pero usar `useTransition()` + Server Actions en lugar de RTK Query mutations
4. **Cache**: Reemplar RTK Query cache con `revalidatePath()` / `revalidateTag()` de Next.js

## Architecture Decisions

### Decision: Server Component para listados, Client Component para formularios

**Choice**: Los `page.tsx` de listado serán Server Components que fetchean directo. Los formularios permanecen como Client Components.

**Alternatives considered**:
- Convertir todo a Server Components: Rechazado porque los formularios necesitan estado local, validación en tiempo real y eventos del usuario
- Mantener todo como Client Components: Rechazado porque pierde los beneficios de Server Components (menos bundle, fetch directo)

**Rationale**: Next.js 15+ está diseñado para esta separación. Los listados son principalmente lectura sin interactividad compleja → Server Component. Los formularios tienen estado, validación y eventos → Client Component.

### Decision: Wrapper `withAction()` para estandarizar errores

**Choice**: Crear `src/lib/server-actions/with-action.ts` que envuelva cualquier función y retorne `{ success, data/error }`

**Alternatives considered**:
- Dejar que cada Server Action maneje errores individualmente: Rechazado porque produce inconsistencias
- Usar try/catch en cada componente: Rechazado porque duplica código

**Rationale**: El wrapper centraliza el manejo de errores de Zod, Prisma y errores desconocidos, dándole al cliente un formato consistente.

### Decision: Conservar API routes durante la migración

**Choice**: Las API routes existentes se mantienen activas mientras se migran las features piloto.

**Alternatives considered**:
- Eliminar API routes inmediatamente: Rechazado porque otras features no migradas las usan
- Duplicar lógica en Server Actions y API routes: Rechazado porque viola DRY

**Rationale**: Las Server Actions para features piloto reutilizarán los handlers existentes (o su lógica) internamente. Las API routes se eliminarán solo cuando TODAS las features estén migradas.

### Decision: Formularios usan `useTransition()` + `useOptimistic()`

**Choice**: Los formularios usan `useTransition()` para llamar Server Actions sin bloquear UI, y `useOptimistic()` para actualizaciones inmediatas.

**Alternatives considered**:
- Seguir usando RTK Query mutations: Rechazado porque es el objetivo de la migración
- `useFormStatus()` de React 19: Rechazado porque no da suficiente control sobre estados de loading

**Rationale**: `useTransition()` es el patrón recomendado por React/Next.js para Server Actions. Proporciona `isPending` para loading states sin necesidad de Redux.

## Data Flow

### Antes (API Routes + RTK Query)

```
page.tsx (Client Component)
  ↓ useGetCategoriasQuery()  [HTTP GET /api/categorias]
  ↓ RTK Query cache
CategoryList.tsx
  ↓ onSubmit
  ↓ useAddCategoriaMutation()  [HTTP POST /api/categorias]
  ↓ RTK Query invalida cache
  ↓ useGetCategoriasQuery() refetch automático
```

### Después (Server Actions + Server Components)

```
page.tsx (Server Component)
  ↓ await prisma.categoria.findMany()  [directo, sin HTTP]
  ↓ props
CategoryList.tsx (Server Component)
  ↓ props a CategoryForm.tsx (Client Component)
CategoryForm.tsx
  ↓ const [isPending, startTransition] = useTransition()
  ↓ startTransition(() => createCategoriaAction(data))
  ↓ Prisma directo en servidor
  ↓ revalidatePath('/busy/categorias')  [cache de Next.js invalidado]
  ↓ router.refresh()  [re-render con datos nuevos]
```

## File Changes

### Infraestructura (Fase 1)

| File | Action | Description |
|------|--------|-------------|
| `src/lib/server-actions/with-action.ts` | Create | Wrapper para estandarizar errores en Server Actions |
| `src/lib/server-actions/types.ts` | Create | Tipos compartidos: ActionResponse, ActionError |
| `src/lib/server-actions/index.ts` | Create | Barrel export |

### Categorías (Fase 2)

| File | Action | Description |
|------|--------|-------------|
| `src/features/categorias/actions.ts` | Create | Server Actions: getCategorias, createCategoria, updateCategoria, deleteCategoria |
| `src/app/busy/categorias/page.tsx` | Create | Server Component que fetchea directo con Prisma |
| `src/app/busy/categorias/layout.tsx` | Create | Layout con SidebarProvider si es necesario |
| `src/features/categorias/components/category-list.tsx` | Modify | Recibir datos como props en lugar de useGetCategoriasQuery |
| `src/features/categorias/components/category-form.tsx` | Modify | Usar useTransition + createCategoriaAction en lugar de useAddCategoriaMutation |
| `src/features/categorias/components/subcategory-form.tsx` | Modify | Usar Server Actions para create/update |

### Productos (Fase 3)

| File | Action | Description |
|------|--------|-------------|
| `src/features/productos/actions.ts` | Create | Server Actions para CRUD de productos |
| `src/app/busy/products/page.tsx` | Modify | Convertir a Server Component (sacar 'use client') |
| `src/features/productos/components/productos-form.tsx` | Modify | Usar Server Actions en onSubmit |

### Ventas (Fase 4)

| File | Action | Description |
|------|--------|-------------|
| `src/features/ventas/actions.ts` | Create | Server Actions para crear venta, listar, anular |
| `src/app/busy/ventas/page.tsx` | Modify | Convertir a Server Component |
| `src/features/ventas/components/venta-form.tsx` | Modify | Usar Server Actions |
| `src/features/ventas/components/pv-interface.tsx` | Modify | POS mantiene 'use client' pero usa Server Actions para guardar |

## Interfaces / Contracts

### Tipos compartidos

```typescript
// src/lib/server-actions/types.ts

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, string[]>;
  };
}

export type ServerAction<TInput, TOutput> = (
  input: TInput
) => Promise<ActionResponse<TOutput>>;
```

### Wrapper withAction

```typescript
// src/lib/server-actions/with-action.ts

import { ActionResponse } from './types';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function withAction<TInput, TOutput>(
  action: (input: TInput, user: AuthenticatedUser) => Promise<TOutput>
): ServerAction<TInput, TOutput> {
  return async (input: TInput): Promise<ActionResponse<TOutput>> => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { success: false, error: { message: 'Unauthorized', code: 'AUTH_REQUIRED' } };
      }
      const result = await action(input, user);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return { 
          success: false, 
          error: { 
            message: 'Validation error', 
            code: 'VALIDATION_ERROR',
            details: error.flatten().fieldErrors
          } 
        };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return { 
          success: false, 
          error: { 
            message: getPrismaErrorMessage(error), 
            code: error.code 
          } 
        };
      }
      console.error('Server Action Error:', error);
      return { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } };
    }
  };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `withAction()` wrapper | Vitest - test que maneja ZodError, PrismaError, Error genérico |
| Unit | Cada Server Action individualmente | Vitest - mock prisma y auth, verificar respuesta |
| Integration | Server Action + Prisma (test DB) | Vitest - usar DB de test, verificar CRUD real |
| Integration | Formulario + Server Action | Testing Library - render form, submit, verificar llamada a action |
| E2E | Flujo completo de categorías | Playwright - crear categoría, verificar en listado |

## Migration / Rollout

### Fase 1: Infraestructura (Semana 1)
- Crear `src/lib/server-actions/` con utilidades
- No tocar features existentes
- Verificar que no rompe nada

### Fase 2: Categorías (Semana 1-2)
- Crear Server Actions
- Crear page.tsx Server Component
- Modificar formularios
- Testing completo
- Si todo OK, continuar. Si no, revertir page.tsx a Client Component

### Fase 3: Productos (Semana 2-3)
- Mismo patrón que categorías
- Atención especial a uploads de imágenes

### Fase 4: Ventas (Semana 3-4)
- Transacciones complejas
- POS mantiene Client Component

### Rollback por feature
- Cada feature piloto es independiente
- Para revertir: volver a importar RTK Query hooks en los formularios
- Las API routes se mantienen activas durante toda la migración

## Open Questions

- [ ] ¿Se puede eliminar React Query del package.json después de migrar las 3 features piloto?
- [ ] ¿Cómo manejar el auth en Server Actions? ¿Reutilizar `withAuthGet` o usar `cookies()` de Next.js?
- [ ] ¿Las validaciones Zod se duplican o se comparten entre client y server?
- [ ] ¿El POS (pv-interface.tsx) con mucho estado local vale la pena migrar o se deja como está?
