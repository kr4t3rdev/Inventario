# Delta Spec: Catalog - Auto-Generated Business Codes (Parent & Child)

---

## PARENT PRODUCT SPECIFICATIONS

### Requirement: Auto-Generation of Parent Product Segments

The system MUST automatically generate all parent product code segments when the user selects a provider.

#### Scenario: Parent Code Generated from Provider Selection

- **GIVEN** a user is creating a new parent product
- **WHEN** the user selects provider "Distribuidora XYZ" (proveedorCodigo = "01")
- **THEN** the system MUST auto-generate:
  - `idSeccionCodigo` = "14" (auto-generated, represents general product type)
  - `especificoCodigo` = "0285" (auto-generated, represents subcategory)
  - `surtidoCodigo` = "0001" (auto-generated, represents first variety)
  - `dcCodigo` = calculated EAN-13 check digit
  - `codigoNegocio` = "0114028500012" (complete, valid EAN-13)

#### Scenario: Section Auto-Assigned by Product Category

- **GIVEN** a user creates a parent product in category "Beverages"
- **WHEN** the system generates the product code
- **THEN** `idSeccionCodigo` MUST be assigned based on category mapping
- **AND** remain consistent for all products in that category
- **AND** be stored for future predictability

#### Scenario: Specific Auto-Assigned by Product Subcategory

- **GIVEN** a product belongs to subcategory "Alcoholic Beverages"
- **WHEN** the parent code is generated
- **THEN** `especificoCodigo` MUST represent that subcategory
- **AND** be auto-assigned deterministically
- **AND** be shared by all products in the same subcategory level

#### Scenario: Assortment (Surtido) Auto-Incremented

- **GIVEN** parent products with section="14", specific="0285" exist with surtido="0001"
- **WHEN** creating a new parent product in the same section/specific
- **THEN** the system MUST find the next available surtido
- **AND** assign `surtidoCodigo` = "0002"
- **AND** generate unique `codigoNegocio` with new surtido

### Requirement: Parent Form - Provider Selection Only

The parent product form MUST display only a provider dropdown; all segment fields MUST be hidden.

#### Scenario: Parent Form Shows Provider Dropdown

- **GIVEN** a user is creating a parent product
- **WHEN** the parent product form is displayed
- **THEN** the form MUST show:
  - Provider dropdown (required) with all active providers
  - No segment input fields (`idSeccionCodigo`, `especificoCodigo`, `surtidoCodigo`)
  - No manual code entry field
  - Code preview/display (read-only) showing generated code
- **AND** show product details (name, category, subcategory, prices, stock)

#### Scenario: Code Generation on Provider Selection

- **GIVEN** the provider dropdown is displayed
- **WHEN** the user selects a provider
- **THEN** the system MUST immediately:
  - Read the `proveedorCodigo` from selection
  - Generate section, specific, surtido
  - Calc check digit
  - Display the complete `codigoNegocio` (read-only preview)
  - Label: "Generated Code: 0114028500012"

---

## CHILD PRODUCT SPECIFICATIONS

### Requirement: Child Product Inherits All Parent Segments

The system MUST inherit ALL parent segments to the child product; only assortment (surtido) is auto-generated differently.

#### Scenario: All Parent Segments Inherited

- **GIVEN** a parent product with:
  - `proveedorCodigo` = "01"
  - `idSeccionCodigo` = "14"
  - `especificoCodigo` = "0285"
  - `surtidoCodigo` = "0001"
  - `codigoNegocio` = "0114028500012"
- **WHEN** a child product is created
- **THEN** the child MUST inherit:
  - `proveedorCodigo` = "01" (unchanged)
  - `idSeccionCodigo` = "14" (unchanged)
  - `especificoCodigo` = "0285" (unchanged)
- **AND** MUST differ only in:
  - `surtidoCodigo` = "0002" (auto-incremented for variant)
  - `codigoNegocioHijo` = "0114028500029" (recalculated with new surtido + DC)

#### Scenario: Child Form - Zero User Input

- **GIVEN** a user is creating a composite (child) product
- **WHEN** the child product form section is displayed
- **THEN** the form MUST show:
  - A read-only label showing inherited provider
  - A read-only label showing inherited section/specific
  - A read-only label showing the parent's base code
  - A generated child variant code (read-only preview)
  - NO input fields for any segment
  - NO dropdown for provider selection
  - NO fields for section, specific, or surtido
- **AND** show only product-specific data (name, quantity, prices)

#### Scenario: Child Surtido Variant Auto-Generated

- **GIVEN** a parent product has surtido="0001"
- **WHEN** creating a child (first variant)
- **THEN** the system MUST assign:
  - `surtidoCodigo` = "0002" (next number in sequence)
- **AND** generate `codigoNegocioHijo` with:
  - inherited provider + section + specific
  - new surtido "0002"
  - calculated DC
  - Result: "0114028500029" (if DC=9)

#### Scenario: Multiple Children Generate Sequential Variants

- **GIVEN** a parent product with section="14", specific="0285", original surtido="0001"
- **WHEN** creating child 1:
  - `surtidoCodigo` = "0002"
  - `codigoNegocioHijo` = "0114028500029"
- **AND** creating child 2:
  - `surtidoCodigo` = "0003"
  - `codigoNegocioHijo` = "0114028500036"
- **THEN** each child has unique, sequential code
- **AND** all children inherit same provider, section, specific as parent

### Requirement: Uniqueness Guarantee

All generated codes (parent and child) MUST be globally unique.

#### Scenario: Uniqueness Check During Generation

- **GIVEN** a parent code generation produces "0114028500012"
- **WHEN** checking uniqueness before save
- **THEN** the system MUST verify no other product has this code
- **AND** reject if found, retry with next surtido

#### Scenario: Child Uniqueness Independent of Parent

- **GIVEN** parent `codigoNegocio` = "0114028500012"
- **AND** child `codigoNegocioHijo` = "0114028500029"
- **WHEN** storing both
- **THEN** both codes MUST be globally unique
- **AND** no conflict between parent and child codes

---

## Removed Requirements

### Requirement: Manual Segment Entry

**Reason**: All segments are now auto-generated or inherited; no user input for segments.

**Removed behavior**:
```
// REMOVED: idSeccionCodigo input field
// REMOVED: especificoCodigo input field
// REMOVED: surtidoCodigo input field
// REMOVED: Manual code entry field
```

### Requirement: Provider Selection in Child Form

**Reason**: Provider is inherited from parent; child has no provider input.

**Removed behavior**:
```
// REMOVED: Provider dropdown from child form
// REMOVED: Provider selection logic in child creation
```

---

## Generation Algorithm

### Parent Generation Algorithm

```
GenerateParentCode(selectedProvider, productCategory, productSubcategory):
  1. provider_code = selectedProvider.proveedorCodigo
  2. section = MapCategory(productCategory)  // "14" for Beverages, etc.
  3. specific = MapSubcategory(productSubcategory)  // "0285" for Alcoholic, etc.
  4. surtido = FindNextAvailableSurtido(section, specific)  // "0001" for first
  5. base12 = provider_code + section + specific + surtido
  6. dc = CalculateEan13CheckDigit(base12)
  7. codigoNegocio = base12 + dc
  8. return { provider_code, section, specific, surtido, dc, codigoNegocio }
```

### Child Generation Algorithm

```
GenerateChildCode(parentProduct):
  1. provider_code = parentProduct.proveedorCodigo  // INHERIT
  2. section = parentProduct.idSeccionCodigo  // INHERIT
  3. specific = parentProduct.especificoCodigo  // INHERIT
  4. surtido = FindNextAvailableSurtido(section, specific)  // NEW VARIANT
  5. base12 = provider_code + section + specific + surtido
  6. dc = CalculateEan13CheckDigit(base12)
  7. codigoNegocioHijo = base12 + dc
  8. return { provider_code, section, specific, surtido, dc, codigoNegocioHijo }
```

---

## Validation Rules (RFC 2119)

| Rule | Strength |
|------|----------|
| Parent: Provider selection is required | **MUST** |
| Parent: Section is auto-generated from category | **MUST** |
| Parent: Specific is auto-generated from subcategory | **MUST** |
| Parent: Surtido is auto-generated sequentially | **MUST** |
| Child: All parent segments are inherited | **MUST** |
| Child: Surtido is auto-generated (new variant) | **MUST** |
| All generated codes MUST be valid EAN-13 | **MUST** |
| All generated codes MUST be globally unique | **MUST** |
| No manual segment input is presented to user | **MUST** |
| System SHOULD generate section/specific based on taxonomy | **SHOULD** |
