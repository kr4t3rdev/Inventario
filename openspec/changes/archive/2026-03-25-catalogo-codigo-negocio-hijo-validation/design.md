# Design: Catalogo - Auto-Generated Business Codes for Parent and Child Products

## Technical Approach

Implement the change by moving business-code ownership to the server and reducing the form to orchestration only. The parent flow will collect provider, category, and subcategory, then request server-side generation of `proveedorCodigo + idSeccionCodigo + especificoCodigo + surtidoCodigo + dcCodigo`. The child flow will never accept manual segment input: it will inherit provider/section/specific from the parent being created and request a second generated `surtidoCodigo` for the child variant. The UI will show read-only previews, but the API remains the source of truth for uniqueness and EAN-13 validity.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Code generation owner | Generate and validate codes in `src/app/api/productos/route.ts` | Generate only in client | Server-side ownership prevents duplicated rules, enforces uniqueness against Prisma, and avoids trusting mutable client inputs. |
| Parent inputs | Keep only provider selection editable; compute other segments from category/subcategory | Preserve manual section/specific/surtido fields | The spec removes manual segment entry and requires deterministic mapping from taxonomy. |
| Child inputs | Make child code preview read-only and derive from parent context | Allow manual `codigoNegocioHijo` or provider re-selection | The spec requires zero segment input for children and inheritance of parent segments. |
| Surtido allocation | Reuse `FindNextAvailableSurtido` against live products for both parent and child | Local counters or client-side increment | Shared server allocation preserves global uniqueness across parent and children. |

## Data Flow

```text
ProductoForm
  ├─ user selects provider/category/subcategory
  ├─ client requests/derives preview data
  └─ POST /api/productos
        ├─ mapCategoryToSection(categoryId)
        ├─ mapSubcategoryToSpecific(subcategoryId)
        ├─ FindNextAvailableSurtido(prisma, section, specific)
        ├─ AssembleEan13Code(...)
        ├─ validate uniqueness in producto.codigoNegocio
        ├─ create parent product
        └─ if esCompuesto: allocate next surtido again and create child product
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/productos/productos-form.tsx` | Modify | Remove manual section/specific/surtido inputs from create flow, replace provider code text field with provider selector/read-only preview logic, and stop posting manual child code. |
| `src/components/productos/compound-product-section.tsx` | Modify | Replace editable child business-code input with inherited parent context and generated preview. |
| `src/app/api/productos/route.ts` | Modify | Normalize parent generation, forbid manual child code input, allocate child surtido separately, and persist inherited child segments plus recalculated DC. |
| `src/lib/ean13-utils.ts` | Modify | Keep EAN assembly helpers as shared primitives and add any small helper needed to return preview-safe segment payloads. |
| `src/lib/category-mapping.ts` | Reuse | Remains the source for category/subcategory-to-segment mapping used by API. |

## Interfaces / Contracts

```ts
interface GeneratedCodePreview {
  proveedorCodigo: string;
  idSeccionCodigo: string;
  especificoCodigo: string;
  surtidoCodigo: string;
  dcCodigo: string;
  codigoNegocio: string;
}

interface CreateProductoRequest {
  proveedorCodigo: string;
  categoriaId: string;
  subcategoriaId: string;
  esCompuesto?: boolean;
  cantidadEnPack?: number;
  nombreHijo?: string;
  // codigoNegocioHijo MUST NOT be accepted from the client
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | EAN-13 assembly, check digit, surtido allocation edge cases | Extend tests for `ean13-utils` and mapping helpers. |
| Integration | POST `/api/productos` parent creation, child inheritance, duplicate-code rejection | Route-level tests with Prisma test fixtures/mocks. |
| UI | Parent hides manual segments, child shows inherited read-only values, manual child code input removed | Component tests with Testing Library/Vitest. |

## Migration / Rollout

No schema migration required. Rollout is safe behind the existing product creation path because database columns already exist. Existing products remain valid; only create/edit behavior changes. If partial rollout is needed, ship API changes first, then UI simplification, so server validation is in place before the form stops sending legacy fields.

## Open Questions

- [ ] Should the provider selector bind to `vendorId`, `proveedorCodigo`, or both in the parent form to avoid divergence between vendor metadata and code segments?
- [ ] In edit mode, do legacy products keep visible stored segments as read-only, or should the form preserve the current editable behavior for backwards compatibility?
