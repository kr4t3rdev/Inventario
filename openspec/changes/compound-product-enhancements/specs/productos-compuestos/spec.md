# Delta for productos-compuestos

## MODIFIED Requirements

### Requirement: Child Product Price Calculation

(Previously: child `precioVenta` ALWAYS equals `parent.precioVenta / cantidadEnPack`)

The system MUST accept an explicit `precioVentaHijo` when creating a composite product.
If `precioVentaHijo` is provided and greater than 0, the child product MUST be saved with that price.
If `precioVentaHijo` is absent or zero, the child `precioVenta` MUST fall back to `parent.precioVenta / cantidadEnPack`.

#### Scenario: Child created with explicit price

- GIVEN a composite product "Cigarette Box" with `precioVenta` = 500 and `cantidadEnPack` = 20
- AND the user enters `precioVentaHijo` = 30
- WHEN the product is saved
- THEN the child product "Individual Cigarette" MUST have `precioVenta` = 30
- AND the child `precioCosto` MUST still be `parent.precioCosto / cantidadEnPack`

#### Scenario: Child created without explicit price (fallback)

- GIVEN a composite product with `precioVenta` = 500, `cantidadEnPack` = 20, no `precioVentaHijo`
- WHEN the product is saved
- THEN the child product MUST have `precioVenta` = 25 (500 / 20)

#### Scenario: Child price below cost — no blocking

- GIVEN `precioVentaHijo` = 10 and calculated child cost = 15
- WHEN the product form is submitted
- THEN the system SHOULD display a warning "El precio del hijo es menor al costo calculado"
- AND MUST NOT block the save

---

### Requirement: Child Product Prices Per List

(Previously: child products inherited price lists from the parent or had none)

The system MUST allow configuring `preciosPorLista` for the child product during composite product creation.

#### Scenario: Child has per-list prices at creation

- GIVEN a composite product form with active price lists ["Mayorista", "Minorista"]
- WHEN the user enters per-list prices for the child
- THEN the child product MUST be saved with those per-list price records
- AND each record MUST reference the correct `listaPrecioId`

#### Scenario: Child per-list prices omitted

- GIVEN the user leaves child per-list prices empty
- WHEN the composite product is saved
- THEN the child product MUST have no per-list price records
- AND the system MUST use child `precioVenta` as the sale price

---

### Requirement: Composite Product Form — Business Code Preview

(Previously: chunk preview always rendered when `esCompuesto = true`)

The system MUST NOT display the child product business code preview section when `usaEan13` is `false` for the current company.

#### Scenario: EAN-13 disabled — no preview

- GIVEN the company has `usaCodigoEan13 = false`
- WHEN the user enables the composite product toggle
- THEN the child business code preview block MUST NOT be rendered

#### Scenario: EAN-13 enabled — preview shown

- GIVEN the company has `usaCodigoEan13 = true`
- WHEN the user enables the composite product toggle
- AND selects a vendor, category, and subcategory
- THEN the child business code preview MUST be visible

---

## ADDED Requirements

### Requirement: Stock Sync — Purchase of Parent Updates Child Stock

When a composite parent product is purchased, the system MUST increment the child product's stock by `purchasedQty * cantidadEnPack` within the same atomic transaction.

#### Scenario: Buying parent increments child stock

- GIVEN a parent "Cigarette Box" with `cantidadEnPack` = 20 and a linked child "Individual Cigarette" with stock = 0
- WHEN a purchase of 2 parent units is registered
- THEN parent stock MUST increase by 2
- AND child stock MUST increase by 40 (2 × 20)
- AND both updates MUST succeed or both MUST roll back

#### Scenario: Parent with no child — no sync needed

- GIVEN a product with `esCompuesto = false` and no child linked
- WHEN a purchase is registered
- THEN only the parent stock is updated (existing behavior unchanged)

---

### Requirement: Stock Sync — Selling Child Decrements Parent Stock

When a child product is sold, the system MUST decrement the parent product's stock by `floor(soldChildQty / cantidadEnPack)` if the result is at least 1.

#### Scenario: Selling enough child units decrements parent

- GIVEN parent "Beer Case" with `cantidadEnPack` = 24 and stock = 5
- AND child "Beer Bottle" with stock = 120
- WHEN 24 child units are sold
- THEN child stock MUST decrease by 24
- AND parent stock MUST decrease by 1

#### Scenario: Selling fewer child units than a full pack

- GIVEN `cantidadEnPack` = 20, parent stock = 3
- WHEN 15 child units are sold
- THEN child stock MUST decrease by 15
- AND parent stock MUST remain unchanged (floor(15/20) = 0)
