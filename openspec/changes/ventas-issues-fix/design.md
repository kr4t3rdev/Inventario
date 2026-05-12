# Design: Fix 5 Critical Issues in Ventas System

## Technical Approach

Resolver 5 issues en orden de dependencia: MultiTenant (#1) → Location Validation (#4) → Stock Unification (#3) → Idempotency Key (#2) → Error Handling (#5). Cada issue es un cambio incremental sobre el anterior.

## Architecture Decisions

### Decision: MultiTenant via requireTenant()

**Choice**: Reemplazar `tenantId: ''` hardcodeado con `requireTenant(user)` en TODOS los handlers de ventas

**Alternatives considered**: Pasar tenantId desde el frontend, usar middleware global

**Rationale**: El tenant debe venir del token JWT (server-confiable), no del cliente. `requireTenant()` ya existe en `tenant-scope.ts` y es el patrón establecido en el proyecto.

**Implementation**:
```typescript
// Antes
const venta = await prisma.venta.create({
  data: { ...data, tenantId: '' }
})

// Después
const tenantId = requireTenant(user)
const venta = await prisma.venta.create({
  data: { ...data, tenantId }
})
```

Además, agregar `withAuth()` wrapper a rutas `[id]/route.ts` y `stats/route.ts` que actualmente no tienen autenticación.

### Decision: Location Validation with findUnique

**Choice**: Validar `puntoDeVentaId` y `almacenId` con `findUnique` antes de `prisma.$transaction`

**Alternatives considered**: Dejar que Prisma lance error de FK, validar en Zod schema

**Rationale**: `findUnique` es rápido (por PK), da error 400 específico, y sigue el patrón existente en servicios. Zod no puede validar existencia en DB.

```typescript
async function validateVentaLocations(
  puntoDeVentaId: string,
  almacenId: string,
  prisma: PrismaClient
): Promise<void> {
  const [puntoDeVenta, almacen] = await Promise.all([
    prisma.puntoDeVenta.findUnique({ where: { puntoDeVentaId } }),
    prisma.almacen.findUnique({ where: { almacenId } }),
  ])
  if (!puntoDeVenta) throw new ValidationError('El punto de venta especificado no existe')
  if (!almacen) throw new ValidationError('El almacén especificado no existe')
}
```

### Decision: Stock Unification — Remove Legacy Aggregate

**Choice**: Eliminar el aggregate `ventasLegacy` que sumaba `Venta.productoId` + `Venta.cantidad`. Calcular stock solo con `VentaItem`.

**Alternatives considered**: Mantener ambos y sincronizar, migrar datos legacy

**Rationale**: La estrategia dual produce inconsistencias. Todos los datos modernos usan `VentaItem`. El legacy `productoId`/`cantidad` en Venta queda como campo deprecated pero no se usa para stock.

```typescript
// ANTES — dual strategy
const ventasLegacy = await prisma.venta.aggregate({ ... }) // ← ELIMINAR
const ventasItems = await prisma.ventaItem.aggregate({ ... })

// DESPUÉS — unified
const ventasItems = await prisma.ventaItem.aggregate({ ... })
```

### Decision: Idempotency with Optional Key

**Choice**: `idempotencyKey` opcional en schema Zod. Si no se envía, auto-generar UUID. Unique index en DB.

**Alternatives considered**: IdempotencyKey requerido, usar hash del body

**Rationale**: Backward compat obligatoria. Auto-generar UUID mantiene la protección sin forzar cambios en clientes existentes.

```typescript
// Schema
export const createVentaSchema = z.object({
  // ...existing fields
  idempotencyKey: z.string().uuid().optional(),
})

// Handler
const idempotencyKey = data.idempotencyKey ?? crypto.randomUUID()
const existing = await prisma.venta.findUnique({
  where: { idempotencyKey }
})
if (existing) {
  return NextResponse.json(existing, { status: 200 })
}
```

### Decision: withVentaTransaction Error Wrapper

**Choice**: Wrapper `withVentaTransaction` que loguea `[VENTA_TX_ROLLBACK]` y discrimina códigos Prisma

**Alternatives considered**: Middleware global, handler-specific try-catch

**Rationale**: Consistencia en todos los handlers. El discriminador de códigos Prisma (P2002→409, P2025→404) da errores semánticos HTTP.

```typescript
async function withVentaTransaction<T>(
  handlerName: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[VENTA_TX_ROLLBACK] ${handlerName}:`, error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictError('...')
      if (error.code === 'P2025') throw new NotFoundError('...')
    }
    throw error
  }
}
```

## Data Flow

```
POST /api/ventas
  │
  ├─→ withAuth (verificar JWT)
  │
  ├─→ requireTenant(user) → tenantId  [Issue #1]
  │
  ├─→ validateVentaLocations(puntoDeVentaId, almacenId)  [Issue #4]
  │       │
  │       └─→ 400 if not found
  │
  ├─→ Check idempotencyKey  [Issue #2]
  │       │
  │       ├─→ Existing → return 200 with existing venta
  │       └─→ New → auto-generate UUID if not provided
  │
  ├─→ withVentaTransaction('createVenta')  [Issue #5]
  │       │
  │       ├─→ Calcular stock desde VentaItem (no legacy)  [Issue #3]
  │       │
  │       ├─→ prisma.venta.create({ data })
  │       │
  │       └─→ [VENTA_TX_ROLLBACK] on error + Prisma code discrimination
  │
  └─→ Return 201/200
```

## File Changes

| File | Action | Issue |
|------|--------|-------|
| `src/features/ventas/api/handlers.ts` | Modify | 1,2,3,4,5 |
| `src/features/ventas/schemas.ts` | Modify | 2 |
| `src/app/api/ventas/[id]/route.ts` | Modify | 1 |
| `src/app/api/ventas/stats/route.ts` | Modify | 1 |
| `prisma/schema.prisma` | Modify | 2,5 |
| `src/features/ventas/__tests__/fixtures/ventas-test-data.ts` | Create | All |
| `src/features/ventas/__tests__/handlers-issues.test.ts` | Create | 1,2,3,4,5 |
| `src/features/ventas/api/__tests__/handlers.test.ts` | Modify | All |
| `vitest.config.mjs` | Modify | All |

## Database Changes

### New Index on Venta
```prisma
model Venta {
  // ...existing fields
  idempotencyKey String? @unique
}
```

### New AuditLog Model
```prisma
model AuditVenta {
  auditVentaId  String   @id @default(cuid())
  ventaId       String
  accion        String
  usuarioId     String   @default("")
  tenantId      String   @default("")
  createdAt     DateTime @default(now())
  metadata      Json?
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `requireTenant` integration | Mock user without/with tenant |
| Unit | `validateVentaLocations` | Mock findUnique results |
| Unit | Idempotency check | Mock findUnique to return existing |
| Unit | Stock calc | Verify only VentaItem used |
| Unit | Error wrapper | Mock Prisma to throw P2002/P2025 |
| Integration | Full create flow | Chain all mocks together |
| Integration | Route auth | Verify withAuth on [id] and stats |

Total tests: ~18 (3 existing handlers + 5 existing actions + 10 new issue-specific)

## Rollout Plan

1. Create branch from `codex/upgrade-next-16`
2. Apply migration via `prisma migrate dev` (fallback: `$executeRawUnsafe`)
3. Run full test suite — must pass 18/18
4. PR to `codex/upgrade-next-16` for code review
5. Merge when approved and green

## Open Questions

- [ ] Legacy queries using `venta.productoId` still work but log deprecation — viable approach?
