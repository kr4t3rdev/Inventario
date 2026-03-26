# Proposal: Catalog - Auto-Generated Business Codes (Parent & Child)

## Intent

Fully automate business code generation for both parent and child products:
- **Parent**: User selects provider only; system auto-generates section, specific, assortment, and complete business code
- **Child**: Inherits ALL segments from parent (provider, section, specific); system auto-generates only the assortment variant number

## Scope

**What changes:**
- Parent product form: replace manual segment entry with provider dropdown only
- Child product form: inherit all parent segments automatically; zero user input
- Auto-generation logic: section, specific, surtido, and parent/child business codes
- UI simplification: remove segment input fields entirely

**What stays the same:**
- Stock management between parent and child
- Database schema (no new fields)
- Product hierarchy model
- Uniqueness constraints

## Affected Areas

- **UI**: 
  - `src/components/productos/productos-form.tsx` — replace segment fields with provider dropdown
  - `src/components/productos/compound-product-section.tsx` — simplify to inheritance-only
- **API**: `src/app/api/productos/route.ts` — auto-generate segments for parent, inherit for child
- **Utils**: `src/lib/ean13-utils.ts` — add section/specific/surtido generation logic
- **Database**: No schema changes

## High-Level Approach

**Parent Creation**:
1. User selects provider from dropdown → system reads `proveedorCodigo`
2. System auto-generates: section (2 digits), specific (4 digits), surtido (4 digits)
3. Calc check digit and build `codigoNegocio`

**Child Creation**:
1. Child inherits parent's: provider, section, specific
2. System auto-generates next surtido (variant number)
3. Build `codigoNegocioHijo` from inherited segments + new surtido + new check digit
4. Result: Fully deterministic, zero user input

## Tradeoffs

| Tradeoff | Decision |
|----------|----------|
| User control | **Minimal** — system generates all segments intelligently |
| Predictability | **Perfect** — all codes derived deterministically |
| Provider selection | **Parent only** — user selects once; child inherits |
| Flexibility | **High** — intelligent generation allows multiple children per parent |

## Success Criteria

- ✓ Parent creation: user selects provider only
- ✓ Parent code: auto-generated section + specific + surtido
- ✓ Child creation: zero manual input
- ✓ Child code: inherited parent segments + new surtido variant
- ✓ All codes are valid EAN-13 and globally unique
