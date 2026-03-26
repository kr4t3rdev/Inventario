# Tasks: Catalogo - Auto-Generated Business Codes (Parent & Child)

## Phase 1: Foundation

- [x] 1.1 Fix `src/app/api/productos/route.ts` compile/runtime breakages around generated-code variables so the handler can own parent/child code generation again.
- [x] 1.2 Normalize `src/lib/ean13-utils.ts` helpers for EAN assembly, check digit, and `FindNextAvailableSurtido()` so parent/child flows share the same primitives.
- [x] 1.3 Align `src/lib/category-mapping.ts` usage with the create-product payload (`categoriaId`, `subcategoriaId`) and define the fallback/error contract for unmapped taxonomy.

## Phase 2: Parent Code Generation

- [x] 2.1 Update `src/app/api/productos/route.ts` POST create flow to accept provider/category/subcategory as inputs and generate `proveedorCodigo`, `idSeccionCodigo`, `especificoCodigo`, `surtidoCodigo`, `dcCodigo`, and `codigoNegocio` on the server.
- [x] 2.2 Add API validation in `src/app/api/productos/route.ts` for missing provider, missing taxonomy mapping, invalid EAN-13, and duplicate `codigoNegocio`, returning 4xx responses instead of trusting client segments.
- [x] 2.3 Refactor `src/components/productos/productos-form.tsx` create mode to remove manual segment inputs, keep provider/category/subcategory selection, and render a read-only generated code preview.

## Phase 3: Child Inheritance and Compound UX

- [x] 3.1 Update compound creation in `src/app/api/productos/route.ts` so child products inherit provider/section/specific from the just-created parent and receive a newly allocated `surtidoCodigo` plus recalculated `codigoNegocioHijo`.
- [x] 3.2 Remove manual `codigoNegocioHijo` submission from `src/components/productos/productos-form.tsx`; submit only compound metadata (`esCompuesto`, `cantidadEnPack`, `nombreHijo`) and let the API generate the child code.
- [x] 3.3 Rework `src/components/productos/compound-product-section.tsx` to replace editable segment/code inputs with inherited read-only labels and a generated child-code preview.

## Phase 4: Verification

- [x] 4.1 Add/adjust unit tests for `src/lib/ean13-utils.ts` covering valid EAN assembly, invalid check digits, and next-surtido edge cases.
- [x] 4.2 Add route-level tests for `src/app/api/productos/route.ts` covering parent generation, child inheritance, duplicate-code rejection, and unmapped category/subcategory failures.
- [x] 4.3 Add component tests for `src/components/productos/productos-form.tsx` and `src/components/productos/compound-product-section.tsx` verifying hidden manual inputs, read-only previews, and compound payload behavior.
