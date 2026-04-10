# Production Error Handling: Implementation Tasks

**Status**: Tasks Phase  
**Last Updated**: 2026-04-09

## Task Phases

### Phase 1: Constants & Setup (Foundation)

- [ ] **1.1**: Create `src/lib/constants/production.ts` with:
  - `PRODUCTION_STATES` object (PENDIENTE, EN_PROCESO, COMPLETADA, CANCELADA)
  - `PRODUCTION_STATE_LABELS` Record
  - `PRODUCTION_STATE_COLORS` Record
  - Export types for TypeScript

- [ ] **1.2**: Update `src/app/models/model.ts` to export error types:
  - `MaterialInsuficienteError` interface with `materialesFaltantes: array`
  - `MaterialDetail` with `productoId, productoNombre, requerido, disponible`

### Phase 2: Backend API Routes (Critical Path)

- [ ] **2.1**: Update `src/app/api/produccion/ordenes/[id]/aprobar/route.ts`:
  - Verify code already returns `{ error, materialesFaltantes }` format correctly
  - Test response format matches Design section
  - Add JSDoc comments for error response

- [ ] **2.2**: Update `src/app/api/produccion/ordenes/[id]/completar/route.ts`:
  - Add validation: producto exists in catalog
  - Add validation: stock won't exceed limits
  - Use Prisma transaction for atomic updates
  - Return proper error responses with status codes
  - Add JSDoc for new validations

- [ ] **2.3**: Verify `src/app/api/produccion/ordenes/[id]/cancelar/route.ts`:
  - Ensure it reverses stock reservations if EN_PROCESO
  - Returns proper success/error responses
  - Create if doesn't exist

### Phase 3: Frontend Error Handling (UI Interactions)

- [ ] **3.1**: Update `handleAprobarOrden` in `src/app/busy/produccion/page.tsx`:
  - Add import: `import { sileo } from 'sileo';`
  - Wrap in try-catch
  - Call `.unwrap()` on mutation
  - Catch `error?.data?.materialesFaltantes`
  - Format and display in sileo.error()
  - On success, show sileo.success()

- [ ] **3.2**: Update `handleCompletarOrden` in same file:
  - Same pattern as `handleAprobarOrden`
  - Success message: "Orden completada"
  - Error handling for missing producto

- [ ] **3.3**: Update `handleCancelarOrden` in same file:
  - Same try-catch pattern
  - Success message: "Orden cancelada"
  - Show toast about material liberation if was EN_PROCESO

- [ ] **3.4**: Update all other API call handlers:
  - `handleCrearReceta`
  - `handleCrearOrden`
  - `handleCrearVale`
  - Note: Only add for now if they have sync issues.  Focus on order actions first.

### Phase 4: Frontend State Fix (UI Consistency)

- [ ] **4.1**: Fix Select filter for estado (Line ~714):
  - Change SelectItem values from lowercase to UPPERCASE
  - Keep display labels readable ("Pendiente" not "PENDIENTE")
  - Test that filtering works correctly

- [ ] **4.2**: Import constants in page.tsx:
  - `import { PRODUCTION_STATES, PRODUCTION_STATE_LABELS } from '@/lib/constants/production'`
  - (Optional) Use constants instead of hardcoded strings for better maintainability

- [ ] **4.3**: Verify badge display (getEstadoBadge function):
  - Already uses `.toUpperCase()`, should work correctly
  - Add type safety if using constants

### Phase 5: Testing & Validation (QA)

- [ ] **5.1**: Manual test Scenario 1: Aprobar con materiales insuficientes
  - Create test data: orden con ingredientes que exceden stock
  - Click aprobar
  - Verify error toast appears
  - Verify toast has product name + quantities
  - Verify orden stays PENDIENTE
  - Verify stock unchanged

- [ ] **5.2**: Manual test Scenario 2: Filtrar órdenes por estado
  - Create diversas órdenes con diferentes estados
  - Test each filter option
  - Verify query param is uppercase: ?estado=EN_PROCESO
  - Verify results match filter

- [ ] **5.3**: Manual test Scenario 3: Completar orden
  - Approve an orden (reserves stock)
  - Click completar
  - Verify success toast
  - Verify estado changes to COMPLETADA
  - Verify producto stock increased

- [ ] **5.4**: Manual test Scenario 4: Cancelar orden
  - Create orden, approve it (EN_PROCESO)
  - Click cancelar
  - Verify confirmation dialog
  - Verify success toast
  - Verify estado = CANCELADA
  - Check que stock fue restaurado

- [ ] **5.5**: E2E Tests (if exists Playwright setup)
  - Write test for each scenario
  - Verify toast notifications appear
  - Verify database state changes

### Phase 6: Documentation & Polish

- [ ] **6.1**: Add JSDoc comments:
  - In handlers explaining error handling
  - In API routes explaining error responses
  - In constants file

- [ ] **6.2**: Update error messages to be user-friendly:
  - Ensure Spanish is clean and natural
  - Provide actionable next steps in error messages

- [ ] **6.3**: Create/Update README or docs:
  - Document how to add new error scenarios
  - Explain sileo toast integration pattern

## Task Execution Order

**Week 1 - Critical Path:**
1. Phase 1: Constants (Easy, unblocks tests)
2. Phase 2: Backend validation (Critical, must pass tests)
3. Phase 3: Try-catch handlers (Critical, UX improvement)
4. Phase 4: Select filter fix (Quick, fixes UX bug)
5. Phase 5: Manual testing (Validate everything works)

**Week 2 - Polish:**
6. Phase 5: E2E Tests (if applicable)
7. Phase 6: Documentation

## Effort Estimate

| Phase | Tasks | Effort | Risk |
|-------|-------|--------|------|
| 1 | 1.1, 1.2 | 30 min | Low |
| 2 | 2.1, 2.2, 2.3 | 1 hr | Medium (transactions) |
| 3 | 3.1-3.4 | 1.5 hrs | Low (pattern-based) |
| 4 | 4.1-4.3 | 30 min | Low |
| 5 | All | 2 hrs | Low |
| 6 | 6.1-6.3 | 1 hr | Low |
| **Total** | | **~6.5 hrs** | **Low-Medium** |

## Blocking Risks

1. **Prisma Transaction Syntax**: May need to verify `.transaction()` call in completar/route.ts
   - Mitigation: Test locally first, refer to Prisma docs

2. **Error Type Compatibility**: RTK Query error format might vary
   - Mitigation: Add defensive checks in catch blocks, log actual error shape

3. **Unit Conversion Edge Cases**: `convertToBase()` behavior with undefined units
   - Mitigation: Test with various unit combinations before deploy

## Success Metrics

- [ ] All 5 error scenarios show proper toast notifications
- [ ] State filter works correctly with UPPERCASE values
- [ ] Database transactions prevent partial updates
- [ ] Tests pass with 0 E2E regressions
- [ ] User feedback: errors are clear and actionable
