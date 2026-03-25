# Productos Compuestos Specification

## Purpose

Allow products to be sold as composite units (boxes, bundles, sets) containing multiple individual items. For example, a cigarette box containing 20 individual cigarettes, or a beer case containing 24 beers. The system MUST automatically generate child products from the parent product configuration.

## Requirements

### Requirement: Composite Product Configuration

The system MUST allow users to define a product as "composite" (a box/set) containing a specified quantity of a secondary product (individual item).

#### Scenario: Create Composite Product (Happy Path)

- **GIVEN** a user is creating a new product "Cigarette Box" with price 500
- **WHEN** the user enables the "Composite Product" option
- **AND** specifies the secondary product is "Individual Cigarette"
- **AND** sets quantity to 20
- **THEN** the system MUST create the parent product with `esCompuesto` = true
- **AND** create a child product "Individual Cigarette" with price = 500 / 20 = 25
- **AND** link the child product to the parent via `productoPadreId`

#### Scenario: Composite Product Without Secondary Product

- **GIVEN** a user is creating a new product "Gift Box"
- **WHEN** the user enables the "Composite Product" option
- **AND** does NOT specify a secondary product
- **THEN** the system MUST NOT allow saving the configuration
- **AND** display error message "Secondary product is required for composite products"

#### Scenario: Zero Quantity

- **GIVEN** a user is creating a composite product
- **AND** sets quantity to 0
- **WHEN** attempting to save the product
- **THEN** the system MUST NOT allow saving
- **AND** display error message "Quantity must be greater than 0"

### Requirement: Automatic Child Product Creation

When a composite product is created, the system MUST automatically create the secondary product with inherited properties.

#### Scenario: Child Product Inherits Category

- **GIVEN** a parent product "Beer Case" belongs to category "Alcoholic Beverages"
- **AND** is configured as composite with 24 units of secondary product "Beer Bottle"
- **WHEN** the composite product is saved
- **THEN** the child product "Beer Bottle" MUST inherit the same category
- **AND** the same subcategory if applicable

#### Scenario: Child Product Has Calculated Price

- **GIVEN** a parent product "Cigarette Box" has `precioVenta` = 500
- **AND** contains 20 units of secondary product
- **WHEN** the child product is created
- **THEN** the child product's `precioVenta` MUST be 25 (500 / 20)
- **AND** the child product's `precioCosto` MUST be calculated as parent `precioCosto` / quantity

#### Scenario: Child Product Has Unique Business Code

- **GIVEN** a parent product has business code (codigoNegocio) "1234567890123"
- **AND** is configured as composite with secondary product
- **WHEN** the child product is created
- **THEN** the child product MUST have a unique code entered by the user
- **AND** this code MUST be validated for uniqueness before saving

### Requirement: Stock Management

The system MUST track stock for both parent and child products independently.

#### Scenario: Selling Child Product Updates Parent Stock

- **GIVEN** a "Cigarette Box" contains 20 "Individual Cigarettes"
- **AND** the parent product has stock = 10 boxes
- **AND** the child product has stock = 200 cigarettes
- **WHEN** 1 box is sold
- **THEN** the parent product stock MUST decrease by 1
- **AND** the child product stock MUST decrease by 20
- **AND** the total stock relationship MUST remain consistent

#### Scenario: Restock Parent Updates Child Stock

- **GIVEN** a "Beer Case" composite product is configured with 24 units
- **AND** the user performs a restock of 5 boxes
- **WHEN** the restock is completed
- **THEN** the parent product stock MUST increase by 5
- **AND** the child product stock MUST automatically increase by 5 * 24 = 120 units

### Requirement: Composite Product Display

The product form MUST display the composite configuration section when enabled.

#### Scenario: Show Composite Section

- **GIVEN** a user is creating or editing a product
- **WHEN** the user enables "Es Producto Compuesto" checkbox
- **THEN** the system MUST display the composite configuration section
- **AND** show fields: secondary product selection, quantity, generate button

#### Scenario: Hide Composite Section

- **GIVEN** a product is NOT marked as composite
- **WHEN** the product form is displayed
- **THEN** the composite configuration section MUST be hidden
- **AND** no composite-related fields should be editable

### Requirement: Product Relationship Integrity

The system MUST maintain the parent-child relationship between composite products.

#### Scenario: Delete Parent Product

- **GIVEN** a composite product "Cigarette Box" exists
- **AND** it has linked child products
- **WHEN** the user attempts to delete the parent product
- **THEN** the system MUST prevent deletion
- **AND** display error message "Cannot delete a composite product with child products"

#### Scenario: Update Composite Configuration

- **GIVEN** a composite product exists with quantity = 20
- **AND** child products have been created
- **WHEN** the user updates the quantity to 30
- **THEN** the system MUST create additional child products if needed
- **AND** recalculate prices for existing child products
- **AND** warn the user that existing child products will be affected

### Requirement: Inventory Reports

The system SHOULD display composite products differently in inventory reports.

#### Scenario: Inventory Report Shows Relationship

- **GIVEN** there are composite products in the inventory
- **WHEN** viewing the inventory report
- **THEN** composite products SHOULD be visually distinguished (icon or indicator)
- **AND** show the relationship to their child products

### Requirement: Price Calculation Validation

The system MUST validate that price calculations result in valid integer values.

#### Scenario: Non-Divisible Price

- **GIVEN** a parent product has price = 100
- **AND** quantity is set to 3
- **WHEN** the child product price is calculated (100 / 3 = 33.33)
- **THEN** the system MUST round to the nearest integer (33)
- **AND** show a warning about price rounding
- **OR** allow the user to manually adjust the calculated price
