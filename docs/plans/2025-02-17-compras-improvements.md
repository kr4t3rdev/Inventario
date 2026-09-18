# Plan de Mejoras - Sistema de Compras

> **Goal:** Implementar todas las mejoras solicitadas al sistema de compras de productos

**Architecture:** Mejoras incrementales al sistema existente de compras y restock, manteniendo compatibilidad con código actual

**Tech Stack:** Next.js 15, TypeScript, Prisma, Zod, React Hook Form, Redux Toolkit

---

## FASE 1: Mejoras de Alta Prioridad (Paginación, Validaciones)

### Task 1.1: Agregar Paginación al GET de Compras

**Files:**
- Modify: `src/app/api/compras-productos/route.ts:89-179` (GET handler)
- Modify: `src/lib/redux/services/comprasProductosApi.tsx:32-55` (add pagination params)

**Step 1: Update query schema to include pagination**

```typescript
const querySchema = z.object({
  search: z.string().optional(),
  tipoOperacion: z.enum(['RESTOCK', 'REGULAR']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})
```

**Step 2: Modify GET handler to support pagination**

Update the GET function to:
- Parse page and limit from query params
- Calculate skip = (page - 1) * limit
- Add take: limit to prisma query
- Return paginated response with metadata

```typescript
const page = params.page
const limit = params.limit
const skip = (page - 1) * limit

const [compras, total] = await Promise.all([
  prisma.compraProducto.findMany({
    where: whereClause,
    include: { ... },
    orderBy: { fechaCompra: 'desc' },
    skip,
    take: limit,
  }),
  prisma.compraProducto.count({ where: whereClause })
])

return NextResponse.json({
  compras,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  }
})
```

**Step 3: Update frontend API to support pagination**

Add page and limit to ComprasProductosQueryParams interface and update the query builder.

**Step 4: Test pagination**

Run: `curl "http://localhost:3000/api/compras-productos?page=1&limit=10"`
Expected: Returns paginated response with 10 items and pagination metadata

**Step 5: Commit**

```bash
git add src/app/api/compras-productos/route.ts src/lib/redux/services/comprasProductosApi.tsx
git commit -m "feat(compras): add pagination support to GET endpoint"
```

---

### Task 1.2: Validar Margen Mínimo del 10%

**Files:**
- Modify: `src/app/api/compras-productos/route.ts:96-126` (createSchema)
- Modify: `src/components/compras/compra-producto-form.tsx:27-56` (compraProductoSchema)

**Step 1: Add margin validation to API schema**

Add a `.refine()` validation after the base schema:

```typescript
}).refine(
  (data) => data.precioVenta >= data.precioCosto * 1.1,
  {
    message: 'El precio de venta debe tener al menos un 10% de margen sobre el costo',
    path: ['precioVenta']
  }
)
```

**Step 2: Add same validation to form schema**

Update `src/components/compras/compra-producto-form.tsx` schema with the same refine validation.

**Step 3: Test margin validation**

Try creating a purchase with:
- precioCosto: 100
- precioVenta: 105
Expected: Error "El precio de venta debe tener al menos un 10% de margen"

Try with:
- precioCosto: 100
- precioVenta: 110
Expected: Success

**Step 4: Commit**

```bash
git add src/app/api/compras-productos/route.ts src/components/compras/compra-producto-form.tsx
git commit -m "feat(compras): add 10% minimum margin validation"
```

---

### Task 1.3: Verificar Factura Duplicada

**Files:**
- Modify: `src/app/api/compras-productos/route.ts:186-350` (POST handler)

**Step 1: Add duplicate invoice check in POST handler**

Before creating the purchase, check if numeroFactura already exists:

```typescript
// Check for duplicate invoice number (only if provided)
if (data.numeroFactura && data.numeroFactura.trim() !== '') {
  const existingCompra = await prisma.compraProducto.findFirst({
    where: {
      numeroFactura: data.numeroFactura.trim(),
      proveedorId: data.vendorId  // Same vendor
    }
  })
  
  if (existingCompra) {
    return NextResponse.json({
      error: 'Ya existe una compra con este número de factura para el mismo proveedor',
      compraExistente: existingCompra.compraProductoId
    }, { status: 409 })
  }
}
```

**Step 2: Test duplicate invoice detection**

1. Create a purchase with numeroFactura: "FACT-001" and vendorId: "vendor-1"
2. Try creating another purchase with same numeroFactura and vendorId
Expected: 409 Conflict error

3. Try creating with same numeroFactura but different vendorId
Expected: Success (same invoice number from different vendors is allowed)

**Step 3: Commit**

```bash
git add src/app/api/compras-productos/route.ts
git commit -m "feat(compras): add duplicate invoice validation per vendor"
```

---

## FASE 2: Revisar y Mejorar RESTOCK

### Task 2.1: Analizar RESTOCK Actual

**Files to review:**
- `src/app/api/productos/restock/route.ts`
- `src/lib/restock-validation.ts`
- `src/components/productos/restock-form.tsx`

**Current Issues Identified:**
1. No maneja numeroFactura ni facturaUrl en el gastoCompra creado
2. No crea registro CompraProducto para el restock
3. El formulario muestra precios ponderados que confunden al usuario
4. No hay validación de margen 10%

---

### Task 2.2: Eliminar Campos de Precio Ponderado del Formulario

**Files:**
- Modify: `src/components/productos/restock-form.tsx:546-609` (remove weighted prices display)

**Step 1: Remove weighted prices preview section**

Remove or simplify the "Resumen del Restock" card that shows weighted average prices.
Keep only:
- Stock después del restock
- Costo total de compra
- Margen estimado por unidad

Remove the section showing "Nuevos precios promedio ponderado".

**Step 2: Update form to be clearer**

Update labels to clarify that prices are optional and only used if explicitly changed:
- "Nuevo Precio de Costo (Opcional - mantener vacío para no cambiar)"
- "Nuevo Precio de Venta (Opcional - mantener vacío para no cambiar)"

**Step 3: Test form without weighted prices**

Open restock form and verify:
- No weighted price preview shown
- Form still works correctly
- Optional prices can be left empty

**Step 4: Commit**

```bash
git add src/components/productos/restock-form.tsx
git commit -m "ui(restock): remove confusing weighted price preview from form"
```

---

### Task 2.3: Actualizar API RESTOCK para Crear CompraProducto

**Files:**
- Modify: `src/app/api/productos/restock/route.ts`

**Step 1: Add missing fields to gastoCompra creation**

Update both gastoCompra.create calls to include:
- numeroFactura (from request)
- facturaUrl handling (may need to add to schema first)

**Step 2: Create CompraProducto record for restocks**

After creating gastoCompra, create a CompraProducto record:

```typescript
const compraProducto = await tx.compraProducto.create({
  data: {
    productoId: producto.id,
    proveedorId: producto.vendorId,
    numeroFactura: data.numeroFactura || '',
    facturaUrl: data.facturaUrl || '',
    cantidad: cantidad,
    precioUnitario: costPrice,
    total: totalCost,
    formaPago: data.formaPago || 'PAGO_COMPLETO',
    estado: data.estado || 'PAGADA',
    tipoOperacion: 'RESTOCK',
    descripcion: descripcion || `Restock - ${producto.nombre}`,
    fechaCompra: now,
    gastoCompraId: gastoCompra.gastoCompraId
  }
})
```

**Step 3: Return compraProducto in response**

Update the response to include the created compraProducto.

**Step 4: Test restock creates CompraProducto**

Make a restock request and verify:
- CompraProducto record is created with tipoOperacion: 'RESTOCK'
- gastoCompra has numeroFactura if provided
- Response includes compraProducto

**Step 5: Commit**

```bash
git add src/app/api/productos/restock/route.ts
git commit -m "feat(restock): create CompraProducto record and add invoice fields"
```

---

### Task 2.4: Agregar Validación de Margen 10% a RESTOCK

**Files:**
- Modify: `src/lib/restock-validation.ts:57-67` (existing price validation)

**Step 1: Update price validation to require 10% margin**

Change the validation from:
```typescript
if (data.precioCosto !== undefined && data.precioVenta !== undefined) {
  return data.precioVenta >= data.precioCosto
}
```

To:
```typescript
if (data.precioCosto !== undefined && data.precioVenta !== undefined) {
  return data.precioVenta >= data.precioCosto * 1.1
}
```

And update the error message to reflect the 10% requirement.

**Step 2: Commit**

```bash
git add src/lib/restock-validation.ts
git commit -m "feat(restock): add 10% minimum margin validation"
```

---

## FASE 3: Mejoras de Media Prioridad + Auditoría

### Task 3.1: Agregar Endpoints CRUD Faltantes

**Files to create/modify:**
- Create: `src/app/api/compras-productos/[id]/route.ts` (GET by ID, PUT, DELETE)

**Step 1: Create GET by ID endpoint**

```typescript
export const GET = withAuthGet(async (request: NextRequest, context: { params: { id: string } }) => {
  try {
    const { id } = context.params
    
    const compra = await prisma.compraProducto.findUnique({
      where: { compraProductoId: id },
      include: {
        producto: { include: { categoria: true, unidad: true } },
        proveedor: true,
        gastoCompra: true,
        cuentaPorPagar: true
      }
    })
    
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }
    
    return NextResponse.json({ compra })
  } catch (error) {
    console.error('Error al obtener compra:', error)
    return NextResponse.json({ error: 'Error al obtener compra' }, { status: 500 })
  }
})
```

**Step 2: Create PUT endpoint**

Allow updating editable fields (not product data, just purchase metadata):
- numeroFactura
- facturaUrl
- descripcion
- formaPago/estado (with business rules)

**Step 3: Create DELETE endpoint**

Implement soft delete or restrict delete if purchase has payments.

**Step 4: Commit**

```bash
git add src/app/api/compras-productos/
git commit -m "feat(compras): add CRUD endpoints (GET by ID, PUT, DELETE)"
```

---

### Task 3.2: Agregar Filtros Avanzados

**Files:**
- Modify: `src/app/api/compras-productos/route.ts:89-94` (query schema)

**Step 1: Add date range and amount filters**

```typescript
const querySchema = z.object({
  // ... existing filters
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  montoMin: z.coerce.number().optional(),
  montoMax: z.coerce.number().optional(),
  proveedorId: z.string().optional(),
})
```

**Step 2: Implement filter logic in GET**

Add conditions to whereClause for each new filter.

**Step 3: Commit**

```bash
git add src/app/api/compras-productos/route.ts
git commit -m "feat(compras): add advanced filters (date range, amount, vendor)"
```

---

### Task 3.3: Agregar Campos de Auditoría (createdBy)

**Files:**
- Modify: `prisma/schema.prisma:475-501` (CompraProducto model)
- Modify: `src/app/api/compras-productos/route.ts:186-350` (POST handler)

**Step 1: Update Prisma schema**

```prisma
model CompraProducto {
  // ... existing fields
  createdById String?
  createdBy   User? @relation(fields: [createdById], references: [id])
  updatedById String?
  updatedBy   User? @relation("CompraProductoUpdatedBy", fields: [updatedById], references: [id])
}
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_compra_audit_fields
```

**Step 3: Update POST handler to capture user**

```typescript
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  // ... validation logic
  
  const compraProducto = await tx.compraProducto.create({
    data: {
      // ... existing fields
      createdById: user.userId || user.id
    }
  })
})
```

**Step 4: Commit**

```bash
git add prisma/ src/app/api/compras-productos/route.ts
git commit -m "feat(compras): add audit fields (createdBy, updatedBy)"
```

---

## FASE 4: Mejoras de Baja Prioridad

### Task 4.1: Implementar Soft Delete

**Files:**
- Modify: `prisma/schema.prisma:475-501`
- Modify: `src/app/api/compras-productos/[id]/route.ts` (DELETE handler)
- Modify: `src/app/api/compras-productos/route.ts:165-172` (GET handler)

**Step 1: Add deletedAt field to schema**

```prisma
model CompraProducto {
  // ... existing fields
  deletedAt DateTime?
}
```

**Step 2: Update GET to exclude soft-deleted**

Add to whereClause: `deletedAt: null`

**Step 3: Update DELETE to soft delete**

```typescript
await prisma.compraProducto.update({
  where: { compraProductoId: id },
  data: { deletedAt: new Date() }
})
```

**Step 4: Commit**

```bash
git add prisma/ src/app/api/compras-productos/
git commit -m "feat(compras): implement soft delete"
```

---

### Task 4.2: Agregar Exportación a Excel/PDF

**Files:**
- Create: `src/app/api/compras-productos/export/route.ts`

**Step 1: Create export endpoint**

Support formats: 'csv', 'excel', 'pdf'
Accept same filters as GET
Generate file and return as download

**Step 2: Add export button to frontend**

Add to `src/app/busy/compras-productos/page.tsx`

**Step 3: Commit**

```bash
git add src/app/api/compras-productos/export/ src/app/busy/compras-productos/page.tsx
git commit -m "feat(compras): add export to CSV/Excel/PDF"
```

---

### Task 4.3: Agregar Análisis de Rentabilidad

**Files:**
- Modify: `src/app/models/model.ts:110-130`
- Modify: `src/app/api/compras-productos/route.ts:334-345` (response)

**Step 1: Add margin calculation to response**

```typescript
const margenPorcentaje = ((data.precioVenta - data.precioCosto) / data.precioCosto * 100).toFixed(2)

const response = {
  ...result,
  success: true,
  analisisRentabilidad: {
    margenPorcentaje: parseFloat(margenPorcentaje),
    margenAbsoluto: data.precioVenta - data.precioCosto,
    rentabilidad: parseFloat(margenPorcentaje) >= 10 ? 'BUENA' : 'BAJA'
  }
}
```

**Step 2: Display in frontend**

Show margin analysis in purchase detail view.

**Step 3: Commit**

```bash
git add src/app/models/model.ts src/app/api/compras-productos/route.ts
git commit -m "feat(compras): add profitability analysis"
```

---

### Task 4.4: Notificaciones de Contrato Próximo a Vencer

**Files:**
- Already implemented in `src/app/api/compras-productos/route.ts:12-87`
- Enhance: Add toast notification in frontend

**Step 1: Ensure frontend shows contract warnings**

The API already returns `advertencia` field. Verify frontend shows it properly.

**Step 2: Commit**

```bash
git commit -m "feat(compras): verify contract expiration notifications"
```

---

## Summary

This plan implements all requested improvements:

1. **FASE 1:** Pagination, 10% margin validation, duplicate invoice check
2. **FASE 2:** Fix RESTOCK to create CompraProducto, remove confusing weighted prices
3. **FASE 3:** Complete CRUD, advanced filters, audit fields (createdBy)
4. **FASE 4:** Soft delete, export, profitability analysis, contract notifications

Each task includes exact file paths, code changes, and verification steps.
