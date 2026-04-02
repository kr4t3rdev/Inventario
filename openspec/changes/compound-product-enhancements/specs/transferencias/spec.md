# Transferencias de Productos — Delta Spec

## ADDED Requirements

### Requirement: Product Transfer Selector — Exclude Child Products

The system MUST NOT display child products (products where `productoPadreId` is not null) in the product selector of the transfer form.

Child products are not transferred independently. When a parent product is transferred to a point of sale, the child product becomes available for sale at that location implicitly — no separate transfer is required.

#### Scenario: Child product absent from transfer selector

- GIVEN composite product "Cigarette Box" with child "Individual Cigarette" (`productoPadreId` set)
- WHEN a user opens the transfer form to select products
- THEN "Individual Cigarette" MUST NOT appear in the product combobox
- AND "Cigarette Box" MUST appear with its stock displayed correctly

#### Scenario: Transferring parent makes child available at destination

- GIVEN "Cigarette Box" (parent, `cantidadEnPack` = 20) is transferred from almacén to punto de venta
- WHEN the transfer is confirmed
- THEN the parent "Cigarette Box" stock appears at the destination
- AND the child "Individual Cigarette" is considered available for sale at the destination without a separate transfer record

#### Scenario: Only standalone products transferred normally

- GIVEN no composite products exist
- WHEN a user opens the transfer form
- THEN all products appear as before (no change in selector behavior)
