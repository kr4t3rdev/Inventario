# Historial Cuadres Turno Specification

## Purpose

Definir la consulta de cuadres de turnos POS cerrados y la reutilización del detalle existente por `turnoId` en modo lectura.

## Requirements

### Requirement: Closed turn history listing

The system MUST provide a history view for POS shifts whose `TurnoPuntoVenta.estado` is `CERRADO`, using existing turno, arqueo, and venta data without creating a new snapshot model for this capability.

#### Scenario: List closed shifts with minimum settlement data

- GIVEN closed POS shifts exist for the tenant
- WHEN the user opens the settlement history view
- THEN the system shows one row per closed shift
- AND each row includes, at minimum, point of sale, opening or closing date, employee when available, sales total, and settlement status or difference derived from the latest arqueo

#### Scenario: Exclude active shifts from history

- GIVEN a POS shift is still `ABIERTO`
- WHEN the history view is loaded
- THEN that shift is not listed as a closed settlement entry

### Requirement: Read-only access to closed shift settlement detail

The system MUST allow the user to open the existing settlement detail page by `turnoId` for a closed shift, and MUST present it in read-only mode.

#### Scenario: Open existing detail from history

- GIVEN a row in the closed-shift history
- WHEN the user selects the view-detail action
- THEN the system navigates to the existing settlement route for that `turnoId`
- AND the detail resolves using the existing turno and arqueo sources for that shift

#### Scenario: Disable mutating actions for closed shifts

- GIVEN the opened settlement detail belongs to a shift whose state is `CERRADO`
- WHEN the detail page finishes loading
- THEN the system hides or disables close-shift and repeat-arqueo actions
- AND the page communicates that the shift is being viewed in consultation mode

### Requirement: Historical data boundary

The system MUST treat the current MVP as a consultation feature, and SHOULD NOT claim immutable historical inventory reconstruction when the detail is derived from mutable current stock sources.

#### Scenario: Document mutable inventory limitation

- GIVEN product-level remaining stock in the detail is reconstructed from current stock sources
- WHEN the team reviews this capability
- THEN the specification records that no inventory snapshot is introduced in this change
- AND any future requirement for exact historical stock reconstruction is handled as a separate change
