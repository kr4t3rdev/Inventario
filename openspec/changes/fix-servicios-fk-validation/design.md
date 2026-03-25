# Design: Fix FK Validation in Servicios API

## Technical Approach

Agregar validación de foreign keys antes de crear un servicio, verificando que los IDs proporcionados existen en sus tablas correspondientes. Si un FK es inválido, retornar HTTP 400 con mensaje específico en lugar de lasciar que Prisma lance un error de constraint.

## Architecture Decisions

### Decision: Validation Approach

**Choice**: Validar cada FK individualmente con `findUnique` antes del create
**Alternatives considered**: 
- Usar transacción con múltiples queries
- Dejar que Prisma lance el error y capturarlo
- Usar `connect` de Prisma con try-catch

**Rationale**: El patrón existente en el proyecto (ej. `/api/licencias/route.ts`) usa `findUnique` + return 404. Es consistente y дает mensajes de error específicos al frontend.

### Decision: Validation Order

**Choice**: Validar en orden: vendorId → categoriaId → subcategoriaId → unidadId
**Alternatives considered**: Validar todos en paralelo con Promise.all

**Rationale**: Validación secuencial permite retornar el primer error encontrado con mensaje claro. Paralelo requeriría agregar lógica para consolidar errores.

## Data Flow

```
POST /api/servicios
    │
    ├─→ Parse body with Zod
    │
    ├─→ Check user role (existing)
    │
    ├─→ Validate vendorId (if provided)
    │       │
    │       └─→ findUnique(Vendor) ──→ 404 if not found
    │
    ├─→ Validate categoriaId (if provided)
    │       │
    │       └─→ findUnique(Categoria) ──→ 404 if not found
    │
    ├─→ Validate subcategoriaId (if provided)
    │       │
    │       └─→ findUnique(Categoria) ──→ 404 if not found
    │
    ├─→ Validate unidadId (if provided)
    │       │
    │       └─→ findUnique(Unidad) ──→ 404 if not found
    │
    └─→ prisma.servicios.create()
            │
            └─→ Return 201 with created service
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/servicios/route.ts` | Modify | Add FK validation before create |

## Interfaces / Contracts

### API Response for Invalid FK

```typescript
// HTTP 400 or 404
{
  error: "El proveedor especificado no existe",
  field: "vendorId",
  providedId: "invalid-id"
}
```

### Validation Functions

```typescript
async function validateVendor(vendorId: string | null | undefined): Promise<void> {
  if (!vendorId) return
  const vendor = await prisma.vendor.findUnique({ where: { vendorId } })
  if (!vendor) throw new InvalidFkError('proveedor', vendorId)
}

async function validateCategoria(categoriaId: string | null | undefined): Promise<void> {
  if (!categoriaId) return
  const categoria = await prisma.categoria.findUnique({ where: { catId: categoriaId } })
  if (!categoria) throw new InvalidFkError('categoría', categoriaId)
}

async function validateUnidad(unidadId: string | null | undefined): Promise<void> {
  if (!unidadId) return
  const unidad = await prisma.unidad.findUnique({ where: { unidadId } })
  if (!unidad) throw new InvalidFkError('unidad', unidadId)
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Validation functions | Test with valid/invalid IDs |
| Integration | POST with invalid FK | Verify 400 response |
| Integration | POST with valid FKs | Verify 201 response |

## Migration / Rollout

No migration required. This is a validation enhancement.

## Open Questions

- [ ] None - el patrón está claro y es consistente con el resto del proyecto
