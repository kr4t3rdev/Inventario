# Delta for produccion

## ADDED Requirements

### Requirement: Production Recipe Output Product

The system MUST require every production recipe used in operational flows to have a linked output product.

#### Scenario: Recipe uses existing catalog product

- **GIVEN** a user is creating or editing a production recipe
- **WHEN** the user chooses the existing-catalog option and selects a product
- **THEN** the recipe MUST store that product as its output product
- **AND** the recipe becomes valid for production orders

#### Scenario: Recipe creates a new catalog product

- **GIVEN** a user is creating or editing a production recipe
- **WHEN** the user chooses the create-new-product option and submits valid product data
- **THEN** the system MUST create the product in the catalog
- **AND** automatically link the new product to the recipe as its output product

#### Scenario: Product creation fails

- **GIVEN** a user chose the create-new-product option
- **WHEN** product creation fails validation or persistence
- **THEN** the recipe MUST NOT be linked to a partial or invalid output product
- **AND** the system MUST show the error and keep the recipe unresolved

### Requirement: Production Completion Contract

The system MUST preserve the current production-order completion behavior and SHALL only allow it for recipes that already have an output product configured.

#### Scenario: Completing a valid production order

- **GIVEN** an order references a recipe with a linked output product
- **WHEN** the order is completed
- **THEN** the system MUST keep the current completion flow
- **AND** increment stock for the linked output product

#### Scenario: Operational flow with missing output product

- **GIVEN** a legacy recipe has no linked output product
- **WHEN** the user attempts to use it in production completion-dependent flows
- **THEN** the system MUST block the action
- **AND** instruct the user to select or create the output product first
