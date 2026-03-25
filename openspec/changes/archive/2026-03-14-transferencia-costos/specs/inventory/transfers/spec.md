# Inventory Transfers Specification

## Purpose
Track the movement of inventory value between locations.

## Requirements

### Requirement: Record Unit Cost
The system **MUST** record the unit cost (`precioCosto`) of the product at the moment the transfer is created.

#### Scenario: Transfer Creation (Happy Path)
- **GIVEN** a product "Widget" with `precioCosto` of 100
- **WHEN** a transfer of 5 units is created
- **THEN** the transfer record **MUST** have `costoUnitario` = 100
- **AND** `costoTotal` = 500

### Requirement: Calculate Total Cost
The system **MUST** calculate and store the total cost of the transfer as `cantidad * costoUnitario`.

#### Scenario: Zero Cost Product
- **GIVEN** a product "Freebie" with `precioCosto` of 0
- **WHEN** a transfer of 10 units is created
- **THEN** the transfer record **MUST** have `costoUnitario` = 0
- **AND** `costoTotal` = 0

### Requirement: Historical Cost Integrity
The system **MUST NOT** update the cost on existing transfer records if the product's cost changes later.

#### Scenario: Cost Change After Transfer
- **GIVEN** an existing transfer with `costoUnitario` = 100
- **WHEN** the product's `precioCosto` is updated to 120
- **THEN** the existing transfer record **MUST** remain with `costoUnitario` = 100
