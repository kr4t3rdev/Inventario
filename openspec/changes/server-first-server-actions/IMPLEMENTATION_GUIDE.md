# Implementation Guide: Server-First con Server Actions

## Patrón General

Cada feature piloto sigue este patrón de migración:

```
Antes:  page.tsx (Client) → RTK Query → API Route → Prisma
Después: page.tsx (Client) → Server Action → Prisma (directo)
```

## Paso a Paso para Crear una Nueva Server Action

### 1. Schemas Zod (`schemas.ts`)

Crear schemas compartidos entre cliente y servidor:

```typescript
// src/features/mi-feature/schemas.ts
import { z } from 'zod';

export const createSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  precio: z.coerce.number().int().min(0),
});

export type CreateInput = z.infer<typeof createSchema>;
```

### 2. Server Actions (`actions.ts`)

Crear acciones envueltas con `withAction()`:

```typescript
// src/features/mi-feature/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { createSchema } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getItemsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.item.findMany({ where: { tenantId } });
});

export const createItemAction = withAction(async (input: CreateInput, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  
  const item = await prisma.item.create({
    data: { ...parsed, tenantId },
  });
  
  revalidatePath('/busy/mi-feature');
  return item;
});

export const deleteItemAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new ActionError('Item no encontrado', 'NOT_FOUND');
  
  await prisma.item.delete({ where: { id } });
  revalidatePath('/busy/mi-feature');
  return { id, deleted: true };
});
```

### 3. Tests (`__tests__/actions.test.ts`)

Seguir TDD estricto: RED → GREEN → REFACTOR:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { item: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() } },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getItemsAction, createItemAction } from '@/features/mi-feature/actions';

// Mock user, test success, validation errors, auth required, not found...
```

### 4. UI — Data Fetching

En el `page.tsx`, reemplazar RTK Query por Server Actions:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { getItemsAction } from '@/features/mi-feature/actions';

export default function MiFeaturePage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const result = await getItemsAction();
      if (result.success) setItems(result.data ?? []);
      setIsLoading(false);
    }
    fetchData();
  }, []);
  // ... render
}
```

### 5. UI — Mutaciones

Reemplazar RTK Query mutations por `useTransition`:

```typescript
import { useState, useTransition } from 'react';
import { deleteItemAction } from '@/features/mi-feature/actions';

const [isPending, startTransition] = useTransition();
const [itemToDelete, setItemToDelete] = useState<string | null>(null);

const handleDelete = () => {
  if (!itemToDelete) return;
  startTransition(async () => {
    const result = await deleteItemAction(itemToDelete);
    if (result.success) {
      toast.success('Eliminado correctamente');
      // Refetch
      const refresh = await getItemsAction();
      if (refresh.success) setItems(refresh.data ?? []);
    } else {
      toast.error(result.error?.message);
    }
    setItemToDelete(null);
  });
};
```

### 6. UI — Formularios

En los hooks de formulario, reemplazar fetch por Server Actions:

```typescript
// Antes (con fetch + token manual):
const token = sessionStorage.getItem('token');
const response = await fetch('/api/mi-feature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(data),
});

// Después (Server Action):
const result = await createItemAction(data);
if (!result.success) throw new Error(result.error?.message);
```

## Cuándo Usar Server Component vs Client Component

| Tipo | Server Component | Client Component |
|------|-----------------|-----------------|
| Listados / Tablas | ✅ Ideal (fetch directo a Prisma) | ✅ También funciona con Server Actions |
| Formularios con validación | ❌ No (no tiene estado) | ✅ Usa Server Action en `onSubmit` |
| POS / Carrito | ❌ No | ✅ Mucho estado interactivo |
| Dashboard con métricas | ✅ Ideal | ✅ También compatible |

**Regla general**: Si el componente necesita `useState`, `useEffect`, `onClick`, o eventos del usuario → Client Component. Si solo muestra datos → Server Component.

## Manejo de Errores

Toda Server Action retorna `ActionResponse<T>`:

```typescript
interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;     // Mensaje para el usuario
    code?: string;       // Código programático
    details?: Record<string, string[]>;  // Errores de campo (Zod)
  };
}
```

### Errores de dominio

Usar `ActionError` para errores de negocio:

```typescript
import { ActionError } from '@/lib/server-actions';

throw new ActionError('Categoría no encontrada', 'NOT_FOUND');
// → { success: false, error: { message: 'Categoría no encontrada', code: 'NOT_FOUND' } }
```

### Errores de validación Zod

`withAction()` captura `ZodError` automáticamente y retorna field errors:

```typescript
// Si el schema lanza ZodError, withAction lo convierte en:
{ success: false, error: { code: 'VALIDATION_ERROR', details: { nombre: ['El nombre es requerido'] } } }
```

### Errores de Prisma

`withAction()` mapea códigos de Prisma a mensajes en español:

| Código Prisma | Mensaje |
|---------------|---------|
| `P2002` | Ya existe un registro con estos datos únicos |
| `P2003` | No se puede eliminar porque tiene registros relacionados |
| `P2025` | El registro solicitado no fue encontrado |

## Cache e Invalidación

Después de cada mutación, llamar `revalidatePath()`:

```typescript
import { revalidatePath } from 'next/cache';

// En la Server Action, después del Prisma:
revalidatePath('/busy/mi-feature');
// En el cliente, después de la acción exitosa:
router.refresh();
```

## Estructura de Archivos Recomendada

```
src/features/mi-feature/
├── schemas.ts              ← Schemas Zod compartidos
├── actions.ts              ← Server Actions (con 'use server')
├── __tests__/
│   └── actions.test.ts     ← Tests TDD
├── components/             ← Componentes React
│   ├── mi-feature-table.tsx
│   └── mi-feature-form.tsx
├── hooks/                  ← Hooks personalizados
│   └── use-mi-feature-form.ts
├── api/
│   └── handlers.ts         ← (Opcional) API routes legacy hasta migrar todo
```

## Línea de Tiempo Estimada por Feature

| Feature | Tamaño | Tiempo estimado |
|---------|--------|----------------|
| Categorías (piloto 1) | Pequeño (<10 archivos) | 2-3 horas |
| Productos (piloto 2) | Mediano (>20 archivos) | 3-5 horas |
| Ventas (piloto 3) | Grande (>30 archivos) | 5-8 horas |
| Contabilidad | Muy grande | 8-12 horas |
| Admin/Usuarios | Mediano | 3-4 horas |
