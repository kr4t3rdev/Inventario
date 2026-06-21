# Spec: ventas-trazabilidad-ui

## Purpose

Client component that renders a product's sales table with FIFO cost traceability, real margin per sale, date range filters, pagination, and an aggregated profitability summary.

## Requirements

### Requirement: Sales Table Rendering

The component SHALL render a table displaying each sale with columns: Fecha, Cliente, Cantidad, Precio Unitario, Ingreso, Costo Real, Margen, Margen %.

#### Scenario: Table with sales data

- GIVEN a product with 3 sales returned by `getVentasProductoAction`
- AND the sales data includes: fecha, clienteNombre, cantidad, precioUnitario, ingreso, costoFifo, margen, margenPorcentaje
- WHEN the `VentasTrazabilidad` component is rendered with `productoId`
- THEN the table SHALL display exactly 3 rows (one per sale)
- AND each row SHALL show the sale's date formatted as date string
- AND each row SHALL show `clienteNombre`
- AND each row SHALL show `cantidad`
- AND each row SHALL show `precioUnitario` formatted as currency
- AND each row SHALL show `ingreso` formatted as currency
- AND each row SHALL show `costoFifo` formatted as currency
- AND each row SHALL show `margen` formatted as currency
- AND each row SHALL show `margenPorcentaje` formatted as percentage

#### Scenario: Margin badge coloring

- GIVEN a sale with `margenPorcentaje = 35` (above 20%)
- AND a sale with `margenPorcentaje = 12` (between 0% and 20%)
- AND a sale with `margenPorcentaje = -5` (negative margin / loss)
- WHEN the component is rendered
- THEN the first sale's margin badge SHALL be styled green (margin > 20%)
- AND the second sale's margin badge SHALL be styled yellow (0% <= margin <= 20%)
- AND the third sale's margin badge SHALL be styled red (margin < 0%, indicating loss)

#### Scenario: Legacy sale indicator

- GIVEN a sale with `tieneAllocaciones = false` (fallback cost was used)
- WHEN the component is rendered
- THEN the component SHALL visually indicate that the cost is estimated (not FIFO)
- AND the indication SHALL be non-intrusive (e.g., an asterisk, tooltip, or subtle badge)

### Requirement: Profitability Summary

The component SHALL display an aggregated summary section with key profitability metrics.

#### Scenario: Summary with sales data

- GIVEN `getVentasProductoAction` returns `resumen` with: cantidadTotalVendida=50, ingresoTotal=25000, costoTotal=18000, margenTotal=7000, margenPromedio=28, totalVentas=15
- WHEN the `VentasTrazabilidad` component is rendered
- THEN the summary section SHALL display "Total vendido" = 50 (quantity)
- AND the summary section SHALL display "Ingreso total" = 25000 (formatted as currency)
- AND the summary section SHALL display "Costo total" = 18000 (formatted as currency)
- AND the summary section SHALL display "Margen total" = 7000 (formatted as currency)
- AND the summary section SHALL display "Margen promedio" = 28% (formatted as percentage)

#### Scenario: Summary with zero values

- GIVEN `getVentasProductoAction` returns `resumen` with all values = 0
- WHEN the component is rendered
- THEN the summary section SHALL display all metrics as 0 or "0.00"
- AND the component SHALL NOT throw errors or display NaN

### Requirement: Empty State

The component SHALL display a meaningful message when the product has no sales.

#### Scenario: No sales for product

- GIVEN `getVentasProductoAction` returns `items: []` and `resumen.totalVentas = 0`
- WHEN the `VentasTrazabilidad` component is rendered
- THEN the component SHALL display the message "No hay ventas registradas para este producto"
- AND the table SHALL NOT be rendered
- AND the summary section SHALL NOT be rendered (or show all zeros)

### Requirement: Date Range Filters

The component SHALL provide date range filter inputs that trigger data refetch.

#### Scenario: User applies date range filter

- GIVEN the component is rendered with initial data (no filters)
- AND the user sets `fechaDesde = "2026-01-01"` and `fechaHasta = "2026-03-31"`
- WHEN the user triggers the filter (e.g., clicks "Filtrar" or presses Enter)
- THEN the component SHALL call `getVentasProductoAction` with the new date parameters
- AND the component SHALL reset `page` to `1`
- AND the table SHALL update to show only filtered results
- AND the summary SHALL update to reflect filtered data

#### Scenario: User clears date filters

- GIVEN the component has active date filters applied
- WHEN the user clears both date inputs
- AND triggers the filter
- THEN the component SHALL call `getVentasProductoAction` without date parameters
- AND the table SHALL show all sales (unfiltered by date)
- AND the page SHALL reset to `1`

#### Scenario: Date filter with no matching results

- GIVEN the component has active date filters
- AND no sales exist within the selected range
- WHEN the filter is applied
- THEN the component SHALL display "No hay ventas registradas para este producto" (empty state)
- AND the summary SHALL show all zeros

### Requirement: Pagination Controls

The component SHALL provide pagination controls to navigate through sales pages.

#### Scenario: Navigate to next page

- GIVEN the component is showing page 1 of 5 (total 100 sales, limit 20)
- AND the "Next" button is enabled
- WHEN the user clicks the "Next" (ChevronRight) button
- THEN the component SHALL call `getVentasProductoAction` with `page: 2`
- AND the table SHALL update to show items 21-40
- AND the summary SHALL remain consistent (aggregated over all 100 sales)

#### Scenario: Navigate to previous page

- GIVEN the component is showing page 3 of 5
- AND the "Previous" button is enabled
- WHEN the user clicks the "Previous" (ChevronLeft) button
- THEN the component SHALL call `getVentasProductoAction` with `page: 2`
- AND the table SHALL update to show items 21-40

#### Scenario: Previous button disabled on first page

- GIVEN the component is showing page 1
- WHEN the component is rendered
- THEN the "Previous" (ChevronLeft) button SHALL be disabled

#### Scenario: Next button disabled on last page

- GIVEN the component is showing page 5 of 5 (last page)
- WHEN the component is rendered
- THEN the "Next" (ChevronRight) button SHALL be disabled

#### Scenario: Pagination resets on filter change

- GIVEN the component is on page 3 with no filters
- WHEN the user applies a date filter
- THEN the page SHALL reset to 1
- AND the pagination controls SHALL reflect the new filtered page count

### Requirement: Loading State

The component SHALL display a loading indicator while data is being fetched.

#### Scenario: Initial data load

- GIVEN the component has just mounted
- AND `getVentasProductoAction` has not yet returned
- WHEN the component renders
- THEN a loading spinner or skeleton SHALL be displayed
- AND the table SHALL NOT be rendered until data arrives

#### Scenario: Loading after filter change

- GIVEN the component has loaded initial data
- WHEN the user changes a filter or page
- THEN a loading indicator SHALL be shown while the new data is fetched
- AND the previous data SHALL remain visible (or be replaced by skeleton) until new data arrives

### Requirement: Error State

The component SHALL handle and display errors gracefully.

#### Scenario: Server Action returns error

- GIVEN `getVentasProductoAction` returns `{ success: false, error: { message: "Producto no encontrado", code: "NOT_FOUND" } }`
- WHEN the component receives the response
- THEN the component SHALL display an error message to the user
- AND the error display SHALL use an alert or toast component
- AND the table SHALL NOT be rendered

#### Scenario: Network error

- GIVEN the network request to the Server Action fails (e.g., timeout, connectivity issue)
- WHEN the component catches the error
- THEN the component SHALL display a generic error message (e.g., "Error al cargar las ventas")
- AND the component SHALL NOT crash or display a blank screen

### Requirement: Data Fetching on Mount

The component SHALL fetch sales data automatically when mounted with a valid `productoId`.

#### Scenario: Component mounts with valid productoId

- GIVEN the `VentasTrazabilidad` component receives `productoId = "P-001"`
- WHEN the component mounts
- THEN the component SHALL call `getVentasProductoAction({ productoId: "P-001" })`
- AND upon success, the component SHALL render the table with returned items
- AND upon success, the component SHALL render the summary with returned data

### Requirement: Currency and Number Formatting

The component SHALL format all monetary values and percentages consistently.

#### Scenario: Formatted values in table

- GIVEN a sale item with `ingreso = 1500.50`, `costoFifo = 980.25`, `margen = 520.25`, `margenPorcentaje = 34.68`
- WHEN the component renders the row
- THEN `ingreso` SHALL be displayed as a currency-formatted string (e.g., "$1,500.50")
- AND `costoFifo` SHALL be displayed as a currency-formatted string (e.g., "$980.25")
- AND `margen` SHALL be displayed as a currency-formatted string (e.g., "$520.25")
- AND `margenPorcentaje` SHALL be displayed as a percentage (e.g., "34.68%")
