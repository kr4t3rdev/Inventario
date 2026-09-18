# Spec: Calculador Puro reconciliarHistorial (Ficha de Costo)

## Purpose
Proveer una función pura `reconciliarHistorial()` que, dada una lista materializada de items de compra, una ventana de meses, una fecha de referencia y un mapa de gastos por documento, devuelva una lista reconciliada con flags de ventana y gastos proporcionales por línea, más un resumen agrupado por proveedor, totales sobre la ventana y advertencias detectadas. La función no debe depender de Prisma, del contexto de la request ni de estado global, para poder ser testeada con datos sintéticos.

## Requirements

### Requirement: Window flag based on fechaReferencia and ventanaMeses
The function SHALL set `enVentanaCPP = true` for each item whose `fecha` falls within `ventanaMeses` of `fechaReferencia` (inclusive on both ends), and `false` otherwise.

#### Scenario: Item at the exact window boundary is included
- **GIVEN** an item with `fecha` equal to `fechaReferencia` minus exactly `ventanaMeses` months (e.g., `fechaReferencia = 2026-06-20` and `ventanaMeses = 12`, item `fecha = 2025-06-20`)
- **WHEN** `reconciliarHistorial(items, 12, fechaReferencia, gastosPorDocumento)` is called
- **THEN** the returned item MUST have `enVentanaCPP: true`

#### Scenario: Item one day outside the window is excluded
- **GIVEN** an item with `fecha` older than `fechaReferencia` minus `ventanaMeses` by at least one day (e.g., `fecha = 2025-06-19` with `fechaReferencia = 2026-06-20` and `ventanaMeses = 12`)
- **WHEN** `reconciliarHistorial(items, 12, fechaReferencia, gastosPorDocumento)` is called
- **THEN** the returned item MUST have `enVentanaCPP: false`

#### Scenario: Item clearly inside the window is included
- **GIVEN** an item with `fecha` more recent than `fechaReferencia` minus `ventanaMeses` (e.g., `fecha = 2026-01-15` with `fechaReferencia = 2026-06-20` and `ventanaMeses = 12`)
- **WHEN** `reconciliarHistorial(items, 12, fechaReferencia, gastosPorDocumento)` is called
- **THEN** the returned item MUST have `enVentanaCPP: true`

#### Scenario: Default fechaReferencia is the current date when omitted
- **GIVEN** the caller does not pass `fechaReferencia`
- **WHEN** `reconciliarHistorial(items, 12, undefined, gastosPorDocumento)` is called
- **THEN** the function MUST use the current date as the reference
- **AND** the returned `ventana.hasta` MUST be equal to the current date

#### Scenario: Ventana metadata in the result reflects the requested window
- **GIVEN** `ventanaMeses = 12` and a fixed `fechaReferencia`
- **WHEN** `reconciliarHistorial(items, 12, fechaReferencia, gastosPorDocumento)` is called
- **THEN** the returned `ventana.meses` MUST be `12`
- **AND** `ventana.desde` MUST equal `fechaReferencia` minus `12` months
- **AND** `ventana.hasta` MUST equal `fechaReferencia`

### Requirement: Proportional expense distribution by quantity
The function SHALL distribute the `total` of a `GastoCompra` proportionally across all items of the same `compraDocumento`, using each item's `cantidad` divided by the document's `cantidad` as the weight.

#### Scenario: Equal quantities produce equal proration
- **GIVEN** 3 items of the same document with `cantidad` of `10`, `10`, `10` respectively
- **AND** the document's `GastoCompra` has `total: 300` and `cantidad: 30`
- **WHEN** `reconciliarHistorial(items, 12, now, { [docId]: { total: 300, cantidad: 30 } })` is called
- **THEN** each of the 3 items MUST receive `gastoProporcional = 100`
- **AND** the sum of the 3 `gastoProporcional` values MUST equal `300` within a tolerance of `0.01`

#### Scenario: Unequal quantities prorate proportionally
- **GIVEN** 2 items of the same document with `cantidad` of `10` and `20` respectively
- **AND** the document's `GastoCompra` has `total: 300` and `cantidad: 30`
- **WHEN** `reconciliarHistorial(items, 12, now, { [docId]: { total: 300, cantidad: 30 } })` is called
- **THEN** the first item MUST receive `gastoProporcional = 100`
- **AND** the second item MUST receive `gastoProporcional = 200`
- **AND** the sum of both `gastoProporcional` values MUST equal `300` within a tolerance of `0.01`

#### Scenario: Items with no associated expense report zero
- **GIVEN** items whose document id is NOT present in `gastosPorDocumento`
- **WHEN** `reconciliarHistorial(items, 12, now, { otherDocId: { total: 100, cantidad: 10 } })` is called
- **THEN** those items MUST have `gastoProporcional: 0`
- **AND** the function MUST NOT throw or warn solely because the document is missing from the map

#### Scenario: Numeric invariant for proportional expense per document
- **GIVEN** any number of items belonging to a document with an associated `GastoCompra`
- **WHEN** `reconciliarHistorial(items, 12, now, { [docId]: { total: T, cantidad: C } })` is called
- **THEN** the sum of `gastoProporcional` over the items of that document MUST be within `0.01` of `T`

### Requirement: Per-supplier summary
The function SHALL produce a `proveedores` array grouping all items by `proveedorId`, computing `cantidadTotal`, `montoTotal`, `precioPromedio` and `participacionPorcentaje` based only on items within the 12-month window.

#### Scenario: Multiple suppliers are summarized separately
- **GIVEN** 4 items: 3 from "Proveedor A" with `cantidad` 5, 5, 5 and `totalLinea` 50, 50, 50; and 1 from "Proveedor B" with `cantidad` 10 and `totalLinea` 200
- **AND** all 4 items fall within the 12-month window
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the returned `proveedores` array MUST have exactly 2 entries
- **AND** the entry for Proveedor A MUST report `cantidadTotal: 15`, `montoTotal: 150` and `precioPromedio = 10`
- **AND** the entry for Proveedor B MUST report `cantidadTotal: 10`, `montoTotal: 200` and `precioPromedio = 20`
- **AND** the sum of `participacionPorcentaje` across both entries MUST equal `100` within a tolerance of `0.1`

#### Scenario: A single supplier reports 100% participation
- **GIVEN** items that all belong to a single supplier AND all fall within the 12-month window
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the `proveedores` array MUST contain exactly 1 entry
- **AND** that entry MUST report `participacionPorcentaje: 100`

#### Scenario: Summary only considers items within the window
- **GIVEN** items from one supplier both inside and outside the 12-month window
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the `cantidadTotal` and `montoTotal` for that supplier MUST be computed using only the items with `enVentanaCPP: true`
- **AND** items with `enVentanaCPP: false` MUST NOT contribute to the supplier summary nor to `totalCantidadEnVentana` / `totalMontoEnVentana`

#### Scenario: Items outside the window appear in items but not in suppliers
- **GIVEN** a product with 2 items from the same supplier, 1 inside and 1 outside the 12-month window
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the returned `items` array MUST contain both entries
- **AND** the returned `proveedores` array MUST contain exactly 1 entry whose `cantidadTotal` reflects only the in-window item

### Requirement: Determinism and purity
The function SHALL be a pure function: no I/O, no Prisma, no global state, and no mutation of its inputs. Given the same inputs (including a fixed `fechaReferencia`), it MUST always return the same output.

#### Scenario: Empty input returns empty result
- **GIVEN** an empty `items` array
- **WHEN** `reconciliarHistorial([], 12, fechaReferencia, new Map())` is called
- **THEN** the result MUST contain `items: []` and `proveedores: []`
- **AND** the result MUST contain `advertencias: []`
- **AND** the result MUST contain a `ventana` field with `meses: 12`, `desde` and `hasta` derived from `fechaReferencia`
- **AND** the result MUST contain `totalCantidadEnVentana: 0` and `totalMontoEnVentana: 0`

#### Scenario: Inputs are not mutated
- **GIVEN** an `items` array and a `gastosPorDocumento` map passed by the caller
- **WHEN** `reconciliarHistorial(items, 12, fechaReferencia, gastosPorDocumento)` is called
- **THEN** the original `items` array MUST NOT be mutated (no new fields on its elements, no reorder, no length change)
- **AND** the original `gastosPorDocumento` map MUST NOT be mutated

#### Scenario: Same inputs produce same outputs
- **GIVEN** a fixed `items` array, `gastosPorDocumento` map, `ventanaMeses` and `fechaReferencia`
- **WHEN** `reconciliarHistorial` is called twice with those same arguments
- **THEN** the two results MUST be deeply equal (same `enVentanaCPP`, `gastoProporcional`, `proveedores` aggregates and warnings)

### Requirement: Warnings emitted by the reconciler
The function SHALL return a list of human-readable `advertencias` describing anomalies detected during reconciliation, without ever throwing.

#### Scenario: A document with zero or negative quantity generates a warning
- **GIVEN** an item whose document id maps to a `GastoCompra` with `cantidad <= 0`
- **WHEN** `reconciliarHistorial(items, 12, now, { [docId]: { total: 100, cantidad: 0 } })` is called
- **THEN** the result MUST include at least one `advertencias` entry explaining the anomaly (referring to the zero/negative quantity)
- **AND** the corresponding item's `gastoProporcional` MUST be `0`
- **AND** the function MUST NOT throw

#### Scenario: An approximate exchange rate on an item generates a warning
- **GIVEN** an item whose source data is flagged with `tasaAproximada: true`
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the result MUST include an `advertencias` entry mentioning the approximate exchange rate

#### Scenario: A well-formed dataset produces no warnings
- **GIVEN** items whose documents all have valid `GastoCompra` records (positive `total` and `cantidad`) and no approximate-rate flags
- **WHEN** `reconciliarHistorial(items, 12, now, gastosPorDocumento)` is called
- **THEN** the result MUST contain `advertencias: []`
