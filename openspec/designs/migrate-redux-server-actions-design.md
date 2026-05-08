# Technical Design: Migrate Redux APIs to Server Actions (Phase 2)

## Architecture Overview

```
┌─ Client Components (React)
│  └─ Use Server Actions (async functions)
│
├─ Server Actions Layer (src/app/actions/)
│  ├─ Authentication check (session)
│  ├─ Input validation (Zod)
│  ├─ API client call (authenticated fetch)
│  ├─ Error handling (ServerActionError)
│  ├─ Cache revalidation (revalidateTag/Path)
│  └─ Response typing (TypeScript)
│
├─ API Client (src/lib/api/)
│  └─ Authenticated fetch wrapper with JWT handling
│
└─ Backend API Routes (Next.js API routes)
   └─ Existing endpoints (unchanged)
```

## Directory Structure

```
src/
├── app/
│   ├── actions/
│   │   ├── index.ts (exports all actions)
│   │   ├── productos-ubicacion.ts
│   │   ├── profile.ts
│   │   ├── reparaciones/
│   │   │   ├── equipos.ts
│   │   │   ├── piezas.ts
│   │   │   └── defectaciones.ts
│   │   ├── produccion/
│   │   │   ├── recetas.ts
│   │   │   ├── ordenes.ts
│   │   │   └── vales.ts
│   │   ├── reportes-financieros.ts
│   │   └── _helpers/
│   │       ├── error-handler.ts
│   │       └── auth-check.ts
│   │
│   └── models/
│       └── model.ts (existing types)
│
└── lib/
    ├── api/
    │   ├── client.ts (authenticated fetch)
    │   └── errors.ts (ServerActionError)
    │
    └── types/
        ├── productos-ubicacion.ts
        ├── profile.ts
        ├── reparaciones.ts
        ├── produccion.ts
        └── reportes-financieros.ts
```

## Core Patterns

### Pattern 1: Simple Query Server Action
```typescript
// src/app/actions/productos-ubicacion.ts
'use server'

import { getProductosPorUbicacion as fetcher } from '@/lib/api/productos-ubicacion'
import { ProductoConStock } from '@/app/models/model'
import { handleServerActionError } from './_helpers/error-handler'

export async function getProductosPorUbicacion(
  ubicacionId: string
): Promise<ProductoConStock[]> {
  try {
    return await fetcher(ubicacionId)
  } catch (error) {
    handleServerActionError(error, 'getProductosPorUbicacion')
  }
}
```

### Pattern 2: Query + Mutation Server Action
```typescript
// src/app/actions/profile.ts
'use server'

import { revalidateTag } from 'next/cache'
import { getProfile as fetchProfile, updateProfile as fetchUpdate } from '@/lib/api/profile'
import { Usuario } from '@/app/models/model'
import { validateProfileInput } from '@/lib/types/profile'
import { handleServerActionError } from './_helpers/error-handler'
import { checkAuth } from './_helpers/auth-check'

export async function getProfile(): Promise<Usuario[]> {
  try {
    await checkAuth()
    return await fetchProfile()
  } catch (error) {
    handleServerActionError(error, 'getProfile')
  }
}

export async function updateProfile(
  patch: Partial<Usuario>
): Promise<Usuario> {
  try {
    await checkAuth()
    validateProfileInput(patch)
    const result = await fetchUpdate(patch)
    revalidateTag('Profile')
    return result
  } catch (error) {
    handleServerActionError(error, 'updateProfile')
  }
}
```

### Pattern 3: Complex Mutations with Revalidation
```typescript
// src/app/actions/produccion/ordenes.ts
'use server'

import { revalidateTag } from 'next/cache'
import * as api from '@/lib/api/produccion/ordenes'
import { OrdenProduccion } from '@/app/models/model'
import { validateOrdenProduccion } from '@/lib/types/produccion'
import { handleServerActionError } from '../_helpers/error-handler'
import { checkAuth } from '../_helpers/auth-check'

export async function completarOrdenProduccion(
  id: string,
  userId?: string,
  cuentaId?: string,
  tipoPagoId?: string
): Promise<OrdenProduccion> {
  try {
    await checkAuth()
    const result = await api.completarOrdenProduccion(id, {
      userId,
      cuentaId,
      tipoPagoId,
    })
    
    // Revalidate dependent caches
    revalidateTag('OrdenesProduccion')
    revalidateTag('Productos')
    revalidateTag('StockUbicacion')
    
    return result
  } catch (error) {
    handleServerActionError(error, 'completarOrdenProduccion')
  }
}
```

## Error Handling Strategy

### ServerActionError Type
```typescript
// src/lib/api/errors.ts
export class ServerActionError extends Error {
  constructor(
    public endpoint: string,
    public method: string,
    public status: number,
    message: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ServerActionError'
  }
}
```

### Helper Function
```typescript
// src/app/actions/_helpers/error-handler.ts
export function handleServerActionError(
  error: unknown,
  action: string
): never {
  if (error instanceof ServerActionError) {
    throw error
  }
  
  if (error instanceof Error) {
    throw new ServerActionError(
      action,
      'UNKNOWN',
      500,
      error.message,
      error
    )
  }
  
  throw new ServerActionError(
    action,
    'UNKNOWN',
    500,
    'An unexpected error occurred'
  )
}
```

### Usage in Components
```typescript
// src/app/busy/perfil/page.tsx
'use client'

import { getProfile, updateProfile } from '@/app/actions/profile'
import { ServerActionError } from '@/lib/api/errors'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  async function handleUpdate(data: Partial<Usuario>) {
    try {
      const result = await updateProfile(data)
      setProfile(result)
      toast.success('Perfil actualizado')
    } catch (err) {
      if (err instanceof ServerActionError) {
        setError(err.message)
        toast.error(`Error: ${err.message}`)
      }
    }
  }
  
  return (
    // ... UI
  )
}
```

## Cache Invalidation Strategy

### Tags per API

| API | Tags |
|-----|------|
| `productosUbicacion` | `ProductosUbicacion` |
| `profile` | `Profile` |
| `reparaciones/equipos` | `EquiposReparacion` |
| `reparaciones/piezas` | `EquiposReparacion` (nested) |
| `reparaciones/defectaciones` | `Defectaciones` |
| `produccion/recetas` | `RecetasProduccion` |
| `produccion/ordenes` | `OrdenesProduccion`, `Productos`, `StockUbicacion` |
| `produccion/vales` | `ValesSalida`, `Productos` |
| `reportesFinancieros` | `ReportesFinancieros` |

### Tag Usage Pattern
```typescript
// GET endpoints use tags for caching
fetch('/api/reparaciones/equipos', {
  next: { tags: ['EquiposReparacion'] }
})

// POST/PUT/DELETE invalidate tags
revalidateTag('EquiposReparacion')
```

## API Client Implementation

```typescript
// src/lib/api/client.ts
import { getSession } from '@/lib/auth'

export async function authenticatedFetch(
  url: string,
  options?: RequestInit
) {
  const session = await getSession()
  
  if (!session) {
    throw new Error('Unauthorized: No session')
  }
  
  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  headers.set('Content-Type', 'application/json')
  
  const response = await fetch(url, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new ServerActionError(
      url,
      options?.method || 'GET',
      response.status,
      text || `HTTP ${response.status}`
    )
  }
  
  return response.json()
}
```

## Component Migration Pattern

### Before (Redux RTK)
```typescript
// uses Redux hook
const { data, isLoading, error } = useGetProductosPorUbicacionQuery(ubicacionId)
```

### After (Server Action)
```typescript
// client component with server action
'use client'

const [productos, setProductos] = useState<ProductoConStock[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  async function load() {
    try {
      setLoading(true)
      const data = await getProductosPorUbicacion(ubicacionId)
      setProductos(data)
    } catch (err) {
      if (err instanceof ServerActionError) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }
  
  load()
}, [ubicacionId])
```

## Type Safety

### Shared Types Layer
```typescript
// src/lib/types/productos-ubicacion.ts
import { z } from 'zod'

export const ProductoConStockSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  stock: z.number(),
  // ... rest of schema
})

export type ProductoConStock = z.infer<typeof ProductoConStockSchema>

// Validation helper
export function validateProductoConStock(data: unknown) {
  return ProductoConStockSchema.parse(data)
}
```

## Implementation Phases

### Phase 2A: Simple APIs (productosUbicacion, profileApi)
- Low risk, fast iteration
- Establishes patterns for team
- Estimated: 1-2 hours

### Phase 2B: Medium Complexity (reparacionesApi, reportesFinancierosApi)
- Moderate endpoint count
- Good for refining error handling
- Estimated: 3-4 hours

### Phase 2C: Complex (produccionApi)
- 16 endpoints across 3 domains
- Multiple revalidation tags
- Pagination handling
- Estimated: 6-8 hours

### Phase 2D: Cleanup & Verification
- Dependency sweep for Redux slices
- Bundle size analysis
- Performance testing
- Estimated: 2-3 hours

## Rollback Strategy

Each completed API gets a git tag:
```bash
git tag api-productosUbicacion-migrated
git tag api-profile-migrated
git tag api-reparaciones-migrated
git tag api-produccion-migrated
git tag api-reportesFinancieros-migrated
```

To rollback to Redux: `git revert <tag>`
