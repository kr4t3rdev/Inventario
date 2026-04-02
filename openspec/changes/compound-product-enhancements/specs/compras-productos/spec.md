# Delta for compras-productos

## MODIFIED Requirements

### Requirement: Product Selector — Exclude Child Products

(Previously: all active products appeared in the purchase product selector)

The system MUST NOT display child products (products where `productoPadreId` is not null) in the product selector of the purchase form. Child products are not purchased independently; their stock is managed through the parent.

#### Scenario: Child product absent from purchase selector

- GIVEN composite product "Cigarette Box" exists with child "Individual Cigarette" (`productoPadreId` set)
- WHEN a user opens the purchase form
- THEN "Individual Cigarette" MUST NOT appear in the product dropdown
- AND "Cigarette Box" MUST appear normally

#### Scenario: No composite products — selector unaffected

- GIVEN no composite products exist in the catalog
- WHEN a user opens the purchase form
- THEN all products appear as before (no change in behavior)

---

### Requirement: Stock Update on Purchase — Propagate to Child

(Previously: purchasing a product updated only that product's stock)

When the purchased product is a composite parent (`esCompuesto = true`, `productosHijos` not empty), the system MUST also increment child stock by `cantidad * cantidadEnPack` within the same `$transaction`.

#### Scenario: Purchase of parent propagates to child

- GIVEN parent "Beer Case" with `cantidadEnPack` = 24 has child "Beer Bottle"
- WHEN a purchase of 3 "Beer Case" units is registered
- THEN "Beer Case" stock MUST increase by 3
- AND "Beer Bottle" stock MUST increase by 72 (3 × 24)
- AND all updates MUST be atomic

#### Scenario: Transaction rollback on child update failure

- GIVEN a purchase of parent is in progress
- WHEN the child stock update fails (e.g., child record not found)
- THEN the entire transaction MUST roll back
- AND neither parent nor child stock MUST be modified
- AND the API MUST return HTTP 500 with an error message
