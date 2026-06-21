# Spec: ventas-producto-action

## Purpose

Server Action that returns a product's sales history with FIFO cost traceability, computing real cost from `PurchaseAllocation` and real margin per sale.

## Requirements

### Requirement: FIFO Cost Calculation per Sale

The system SHALL calculate the real cost (`costoFifo`) of each `VentaItem` by invoking `calcularCostoVenta()` with the item's `PurchaseAllocation` records. Each allocation contributes `cantidad × precioUnitario` from the linked `CompraDocumentoItem`.

#### Scenario: Sale with complete FIFO allocations

- GIVEN a product "P-001" belonging to tenant "T-A"
- AND the product has 3 `VentaItem` records (VI-1, VI-2, VI-3) across 3 different sales
- AND VI-1 has 2 allocations: (cantidad=5, precioUnitario=100) and (cantidad=3, precioUnitario=120)
- AND VI-2 has 1 allocation: (cantidad=10, precioUnitario=110)
- AND VI-3 has 3 allocations: (cantidad=2, precioUnitario=90), (cantidad=4, precioUnitario=95), (cantidad=1, precioUnitario=100)
- WHEN `getVentasProductoAction({ productoId: "P-001" })` is called by an authenticated user of tenant "T-A"
- THEN the response SHALL contain `items` array with 3 elements
- AND VI-1's `costoFifo` SHALL equal `(5 × 100) + (3 × 120) = 860`
- AND VI-2's `costoFifo` SHALL equal `(10 × 110) = 1100`
- AND VI-3's `costoFifo` SHALL equal `(2 × 90) + (4 × 95) + (1 × 100) = 660`
- AND each item's `tieneAllocaciones` SHALL be `true`
- AND each item's `margen` SHALL equal `ingreso - costoFifo`
- AND each item's `margenPorcentaje` SHALL equal `(margen / ingreso) × 100`

#### Scenario: Sale with partial allocations (legacy fallback)

- GIVEN a product "P-002" belonging to tenant "T-A" with `precioCosto = 80`
- AND the product has 2 `VentaItem` records: VI-1 and VI-2
- AND VI-1 has 1 allocation: (cantidad=5, precioUnitario=70)
- AND VI-2 has NO allocations (legacy sale)
- WHEN `getVentasProductoAction({ productoId: "P-002" })` is called
- THEN VI-1's `costoFifo` SHALL equal `(5 × 70) = 350` and `tieneAllocaciones = true`
- AND VI-2's `costoFifo` SHALL equal `producto.precioCosto × cantidad` (fallback) and `tieneAllocaciones = false`

### Requirement: Client Name Resolution

The system SHALL resolve and return the client name for each sale. If the sale has no associated client, the system SHALL return `'Cliente genérico'`.

#### Scenario: Sales with multiple clients

- GIVEN a product with 3 sales: Sale-1 linked to client "Juan Pérez", Sale-2 linked to client "María López", Sale-3 with no client
- WHEN `getVentasProductoAction({ productoId })` is called
- THEN the response items SHALL include `clienteNombre` for each sale
- AND Sale-1's item SHALL have `clienteNombre = "Juan Pérez"`
- AND Sale-2's item SHALL have `clienteNombre = "María López"`
- AND Sale-3's item SHALL have `clienteNombre = "Cliente genérico"`

### Requirement: Date Range Filtering

The system SHALL filter sales by optional `fechaDesde` and `fechaHasta` date parameters. The filter SHALL be applied against `venta.createdAt`.

#### Scenario: Sales within date range

- GIVEN a product with 5 sales created on dates: 2026-01-15, 2026-02-10, 2026-03-05, 2026-04-20, 2026-05-12
- WHEN `getVentasProductoAction({ productoId, fechaDesde: "2026-02-01", fechaHasta: "2026-04-30" })` is called
- THEN the response SHALL contain exactly 3 items (sales from Feb, Mar, Apr)
- AND all returned items SHALL have `fecha` within the range [2026-02-01, 2026-04-30]

#### Scenario: Only fechaDesde provided

- GIVEN a product with sales across multiple months
- WHEN `getVentasProductoAction({ productoId, fechaDesde: "2026-03-01" })` is called
- THEN the response SHALL contain only sales with `fecha >= "2026-03-01"`

#### Scenario: Only fechaHasta provided

- GIVEN a product with sales across multiple months
- WHEN `getVentasProductoAction({ productoId, fechaHasta: "2026-03-31" })` is called
- THEN the response SHALL contain only sales with `fecha <= "2026-03-31"`

### Requirement: Pagination

The system SHALL paginate results using `page` (default: 1) and `limit` (default: 20, max: 100) parameters. The response SHALL include pagination metadata.

#### Scenario: Paginated sales (page 2, limit 10)

- GIVEN a product with 25 non-deleted sales
- WHEN `getVentasProductoAction({ productoId, page: 2, limit: 10 })` is called
- THEN the response SHALL contain exactly 10 items in `items`
- AND `pagination.page` SHALL equal `2`
- AND `pagination.limit` SHALL equal `10`
- AND `pagination.total` SHALL equal `25`
- AND `pagination.totalPages` SHALL equal `3`

#### Scenario: Default pagination

- GIVEN a product with 5 sales
- WHEN `getVentasProductoAction({ productoId })` is called without page/limit
- THEN the response SHALL use `page = 1`, `limit = 20`
- AND all 5 items SHALL be returned
- AND `pagination.total` SHALL equal `5`

#### Scenario: Limit exceeds maximum

- GIVEN a product with sales
- WHEN `getVentasProductoAction({ productoId, limit: 200 })` is called
- THEN the system SHALL cap `limit` to `100`
- AND `pagination.limit` SHALL equal `100`

### Requirement: Multi-Tenant Isolation

The system SHALL enforce strict tenant isolation. A product belonging to a different tenant SHALL NOT be accessible.

#### Scenario: Product from another tenant

- GIVEN an authenticated user of tenant "T-A"
- AND a product "P-999" belonging to tenant "T-B"
- WHEN `getVentasProductoAction({ productoId: "P-999" })` is called
- THEN the response SHALL be an error with code `NOT_FOUND`
- AND the error message SHALL be `'Producto no encontrado'` (opaque, does not reveal existence)

#### Scenario: Unauthenticated call

- GIVEN no authenticated user
- WHEN `getVentasProductoAction({ productoId })` is called
- THEN the `withAction` wrapper SHALL reject the call with an authentication error

### Requirement: Empty Sales Result

The system SHALL return a valid empty result for products with no sales.

#### Scenario: Product with no sales

- GIVEN a product "P-003" belonging to tenant "T-A" with zero `VentaItem` records
- WHEN `getVentasProductoAction({ productoId: "P-003" })` is called
- THEN the response SHALL contain `items: []`
- AND `resumen.cantidadTotalVendida` SHALL equal `0`
- AND `resumen.ingresoTotal` SHALL equal `0`
- AND `resumen.costoTotal` SHALL equal `0`
- AND `resumen.margenTotal` SHALL equal `0`
- AND `resumen.margenPromedio` SHALL equal `0`
- AND `resumen.totalVentas` SHALL equal `0`
- AND `pagination.total` SHALL equal `0`

### Requirement: Soft-Delete Exclusion

The system SHALL exclude soft-deleted sales from results.

#### Scenario: Mix of active and deleted sales

- GIVEN a product with 4 `VentaItem` records: 3 linked to active sales (`deletedAt: null`) and 1 linked to a soft-deleted sale (`deletedAt: "2026-01-15"`)
- WHEN `getVentasProductoAction({ productoId })` is called
- THEN the response SHALL contain exactly 3 items
- AND no item SHALL reference the soft-deleted sale

### Requirement: Aggregated Summary

The system SHALL compute an aggregated summary (`resumen`) over ALL matching sales (not just the current page).

#### Scenario: Summary reflects total dataset, not just current page

- GIVEN a product with 50 sales (total ingreso = 25000, total costo FIFO = 18000)
- WHEN `getVentasProductoAction({ productoId, page: 1, limit: 10 })` is called
- THEN `resumen.cantidadTotalVendida` SHALL reflect the sum across all 50 sales
- AND `resumen.ingresoTotal` SHALL equal `25000`
- AND `resumen.costoTotal` SHALL equal `18000`
- AND `resumen.margenTotal` SHALL equal `7000`
- AND `resumen.margenPromedio` SHALL equal `(7000 / 25000) × 100 = 28`
- AND `resumen.totalVentas` SHALL equal `50`

### Requirement: Sales Ordering

The system SHALL return sales ordered by `venta.createdAt` in descending order (newest first).

#### Scenario: Chronological ordering

- GIVEN a product with sales created on 2026-01-01, 2026-03-15, 2026-02-10
- WHEN `getVentasProductoAction({ productoId })` is called
- THEN `items[0]` SHALL correspond to the sale from 2026-03-15
- AND `items[1]` SHALL correspond to the sale from 2026-02-10
- AND `items[2]` SHALL correspond to the sale from 2026-01-01
