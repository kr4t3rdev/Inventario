# Design: Catalog CRUD Hardening for Almacenes, Unidades, Puntos de Venta, and Proveedores

## 1. Architecture Summary

This is a **contract-hardening change**, not a feature build. The safest design is to preserve the current Server Action boundaries and refactor the surrounding client forms, page types, and tests so they all agree on the same contracts.

The design follows three rules:

1. **Server Actions remain the authoritative backend boundary.**
2. **Feature schemas become the shared contract for both client and server.**
3. **UI components adapt to real payloads instead of inventing alternate shapes.**

## 2. Module-by-Module Design

### 2.1 Almacenes
- Keep `src/features/almacenes/actions.ts` behavior unchanged.
- Refactor `src/features/almacenes/components/almacen-form.tsx` to import the shared schema from `src/features/almacenes/schemas.ts`.
- If the form needs a client-specific alias, export it from the feature schema file instead of redefining it locally.

### 2.2 Unidades
- Keep `src/features/unidades/actions.ts` as the canonical source for uniqueness behavior.
- Refactor `src/features/unidades/components/unidad-form.tsx` to use shared schemas from `src/features/unidades/schemas.ts`.
- Remove suppression in `src/app/busy/unidad/page.tsx` by tightening the result typing from `getUnidadesAction` to `Unidad[]` without unsafe casts.

### 2.3 Puntos de Venta
- Remove the `@ts-expect-error` in `src/features/puntos-venta/actions.ts` by normalizing the create/update payload types so Prisma relation writes are typed explicitly.
- Refactor `src/features/puntos-venta/components/pvtoVenta-form.tsx` to use the shared schema from `src/features/puntos-venta/schemas.ts` instead of a local weaker schema plus `as any` resolver cast.
- Keep `listaPrecioId` as the UI sentinel boundary only inside the form (`"default"` → `null`), never in the action contract.
- Expand action tests to prove relation connect/disconnect semantics and tenant isolation.

### 2.4 Vendors
- Preserve the enriched vendor payload produced by `src/features/vendors/actions.ts`.
- Fix `src/features/vendors/components/vendor-page-client.tsx` to consume `contrato` instead of a nonexistent `contratos[]` structure.
- Refactor `src/features/vendors/components/vendor-form.tsx` to use `src/features/vendors/schemas.ts` as the validation source of truth.
- Keep vendor code / EAN enrichment behavior unchanged unless a failing test proves a defect.

## 3. Data Contract Strategy

### 3.1 Validation contract
Each feature should expose a schema that can be used in both places:
- **Server Action parsing**
- **React Hook Form resolver**

That avoids client/server drift and removes the need for weaker duplicate local schemas.

### 3.2 UI contract normalization
The UI should consume the payload the backend already returns.

For vendors, the contract mismatch is not a backend bug; it is a consumer bug. The smallest correct fix is:
- either render `vendor.contrato`
- or extract a tiny presenter/helper that maps `VendorActionItem -> contract label`

The design recommends the smallest path that is easiest to test.

## 4. Testing Strategy

### 4.1 Strict TDD slices
Implementation should be split into small red/green slices:
1. Shared schema convergence for one module at a time.
2. Vendor contract rendering.
3. Puntos de venta typed relation writes.
4. Puntos de venta regression suite expansion.

### 4.2 Test layers
- **Unit tests** for Server Actions and helper/presenter behavior.
- **Component tests** only where they directly protect contract drift in touched forms or vendor rendering.
- **Typecheck** as a hard verification gate after removing suppressions.

### 4.3 Recommended new tests
- Schema behavior tests for shared create/update schemas where useful.
- Vendors table rendering test for `contrato` present vs null.
- Puntos de venta action tests for:
  - auth required
  - tenant isolation
  - validation error
  - create connect `listaPrecio`
  - update connect/disconnect `listaPrecio`
  - not found on foreign tenant or missing ID

## 5. File Responsibilities

| File | Responsibility |
|------|----------------|
| `src/features/almacenes/schemas.ts` | Shared Zod source for almacenes |
| `src/features/almacenes/components/almacen-form.tsx` | Consume shared schema in client form |
| `src/features/unidades/schemas.ts` | Shared Zod source for unidades |
| `src/features/unidades/components/unidad-form.tsx` | Consume shared schema in client form |
| `src/app/busy/unidad/page.tsx` | Typed page-level consumption of action result |
| `src/features/puntos-venta/schemas.ts` | Shared Zod source for puntos de venta |
| `src/features/puntos-venta/actions.ts` | Typed relation writes without suppression |
| `src/features/puntos-venta/components/pvtoVenta-form.tsx` | Shared-schema form with no resolver cast hack |
| `src/features/puntos-venta/__tests__/actions.test.ts` | Regression suite for action behavior |
| `src/features/vendors/schemas.ts` | Shared Zod source for vendors |
| `src/features/vendors/components/vendor-form.tsx` | Consume shared schema in client form |
| `src/features/vendors/components/vendor-page-client.tsx` | Render actual contract payload |
| `src/features/vendors/__tests__/actions.test.ts` | Preserve action enrichment and CRUD behavior |
| `src/features/vendors/components/__tests__/vendor-page-client.test.tsx` (new, recommended) | Lock rendering of `contrato` fallback behavior |

## 6. Tradeoffs

### Option chosen: minimal contract convergence
**Why**: it fixes the real bugs with the least blast radius.

### Option rejected: redesign backend payloads to arrays
**Why not**: there is no evidence that vendors truly need `contratos[]` in this CRUD. That would expand scope and risk without solving the core problem.

### Option rejected: keep local form schemas and “make them match manually”
**Why not**: that keeps duplicate sources of truth alive, which is exactly the defect class we are trying to remove.

## 7. Verification Gates

Before considering the change complete:
1. Focused tests for each touched slice MUST pass.
2. `pnpm run typecheck` MUST pass.
3. No touched file may contain fresh suppression comments to bypass typing.
4. Vendor contract rendering MUST be covered by at least one deterministic test.
