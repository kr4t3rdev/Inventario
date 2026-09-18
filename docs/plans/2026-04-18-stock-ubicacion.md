# StockUbicacion — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Materializar el stock por ubicación (almacén y punto de venta) en una tabla `StockUbicacion`, eliminar el cálculo on-demand duplicado, y hacer que todos los endpoints que mutan stock mantengan esa tabla sincronizada dentro de la misma transacción.

**Architecture:** Se agrega el modelo `StockUbicacion` al schema Prisma con un `@@unique([productoId, tipoUbicacion, ubicacionId])` como clave compuesta. Cada endpoint que hoy escribe en `Producto.stock` agrega también un `upsert` sobre `StockUbicacion` dentro de la misma transacción. El endpoint `GET /api/productos/stock-ubicacion` pasa a leer de esta tabla en lugar de calcular on-demand. La lógica de cálculo virtual de PV queda eliminada.

**Tech Stack:** Next.js 15 API Routes, Prisma ORM, PostgreSQL, Vitest

**Tipos de ubicación:** `"almacen"` | `"punto_venta"` (literales ya usados en todo el codebase)

---

## Contexto crítico para el implementador

### Qué toca el stock hoy (y dónde)

| Endpoint | Archivo | Qué hace con stock | ¿Toca StockUbicacion? |
|---|---|---|---|
| POST /api/compras-productos | `route.ts:230-265` | `Producto.stock += cantidad` | Sí, pero modelo no existe aún |
| POST /api/productos/restock | `route.ts:362-384` | `Producto.stock = newStock` (absoluto) | No |
| POST /api/transferencias | `route.ts:364-378` | `Producto.stock += stockDelta` (positivo o negativo) | No |
| POST /api/ventas | `route.ts:599-609, 827-836` | Solo packs: `Producto.stock -= parentDecrement` | No |
| POST /api/productos | `route.ts:398-508` | `Producto.stock = stock` (inicial) | No |
| GET /api/productos/stock-ubicacion | `route.ts:109-122` | Solo lectura, calcula on-demand | No — reemplazar por lectura directa |

### Por qué ventas no necesita actualizar StockUbicacion del almacén
Las ventas descuentan del **punto de venta**, no del almacén. El stock del almacén (`Producto.stock`) solo cambia con restock, compras, y transferencias. El stock de PV (`StockUbicacion` tipo `punto_venta`) sí se descuenta en ventas.

### Caso especial: packs (productos compuestos)
`POST /api/ventas` decrementa `Producto.stock` del padre cuando se vende un ítem hijo que es parte de un pack. En esa situación también hay que decrementar `StockUbicacion` del almacén del padre.

### Restock usa asignación absoluta de stock
`restock/route.ts` no hace `{ increment }` sino `stock: newStock`. Al escribir StockUbicacion ahí, hay que usar también valor absoluto (no increment), porque el `workflowResult` ya calculó el nuevo stock total.

### Constraint Prisma clave
```
@@unique([productoId, tipoUbicacion, ubicacionId])
```
Esto es lo que permite el `upsert` con `where: { productoId_tipoUbicacion_ubicacionId: {...} }`.

---

## Task 1: Agregar modelo StockUbicacion al schema Prisma

**Files:**
- Modify: `prisma/schema.prisma` — agregar modelo después de `model Producto`
- Run: `pnpm prisma migrate dev --name add-stock-ubicacion`
- Run: `pnpm prisma generate`

**Step 1: Agregar el modelo en `prisma/schema.prisma`**

Agregar después del bloque `model Producto { ... }` (línea ~208):

```prisma
model StockUbicacion {
  id                 String   @id @default(cuid())
  productoId         String
  tipoUbicacion      String   // "almacen" | "punto_venta"
  ubicacionId        String   // Almacen.almacenId o PuntoDeVenta.pvId
  cantidad           Int      @default(0)
  cantidadReservada  Int      @default(0)
  cantidadDisponible Int      @default(0)
  ultimaActualizacion DateTime @default(now())
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  producto           Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@unique([productoId, tipoUbicacion, ubicacionId])
  @@index([ubicacionId, tipoUbicacion])
  @@index([productoId])
}
```

Agregar también la relación inversa en `model Producto`:

```prisma
  stockUbicaciones   StockUbicacion[]
```

**Step 2: Crear la migración**

```bash
cd "/Users/arturo/Documents/Proyecto Inventario/TCP"
pnpm prisma migrate dev --name add-stock-ubicacion
```

Esperado: migración creada y aplicada sin errores.

**Step 3: Regenerar el cliente**

```bash
pnpm prisma generate
```

Esperado: `src/generated/prisma/` actualizado con `stockUbicacion` disponible en el client.

**Step 4: Verificar que el client tiene el modelo**

```bash
grep -n "stockUbicacion" src/generated/prisma/index.d.ts | head -10
```

Esperado: líneas que muestran `stockUbicacion` como propiedad del client.

---

## Task 2: Helper centralizado `upsertStockUbicacion`

Un helper puro para evitar duplicar el `upsert` en cada endpoint.

**Files:**
- Create: `src/lib/services/stock-ubicacion-service.ts`
- Test: `src/lib/services/__tests__/stock-ubicacion-service.test.ts`

**Step 1: Escribir el test que falla**

```typescript
// src/lib/services/__tests__/stock-ubicacion-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertStockUbicacion } from '../stock-ubicacion-service'

const txMock = {
  stockUbicacion: {
    upsert: vi.fn(),
  },
}

describe('upsertStockUbicacion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama a upsert con increment cuando modo es increment', async () => {
    txMock.stockUbicacion.upsert.mockResolvedValue({ id: 'su-1' })

    await upsertStockUbicacion(txMock as any, {
      productoId: 'prod-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      modo: 'increment',
      delta: 5,
    })

    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: 'prod-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
        },
      },
      update: {
        cantidad: { increment: 5 },
        cantidadDisponible: { increment: 5 },
        ultimaActualizacion: expect.any(Date),
      },
      create: {
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: 5,
        cantidadReservada: 0,
        cantidadDisponible: 5,
        ultimaActualizacion: expect.any(Date),
      },
    })
  })

  it('llama a upsert con set cuando modo es set', async () => {
    txMock.stockUbicacion.upsert.mockResolvedValue({ id: 'su-1' })

    await upsertStockUbicacion(txMock as any, {
      productoId: 'prod-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      modo: 'set',
      valor: 20,
    })

    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: 'prod-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
        },
      },
      update: {
        cantidad: 20,
        cantidadDisponible: 20,
        ultimaActualizacion: expect.any(Date),
      },
      create: {
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: 20,
        cantidadReservada: 0,
        cantidadDisponible: 20,
        ultimaActualizacion: expect.any(Date),
      },
    })
  })
})
```

**Step 2: Correr el test para verificar que falla**

```bash
cd "/Users/arturo/Documents/Proyecto Inventario/TCP"
pnpm test -- src/lib/services/__tests__/stock-ubicacion-service.test.ts
```

Esperado: FAIL — `Cannot find module '../stock-ubicacion-service'`

**Step 3: Crear el helper**

```typescript
// src/lib/services/stock-ubicacion-service.ts
import { PrismaClient } from '@/generated/prisma'

type TipoUbicacion = 'almacen' | 'punto_venta'

type UpsertStockOpts =
  | {
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'increment'
      delta: number
    }
  | {
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'set'
      valor: number
    }

/**
 * @description Hace upsert del stock materializado por ubicación dentro de una transacción Prisma.
 * Usar modo 'increment' para compras, transferencias y ventas.
 * Usar modo 'set' para restock (que ya calcula el valor absoluto nuevo).
 * @param {any} tx - Cliente de transacción Prisma
 * @param {UpsertStockOpts} opts - Opciones de actualización
 * @returns {Promise<void>}
 */
export async function upsertStockUbicacion(tx: any, opts: UpsertStockOpts): Promise<void> {
  const { productoId, tipoUbicacion, ubicacionId } = opts
  const now = new Date()

  if (opts.modo === 'increment') {
    const { delta } = opts
    await tx.stockUbicacion.upsert({
      where: {
        productoId_tipoUbicacion_ubicacionId: { productoId, tipoUbicacion, ubicacionId },
      },
      update: {
        cantidad: { increment: delta },
        cantidadDisponible: { increment: delta },
        ultimaActualizacion: now,
      },
      create: {
        productoId,
        tipoUbicacion,
        ubicacionId,
        cantidad: delta,
        cantidadReservada: 0,
        cantidadDisponible: delta,
        ultimaActualizacion: now,
      },
    })
  } else {
    const { valor } = opts
    await tx.stockUbicacion.upsert({
      where: {
        productoId_tipoUbicacion_ubicacionId: { productoId, tipoUbicacion, ubicacionId },
      },
      update: {
        cantidad: valor,
        cantidadDisponible: valor,
        ultimaActualizacion: now,
      },
      create: {
        productoId,
        tipoUbicacion,
        ubicacionId,
        cantidad: valor,
        cantidadReservada: 0,
        cantidadDisponible: valor,
        ultimaActualizacion: now,
      },
    })
  }
}
```

**Step 4: Correr el test para verificar que pasa**

```bash
pnpm test -- src/lib/services/__tests__/stock-ubicacion-service.test.ts
```

Esperado: PASS — 2 tests pasando.

**Step 5: Commit**

```bash
git add src/lib/services/stock-ubicacion-service.ts src/lib/services/__tests__/stock-ubicacion-service.test.ts
git commit -m "feat: add upsertStockUbicacion helper service"
```

---

## Task 3: Actualizar `POST /api/compras-productos`

Reemplazar el `upsert` inline existente (que ya existe pero falla) por el helper. Este endpoint ya tiene la lógica correcta — solo hay que reemplazar el código inline por el helper.

**Files:**
- Modify: `src/app/api/compras-productos/route.ts:240-265`
- Test: `src/app/api/compras-productos/__tests__/route.test.ts` — ya existe, debe seguir pasando

**Step 1: Verificar que el test actual FALLA (porque `StockUbicacion` no existía)**

```bash
pnpm test -- src/app/api/compras-productos/__tests__/route.test.ts
```

Nota: si el test ya pasa (porque mockea `txMock.stockUbicacion`), eso es normal — el mock no valida el contrato real. El fallo era solo en runtime.

**Step 2: Reemplazar el bloque inline en `route.ts`**

Agregar el import al inicio del archivo (después de los imports existentes):

```typescript
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
```

Reemplazar líneas 240-265:

```typescript
// ANTES:
await tx.stockUbicacion.upsert({
  where: {
    productoId_tipoUbicacion_ubicacionId: {
      productoId: producto.id,
      tipoUbicacion: 'almacen',
      ubicacionId: producto.almacenId
    }
  },
  update: {
    cantidad: { increment: data.cantidad },
    cantidadDisponible: { increment: data.cantidad },
    ultimaActualizacion: new Date()
  },
  create: {
    productoId: producto.id,
    tipoUbicacion: 'almacen',
    ubicacionId: producto.almacenId,
    cantidad: stockDespues,
    cantidadReservada: 0,
    cantidadDisponible: stockDespues
  }
})

// DESPUÉS:
await upsertStockUbicacion(tx, {
  productoId: producto.id,
  tipoUbicacion: 'almacen',
  ubicacionId: producto.almacenId,
  modo: 'increment',
  delta: data.cantidad,
})
```

**Step 3: Correr el test**

```bash
pnpm test -- src/app/api/compras-productos/__tests__/route.test.ts
```

Esperado: PASS — todos los tests existentes siguen pasando.

**Step 4: Commit**

```bash
git add src/app/api/compras-productos/route.ts
git commit -m "fix: use upsertStockUbicacion helper in compras-productos"
```

---

## Task 4: Actualizar `POST /api/productos/restock`

**Files:**
- Modify: `src/app/api/productos/restock/route.ts`

El restock calcula `workflowResult.originalProductUpdate.newStock` — un valor absoluto. Hay que usar modo `'set'` con ese valor como `valor`.

**Contexto del código existente:**

En la transacción (líneas ~362-384), después de `tx.producto.update(...)`, agregar:

```typescript
await upsertStockUbicacion(tx, {
  productoId,
  tipoUbicacion: 'almacen',
  ubicacionId: currentProduct.almacenId,  // campo disponible en currentProduct
  modo: 'set',
  valor: workflowResult.originalProductUpdate.newStock,
})
```

Hay dos ramas de `tx.producto.update` (con y sin cambio de precios, líneas ~362 y ~378). Agregar el `upsert` después de cada una, o refactorizar en una sola llamada si el campo `almacenId` está disponible en ambas.

**Step 1: Agregar el import al inicio del archivo**

```typescript
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
```

**Step 2: Agregar el upsert después de `tx.producto.update` (rama con precios)**

Localizar el bloque con `precioCosto: workflowResult.originalProductUpdate.newPrecioCosto` y agregar después del `update`:

```typescript
await upsertStockUbicacion(tx, {
  productoId,
  tipoUbicacion: 'almacen',
  ubicacionId: currentProduct.almacenId,
  modo: 'set',
  valor: workflowResult.originalProductUpdate.newStock,
})
```

**Step 3: Agregar el upsert después de `tx.producto.update` (rama sin precios)**

Mismo código, misma ubicación — después del segundo `update`.

**Step 4: Correr lint para verificar tipos**

```bash
pnpm run lint 2>&1 | grep -A3 "restock/route"
```

Esperado: sin errores en ese archivo.

**Step 5: Commit**

```bash
git add src/app/api/productos/restock/route.ts
git commit -m "feat: sync StockUbicacion on restock"
```

---

## Task 5: Actualizar `POST /api/transferencias`

Las transferencias mueven stock entre ubicaciones. Hay cuatro combinaciones posibles:

| Origen | Destino | Efecto StockUbicacion |
|---|---|---|
| almacen | almacen | origen.almacen -= N, destino.almacen += N |
| almacen | punto_venta | origen.almacen -= N, destino.pv += N |
| punto_venta | almacen | origen.pv -= N, destino.almacen += N |
| punto_venta | punto_venta | origen.pv -= N, destino.pv += N |

**Files:**
- Modify: `src/app/api/transferencias/route.ts:319-384` (dentro del `for` loop)

**Step 1: Agregar el import**

```typescript
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
```

**Step 2: Agregar los upserts dentro del `for` loop de la transacción**

Después del bloque `if (stockDelta !== 0) { ... }` (línea ~378), agregar:

```typescript
// Decrementar stock en ubicación origen
await upsertStockUbicacion(tx, {
  productoId: producto.id,
  tipoUbicacion: tipoOrigen,
  ubicacionId: origenId,
  modo: 'increment',
  delta: -cantidad,
})

// Incrementar stock en ubicación destino
await upsertStockUbicacion(tx, {
  productoId: producto.id,
  tipoUbicacion: tipoDestino,
  ubicacionId: destinoId,
  modo: 'increment',
  delta: cantidad,
})
```

Nota: `tipoOrigen` y `tipoDestino` son los strings `"almacen"` o `"punto_venta"` que ya están disponibles en ese scope (vienen del body parseado).

**Step 3: Correr lint**

```bash
pnpm run lint 2>&1 | grep -A3 "transferencias/route"
```

**Step 4: Commit**

```bash
git add src/app/api/transferencias/route.ts
git commit -m "feat: sync StockUbicacion on transferencias"
```

---

## Task 6: Actualizar `POST /api/ventas` (solo stock de PV)

Las ventas descuentan del **punto de venta**, no del almacén. Excepción: venta de un pack decrementa `Producto.stock` del padre en almacén — también hay que decrementar `StockUbicacion` del padre ahí.

**Files:**
- Modify: `src/app/api/ventas/route.ts`

**Step 1: Agregar el import**

```typescript
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
```

**Step 2: Decrementar PV en `crearVentaIndividual`**

En la función `crearVentaIndividual`, después de crear el `VentaItem` (o la `Venta`), agregar:

```typescript
// Descontar stock del punto de venta
await upsertStockUbicacion(tx, {
  productoId: producto.id,
  tipoUbicacion: 'punto_venta',
  ubicacionId: puntoDeVentaId,
  modo: 'increment',
  delta: -cantidad,
})
```

**Step 3: Decrementar PV en `crearVentaUnica`**

Mismo patrón en la función `crearVentaUnica`.

**Step 4: Decrementar almacén del padre (caso pack)**

En el bloque que decrementa `Producto.stock` del padre (líneas ~827-836 y ~599-609), agregar después del `tx.producto.update`:

```typescript
// También decrementar StockUbicacion del almacén del padre
const productoPadre = await tx.producto.findUnique({
  where: { id: producto.productoPadreId! },
  select: { almacenId: true },
})
if (productoPadre) {
  await upsertStockUbicacion(tx, {
    productoId: producto.productoPadreId!,
    tipoUbicacion: 'almacen',
    ubicacionId: productoPadre.almacenId,
    modo: 'increment',
    delta: -parentDecrement,
  })
}
```

**Step 5: Correr lint**

```bash
pnpm run lint 2>&1 | grep -A3 "ventas/route"
```

**Step 6: Commit**

```bash
git add src/app/api/ventas/route.ts
git commit -m "feat: sync StockUbicacion on ventas"
```

---

## Task 7: Actualizar `POST /api/productos` (stock inicial al crear)

Al crear un producto con stock > 0, inicializar el registro en `StockUbicacion` para el almacén home.

**Files:**
- Modify: `src/app/api/productos/route.ts`

**Step 1: Agregar el import**

```typescript
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
```

**Step 2: Agregar upsert después de `prisma.producto.create` (rama sin EAN-13)**

```typescript
if (stock > 0) {
  await upsertStockUbicacion(prisma as any, {
    productoId: productoSimple.id,
    tipoUbicacion: 'almacen',
    ubicacionId: almacenId,
    modo: 'set',
    valor: stock,
  })
}
```

Nota: fuera de transacción, se pasa `prisma` directamente. Si el `gastoCompra` (línea ~512) falla, el `StockUbicacion` ya fue creado — consistente con el mismo problema ya existente del `gastoCompra` fuera de transacción.

**Step 3: Agregar upsert dentro de la transacción (rama EAN-13)**

Dentro del `prisma.$transaction`, después de `tx.producto.create`:

```typescript
if (stock > 0) {
  await upsertStockUbicacion(tx, {
    productoId: producto.id,
    tipoUbicacion: 'almacen',
    ubicacionId: almacenId,
    modo: 'set',
    valor: stock,
  })
}
```

**Step 4: Correr lint**

```bash
pnpm run lint 2>&1 | grep -A3 "productos/route"
```

**Step 5: Commit**

```bash
git add src/app/api/productos/route.ts
git commit -m "feat: initialize StockUbicacion on producto creation"
```

---

## Task 8: Simplificar `GET /api/productos/stock-ubicacion`

Con el stock ya materializado, este endpoint puede leer directamente de `StockUbicacion` en lugar de calcular on-demand.

**Files:**
- Modify: `src/app/api/productos/stock-ubicacion/route.ts`
- Test: `src/app/api/productos/stock-ubicacion/__tests__/route.test.ts`

**Step 1: Correr los tests actuales para tener baseline**

```bash
pnpm test -- src/app/api/productos/stock-ubicacion/__tests__/route.test.ts
```

Esperado: PASS (asegurar que no rompemos nada).

**Step 2: Reescribir el GET para leer de StockUbicacion**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @description Devuelve el stock materializado por ubicación leyendo directamente
 * de la tabla StockUbicacion. Más eficiente que el cálculo on-demand anterior.
 * @returns {Promise<NextResponse>} Lista de productos con stockUbicacion
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get('ubicacionId')
    const tipoUbicacion = searchParams.get('tipoUbicacion') // 'almacen' | 'punto_venta'
    const includeZero = searchParams.get('includeZero') === 'true'

    if (!ubicacionId || !tipoUbicacion) {
      return NextResponse.json(
        { error: 'ubicacionId y tipoUbicacion son requeridos' },
        { status: 400 }
      )
    }

    if (tipoUbicacion !== 'almacen' && tipoUbicacion !== 'punto_venta') {
      return NextResponse.json({ error: 'tipoUbicacion inválido' }, { status: 400 })
    }

    const registros = await prisma.stockUbicacion.findMany({
      where: {
        ubicacionId,
        tipoUbicacion,
        ...(includeZero ? {} : { cantidad: { gt: 0 } }),
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            codigoInterno: true,
            fotos: true,
            precioCosto: true,
            precioVenta: true,
            stock: true,
            stockMinimo: true,
            categoriaId: true,
            subcategoriaId: true,
            unidadId: true,
            vendorId: true,
            almacenId: true,
            categoria: { select: { catId: true, nombre: true } },
            subcategoria: { select: { catId: true, nombre: true, parentId: true } },
            unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
            vendor: { select: { vendorId: true, nombre: true } },
          },
        },
      },
    })

    const resultado = registros.map((r) => ({
      ...r.producto,
      stockUbicacion: r.cantidad,
      stockTotal: r.producto.stock,
    }))

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error al obtener stock por ubicación:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor al calcular stock' },
      { status: 500 }
    )
  }
}
```

**Step 3: Actualizar los tests existentes**

Los tests mockean el cálculo on-demand actual. Hay que actualizarlos para mockear `prisma.stockUbicacion.findMany`. Ver el archivo de tests existente para el patrón de mocks.

**Step 4: Correr los tests**

```bash
pnpm test -- src/app/api/productos/stock-ubicacion/__tests__/route.test.ts
```

Esperado: PASS.

**Step 5: Commit**

```bash
git add src/app/api/productos/stock-ubicacion/route.ts src/app/api/productos/stock-ubicacion/__tests__/route.test.ts
git commit -m "refactor: stock-ubicacion GET reads from materialized table"
```

---

## Task 9: Script de migración de datos existentes

La tabla `StockUbicacion` recién creada estará vacía. Hay que poblarla con los datos actuales del sistema para que el estado inicial sea correcto.

**Files:**
- Create: `prisma/scripts/seed-stock-ubicacion.ts`

**Step 1: Crear el script**

```typescript
// prisma/scripts/seed-stock-ubicacion.ts
import { prisma } from '../../src/lib/prisma'

/**
 * @description Pobla StockUbicacion con datos calculados del estado actual del sistema.
 * Ejecutar una sola vez después de la migración.
 */
async function main() {
  console.log('Iniciando seed de StockUbicacion...')

  // 1. Almacenes: usar Producto.stock directamente
  const productos = await prisma.producto.findMany({
    select: { id: true, stock: true, almacenId: true },
  })

  for (const producto of productos) {
    if (producto.stock > 0) {
      await prisma.stockUbicacion.upsert({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: producto.id,
            tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId,
          },
        },
        update: {
          cantidad: producto.stock,
          cantidadDisponible: producto.stock,
        },
        create: {
          productoId: producto.id,
          tipoUbicacion: 'almacen',
          ubicacionId: producto.almacenId,
          cantidad: producto.stock,
          cantidadReservada: 0,
          cantidadDisponible: producto.stock,
        },
      })
    }
  }
  console.log(`  Almacenes: ${productos.length} productos procesados`)

  // 2. Puntos de venta: calcular el stock on-demand y materializarlo
  const puntosDeVenta = await prisma.puntoDeVenta.findMany({
    select: { pvId: true, nombre: true },
  })

  for (const pv of puntosDeVenta) {
    // Entradas al PV
    const entradas = await prisma.transferencia.findMany({
      where: { puntoDeVentaDestinoId: pv.pvId },
      select: { productoId: true, cantidad: true },
    })

    // Salidas del PV
    const salidas = await prisma.transferencia.findMany({
      where: { puntoDeVentaOrigenId: pv.pvId },
      select: { productoId: true, cantidad: true },
    })

    // Ventas en el PV
    const ventasItems = await prisma.ventaItem.findMany({
      where: { venta: { puntoDeVentaId: pv.pvId } },
      select: { productoId: true, cantidad: true },
    })
    const ventasLegacy = await prisma.venta.findMany({
      where: { puntoDeVentaId: pv.pvId, items: { none: {} } },
      select: { productoId: true, cantidad: true },
    })

    // Calcular stock por producto
    const stockMap = new Map<string, number>()

    entradas.forEach((t) => {
      stockMap.set(t.productoId, (stockMap.get(t.productoId) || 0) + t.cantidad)
    })
    salidas.forEach((t) => {
      stockMap.set(t.productoId, (stockMap.get(t.productoId) || 0) - t.cantidad)
    })
    ventasItems.forEach((v) => {
      if (v.productoId) {
        stockMap.set(v.productoId, (stockMap.get(v.productoId) || 0) - v.cantidad)
      }
    })
    ventasLegacy.forEach((v) => {
      if (v.productoId) {
        stockMap.set(v.productoId, (stockMap.get(v.productoId) || 0) - v.cantidad)
      }
    })

    // Upsert por producto
    for (const [productoId, cantidad] of stockMap.entries()) {
      const cantidadFinal = Math.max(0, cantidad)
      if (cantidadFinal > 0) {
        await prisma.stockUbicacion.upsert({
          where: {
            productoId_tipoUbicacion_ubicacionId: {
              productoId,
              tipoUbicacion: 'punto_venta',
              ubicacionId: pv.pvId,
            },
          },
          update: {
            cantidad: cantidadFinal,
            cantidadDisponible: cantidadFinal,
          },
          create: {
            productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: pv.pvId,
            cantidad: cantidadFinal,
            cantidadReservada: 0,
            cantidadDisponible: cantidadFinal,
          },
        })
      }
    }
    console.log(`  PV "${pv.nombre}": ${stockMap.size} productos procesados`)
  }

  console.log('Seed de StockUbicacion completado.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 2: Ejecutar el script**

```bash
cd "/Users/arturo/Documents/Proyecto Inventario/TCP"
npx tsx prisma/scripts/seed-stock-ubicacion.ts
```

Esperado: output con conteo de productos procesados por almacén y PV, sin errores.

**Step 3: Verificar en DB**

```bash
pnpm prisma studio
```

Navegar a la tabla `StockUbicacion` y verificar que tiene registros con cantidades razonables.

**Step 4: Commit**

```bash
git add prisma/scripts/seed-stock-ubicacion.ts
git commit -m "feat: seed script for StockUbicacion initial data"
```

---

## Task 10: Correr todos los tests y verificar

```bash
cd "/Users/arturo/Documents/Proyecto Inventario/TCP"
pnpm run test:run
```

Esperado: todos los tests pasan. Si alguno falla, revisar el mock correspondiente para que use `prisma.stockUbicacion` en lugar del cálculo on-demand.

```bash
pnpm run lint
```

Esperado: sin errores de tipos ni de estilo.

---

## Orden de ejecución

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10
```

Tasks 3-7 son independientes entre sí una vez que Task 2 está lista — pueden ejecutarse en paralelo si se usa subagent-driven.

---

## Qué NO hace este plan

- **No elimina `Producto.stock`** — ese campo sigue siendo la fuente de verdad para el almacén home y mantiene compatibilidad con todo el sistema existente.
- **No agrega cantidades reservadas** — `cantidadReservada` queda en 0 siempre. Implementar reservas es una feature separada.
- **No corrige el bug de `gastoCompra` fuera de transacción** en `productos/route.ts` — es un problema preexistente fuera del alcance.
- **No agrega índices a `Transferencia`** — la migración de datos existentes es tolerable con el volumen actual.
