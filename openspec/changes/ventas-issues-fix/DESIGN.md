# Design: Ventas - Issues Críticos & Multitenancy

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      API Request                             │
│                   POST /api/ventas                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    [Auth Middleware]         [Extract TenantId]
    (withAuthPost)            (requireTenant(user))
        │                             │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  1. VALIDATE IdempotencyKey │
        │  - Check if exists in DB    │
        │  - If yes: Return existing  │
        │  - If no: Generate UUID     │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────────────────┐
        │  2. VALIDATE Locations (Point of Sale) │
        │  - Verify PuntoDeVenta(pvId) exists    │
        │  - Verify Almacen if parent product    │
        │  - Return 404 if invalid                │
        └──────────────┬──────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────┐
        │  3. TRANSACTION START                   │
        │  ├─ Validate Stock (VentaItem only)    │
        │  ├─ Create Venta + VentaItem[]         │
        │  ├─ Create Factura (if clienteId)      │
        │  ├─ Update StockUbicacion              │
        │  ├─ Handle Pack Products               │
        │  ├─ Handle Anticipos                   │
        │  └─ ROLLBACK on any error              │
        └──────────────┬──────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  4. CACHE INVALIDATION      │
        │  - revalidatePath(...)      │
        │  - DELETE /api/dashboard    │
        └──────────────┬──────────────┘
                       │
                  [Response 201/400/500]
```

---

## Implementation Details by Issue

### Issue #1: MultiTenant Fix

#### Changes to `src/features/ventas/api/handlers.ts`

```typescript
// ❌ REMOVE (líneas 82, 138, 164, 247, 347):
tenantId: ''

// ✅ ADD:
const tenantId = requireTenant(user);

// In each handler function signature:
export async function createVentaHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser  // Already present but not used properly
) {
  const tenantId = requireTenant(user);  // ADD THIS LINE
  
  // Then replace ALL tenantId: '' with tenantId
}
```

#### Impact Map
- `crearVentaMixta()` - línea 138, 164
- `crearVentaUnica()` - línea 247
- `criarVentaIndividual()` - línea 347
- `crearFacturaParaVenta()` - línea 82

#### Tests
```typescript
// test: multitenancy isolation
it('should create venta with user tenantId, not empty string', async () => {
  const user = { userId: 'u1', tenantId: 'tenant-abc' };
  const response = await createVentaHandler(req, {}, user);
  const venta = JSON.parse(response.body);
  
  expect(venta.tenantId).toBe('tenant-abc');
  expect(venta.tenantId).not.toBe('');
});
```

---

### Issue #2: Idempotency Key Validation

#### Schema Update: `src/features/ventas/schemas.ts`

```typescript
// ADD to createVentaSchema:
export const createVentaSchema = z.object({
  // ... existing fields
  idempotencyKey: z.string().uuid().optional(),  // ADD THIS
});

// ADD new table tracking schema:
export const idempotencyKeySchema = z.object({
  key: z.string().uuid(),
  ventaId: z.string(),
  tenantId: z.string(),
  createdAt: z.date(),
});
```

#### DB Schema Change

```sql
-- Add to Venta model in prisma/schema.prisma:
model Venta {
  // ... existing fields
  idempotencyKey    String?      @unique
  // ... rest
  
  @@index([tenantId, idempotencyKey])
}

-- Run migration:
$ pnpm prisma migrate dev --name add_idempotency_key
```

#### Handler Logic

```typescript
async function createVentaHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser
) {
  const body = await request.json();
  const tenantId = requireTenant(user);
  
  // NEW: Validate/check idempotency key
  let idempotencyKey = body.idempotencyKey;
  let existingVenta = null;
  
  if (idempotencyKey) {
    existingVenta = await prisma.venta.findFirst({
      where: {
        idempotencyKey,
        tenantId,
      },
      select: VENTA_SELECT,
    });
    
    if (existingVenta) {
      // Return existing, idempotent
      return NextResponse.json(existingVenta, { status: 200 });
    }
  } else {
    // Generate UUID if not provided
    idempotencyKey = crypto.randomUUID();
  }
  
  // Then proceed with creation (pass idempotencyKey to be saved)
  // ...
}
```

#### Tests
```typescript
it('should return existing venta on idempotency key retry', async () => {
  const key = 'uuid-12345';
  const req1 = createRequest({ idempotencyKey: key, ... });
  const res1 = await createVentaHandler(req1, {}, user);
  
  const req2 = createRequest({ idempotencyKey: key, ... }); // SAME
  const res2 = await createVentaHandler(req2, {}, user);
  
  expect(res1.status).toBe(201);
  expect(res2.status).toBe(200); // idempotent!
  expect(JSON.parse(res1.body).ventaId).toBe(JSON.parse(res2.body).ventaId);
});
```

---

### Issue #3: Stock Strategy Unification

#### Changes: `src/features/ventas/api/handlers.ts`

```typescript
// ❌ REMOVE this calculation:
const [ventasItems, ventasLegacy] = await Promise.all([
  prisma.ventaItem.aggregate({ where: { productoId, venta: { puntoDeVentaId } }, ... }),
  prisma.venta.aggregate({ 
    where: { productoId, puntoDeVentaId, items: { none: {} } },  // DEPRECATED
    ... 
  }),
])
const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)

// ✅ USE ONLY VentaItem:
const ventasItems = await prisma.ventaItem.aggregate({
  where: { productoId, venta: { puntoDeVentaId } },
  _sum: { cantidad: true },
});
const ventasTotal = ventasItems._sum.cantidad || 0;
```

#### Venta Creation

```typescript
// ✅ ALWAYS create VentaItem, never use venta.productoId
const venta = await prisma.venta.create({
  data: {
    tenantId,
    puntoDeVentaId,
    clienteId: clienteId || null,
    // ❌ REMOVE: productoId, cantidad
    
    items: {
      create: productosConPrecio.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: Number(item.precioVenta),
        total: Number(item.subtotal),
      })),
    },
  },
});

// Verify at read time:
// venta.productoId MUST BE null
// venta.items MUST BE non-empty array
```

#### Deprecation Warning

```typescript
// Add to handlers.ts top:
console.warn(
  '[DEPRECATION] venta.productoId + venta.cantidad are legacy. Use venta.items[] instead. ' +
  'Legacy strategy will be removed in v2.0.0. Background migration running.'
);
```

#### Migration Script (background task)

```typescript
// scripts/migrate-venta-stock-to-items.ts
async function migrateVentaToVentaItem() {
  const legacyVentas = await prisma.venta.findMany({
    where: {
      productoId: { not: null },
      items: { none: {} },
    },
  });
  
  for (const venta of legacyVentas) {
    await prisma.ventaItem.create({
      data: {
        ventaId: venta.ventaId,
        productoId: venta.productoId!,
        cantidad: venta.cantidad,
        precioUnitario: 0, // Best effort
        total: 0,
      },
    });
  }
}
```

#### Tests
```typescript
it('should create VentaItem, not use venta.productoId', async () => {
  const response = await createVentaHandler(req, {}, user);
  const venta = JSON.parse(response.body);
  
  expect(venta.productoId).toBeNull();
  expect(venta.items).toHaveLength(1);
  expect(venta.items[0].productoId).toBe('prod-001');
});

it('should calculate stock using only VentaItem', async () => {
  // Create venta
  await createVentaHandler(req, {}, user);
  
  // Check stock calculation
  const available = await calculateAvailableStock('prod-001', 'pv-001');
  expect(available).toBe(90); // 100 - 10 from VentaItem
});
```

---

### Issue #4: Location Validation

#### Changes: `src/features/ventas/api/handlers.ts`

```typescript
async function crearVentaUnica(body: any, user: any) {
  // ADD validation BEFORE any DB operation
  
  // 1. Validate PuntoDeVenta exists
  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
    where: { pvId: body.puntoDeVentaId },
  });
  
  if (!puntoDeVenta) {
    return NextResponse.json(
      { error: 'Punto de venta no encontrado' },
      { status: 404 }
    );
  }
  
  // 2. Validate Almacenes for parent products
  for (const item of body.productos) {
    const producto = await prisma.producto.findUnique({
      where: { id: item.productoId },
    });
    
    if (!producto) {
      return NextResponse.json(
        { error: `Producto ${item.productoId} no encontrado` },
        { status: 404 }
      );
    }
    
    if (producto.productoPadreId) {
      const parent = await prisma.producto.findUnique({
        where: { id: producto.productoPadreId },
        select: { almacenId: true },
      });
      
      if (!parent || !parent.almacenId) {
        return NextResponse.json(
          { error: 'Almacén no disponible para producto padre' },
          { status: 400 }
        );
      }
      
      const almacen = await prisma.almacen.findUnique({
        where: { almacenId: parent.almacenId },
      });
      
      if (!almacen || !almacen.activo) {
        return NextResponse.json(
          { error: 'Almacén inactivo o no encontrado' },
          { status: 400 }
        );
      }
    }
  }
  
  // THEN proceed with transaction
  try {
    const venta = await prisma.$transaction(async (tx) => {
      // ... venta creation
    });
  } catch (error) {
    // Will be handled by Issue #5 error handling
  }
}
```

#### Tests
```typescript
it('should return 404 if PuntoDeVenta not found', async () => {
  const response = await createVentaHandler(
    createRequest({ puntoDeVentaId: 'pv-invalid' }),
    {},
    user
  );
  
  expect(response.status).toBe(404);
  expect(JSON.parse(response.body).error).toContain('Punto de venta');
});

it('should return 400 if Almacén inactive', async () => {
  // Create almacén inactivo
  // Create producto padre con ese almacén
  // Try to create venta
  
  const response = await createVentaHandler(req, {}, user);
  expect(response.status).toBe(400);
  expect(JSON.parse(response.body).error).toContain('Almacén');
});
```

---

### Issue #5: Error Handling & Rollback

#### Changes: `src/features/ventas/api/handlers.ts`

```typescript
// Wrapper function for consistent error handling
async function withVentaTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  context: { ventaId?: string; userId: string; operation: string }
): Promise<T> {
  try {
    return await prisma.$transaction(fn);
  } catch (error) {
    // Log detailed context
    console.error('[VENTA_TX_ROLLBACK]', {
      operation: context.operation,
      userId: context.userId,
      ventaId: context.ventaId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Re-throw for caller to handle HTTP response
    throw error;
  }
}

// Usage in handlers:
export async function createVentaHandler(...) {
  try {
    // ... validations (Issues #1, #2, #4)
    
    const venta = await withVentaTransaction(
      async (tx) => {
        const ventaCreada = await tx.venta.create({ data: {...} });
        
        if (clienteId && user?.userId) {
          await crearFacturaParaVenta(tx, ...);
        }
        
        for (const item of productosConPrecio) {
          await upsertStockUbicacion(tx, {
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: puntoDeVentaId,
            modo: 'increment',
            delta: -item.cantidad,
          });
        }
        
        return ventaCreada;
      },
      { userId: user.userId, operation: 'create_venta_unica' }
    );
    
    return NextResponse.json(venta, { status: 201 });
  } catch (error) {
    console.error('[VENTA_HANDLER_ERROR]', {
      userId: user?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Discriminate error types
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Venta duplicada o conflicto de datos' },
          { status: 409 }
        );
      }
    }
    
    if (error instanceof Error && error.message.includes('Stock insuficiente')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Generic error
    return NextResponse.json(
      { error: 'Error al crear venta', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
```

#### Logging Schema

```typescript
// Create audit table for critical operations
// In prisma/schema.prisma:
model AuditVenta {
  id        String   @id @default(cuid())
  ventaId   String?
  tenantId  String
  operacion String   // 'create', 'update', 'delete', 'rollback'
  userId    String
  resultado String   // 'success', 'rollback', 'error'
  mensaje   String?
  detalles  Json?    // Error details, validation errors, etc
  createdAt DateTime @default(now())
}
```

#### Tests
```typescript
it('should rollback transaction and log error if stock operation fails', async () => {
  // Mock upsertStockUbicacion to throw error
  jest.spyOn(stockService, 'upsertStockUbicacion').mockRejectedValueOnce(
    new Error('Location invalid')
  );
  
  const response = await createVentaHandler(req, {}, user);
  
  expect(response.status).toBe(500);
  
  // Verify venta NOT created
  const ventas = await prisma.venta.findMany({
    where: { tenantId: user.tenantId },
  });
  expect(ventas).toHaveLength(0);
  
  // Verify error logged
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('[VENTA_TX_ROLLBACK]'),
    expect.anything()
  );
});
```

---

## Database Schema Changes

### Prisma Migration

```sql
-- Add to prisma/schema.prisma

model Venta {
  // ... existing fields
  
  // NEW: For idempotency
  idempotencyKey    String?      @unique
  
  // DEPRECATE (keep for backward compat, mark as nullable):
  productoId        String?      @deprecated("Use items[] instead")
  cantidad          Int?         @deprecated("Use items[] instead")
  
  // For audit
  createdBy         String       // userId
  
  // ... rest of model
  
  @@index([tenantId])
  @@index([tenantId, idempotencyKey])
  @@index([tenantId, createdAt])
}

model AuditVenta {
  id        String   @id @default(cuid())
  ventaId   String?
  tenantId  String
  operacion String
  userId    String
  resultado String
  mensaje   String?
  detalles  Json?
  createdAt DateTime @default(now())
  
  @@index([tenantId, createdAt])
}
```

### Migration Command

```bash
pnpm prisma migrate dev --name fix_ventas_multitenancy_idempotency_stock
```

---

## Sequence Diagram: Happy Path

```
Client                API Handler           Prisma TX         Services
  │                        │                    │                 │
  ├─ POST /api/ventas ─────>│                    │                 │
  │   {idempotencyKey,      │                    │                 │
  │    productos, ...}      │                    │                 │
  │                         │                    │                 │
  │                         ├─ Extract TenantId  │                 │
  │                         │                    │                 │
  │                         ├─ Check Idempotency │                 │
  │                         │  Key (not exists)  │                 │
  │                         │                    │                 │
  │                         ├─ Validate          │                 │
  │                         │  Locations         │                 │
  │                         │                    │                 │
  │                         │                    ├─ START TX       │
  │                         │                    │                 │
  │                         │                    ├─ CREATE Venta   │
  │                         │                    │  + VentaItem    │
  │                         │                    │                 │
  │                         │                    ├─ CREATE Factura │
  │                         │                    │                 │
  │                         │  upsertStockUbic ──────────────────>│
  │                         │  ación            │                 │
  │                         │  <──────────────────────────────────┤
  │                         │                    │                 │
  │                         │                    ├─ COMMIT TX      │
  │                         │                    │                 │
  │                         ├─ Invalidate Cache  │                 │
  │                         │                    │                 │
  │ <─ Response 201 ────────┤                    │                 │
  │  {ventaId, items[],     │                    │                 │
  │   idempotencyKey, ...}  │                    │                 │
```

---

## Implementation Checklist

- [ ] Issue #1: MultiTenant fix (requireTenant in all handlers)
- [ ] Issue #4: Location validation (before transaction)
- [ ] Issue #3: Stock unification (VentaItem only, deprecate legacy)
- [ ] Issue #2: Idempotency (schema + handler logic)
- [ ] Issue #5: Error handling (withVentaTransaction wrapper + logging)
- [ ] DB Migrations (prisma migrate)
- [ ] Tests (unit + integration)
- [ ] Documentation update
- [ ] Background migration script (legacy stock)
- [ ] Rollback plan documented
