# Proposal: Track Costs in Inventory Transfers

## Intent
Enable tracking of the monetary value of inventory moving between locations. Currently, `Transferencia` only tracks quantity, which leads to a gap in inventory value accounting when items move between warehouses or stores.

## Scope
### In Scope
- Modify `Transferencia` model in `prisma/schema.prisma` to add `costoUnitario` and `costoTotal`.
- Update `POST /api/transferencias` to snapshot the product's `precioCosto` at the time of transfer.
- Update `GET /api/transferencias` to return cost information.

### Out of Scope
- Backfilling costs for historical transfers (data availability is not guaranteed).
- Complex FIFO/LIFO valuation (we will use the current `precioCosto` snapshot).

## Approach
1. **Schema Change:** Add `costoUnitario Int?` and `costoTotal Int?` to the `Transferencia` model. Fields are nullable to support existing records.
2. **Logic Update:** In the transfer creation transaction, fetch the current `Producto.precioCosto` and save it to `costoUnitario`. Calculate `costoTotal` as `cantidad * costoUnitario`.

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| **Migration / Null Values** | High | New fields will be optional (`?`). Existing records will have `null` costs. We accept this gap for historical data rather than guessing. |
| **Integer Overflow** | Low | `costoTotal` will use `Int` to match `Venta.total`. If a transfer exceeds ~2 billion units of currency (CUP cents?), it would fail. We assume this is sufficient based on existing `Venta` usage. |
| **Cost Discrepancy** | Medium | The cost is a *snapshot* at transfer time. If the product cost changes later, the transfer record preserves the value *at that moment*, which is the correct accounting behavior. |

## Rollback Plan
- Revert the changes to `prisma/schema.prisma`.
- Revert the logic in `src/app/api/transferencias/route.ts`.
- Run a migration to remove the columns if strictly necessary (or leave them unused).

## Success Criteria
- [x] New transfers are created with `costoUnitario` and `costoTotal` populated.
- [x] The total value of a transfer matches `cantidad * costoUnitario`.
- [x] Existing transfers can still be queried without errors.
