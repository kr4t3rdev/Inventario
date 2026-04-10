# Production Module Error Handling: Technical Design

**Status**: Design Phase  
**Last Updated**: 2026-04-09

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Frontend: production/page.tsx           │
│  ┌─────────────────────────────────────────────┐    │
│  │ Handlers (aprobar, completar, cancelar)     │    │
│  │ - Try-catch blocks                          │    │
│  │ - .unwrap() for RTK Query                   │    │
│  │ - sileo.error() / sileo.success()           │    │
│  └─────────────────────────────────────────────┘    │
└────────────────┬────────────────────────────────────┘
                 │ HTTP Requests
                 ↓
┌─────────────────────────────────────────────────────┐
│          Backend: API Routes                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ aprobar/ │  │completar/│  │cancelar/ │          │
│  │route.ts  │  │route.ts  │  │route.ts  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│  - Validación de inventario                         │
│  - Transacciones Prisma                             │
│  - Conversión de unidades                           │
│  - Respuestas JSON estructuradas                    │
└─────────────────────────────────────────────────────┘
```

## Component Changes

### 1. Frontend: `src/app/busy/produccion/page.tsx`

#### Change 1.1: Import Sileo
```typescript
// Add at top
import { sileo } from 'sileo';
```

#### Change 1.2: Update `handleAprobarOrden`
**Before**:
```typescript
const handleAprobarOrden = async (ordenId: string) => {
  try {
    await aprobarOrden({ ordenProduccionId: ordenId }).unwrap()  // No error capture
  } catch (error) {
    console.error('Error al aprobar orden:', error)
  }
}
```

**After**:
```typescript
const handleAprobarOrden = async (ordenId: string) => {
  try {
    const result = await aprobarOrden({ ordenProduccionId: ordenId }).unwrap()
    sileo.success({
      title: 'Orden aprobada',
      description: 'Materiales reservados exitosamente'
    })
  } catch (error: any) {
    // Type: RTKQueryError
    if (error?.data?.materialesFaltantes?.length > 0) {
      const faltantes = error.data.materialesFaltantes
        .map((m: any) => `${m.productoNombre}: necesita ${m.requerido}, disponible ${m.disponible}`)
        .join('\n')
      sileo.error({
        title: 'Materiales insuficientes',
        description: faltantes
      })
    } else if (error?.data?.error) {
      sileo.error({
        title: 'Error',
        description: error.data.error
      })
    } else {
      sileo.error({
        title: 'Error al aprobar orden',
        description: 'Intenta de nuevo'
      })
    }
    console.error('Error al aprobar orden:', error)
  }
}
```

#### Change 1.3: Update `handleCompletarOrden`
**Same pattern as handleAprobarOrden**:
- Try-catch con .unwrap()
- Capturar `error.data.materialesFaltantes` o `error.data.error`
- sileo.success() si todo bien
- sileo.error() con detalles si falla

#### Change 1.4: Update `handleCancelarOrden`
**Same pattern**, pero mensaje diferente:
- sileo.success(): "Orden cancelada"
- Mostrar en descripción si se liberaron materiales

#### Change 1.5: Fix State Filter Select (Line 714)
**Before**:
```tsx
<SelectItem value="pendiente">Pendiente</SelectItem>
<SelectItem value="en_proceso">En Proceso</SelectItem>
<SelectItem value="completada">Completada</SelectItem>
<SelectItem value="cancelada">Cancelada</SelectItem>
```

**After**:
```tsx
<SelectItem value="PENDIENTE">Pendiente</SelectItem>
<SelectItem value="EN_PROCESO">En Proceso</SelectItem>
<SelectItem value="COMPLETADA">Completada</SelectItem>
<SelectItem value="CANCELADA">Cancelada</SelectItem>
```

### 2. Backend: `src/app/api/produccion/ordenes/[id]/completar/route.ts`

#### Change 2.1: Add Validation Before Update
**Location**: Before line that updates orden estado

**Current**: No valida si producto existe

**Add**:
```typescript
// Validar que el producto existe
const producto = await prisma.producto.findUnique({
  where: { id: orden.Receta.productoId },
});

if (!producto) {
  return NextResponse.json({
    error: 'Producto final no encontrado en catálogo.',
  }, { status: 404 });
}

// Validar stock a incrementar
const stockFinal = producto.stock + orden.cantidad;
if (stockFinal > 999999) {
  return NextResponse.json({
    error: 'Stock excede límite permitido.',
  }, { status: 400 });
}
```

#### Change 2.2: Update Stock Atomically
**Current**:
```typescript
// Individual updates - can fail mid-way
await prisma.producto.update(...);
```

**Better**:
```typescript
// Use transaction for atomicity
const result = await prisma.$transaction([
  prisma.producto.update({
    where: { id: orden.Receta.productoId },
    data: { stock: { increment: orden.cantidad } },
  }),
  prisma.ordenProduccion.update({
    where: { ordenProduccionId: id },
    data: { estado: 'COMPLETADA', updatedAt: new Date() },
  }),
  prisma.ordenProduccionHistorial.create({
    data: {
      ordenProduccionId: id,
      estadoAnterior: 'EN_PROCESO',
      estadoNuevo: 'COMPLETADA',
      usuarioId: userId,
    },
  }),
]);
```

### 3. Constants File: Create `src/lib/constants/production.ts`

**New File**:
```typescript
/**
 * @description Estados de órdenes de producción
 * @note Siempre UPPERCASE con underscore para coincidir con Prisma enum
 */
export const PRODUCTION_STATES = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
} as const;

export type ProductionState = keyof typeof PRODUCTION_STATES;

/**
 * @description Labels legibles para estados
 */
export const PRODUCTION_STATE_LABELS: Record<ProductionState, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

/**
 * @description Colores para badges de estado
 */
export const PRODUCTION_STATE_COLORS: Record<ProductionState, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-900',
  EN_PROCESO: 'bg-blue-100 text-blue-900',
  COMPLETADA: 'bg-green-100 text-green-900',
  CANCELADA: 'bg-red-100 text-red-900',
};
```

## File Changes Summary

| File | Type | Changes |
|------|------|---------|
| `src/app/busy/produccion/page.tsx` | Modify | 1. Import sileo<br>2. Update 3 handlers (try-catch + sileo)<br>3. Normalize Select values UPPERCASE |
| `src/app/api/produccion/ordenes/[id]/completar/route.ts` | Modify | 1. Add validación de producto<br>2. Use transactions<br>3. Atomicity |
| `src/lib/constants/production.ts` | Create | Estados, labels, colores |
| `src/app/models/model.ts` | Modify | Update error response types si es necesario |

## Error Response Contracts

### Aprobar Orden - Error Response
```json
{
  "status": 400,
  "body": {
    "error": "Materiales insuficientes.",
    "materialesFaltantes": [
      {
        "productoId": "prod-123",
        "productoNombre": "Harina de Trigo",
        "requerido": 100,
        "disponible": 50
      }
    ]
  }
}
```

### Completar Orden - Error Response
```json
{
  "status": 404 | 400,
  "body": {
    "error": "Producto final no encontrado en catálogo."
  }
}
```

### Generic Error Response
```json
{
  "status": 500,
  "body": {
    "error": "Error al approbar orden de producción."
  }
}
```

## State Transitions Diagram

```
                Caso Normal                    Caso Error
┌─────────────┐
│  PENDIENTE  │────────Aprobar─────────►┌────────────────┐
└─────────────┘                         │  EN_PROCESO    │
       Δ                                 └────────────────┘
       │                                        │
       │ Error: Cancelar                        │ Completar
       │                                        ↓
       └────────┐                         ┌──────────────┐
                │                         │  COMPLETADA  │
                │                         └──────────────┘
       ┌────────┴──┐
       │  CANCELADA │
       └───────────┘
       
Materiales Insuficientes → User ve toast + Error → Orden queda PENDIENTE
```

## Testing Strategy

### Unit Tests
- `handleAprobarOrden` con error `materialesFaltantes`
- `handleAprobarOrden` con error genérico
- `handleAprobarOrden` exitoso

### E2E Tests (Playwright)
- Escenario 1: Aprobar con materiales faltantes + verificar toast
- Escenario 2: Filtrar por estado EN_PROCESO + verificar resultados
- Escenario 3: Completar orden + verificar transición y stock

### Manual Testing Checklist
- [ ] Aprobar orden sin materiales → toast error
- [ ] Aprobar orden con materiales → toast success + estado EN_PROCESO
- [ ] Filtrar por "En Proceso" → solo muestra esas órdenes
- [ ] Completar orden → state COMPLETADA + stock incrementado
- [ ] Cancelar orden → state CANCELADA + materiales liberados (si estaba EN_PROCESO)
