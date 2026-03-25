# Design: Transferencia Costos

## Technical Approach
Modify the `Transferencia` model in Prisma to include `costoUnitario` and `costoTotal`. Update the `POST` endpoint to snapshot the product's `precioCosto` at the time of creation.

## Architecture Decisions

### Decision: Nullable Cost Fields
**Choice**: Make `costoUnitario` and `costoTotal` nullable (`Int?`).
**Rationale**: To support existing records without requiring a complex backfill migration. New records will always have these fields populated.

### Decision: Snapshot Cost at Source
**Choice**: Read `precioCosto` from the `Producto` table within the transaction and save it to `Transferencia`.
**Rationale**: Ensures the transfer value reflects the cost *at that moment*, invariant to future price changes.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `costoUnitario Int?` and `costoTotal Int?` to `Transferencia` model. |
| `src/app/api/transferencias/route.ts` | Modify | In `POST`, read `precioCosto` and populate new fields. In `GET`, include these fields in response. |

## Interfaces / Contracts
```prisma
model Transferencia {
  // ... existing fields
  costoUnitario Int?
  costoTotal    Int?
}
```
