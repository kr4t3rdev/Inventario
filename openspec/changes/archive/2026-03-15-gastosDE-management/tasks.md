# Tasks: GastosDE Management Enhancement

## Phase 1: Infrastructure / API Corrections

- [x] 1.1 Fix `src/app/api/gastosDE/route.ts` - POST route to use correct field `gastosDEId` instead of `gastoSId`
- [x] 1.2 Fix `src/app/api/gastosDE/route.ts` - Add `numeroFactura` to POST data creation
- [x] 1.3 Fix `src/app/api/gastosDE/route.ts` - Remove manual timestamp setting (rely on Prisma @default(now()))
- [x] 1.4 Fix `src/app/api/gastosDE/[id]/route.ts` - PATCH route to exclude immutable fields (`gastosDEId`, `createdAt`, `updatedAt`)
- [x] 1.5 Fix `src/app/api/gastosDE/[id]/route.ts` - Add `numeroFactura` to PATCH data
- [x] 1.6 Update `src/app/models/model.ts` - Add `numeroFactura: string | null` field to GastosDE interface

## Phase 2: Frontend Implementation

- [x] 2.1 Fix `src/components/gastoDE/GastoDEForm.tsx` - Correct validation message typo ("descipcion" → "descripcion")
- [x] 2.2 Update `src/components/gastoDE/GastoDEForm.tsx` - Add Vendor list dropdown for proveedor field (fetch from `/api/vendors`)
- [x] 2.3 Update `src/app/busy/gastosDE/page.tsx` - Add filter for proveedor selection (dropdown)
- [x] 2.4 Update `src/app/busy/gastosDE/page.tsx` - Add date range filter functionality (N/A - no date field in GastosDE model, only periodo)
- [x] 2.5 Ensure form validation matches spec: required fields (tipo, proveedor, monto, descripcion), optional numeroFactura (already implemented)

## Phase 3: Testing

- [x] 3.1 Write unit tests for `src/app/api/gastosDE/route.ts` - POST with numeroFactura and without
- [x] 3.2 Write unit tests for `src/app/api/gastosDE/[id]/route.ts` - PATCH with numeroFactura
- [x] 3.3 Verify form submission matches spec scenario: Create with invoice
- [x] 3.4 Verify form submission matches spec scenario: Create without invoice
- [x] 3.5 Verify validation error scenarios: amount, description, provider required
- [x] 3.6 Verify reconciliation integration: GastosDE appears in pendientes table

## Phase 4: Cleanup & Documentation

- [x] 4.1 Update `openspec/specs/contabilidad/gastosDE/spec.md` to reflect invoice field changes
- [x] 4.2 Remove any temporary console logs or debug code from API routes
- [x] 4.3 Verify no foreign key constraint violations occur during form submission