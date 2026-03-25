# Design: GastosDE Management Enhancement

## Technical Approach

Enhance the existing GastosDE functionality to properly handle service-based expenses with optional invoice tracking, ensuring seamless integration with the financial reconciliation workflow. The current implementation has gaps in API route handling and form validation that need to be addressed to match the specification requirements.

## Architecture Decisions

### Decision: API Route Field Alignment

**Choice**: Update API routes to include all relevant GastosDE fields (especially numeroFactura) and remove manual timestamp setting
**Alternatives considered**: 
- Keep current API routes and fix only in frontend forms
- Create new API endpoints specifically for this enhancement
**Rationale**: 
The current POST route omits numeroFactura from the create operation despite the model supporting it, and manually sets timestamps that could conflict with Prisma's @default(now()). The PATCH route incorrectly includes immutable fields like gastosDEId and createdAt in updates. Aligning the API routes with the complete model ensures data consistency and follows RESTful principles.

### Decision: Form Validation Enhancement

**Choice**: Enhance form validation to match business requirements while maintaining existing UX patterns
**Alternatives considered**:
- Keep current validation as-is since it mostly works
- Redesign the form completely with different field names
**Rationale**:
The current form already captures the necessary fields (tipo, numeroFactura, proveedor, monto, descripcion) but has minor validation message typos ("descipcion" instead of "descripcion"). Enhancing validation messages and ensuring proper handling of optional fields provides better user experience without changing the established UI patterns.

### Decision: Vendor Relationship Modeling

**Choice**: Keep proveedor as a simple string field rather than implementing a foreign key to Vendor model
**Alternatives considered**:
- Implement proper foreign key relationship to Vendor model
- Create a separate proveedor table for normalization
**Rationale**:
The GastosDE model currently uses a simple string for "proveedor" field, and changing this would require schema migrations and affect existing data. The proposal emphasizes keeping the provider field for invoice tracking, not for complex vendor relationships. Keeping it as a string maintains backward compatibility while satisfying the requirement to track providers for service-based expenses.

## Data Flow

```
User Interface ──→ Form Submission ──→ API Route ──→ Prisma ──→ Database
     ↑                                                                ↓
     └────────── Display Results ←── API Response ←──────────────────┘
           ↑                                                                ↓
     Reconciliation Workflow ←───── GastosDE Records ←─────────────────┘
```

When creating/editing a GastosDE:
1. User fills form with tipo, numeroFactura (optional), proveedor, monto, descripcion
2. Form submits to Next.js API route
3. API validates and passes data to Prisma create/update
4. Prisma saves to GastosDE table with auto-generated timestamps
5. API returns created/updated record
6. UI updates table/list view
7. Record appears in gastos pendientes reconciliation via existing integration

When viewing in reconciliation:
1. GastosDE records are queried alongside other expense types
2. System displays provider as primary detail for GastosDE records
3. User can initiate reconciliation process
4. On successful reconciliation, ReconciliacionGasto record is created linking to GastosDE

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/gastosDE/route.ts` | Modify | Fix POST route to include numeroFactura, remove manual timestamp setting, use correct ID field |
| `src/app/api/gastosDE/[id]/route.ts` | Modify | Fix PATCH route to exclude immutable fields, add numeroFactura to update data |
| `src/components/gastoDE/GastoDEForm.tsx` | Modify | Fix validation message typo, improve field handling for optional invoice |
| `openspec/specs/contabilidad/gastosDE/spec.md` | Modify | Update existing spec to reflect enhanced functionality (optional invoice focus) |

## Interfaces / Contracts

### GastosDE API Contract

```typescript
// POST /api/gastosDE - Create GastosDE
Request Body:
{
  gastosDEId: string (UUID),
  tipo: string (required),
  numeroFactura?: string (optional),
  proveedor: string (required),
  monto: number (required, > 0),
  descripcion: string (required)
}

Response (200):
{
  gastosDEId: string,
  tipo: string,
  numeroFactura: string | null,
  proveedor: string,
  monto: number,
  descripcion: string,
  periodo: string (YYYY-MM format),
  isPagado: string | null,
  createdAt: ISO string,
  updatedAt: ISO string
}

// PATCH /api/gastosDE/[id] - Update GastosDE
Request Body:
{
  tipo?: string,
  numeroFactura?: string | null,
  proveedor?: string,
  monto?: number (> 0),
  descripcion?: string
}

Response (200): Same as GET response
```

### GastosDE Form Contract

The GastoDEForm component uses react-hook-form with zod validation:
- Fields: tipo, numeroFactura (optional), proveedor, monto, descripcion
- Validation: 
  - tipo: required, custom error message
  - numeroFactura: optional, no validation
  - proveedor: required, custom error message
  - monto: required, must be positive number
  - descripcion: required, custom error message, auto-uppercase on input

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Form validation logic | Test zod schema with valid/invalid inputs |
| Integration | API route handlers | Test POST/PATCH with complete/incomplete data |
| UI | Form submission and display | Verify fields map correctly to API and display |
| Reconciliation | GastosDE appearance in pendientes | Confirm records show up in reconciliation workflow |
| Error Handling | Foreign key constraints | Verify proper validation prevents constraint violations |

## Migration / Rollout

No migration required. The changes are backward compatible:
- Existing GastosDE records will continue to work
- New records can optionally include invoice numbers
- API changes enhance rather than break existing functionality
- Database schema already supports all required fields

## Open Questions

- [ ] Should we add automatic periodo generation based on createdAt date, or allow manual periodo selection?
- [ ] Should the proveedor field include autocomplete/suggestions from existing Vendor records?
- [ ] Should we add filtering by numeroFactura in the GastosDE list view?

## Next Step
Ready for tasks (sdd-tasks).