;# Design: Auto-Generated Business Codes (Parent & Child Products)

## Technical Approach

The system automates business code generation by removing all manual segment entry from the UI. Parent products require only a provider selection; the system intelligently generates section, specific, and surtido based on product category/subcategory and database state. Child products inherit ALL parent segments (provider, section, specific) and auto-generate only the surtido variant.

**Key insight**: Section and specific are deterministic (category → section; subcategory → specific). Surtido is sequential (find highest existing surtido for a section/specific pair, then increment). This eliminates user error and guarantees uniqueness.

---

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| **Mapping strategy** | Category → Section; Subcategory → Specific | Fixed hardcoded map OR ML-based classification | Fixed map is simple, auditable, and reversible. Avoids over-engineering. |
| **Surtido generation** | Find max surtido by (section, specific); increment | UUID-based variants OR random 4-digit | Sequential is human-readable, predictable, and avoids name collisions. |
| **UI changes** | Hide all segment fields; show provider dropdown + code preview | Allow field override for admin | Prevents user confusion and ensures 100% consistency. |
| **Child inheritance** | Copy parent segments at creation time (not runtime) | Store parent reference + lazy inherit | Copy at creation is explicit, auditable, and avoids accidental parent mutations affecting children. |
| **Validation** | Check uniqueness BEFORE save (DB constraint as fallback) | Only check at save time | Fail fast: show user if code exists before they commit. |

---

## Data Flow

### Parent Product Creation Flow

```
User selects provider
  ↓
Form reads vendorId + productCategory + productSubcategory
  ↓
GenerateParentCode(vendorId, category, subcategory)
  │
  ├─→ Fetch vendor.proveedorCodigo [string, 2 digits]
  ├─→ MapCategoryToSection(category) → section [2 digits]
  ├─→ MapSubcategoryToSpecific(subcategory) → specific [4 digits]
  ├─→ FindNextAvailableSurtido(section, specific) → surtido [4 digits]
  │
  └─→ BuildCode(provider, section, specific, surtido)
       ├─→ base12 = provider + section + specific + surtido
       ├─→ dc = CalculateEan13CheckDigit(base12)
       └─→ codigoNegocio = base12 + dc [13 digits]
  ↓
Form displays: "Generated Code: 0114028500012" (read-only)
  ↓
User submits form
  ↓
API validates uniqueness + saves Producto
```

### Child Product Creation Flow

```
User selects parent product
  ↓
Form inherits: parentProduct.{proveedorCodigo, idSeccionCodigo, especificoCodigo}
  ↓
Form displays inherited segments (read-only labels)
  ↓
GenerateChildCode(parentProduct)
  │
  ├─→ Inherit: provider, section, specific from parent
  ├─→ FindNextAvailableSurtido(section, specific) → NEW surtido
  │   (Note: searches ALL products where section=X AND specific=Y, including parent)
  │
  └─→ BuildCode(provider, section, specific, newSurtido)
       ├─→ base12 = provider + section + specific + newSurtido
       ├─→ dc = CalculateEan13CheckDigit(base12)
       └─→ codigoNegocioHijo = base12 + dc [13 digits]
  ↓
Form displays: "Child Code: 0114028500029" (read-only)
  ↓
User submits form
  ↓
API validates + saves Producto with productoPadreId
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/ean13-utils.ts` | **Modify** | Add `MapCategoryToSection()`, `MapSubcategoryToSpecific()`, `FindNextAvailableSurtido()` functions |
| `src/lib/category-mapping.ts` | **Create** | Define static category → section and subcategory → specific mappings |
| `src/app/api/productos/route.ts` | **Modify** | Update POST handler: generatencode before save; inherit for child; validate uniqueness |
| `src/components/productos/productos-form.tsx` | **Modify** | Remove proveedorCodigo, idSeccionCodigo, especificoCodigo, surtidoCodigo input fields; add provider dropdown; auto-generate code preview on provider change |
| `src/components/productos/compound-product-section.tsx` | **Modify** | Show inherited parent segments (read-only); auto-generate child code preview on parent selection |

---

## Key Algorithms

### 1. GenerateParentCode(vendorId, categoryId, subcategoryId)

```pseudocode
function GenerateParentCode(vendorId, categoryId, subcategoryId):
  vendor = Prisma.vendor.findUnique(vendorId)
  providerCode = vendor.proveedorCodigo  // e.g., "01"
  
  category = Prisma.categoria.findUnique(categoryId)
  section = MapCategoryToSection(category.nombre)  // e.g., "14" for Beverages
  
  subcategory = Prisma.categoria.findUnique(subcategoryId)
  specific = MapSubcategoryToSpecific(subcategory.nombre)  // e.g., "0285" for Alcoholic
  
  surtido = FindNextAvailableSurtido(section, specific)  // e.g., "0001" for first
  
  RETURN {
    proveedorCodigo: providerCode,
    idSeccionCodigo: section,
    especificoCodigo: specific,
    surtidoCodigo: surtido,
    codigoNegocio: BuildBusinessCode(providerCode, section, specific, surtido)
  }
```

**Implementation note**: This runs on the **client** (form watcher) for instant preview, then re-runs on the **API** (POST handler) for verification. Do NOT trust client-side code; API is authoritative.

### 2. FindNextAvailableSurtido(section, specific)

```pseudocode
function FindNextAvailableSurtido(section, specific):
  // Find all existing products with this section/specific pair
  existingProducts = Prisma.producto.findMany({
    where: {
      idSeccionCodigo: section,
      especificoCodigo: specific,
      deletedAt: null  // Respect soft deletes
    },
    select: { surtidoCodigo: true }
  })
  
  // Extract numeric surtido values, sort descending
  surtidoNumbers = existingProducts
    .map(p => parseInt(p.surtidoCodigo, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => b - a)
  
  // Next = max + 1; default to 0001 if no existing
  maxSurtido = surtidoNumbers.length > 0 ? surtidoNumbers[0] : 0
  nextSurtido = maxSurtido + 1
  
  if (nextSurtido > 9999) {
    THROW Error("Surtido overflow: no more variants available for this section/specific")
  }
  
  RETURN nextSurtido.toString().padStart(4, '0')  // e.g., "0002"
```

**Edge case**: If a product is deleted (soft delete via deletedAt), its surtido slot is lost. This is intentional—recycling numbers would create gaps and confusion.

### 3. GenerateChildCode(parentProduct)

```pseudocode
function GenerateChildCode(parentProduct):
  // Inherit all segments from parent
  providerCode = parentProduct.proveedorCodigo
  section = parentProduct.idSeccionCodigo
  specific = parentProduct.especificoCodigo
  
  // Generate NEW surtido (variant)—must avoid parent's surtido
  surtido = FindNextAvailableSurtido(section, specific)
  
  RETURN {
    proveedorCodigo: providerCode,
    idSeccionCodigo: section,
    especificoCodigo: specific,
    surtidoCodigo: surtido,
    codigoNegocioHijo: BuildBusinessCode(providerCode, section, specific, surtido)
  }
```

**Clarification**: Child code DIFFER from parent code because surtido is incremented. Example:
- Parent: section=14, specific=0285, surtido=0001 → code=0114028500012
- Child 1: section=14, specific=0285, surtido=0002 → code=0114028500029
- Child 2: section=14, specific=0285, surtido=0003 → code=0114028500036

### 4. MapCategoryToSection(categoryName) & MapSubcategoryToSpecific(subcategoryName)

These use a **static lookup table** defined in `src/lib/category-mapping.ts`:

```pseudocode
CATEGORY_SECTION_MAP = {
  "Beverages": "14",
  "Dairy Products": "15",
  "Fruits": "16",
  // ... add more as needed
}

SUBCATEGORY_SPECIFIC_MAP = {
  "Alcoholic Beverages": "0285",
  "Non-Alcoholic": "0286",
  "Pasteurized Milk": "0301",
  // ... add more as needed
}
```

If a category/subcategory is not in the map:
- **Option A**: Throw error (safe, forces admin to add mapping)
- **Option B**: Auto-assign a sequence number (0100, 0101, etc.)

**Recommendation**: Use **Option A** for MVP. Adds friction, but prevents accidental collisions.

---

## Form Changes (UI/UX)

### Parent Product Form (Current → New)

| Field | Current | New |
|-------|---------|-----|
| `proveedorCodigo` | Text input (manual) | **Removed** |
| `idSeccionCodigo` | Text input (manual) | **Removed** |
| `especificoCodigo` | Text input (manual) | **Removed** |
| `surtidoCodigo` | Text input (manual) | **Removed** |
| `codigoNegocio` | Computed display | **Removed** (shown in preview) |
| Provider selection | N/A | **Added** Dropdown (Vendor select) |
| Code preview | N/A | **Added** Read-only label: "Generated Code: 0114028500012" |

### Child Product Form (Current → New)

| Field | Current | New |
|-------|---------|-----|
| All segment fields | User input | **Removed** |
| Provider dropdown | N/A | **Removed** (inherited, shown as label) |
| `codigoNegocioHijo` | User input | **Removed** (auto-generated, shown in preview) |
| Parent segments display | N/A | **Added** Three read-only labels (provider, section, specific) |
| Child code preview | N/A | **Added** Read-only label: "Child Code Variant: 0114028500029" |

### Form Validation (Zod Schema)

```typescript
// NEW: Parent product schema (simplified)
const parentProductSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  codigoInterno: z.string().regex(/^\d{11}$/).optional(),
  vendorId: z.string().min(1, "Select a provider"),  // REQUIRED
  categoriaId: z.string().min(1),
  subcategoriaId: z.string().min(1),
  precioCosto: z.number().positive(),
  precioVenta: z.number().positive(),
  stock: z.number().min(0),
  // Segments are auto-generated; NOT in schema
})

// NEW: Child product schema (even simpler)
const childProductSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  precioCosto: z.number().positive(),
  precioVenta: z.number().positive(),
  stock: z.number().min(0),
  productoPadreId: z.string().min(1, "Select a parent"),  // REQUIRED
  // All segments inherited; NOT in schema
})
```

---

## API Endpoint Logic

### POST /api/productos (create parent)

```pseudocode
POST /api/productos
{
  "nombre": "Beer Heineken",
  "descripcion": "Imported beer",
  "vendorId": "vendor-xyz",
  "categoriaId": "beverages",
  "subcategoriaId": "alcoholic",
  "precioCosto": 100,
  "precioVenta": 150,
  "stock": 500
}

handler:
  1. Validate payload (schema only has vendorId, NO segments)
  2. Generate code:
     parent = GenerateParentCode(vendorId, categoryId, subcategoryId)
  3. Check uniqueness of parent.codigoNegocio
     existing = Prisma.producto.findUnique({ where: { codigoNegocio: parent.codigoNegocio } })
     if (existing) THROW 409 "Code already exists"
  4. Save:
     Prisma.producto.create({
       ...payload,
       proveedorCodigo: parent.proveedorCodigo,
       idSeccionCodigo: parent.idSeccionCodigo,
       especificoCodigo: parent.especificoCodigo,
       surtidoCodigo: parent.surtido,
       dcCodigo: parent.dc,
       codigoNegocio: parent.codigoNegocio,
       esCompuesto: false
     })
  5. Return 201 { ...saved product }
```

### POST /api/productos (create child)

```pseudocode
POST /api/productos
{
  "nombre": "Beer 6-pack",
  "descripcion": "6 x 350ml bottles",
  "productoPadreId": "product-parent-xyz",
  "precioCosto": 600,
  "precioVenta": 900,
  "stock": 100,
  "esCompuesto": true,
  "cantidadEnPack": 6
}

handler:
  1. Validate payload (schema only has productoPadreId, NO segments)
  2. Fetch parent:
     parent = Prisma.producto.findUnique({ id: productoPadreId })
     if (!parent) THROW 404 "Parent not found"
  3. Generate child code:
     child = GenerateChildCode(parent)
  4. Check uniqueness of child.codigoNegocio
     existing = Prisma.producto.findUnique({ where: { codigoNegocio: child.codigoNegocio } })
     if (existing) THROW 409 "Code already exists"
  5. Save:
     Prisma.producto.create({
       ...payload,
       proveedorCodigo: child.proveedorCodigo,
       idSeccionCodigo: child.idSeccionCodigo,
       especificoCodigo: child.especificoCodigo,
       surtidoCodigo: child.surtido,
       dcCodigo: child.dc,
       codigoNegocio: child.codigoNegocio  // OR codigoNegocioHijo?
       esCompuesto: true,
       productoPadreId: parent.id
     })
  6. Return 201 { ...saved product }
```

**Note**: Current schema has a field `codigoNegocioHijo` but the Prisma model uses `codigoNegocio` for all products. Clarify: should child use same field or separate field? **Recommendation**: Use same `codigoNegocio` field for both (simpler) but set `esCompuesto=true` to distinguish.

---

## Database Constraints & Validation

### Uniqueness Guarantee

    ```sql
    -- Existing constraint (should remain)
    ALTER TABLE "Producto" ADD CONSTRAINT "Producto_codigoNegocio_key" UNIQUE("codigoNegocio");
    
    -- This ensures no parent or child can have the same code
    ```

### Soft Delete Awareness

When checking for "next available surtido", exclude soft-deleted products:

    ```sql
    SELECT MAX(CAST("surtidoCodigo" AS INT))
    FROM "Producto"
    WHERE "idSeccionCodigo" = $1
      AND "especificoCodigo" = $2
      AND "deletedAt" IS NULL;
    ```

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| **Unit** | EAN-13 checksum calc | Test `calculateEan13CheckDigit()` with known inputs/outputs |
| **Unit** | Category/subcategory mapping | Test `MapCategoryToSection()`, `MapSubcategoryToSpecific()` with all map entries |
| **Unit** | Surtido finding | Test `FindNextAvailableSurtido()` with mixed data + soft deletes |
| **Integration** | Parent code generation | POST /api/productos with full parent payload; verify segments + code are correct |
| **Integration** | Child code generation | POST /api/productos with parent ID; verify inheritance + new surtido |
| **Integration** | Uniqueness validation | Attempt duplicate code; expect 409 conflict |
| **E2E** | Parent form flow | Select provider → verify code preview updates → submit → verify DB |
| **E2E** | Child form flow | Select parent → verify inherited segments display → submit → verify code differs |

---

## Migration / Rollout

**No data migration required.** Existing columns remain unchanged; new logic is additive.

**Rollout strategy**:
1. Deploy new API handlers (backward-compatible during transition)
2. Deploy new category-mapping.ts (define all known mappings upfront)
3. Roll out new form UI (provider dropdown for parent; parent selector for child)
4. Monitor: track any 409 conflicts (code collisions); audit generated codes for consistency
5. (Optional) Backfill existing products' segments using batch job if any are missing

---

## Error Handling & Edge Cases

| Case | Behavior |
|------|----------|
| Vendor not found | Throw 404; user message: "Provider does not exist" |
| Category not in mapping | Throw 400; user message: "Category not supported yet; contact admin" |
| Surtido overflow (>9999) | Throw 400; user message: "No more variants available for this product class" |
| Code uniqueness violation | Throw 409 (DB constraint catches) or pre-check via API; user message: "Code already exists; try again" |
| Parent product deleted | If soft-deleted, child can still reference (FK allows NULL data). If hard-deleted, cascade deletes child. |
| Child created without parent | Throw 400; user message: "Select a parent product" |
| Multiple children sequential | Each child gets next surtido in sequence; all valid and unique |

---

## Open Questions

- [ ] Should child products use a separate `codigoNegocioHijo` column or reuse `codigoNegocio`?
- [ ] What are the complete category → section and subcategory → specific mappings? (MVP: provide hardcoded list for ~10 common categories)
- [ ] Should admin have ability to **manually override** generated codes (emergency escape hatch)?
- [ ] Should we track code generation history or audit log?
- [ ] Performance: For high-volume product creation, is the surtido query fast enough (add DB index)?

---

## Summary for Implementation

**Total files to modify**: 5  
**New functions**: 4 (GenerateParentCode, FindNextAvailableSurtido, GenerateChildCode, + mappings)  
**UI changes**: Remove 4 segment input fields; add 2 dropdowns + 2 read-only code previews  
**Validation**: Simplify Zod schema (fewer required fields); strengthen API validation  
**Testing budget**: ~15 unit + integration tests  
**Estimated effort**: 2–3 days (including testing + edge cases)
