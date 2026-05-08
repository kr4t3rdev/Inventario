# Specifications: Migrate Redux to Server Actions (Phase 2)

## Requirements

### Functional Requirements

#### FR-1: Migrate productosUbicacionApi
**Given** a Point of Sale (PV) interface needs to list products available in a location
**When** the component mounts or location changes
**Then** a Server Action fetches products from `/productos/por-ubicacion/{ubicacionId}`
**And** returns typed array of `ProductoConStock` with full relationship data

```typescript
// Server Action signature
async function getProductosPorUbicacion(
  ubicacionId: string
): Promise<ProductoConStock[]>

// Usage in component
const productos = await getProductosPorUbicacion(ubicacionId)
```

#### FR-2: Migrate profileApi
**Given** a user navigates to their profile page
**When** the page component renders
**Then** a Server Action fetches user profile from `/profile`
**And** returns typed `Usuario` object with all permissions and roles

**And** when the user updates their profile
**Then** a mutation Server Action sends PUT to `/profile`
**And** revalidates the profile cache via `revalidateTag('Profile')`

```typescript
async function getProfile(): Promise<Usuario[]>
async function updateProfile(patch: Partial<Usuario>): Promise<Usuario>
```

#### FR-3: Migrate reparacionesApi (8 endpoints)
Decompose into 3 resource domains:

**Domain: Equipos de Reparación**
- getEquiposReparacion() → GET `/reparaciones/equipos`
- getEquipoReparacion(id) → GET `/reparaciones/equipos/:id`
- addEquipoReparacion(data) → POST `/reparaciones/equipos`
- updateEquipoReparacion(id, data) → PUT `/reparaciones/equipos/:id`
- deleteEquipoReparacion(id) → DELETE `/reparaciones/equipos/:id`

**Domain: Piezas de Reparación**
- addPiezaReparacion(data) → POST `/reparaciones/piezas`
- updatePiezaReparacion(id, data) → PUT `/reparaciones/piezas/:id`
- deletePiezaReparacion(id) → DELETE `/reparaciones/piezas/:id`

**Domain: Defectaciones**
- getDefectaciones() → GET `/reparaciones/defectaciones`
- addDefectacion(data) → POST `/reparaciones/defectaciones`
- updateDefectacion(id, data) → PUT `/reparaciones/defectaciones/:id`
- deleteDefectacion(id) → DELETE `/reparaciones/defectaciones/:id`

**Revalidation Strategy:**
- After add/update/delete equipo: `revalidateTag('EquiposReparacion')`
- After add/update/delete pieza: `revalidateTag('EquiposReparacion')` (piezas nested)
- After add/update/delete defectacion: `revalidateTag('Defectaciones')`

#### FR-4: Migrate produccionApi (16 endpoints)

**Domain: Recetas de Producción**
- getRecetasProduccion(filters) → GET `/produccion/recetas` (with pagination)
- getRecetaProduccion(id) → GET `/produccion/recetas/:id`
- createRecetaProduccion(data) → POST `/produccion/recetas`
- updateRecetaProduccion(id, data) → PATCH `/produccion/recetas/:id`
- deleteRecetaProduccion(id) → DELETE `/produccion/recetas/:id`
- setIngredientesRecetaProduccion(recetaId, ingredientes) → POST `/produccion/recetas/:recetaId/ingredientes`
- deleteIngredienteRecetaProduccion(recetaId, productoId) → DELETE `/produccion/recetas/:recetaId/ingredientes`

**Domain: Órdenes de Producción**
- getOrdenesProduccion(filters) → GET `/produccion/ordenes` (with pagination)
- getOrdenProduccion(id) → GET `/produccion/ordenes/:id`
- createOrdenProduccion(data) → POST `/produccion/ordenes`
- aprobarOrdenProduccion(id) → POST `/produccion/ordenes/:id/aprobar`
- completarOrdenProduccion(id) → POST `/produccion/ordenes/:id/completar`
- cancelarOrdenProduccion(id) → POST `/produccion/ordenes/:id/cancelar`

**Domain: Vales de Salida**
- getConceptos() → GET `/produccion/conceptos`
- getValesSalida(filters) → GET `/produccion/vales`
- getValeSalida(id) → GET `/produccion/vales/:id`
- createValeSalida(data) → POST `/produccion/vales`
- updateValeSalida(id, data) → PATCH `/produccion/vales/:id`
- anularValeSalida(id) → DELETE `/produccion/vales/:id`
- getPdfValeSalida(id) → GET `/produccion/vales/:id/pdf`

**Revalidation Strategy:**
- Recetas: `revalidateTag('RecetasProduccion')`
- Órdenes: `revalidateTag('OrdenesProduccion')` + `revalidateTag('Productos')` + `revalidateTag('StockUbicacion')`
- Vales: `revalidateTag('ValesSalida')` + `revalidateTag('Productos')`

#### FR-5: Migrate reportesFinancierosApi
**Given** a user views the financial reports dashboard
**When** the page renders
**Then** a Server Action fetches report data from `/reportes-financieros`
**And** returns typed array of `ResumenData`
**And** is cached with tag `ReportesFinancieros`

```typescript
async function getRF(): Promise<ResumenData[]>
```

### Non-Functional Requirements

#### NFR-1: Type Safety
- MUST use TypeScript strict mode throughout
- MUST export all request/response types from shared `types/` directory
- MUST NOT use `any` type
- MUST leverage discriminated unions for error types

#### NFR-2: Error Handling
- All Server Actions MUST catch API errors and throw standardized `ServerActionError`
- Server Actions MUST include error context: `{ endpoint, method, status, message }`
- Client components MUST handle both success and error states

#### NFR-3: Performance
- MUST implement pagination for large result sets (recetas, órdenes, vales)
- MUST cache responses using `unstable_cache()` where appropriate
- MUST use ISR (revalidatePath/revalidateTag) to keep data fresh without re-rendering

#### NFR-4: Security
- All Server Actions MUST verify authentication via session
- All mutations MUST validate input via Zod schemas
- All API calls MUST use authenticated client (with JWT headers)

#### NFR-5: Backward Compatibility
- During migration phase, client components MAY use feature flags
- Redux API slices MUST remain untouched until all components migrated
- Rollback to Redux must be possible at any point

## Scenarios

### Scenario 1: User adds new equipo de reparación
```gherkin
Given the reparaciones page is loaded
And user clicks "Agregar Equipo"
When user fills in equipo name and submits
Then addEquipoReparacion Server Action is called
And equipo is created in database
And EquiposReparacion cache is invalidated
And list refreshes automatically
```

### Scenario 2: User views production recipes with pagination
```gherkin
Given production recipes page loads
When user searches for "harina" with limit=10, page=1
Then getRecetasProduccion(search, page, limit) is called
And returns PaginatedResponse<RecetaProduccion>
And pagination buttons are enabled/disabled based on meta.hasMore
```

### Scenario 3: User completes a production order
```gherkin
Given an approved production order exists
When user clicks "Completar"
Then completarOrdenProduccion(id, userId) is called
And order status changes to "completada"
And OrdenesProduccion, Productos, StockUbicacion tags are revalidated
And user is redirected to success page
```

## Acceptance Criteria

1. ✓ All 28 Server Actions created and tested
2. ✓ All components updated to use Server Actions instead of Redux hooks
3. ✓ Error messages display in UI (not silent failures)
4. ✓ Pagination works correctly in search/list endpoints
5. ✓ Revalidation tags configured correctly (cache invalidation works)
6. ✓ No Redux hook imports remain in migrated components
7. ✓ Bundle size reduced by measurable amount (≥40KB)
8. ✓ All tests passing (existing + new migration tests)
