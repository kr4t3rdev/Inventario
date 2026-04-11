# Delta for catalogo

## ADDED Requirements

### Requirement: Catalog Product Creation from Production Recipes

The catalog system MUST support product creation initiated from the production-recipe flow using the same business rules required by the standard product form.

#### Scenario: Inline product creation reuses catalog validation

- **GIVEN** a user creates a product from a production recipe
- **WHEN** the inline form is submitted
- **THEN** the system MUST apply the same required validations and defaults as the standard catalog product flow
- **AND** persist the product in the main catalog

#### Scenario: New catalog product is returned to production flow

- **GIVEN** a product was created successfully from the production recipe flow
- **WHEN** the catalog save finishes
- **THEN** the system MUST return the created product identifier and display data
- **AND** allow production to bind that product to the recipe without manual re-selection
