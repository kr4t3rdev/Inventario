# Task Breakdown: Migrate Redux APIs to Server Actions (Phase 2)

## Phase 2A: Simple APIs Infrastructure & Setup

### Task 1.1: Create Server Action Error Handling Framework
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Create `src/lib/api/errors.ts` with `ServerActionError` class
  - [ ] Create `src/app/actions/_helpers/error-handler.ts`
  - [ ] Create `src/app/actions/_helpers/auth-check.ts`
  - [ ] Export both helpers from `src/app/actions/index.ts`

### Task 1.2: Create Authenticated API Client
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Create `src/lib/api/client.ts` with `authenticatedFetch()`
  - [ ] Handle JWT token from session
  - [ ] Convert non-ok responses to `ServerActionError`
  - [ ] Add proper headers (Authorization, Content-Type)

### Task 1.3: Set Up API Routes Organization
- **Complexity**: ⭐ Simple
- **Time Estimate**: 20 min
- **Deliverables**:
  - [ ] Create `src/lib/api/` directory structure
  - [ ] Create placeholder files for each API module
  - [ ] Create `src/app/actions/` directories for nested organization

## Phase 2A: productosUbicacionApi Migration

### Task 2.1: Create productosUbicacionApi Server Actions
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Endpoint**: GET `/productos/por-ubicacion/:id`
- **Deliverables**:
  - [ ] Create `src/lib/api/productos-ubicacion.ts` fetcher
  - [ ] Create `src/app/actions/productos-ubicacion.ts` Server Action
  - [ ] Add cache tag: `ProductosUbicacion`
  - [ ] Type-safe response: `ProductoConStock[]`

### Task 2.2: Update Components Using productosUbicacionApi
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Files to Update**:
  - [ ] `src/features/ventas/components/pv-interface.tsx`
  - [ ] Remove Redux hook `useGetProductosPorUbicacionQuery`
  - [ ] Import Server Action `getProductosPorUbicacion`
  - [ ] Add error handling with `ServerActionError`
  - [ ] Test component rendering

### Task 2.3: Test productosUbicacionApi Migration
- **Complexity**: ⭐ Simple
- **Time Estimate**: 20 min
- **Deliverables**:
  - [ ] Write unit test for Server Action
  - [ ] Verify error handling
  - [ ] Verify cache tags are applied
  - [ ] Integration test with component

## Phase 2A: profileApi Migration

### Task 3.1: Create profileApi Server Actions
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 45 min
- **Endpoints**: GET/PUT `/profile`
- **Deliverables**:
  - [ ] Create `src/lib/api/profile.ts` fetcher with getProfile + updateProfile
  - [ ] Create `src/app/actions/profile.ts` Server Actions (2 actions)
  - [ ] Add cache tag: `Profile`
  - [ ] Add `revalidateTag('Profile')` on updates
  - [ ] Type-safe: `Usuario[]` (query), `Usuario` (mutation)

### Task 3.2: Update Components Using profileApi
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 30 min
- **Files to Update**:
  - [ ] `src/app/busy/perfil/page.tsx`
  - [ ] Remove Redux hooks `useGetProfileQuery`, `useUpdateProfileMutation`
  - [ ] Import Server Actions `getProfile`, `updateProfile`
  - [ ] Add error handling and loading states
  - [ ] Test form submission with mutation

### Task 3.3: Test profileApi Migration
- **Complexity**: ⭐ Simple
- **Time Estimate**: 20 min
- **Deliverables**:
  - [ ] Unit test for both Server Actions
  - [ ] Test cache invalidation on update
  - [ ] Integration test with form component

## Phase 2B: reportesFinancierosApi Migration

### Task 4.1: Create reportesFinancierosApi Server Actions
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Endpoint**: GET `/reportes-financieros`
- **Deliverables**:
  - [ ] Create `src/lib/api/reportes-financieros.ts` fetcher
  - [ ] Create `src/app/actions/reportes-financieros.ts` Server Action
  - [ ] Add cache tag: `ReportesFinancieros`
  - [ ] Type-safe: `ResumenData[]`

### Task 4.2: Update Components Using reportesFinancierosApi
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Files to Update**:
  - [ ] Any page/component using `useGetRFQuery`
  - [ ] Remove Redux hook
  - [ ] Import Server Action
  - [ ] Add loading/error states

## Phase 2B: reparacionesApi Migration

### Task 5.1: Create reparacionesApi - Equipos Server Actions
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 1 hour
- **Endpoints**: 5 (GET list, GET single, POST, PUT, DELETE)
- **Deliverables**:
  - [ ] Create `src/lib/api/reparaciones/equipos.ts`
  - [ ] Create `src/app/actions/reparaciones/equipos.ts`
  - [ ] All 5 Server Actions for CRUD operations
  - [ ] Cache tag: `EquiposReparacion`
  - [ ] Revalidation on mutations

### Task 5.2: Create reparacionesApi - Piezas Server Actions
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 45 min
- **Endpoints**: 3 (POST, PUT, DELETE - nested under equipos)
- **Deliverables**:
  - [ ] Create `src/lib/api/reparaciones/piezas.ts`
  - [ ] Create `src/app/actions/reparaciones/piezas.ts`
  - [ ] All 3 Server Actions
  - [ ] Cache tag: `EquiposReparacion` (invalidates equipos list)

### Task 5.3: Create reparacionesApi - Defectaciones Server Actions
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 45 min
- **Endpoints**: 4 (GET, POST, PUT, DELETE)
- **Deliverables**:
  - [ ] Create `src/lib/api/reparaciones/defectaciones.ts`
  - [ ] Create `src/app/actions/reparaciones/defectaciones.ts`
  - [ ] All 4 Server Actions
  - [ ] Cache tag: `Defectaciones`

### Task 5.4: Update Components Using reparacionesApi
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 1 hour
- **Files to Update**:
  - [ ] `src/app/busy/reparaciones/page.tsx`
  - [ ] `src/app/busy/reparaciones/ordenes/new/page.tsx`
  - [ ] `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
  - [ ] Remove all Redux hooks
  - [ ] Import Server Actions
  - [ ] Update forms and lists

### Task 5.5: Test reparacionesApi Migration
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Unit tests for all 12 Server Actions
  - [ ] Cache invalidation tests
  - [ ] Component integration tests

## Phase 2C: produccionApi Migration (16 endpoints)

### Task 6.1: Create produccionApi - Recetas Server Actions
- **Complexity**: ⭐⭐⭐ High
- **Time Estimate**: 1.5 hours
- **Endpoints**: 7 (GET list+pagination, GET single, POST, PATCH, DELETE, POST ingredientes, DELETE ingrediente)
- **Deliverables**:
  - [ ] Create `src/lib/api/produccion/recetas.ts`
  - [ ] Create `src/app/actions/produccion/recetas.ts`
  - [ ] Implement pagination handling (limit, page, search)
  - [ ] Cache tag: `RecetasProduccion`
  - [ ] Revalidation on all mutations

### Task 6.2: Create produccionApi - Órdenes Server Actions
- **Complexity**: ⭐⭐⭐ High
- **Time Estimate**: 1.5 hours
- **Endpoints**: 6 (GET list+pagination, GET single, POST, POST aprobar, POST completar, POST cancelar)
- **Deliverables**:
  - [ ] Create `src/lib/api/produccion/ordenes.ts`
  - [ ] Create `src/app/actions/produccion/ordenes.ts`
  - [ ] Pagination for list endpoint
  - [ ] Cache tags: `OrdenesProduccion`, `Productos`, `StockUbicacion`
  - [ ] Complex revalidation on state transitions

### Task 6.3: Create produccionApi - Vales Server Actions
- **Complexity**: ⭐⭐⭐ High
- **Time Estimate**: 1.5 hours
- **Endpoints**: 7 (GET conceptos, GET list+pagination, GET single, POST, PATCH, DELETE, GET PDF)
- **Deliverables**:
  - [ ] Create `src/lib/api/produccion/vales.ts`
  - [ ] Create `src/app/actions/produccion/vales.ts`
  - [ ] Pagination handling
  - [ ] Cache tags: `ValesSalida`, `Productos`
  - [ ] PDF generation endpoint (no mutation needed)

### Task 6.4: Update Components Using produccionApi
- **Complexity**: ⭐⭐⭐ High
- **Time Estimate**: 2 hours
- **Files to Update**:
  - [ ] `src/app/busy/produccion/page.tsx` (all tabs)
  - [ ] Forms and modals for recetas, órdenes, vales
  - [ ] Search, filter, pagination UI
  - [ ] Remove all Redux hooks
  - [ ] Update error handling for complex mutations

### Task 6.5: Test produccionApi Migration
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 1 hour
- **Deliverables**:
  - [ ] Unit tests for all 20 Server Actions
  - [ ] Pagination tests
  - [ ] Cache invalidation tests with multiple tags
  - [ ] Component integration tests

## Phase 2D: Cleanup & Verification

### Task 7.1: Verify Redux API Slices Have Zero Imports
- **Complexity**: ⭐ Simple
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Run grep to find any remaining imports of Redux slices
  - [ ] Document any dependencies still using Redux
  - [ ] Update findings in task log

### Task 7.2: Remove Redux API Slice Files
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Delete `src/lib/redux/services/productosUbicacionApi.tsx`
  - [ ] Delete `src/lib/redux/services/profileApi.tsx`
  - [ ] Delete `src/lib/redux/services/reparacionesApi.tsx`
  - [ ] Delete `src/lib/redux/services/produccionApi.ts`
  - [ ] Delete `src/features/reportes-financieros/api/reportesFinancierosApi.ts`
  - [ ] Verify git history preserves files for rollback

### Task 7.3: Bundle Size Analysis
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 30 min
- **Deliverables**:
  - [ ] Run `npm run build` and check bundle size before/after
  - [ ] Document size reduction (target: ≥40KB)
  - [ ] Compare Redux chunks removed

### Task 7.4: Performance Testing
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 45 min
- **Deliverables**:
  - [ ] Test data loading speed (FCP, LCP)
  - [ ] Verify no performance regressions
  - [ ] Test cache invalidation performance
  - [ ] Document results

### Task 7.5: Final Integration & Regression Testing
- **Complexity**: ⭐⭐ Medium
- **Time Estimate**: 1 hour
- **Deliverables**:
  - [ ] Run full test suite: `pnpm test:run`
  - [ ] Test all 5 migrated API modules end-to-end
  - [ ] Verify UI behavior unchanged
  - [ ] Check error messages display correctly

## Summary Statistics

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| 2A Setup | 3 | 1.5 |
| 2A APIs (2) | 6 | 2.5 |
| 2B APIs (2) | 2 | 1.5 |
| 2B reparaciones | 5 | 3.5 |
| 2C produccion | 5 | 6.5 |
| 2D Cleanup | 5 | 3.25 |
| **TOTAL** | **26** | **18.75 hours** |

---

## Execution Notes

- Each task can be executed independently once dependencies are complete
- Phases can be parallelized after 2A Setup is done
- Test each migration immediately after implementation (don't batch)
- Commit after each API is fully migrated with message: `feat: migrate {apiName} to Server Actions`
- Tag each completed API: `git tag api-{name}-migrated`
