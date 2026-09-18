# Módulo Restaurante - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear un módulo de restaurante con carta digital, recetas/elaboración y POS paralelo.

**Architecture:** 
- Nuevos modelos en Prisma para platos, recetas, mesas y comandas
- API routes RESTful en `/api/restaurante/*`
- Redux Toolkit API slice para gestión de estado
- Frontend con componentes React para CRUD y POS

**Tech Stack:** Next.js 15, Prisma, Redux Toolkit, TypeScript, Tailwind CSS

---

## Phase 1: Base de Datos (Prisma)

### Task 1: Agregar modelos al schema

**Files:**
- Modify: `prisma/schema.prisma:1-600` (agregar al final)

**Step 1: Agregar enum TipoPlato y Estados**

```prisma
enum TipoPlato {
  COMIDA
  BEBIDA
  POSTRE
  APERITIVO
}

enum EstadoMesa {
  DISPONIBLE
  OCUPADA
  RESERVADA
}

enum EstadoComanda {
  ABIERTA
  CERRADA
  CANCELADA
}

enum EstadoComandaItem {
  PENDIENTE
  EN_PROCESO
  LISTO
  SERVIDO
}

enum EstadoProduccion {
  PENDIENTE
  EN_PROCESO
  COMPLETADA
  CANCELADA
}
```

**Step 2: Agregar modelos**

```prisma
model CategoriaPlato {
  categoriaPlatoId String   @id @default(cuid())
  nombre           String
  descripcion      String?
  orden            Int      @default(0)
  activo           Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  platos           Plato[]
}

model Plato {
  platoId            String         @id @default(cuid())
  nombre             String
  descripcion        String?
  precio             Int
  imagen             String?
  disponible         Boolean        @default(true)
  tipoPlato          TipoPlato
  esElaborado        Boolean        @default(false)
  categoriaPlatoId  String?
  recetaId           String?        @unique
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
  categoriaPlato     CategoriaPlato? @relation(fields: [categoriaPlatoId], references: [categoriaPlatoId])
  receta             Receta?        @relation(fields: [recetaId], references: [recetaId])
  comandaItems       ComandaItem[]
}

model Receta {
  recetaId        String            @id @default(cuid())
  nombre          String
  rendimiento    Int               @default(1)
  costoUnitario  Int               @default(0)
  instrucciones   String?
  tiempoPrep     Int?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  plato          Plato?
  ingredientes   RecetaIngrediente[]
  ordenesProduccion OrdenProduccion[]
}

model RecetaIngrediente {
  recetaIngredienteId String   @id @default(cuid())
  recetaId           String
  productoId         String
  cantidad           Float
  desperdicio        Float    @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  receta             Receta   @relation(fields: [recetaId], references: [recetaId], onDelete: Cascade)
  producto           Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@unique([recetaId, productoId])
}

model Mesa {
  mesaId      String      @id @default(cuid())
  numero      Int         @unique
  capacidad   Int         @default(4)
  estado      EstadoMesa  @default(DISPONIBLE)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  comandas   Comanda[]
}

model Comanda {
  comandaId       String         @id @default(cuid())
  mesaId          String
  empleadoId      String?
  estado          EstadoComanda  @default(ABIERTA)
  total           Int            @default(0)
  observaciones   String?
  fechaApertura   DateTime       @default(now())
  fechaCierre     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  mesa            Mesa           @relation(fields: [mesaId], references: [mesaId])
  empleado        Empleado?      @relation(fields: [empleadoId], references: [empleadoId])
  items           ComandaItem[]
}

model ComandaItem {
  comandaItemId String            @id @default(cuid())
  comandaId     String
  platoId       String
  cantidad      Int
  precioUnitario Int
  notas         String?
  estado        EstadoComandaItem @default(PENDIENTE)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  comanda       Comanda           @relation(fields: [comandaId], references: [comandaId], onDelete: Cascade)
  plato         Plato             @relation(fields: [platoId], references: [platoId])
}

model OrdenProduccion {
  ordenProduccionId String           @id @default(cuid())
  recetaId         String
  cantidad         Int
  estado           EstadoProduccion @default(PENDIENTE)
  observaciones    String?
  fechaProduccion  DateTime         @default(now())
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  receta           Receta           @relation(fields: [recetaId], references: [recetaId])
}
```

**Step 3: Ejecutar migración**

```bash
cd /Users/arturo/Documents/Proyecto\ Inventario/TCP
pnpm prisma generate
pnpm prisma migrate dev --name add_restaurante_modules
```

---

## Phase 2: API Routes

### Task 2: Crear API de categorías de platos

**Files:**
- Create: `src/app/api/restaurante/categorias/route.ts`
- Create: `src/app/api/restaurante/categorias/[id]/route.ts`

**Step 1: Escribir test (opcional跳过)**

**Step 2: Implementar GET/POST para categorías**

```typescript
// src/app/api/restaurante/categorias/route.ts
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(async () => {
  const categorias = await prisma.categoriaPlato.findMany({
    orderBy: { orden: 'asc' }
  })
  return NextResponse.json(categorias)
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  const body = await request.json()
  const categoria = await prisma.categoriaPlato.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      orden: body.orden || 0,
      activo: body.activo ?? true
    }
  })
  return NextResponse.json(categoria)
})
```

**Step 3: Implementar PUT/DELETE para categoría específica**

```typescript
// src/app/api/restaurante/categorias/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, context: any) => {
  const { id } = context.params
  const categoria = await prisma.categoriaPlato.findUnique({
    where: { categoriaPlatoId: id }
  })
  if (!categoria) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(categoria)
})

export const PUT = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  const { id } = context.params
  const body = await request.json()
  const categoria = await prisma.categoriaPlato.update({
    where: { categoriaPlatoId: id },
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      orden: body.orden,
      activo: body.activo
    }
  })
  return NextResponse.json(categoria)
})

export const DELETE = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  const { id } = context.params
  await prisma.categoriaPlato.delete({ where: { categoriaPlatoId: id } })
  return NextResponse.json({ success: true })
})
```

---

### Task 3: Crear API de platos

**Files:**
- Create: `src/app/api/restaurante/platos/route.ts`
- Create: `src/app/api/restaurante/platos/[id]/route.ts`

**Step 1: GET/POST platos con include de categoría y receta**

```typescript
// src/app/api/restaurante/platos/route.ts
export const GET = withAuthGet(async () => {
  const platos = await prisma.plato.findMany({
    include: {
      categoriaPlato: true,
      receta: {
        include: {
          ingredientes: {
            include: { producto: { select: { id: true, nombre: true } } }
          }
        }
      }
    },
    orderBy: { nombre: 'asc' }
  })
  return NextResponse.json(platos)
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  const body = await request.json()
  const plato = await prisma.plato.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      precio: body.precio,
      imagen: body.imagen,
      disponible: body.disponible ?? true,
      tipoPlato: body.tipoPlato,
      esElaborado: body.esElaborado ?? false,
      categoriaPlatoId: body.categoriaPlatoId,
      // Si es elaborado, crear receta vinculada
      ...(body.esElaborado && body.receta && {
        receta: {
          create: {
            nombre: body.receta.nombre,
            rendimiento: body.receta.rendimiento || 1,
            instrucciones: body.receta.instrucciones,
            tiempoPrep: body.receta.tiempoPrep,
            ingredientes: {
              create: body.receta.ingredientes?.map((ing: any) => ({
                productoId: ing.productoId,
                cantidad: ing.cantidad,
                desperdicio: ing.desperdicio || 0
              }))
            }
          }
        }
      })
    },
    include: {
      categoriaPlato: true,
      receta: { include: { ingredientes: true } }
    }
  })
  return NextResponse.json(plato)
})
```

---

### Task 4: Crear API de recetas

**Files:**
- Create: `src/app/api/restaurante/recetas/route.ts`
- Create: `src/app/api/restaurante/recetas/[id]/route.ts`
- Create: `src/app/api/restaurante/recetas/[id]/ingredientes/route.ts`

**Step 1: CRUD recetas**

- GET: Listar todas las recetas con ingredientes
- POST: Crear receta (calcula costo automáticamente)
- PUT: Actualizar receta
- DELETE: Eliminar receta

**Step 2: Calcular costo de receta**

```typescript
// Función helper para calcular costo
async function calcularCostoReceta(recetaId: string): Promise<number> {
  const ingredientes = await prisma.recetaIngrediente.findMany({
    where: { recetaId },
    include: { producto: { select: { precioCosto: true } } }
  })
  
  let costoTotal = 0
  for (const ing of ingredientes) {
    const cantidadReal = ing.cantidad * (1 + ing.desperdicio / 100)
    costoTotal += Number(ing.producto.precioCosto || 0) * cantidadReal
  }
  return Math.round(costoTotal)
}
```

---

### Task 5: Crear API de producción

**Files:**
- Create: `src/app/api/restaurante/produccion/route.ts`
- Create: `src/app/api/restaurante/produccion/[id]/route.ts`

**Step 1: POST crear orden de producción**

```typescript
// Verificar stock antes de producir
async function verificarStockProduccion(recetaId: string, cantidad: Int) {
  const receta = await prisma.receta.findUnique({
    where: { recetaId },
    include: { ingredientes: true }
  })
  
  const errores: string[] = []
  for (const ing of receta.ingredientes) {
    // Obtener stock del producto
    const stockActual = await prisma.producto.findUnique({
      where: { id: ing.productoId },
      select: { cantidad: true }
    })
    const cantidadNecesaria = ing.cantidad * cantidad * (1 + ing.desperdicio / 100)
    if ((stockActual?.cantidad || 0) < cantidadNecesaria) {
      errores.push(`Stock insuficiente para ${ing.productoId}`)
    }
  }
  return errores
}
```

**Step 2: POST completar orden (descuenta inventario)**

```typescript
// En completar orden:
await prisma.$transaction(async (tx) => {
  // Descontar ingredientes
  for (const ing of receta.ingredientes) {
    const cantidadDescontar = ing.cantidad * cantidad * (1 + ing.desperdicio / 100)
    await tx.producto.update({
      where: { id: ing.productoId },
      data: { cantidad: { decrement: cantidadDescontar } }
    })
  }
  // Actualizar estado orden
  await tx.ordenProduccion.update({
    where: { ordenProduccionId: id },
    data: { estado: 'COMPLETADA' }
  })
})
```

---

### Task 6: Crear API de mesas

**Files:**
- Create: `src/app/api/restaurante/mesas/route.ts`
- Create: `src/app/api/restaurante/mesas/[id]/route.ts`

**Step 1: CRUD mesas**

- GET: Listar mesas con estado
- POST: Crear mesa
- PUT: Cambiar estado (disponible/ocupada/reservada)

---

### Task 7: Crear API de comandas

**Files:**
- Create: `src/app/api/restaurante/comandas/route.ts`
- Create: `src/app/api/restaurante/comandas/[id]/route.ts`
- Create: `src/app/api/restaurante/comandas/[id]/items/route.ts`
- Create: `src/app/api/restaurante/comandas/[id]/cerrar/route.ts`

**Step 1: POST abrir comanda**

```typescript
export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  const body = await request.json()
  
  // Verificar mesa disponible
  const mesa = await prisma.mesa.findUnique({ where: { mesaId: body.mesaId } })
  if (mesa.estado !== 'DISPONIBLE') {
    return NextResponse.json({ error: 'Mesa no disponible' }, { status: 400 })
  }
  
  const comanda = await prisma.$transaction(async (tx) => {
    // Crear comanda
    const nueva = await tx.comanda.create({
      data: {
        mesaId: body.mesaId,
        empleadoId: body.empleadoId,
        estado: 'ABIERTA'
      }
    })
    // Ocupar mesa
    await tx.mesa.update({
      where: { mesaId: body.mesaId },
      data: { estado: 'OCUPADA' }
    })
    return nueva
  })
  
  return NextResponse.json(comanda)
})
```

**Step 2: POST agregar items**

```typescript
export const POST = async (request: NextRequest, context: any) => {
  const { id } = context.params
  const body = await request.json()
  
  // Verificar plato disponible
  const plato = await prisma.plato.findUnique({ where: { platoId: body.platoId } })
  if (!plato.disponible) {
    return NextResponse.json({ error: 'Plato no disponible' }, { status: 400 })
  }
  
  const item = await prisma.comandaItem.create({
    data: {
      comandaId: id,
      platoId: body.platoId,
      cantidad: body.cantidad,
      precioUnitario: plato.precio,
      notas: body.notas
    }
  })
  
  // Actualizar total comanda
  await prisma.comanda.update({
    where: { comandaId: id },
    data: { total: { increment: plato.precio * body.cantidad } }
  })
  
  return NextResponse.json(item)
}
```

**Step 3: POST cerrar comanda (facturación)**

```typescript
// Similar a ventas/route.ts pero para restaurante
// Genera factura y limpia mesa
export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  const { id } = context.params
  const body = await request.json()
  
  const comanda = await prisma.$transaction(async (tx) => {
    // Obtener items con platos
    const items = await tx.comandaItem.findMany({
      where: { comandaId: id },
      include: { plato: true }
    })
    
    // Cerrar comanda
    await tx.comanda.update({
      where: { comandaId: id },
      data: { 
        estado: 'CERRADA',
        fechaCierre: new Date(),
        observaciones: body.observaciones
      }
    })
    
    // Liberar mesa
    await tx.mesa.update({
      where: { mesaId: comanda.mesaId },
      data: { estado: 'DISPONIBLE' }
    })
    
    // Aquí integrar con facturación si se requiere
    return { ...comanda, items }
  })
  
  return NextResponse.json(comanda)
})
```

---

## Phase 3: Redux API Slice

### Task 8: Crear restauranteApi

**Files:**
- Create: `src/lib/redux/services/restauranteApi.ts`

**Step 1: Implementar API slice**

```typescript
import { apiSlice } from './apiSlice'

export const restauranteApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Categorías
    getCategoriasPlatos: builder.query<any[], void>({
      query: () => '/restaurante/categorias',
      providesTags: ['RestauranteCategorias']
    }),
    createCategoriaPlato: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '/restaurante/categorias', method: 'POST', body }),
      invalidatesTags: ['RestauranteCategorias']
    }),
    
    // Platos
    getPlatos: builder.query<any[], void>({
      query: () => '/restaurante/platos',
      providesTags: ['RestaurantePlatos']
    }),
    createPlato: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '/restaurante/platos', method: 'POST', body }),
      invalidatesTags: ['RestaurantePlatos']
    }),
    updatePlato: builder.mutation<any, { id: string; body: Partial<any> }>({
      query: ({ id, body }) => ({ url: `/restaurante/platos/${id}`, method: 'PUT', body }),
      invalidatesTags: ['RestaurantePlatos']
    }),
    deletePlato: builder.mutation<any, string>({
      query: (id) => ({ url: `/restaurante/platos/${id}`, method: 'DELETE' }),
      invalidatesTags: ['RestaurantePlatos']
    }),
    
    // Recetas
    getRecetas: builder.query<any[], void>({
      query: () => '/restaurante/recetas',
      providesTags: ['RestauranteRecetas']
    }),
    createReceta: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '/restaurante/recetas', method: 'POST', body }),
      invalidatesTags: ['RestauranteRecetas']
    }),
    
    // Mesas
    getMesas: builder.query<any[], void>({
      query: () => '/restaurante/mesas',
      providesTags: ['RestauranteMesas']
    }),
    updateMesa: builder.mutation<any, { id: string; body: Partial<any> }>({
      query: ({ id, body }) => ({ url: `/restaurante/mesas/${id}`, method: 'PUT', body }),
      invalidatesTags: ['RestauranteMesas']
    }),
    
    // Comandas
    getComandas: builder.query<any[], void>({
      query: () => '/restaurante/comandas',
      providesTags: ['RestauranteComandas']
    }),
    createComanda: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '/restaurante/comandas', method: 'POST', body }),
      invalidatesTags: ['RestauranteComandas', 'RestauranteMesas']
    }),
    addItemToComanda: builder.mutation<any, { comandaId: string; item: Partial<any> }>({
      query: ({ comandaId, item }) => ({ 
        url: `/restaurante/comandas/${comandaId}/items`, 
        method: 'POST', 
        body: item 
      }),
      invalidatesTags: ['RestauranteComandas']
    }),
    closeComanda: builder.mutation<any, { id: string; body: Partial<any> }>({
      query: ({ id, body }) => ({ url: `/restaurante/comandas/${id}/cerrar`, method: 'POST', body }),
      invalidatesTags: ['RestauranteComandas', 'RestauranteMesas']
    }),
    
    // Producción
    getOrdenesProduccion: builder.query<any[], void>({
      query: () => '/restaurante/produccion',
      providesTags: ['RestauranteProduccion']
    }),
    createOrdenProduccion: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '/restaurante/produccion', method: 'POST', body }),
      invalidatesTags: ['RestauranteProduccion']
    }),
    completeOrdenProduccion: builder.mutation<any, string>({
      query: (id) => ({ url: `/restaurante/produccion/${id}/completar`, method: 'POST' }),
      invalidatesTags: ['RestauranteProduccion']
    })
  })
})

export const {
  useGetCategoriasPlatosQuery,
  useCreateCategoriaPlatoMutation,
  useGetPlatosQuery,
  useCreatePlatoMutation,
  useUpdatePlatoMutation,
  useDeletePlatoMutation,
  useGetRecetasQuery,
  useCreateRecetaMutation,
  useGetMesasQuery,
  useUpdateMesaMutation,
  useGetComandasQuery,
  useCreateComandaMutation,
  useAddItemToComandaMutation,
  useCloseComandaMutation,
  useGetOrdenesProduccionQuery,
  useCreateOrdenProduccionMutation,
  useCompleteOrdenProduccionMutation
} = restauranteApi
```

---

## Phase 4: Frontend

### Task 9: Crear componentes de Carta

**Files:**
- Create: `src/components/restaurante/carta-manager.tsx`
- Create: `src/components/restaurante/plato-form.tsx`

**Step 1: CartaManager**

- Lista de categorías (sidebar)
- Grid de platos con filtros
- Modal para crear/editar plato
- Toggle disponibilidad

---

### Task 10: Crear componentes de Producción

**Files:**
- Create: `src/components/restaurante/produccion-panel.tsx`
- Create: `src/components/restaurante/receta-editor.tsx`

**Step 1: ProduccionPanel**

- Lista de recetas disponibles
- Formulario para crear orden
- Validación de stock
- Historial de órdenes

---

### Task 11: Crear POS Restaurante

**Files:**
- Create: `src/components/restaurante/restaurante-pos.tsx`
- Create: `src/components/restaurante/mesa-grid.tsx`

**Step 1: RestaurantePOS**

- Grid visual de mesas (colores por estado)
- Click en mesa abre comanda
- Carrito de pedidos
- Estados de items (pendiente → listo → servido)
- Cerrar comanda con método de pago

---

## Phase 5: Integración y Testing

### Task 12: Ejecutar lint y verificar

**Step 1: Run lint**

```bash
cd /Users/arturo/Documents/Proyecto\ Inventario/TCP
pnpm run lint
```

**Step 2: Run build (si aplica)**

```bash
pnpm run build
```

---

## Resumen de Archivos a Crear/Modificar

| Phase | Archivo | Acción |
|-------|---------|--------|
| 1 | `prisma/schema.prisma` | Modificar |
| 2 | `src/app/api/restaurante/categorias/route.ts` | Crear |
| 2 | `src/app/api/restaurante/categorias/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/platos/route.ts` | Crear |
| 2 | `src/app/api/restaurante/platos/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/recetas/route.ts` | Crear |
| 2 | `src/app/api/restaurante/recetas/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/recetas/[id]/ingredientes/route.ts` | Crear |
| 2 | `src/app/api/restaurante/produccion/route.ts` | Crear |
| 2 | `src/app/api/restaurante/produccion/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/mesas/route.ts` | Crear |
| 2 | `src/app/api/restaurante/mesas/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/comandas/route.ts` | Crear |
| 2 | `src/app/api/restaurante/comandas/[id]/route.ts` | Crear |
| 2 | `src/app/api/restaurante/comandas/[id]/items/route.ts` | Crear |
| 2 | `src/app/api/restaurante/comandas/[id]/cerrar/route.ts` | Crear |
| 3 | `src/lib/redux/services/restauranteApi.ts` | Crear |
| 4 | `src/components/restaurante/carta-manager.tsx` | Crear |
| 4 | `src/components/restaurante/plato-form.tsx` | Crear |
| 4 | `src/components/restaurante/produccion-panel.tsx` | Crear |
| 4 | `src/components/restaurante/receta-editor.tsx` | Crear |
| 4 | `src/components/restaurante/restaurante-pos.tsx` | Crear |
| 4 | `src/components/restaurante/mesa-grid.tsx` | Crear |
