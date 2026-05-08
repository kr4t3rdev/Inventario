# SDD Phase 2: Migrate Redux APIs to Server Actions

## Change Summary

This SDD (Spec-Driven Development) cycle guides the complete migration of 5 remaining Redux RTK Query API slices to Next.js Server Actions:

1. **productosUbicacionApi** (1 endpoint)
2. **profileApi** (2 endpoints)
3. **reparacionesApi** (12 endpoints across 3 domains)
4. **produccionApi** (16 endpoints across 3 domains)
5. **reportesFinancierosApi** (1 endpoint)

**Total: 28 API endpoints → Server Actions**

## SDD Artifact Map

### 📋 Proposal
- **File**: `migrate-redux-to-server-actions-phase2.md`
- **Purpose**: Intent, scope, success criteria, risks, timeline
- **Status**: ✅ Complete

### 📝 Specifications
- **File**: `specs/migrate-redux-server-actions-phase2-spec.md`
- **Purpose**: Detailed requirements (FR/NFR), scenarios, acceptance criteria
- **Status**: ✅ Complete

### 🏗️ Technical Design
- **File**: `designs/migrate-redux-server-actions-design.md`
- **Purpose**: Architecture, patterns, error handling, cache strategy, type safety
- **Status**: ✅ Complete

### ✅ Tasks & Breakdown
- **File**: `tasks/migrate-redux-server-actions-tasks.md`
- **Purpose**: 26 actionable tasks organized in 4 phases (2A, 2B, 2C, 2D)
- **Status**: ✅ Complete
- **Estimate**: 18.75 hours total

## Quick Start for Implementation

### Phase 2A: Infrastructure & Simple APIs (3.5 hours)
1. Create error handling framework (1h)
   - `src/lib/api/errors.ts`
   - `src/app/actions/_helpers/`
   
2. Migrate `productosUbicacionApi` (1.5h)
   - 1 endpoint, update 1 component
   
3. Migrate `profileApi` (1.5h)
   - 2 endpoints, update 1 component

### Phase 2B: Medium Complexity (5 hours)
1. Migrate `reportesFinancierosApi` (1h)
2. Migrate `reparacionesApi` (4h)
   - 12 endpoints, 3 domains, update multiple components

### Phase 2C: Complex (6.5 hours)
1. Migrate `produccionApi`
   - 16 endpoints, 3 domains, pagination, complex revalidation

### Phase 2D: Cleanup (3.25 hours)
1. Verify zero Redux dependencies
2. Delete Redux API slices
3. Bundle size analysis & performance testing
4. Final regression testing

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Server Actions instead of API routes | Simpler, type-safe, server-side session access |
| Revalidation via tags + paths | Cache coherency without manual staleness |
| Shared error class `ServerActionError` | Consistent error handling across all actions |
| 28 separate Server Actions | One action per endpoint keeps code simple & testable |
| Phase-based rollout | Low-risk, easy to revert, can parallelize after 2A |

## Type Safety Strategy

✅ **End-to-end TypeScript**
- Input types: Zod schemas in `src/lib/types/`
- Response types: Shared from `src/app/models/`
- Error handling: `ServerActionError` with context
- Component props: Full type inference

## Error Handling Pattern

```typescript
// All Server Actions follow this pattern:
'use server'

export async function myAction(input: Input): Promise<Output> {
  try {
    await checkAuth()
    validateInput(input)
    const result = await apiCall()
    revalidateTag('MyTag')
    return result
  } catch (error) {
    handleServerActionError(error, 'myAction')
  }
}

// Components catch ServerActionError
try {
  const result = await myAction(data)
} catch (err) {
  if (err instanceof ServerActionError) {
    toast.error(err.message)
  }
}
```

## Cache Invalidation Strategy

| API | Tags | Invalidation |
|-----|------|--------------|
| productosUbicacion | `ProductosUbicacion` | GET only |
| profile | `Profile` | `revalidateTag('Profile')` on update |
| reparaciones | `EquiposReparacion`, `Defectaciones` | Multiple tags on mutations |
| produccion | `RecetasProduccion`, `OrdenesProduccion`, `ValesSalida`, `Productos`, `StockUbicacion` | Complex, depends on domain |
| reportesFinancieros | `ReportesFinancieros` | GET only |

## Testing Strategy

✅ **Unit Tests**
- Each Server Action: test success & error paths
- Verify cache tags applied correctly

✅ **Integration Tests**
- Component + Server Action together
- Verify UI state updates correctly

✅ **End-to-End Tests**
- Full workflow from user action to cache revalidation

## Rollback Mechanism

Each completed API is tagged in git:
```bash
git tag api-productosUbicacion-migrated
git tag api-profile-migrated
git tag api-reparaciones-migrated
git tag api-produccion-migrated
git tag api-reportesFinancieros-migrated
```

To rollback: `git revert <tag>`

## Success Metrics

✅ All 28 endpoints migrated to Server Actions
✅ Zero Redux hook imports in migrated components
✅ Bundle size reduced ≥40KB
✅ All tests passing
✅ No UI behavior changes
✅ Error handling working correctly
✅ Cache invalidation working correctly

## Files Delivered by Phase

### Phase 2A Deliverables
```
src/lib/api/
├── errors.ts
├── client.ts
├── productos-ubicacion.ts
└── profile.ts

src/app/actions/
├── index.ts
├── productos-ubicacion.ts
├── profile.ts
└── _helpers/
    ├── error-handler.ts
    └── auth-check.ts
```

### Phase 2B Deliverables
```
src/lib/api/
├── reportes-financieros.ts
└── reparaciones/
    ├── equipos.ts
    ├── piezas.ts
    └── defectaciones.ts

src/app/actions/
├── reportes-financieros.ts
└── reparaciones/
    ├── equipos.ts
    ├── piezas.ts
    └── defectaciones.ts
```

### Phase 2C Deliverables
```
src/lib/api/produccion/
├── recetas.ts
├── ordenes.ts
└── vales.ts

src/app/actions/produccion/
├── recetas.ts
├── ordenes.ts
└── vales.ts
```

### Phase 2D Deliverables
- ✅ Verification report (zero Redux dependencies)
- ✅ Bundle size comparison
- ✅ Performance analysis
- ✅ Migration completion tag: `phase2-complete`

---

## How to Use This SDD

1. **Read** the proposal to understand intent and scope
2. **Review** specifications for detailed requirements
3. **Study** design for architecture and patterns
4. **Execute** tasks in order, following the task breakdown
5. **Test** each phase before proceeding to next
6. **Verify** all acceptance criteria met
7. **Tag** when complete: `git tag phase2-complete`

## Support & Questions

Each artifact includes detailed commentary. Refer to:
- **Architecture questions** → `designs/migrate-redux-server-actions-design.md`
- **Requirement clarifications** → `specs/migrate-redux-server-actions-phase2-spec.md`
- **Task questions** → `tasks/migrate-redux-server-actions-tasks.md`
- **Risk concerns** → `migrate-redux-to-server-actions-phase2.md`

---

**Created**: 2026-05-08
**Status**: Ready for Implementation
**Estimated Duration**: 18.75 hours
**Priority**: Medium (Phase 2 of Redux consolidation)
