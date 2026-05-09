# Delta: Dashboard Server-First Migration Phase 2

## ADDED Requirements

### Requirement: Dashboard route uses server-first composition

La ruta `/busy/dashboard` DEBE usar una composición server-first con fetch principal en servidor y client boundaries mínimos para interactividad real.

#### Scenario: Dashboard page fetches stats on the server

- GIVEN un usuario navega a `/busy/dashboard`
- WHEN la ruta se renderiza
- THEN el dashboard DEBE obtener `dashboardStats` desde la fuente server actual una sola vez en el nivel page/wrapper
- AND DEBE distribuir slices serializables a los widgets hijos
- AND NO DEBE hacer fetch client-side por widget

#### Scenario: Client boundaries are narrow

- GIVEN widgets que requieren charts o motion interactivo
- WHEN se define el boundary del componente
- THEN solo esos widgets PUEDEN ser `'use client'`
- AND el motivo DEBE ser charting, hover/tooltips, o motion interactivo
- AND el fetch de datos NO DEBE ser la razón para marcar `'use client'`

### Requirement: Dashboard widgets are restored under the feature module

Los widgets del dashboard DEBEN vivir bajo `src/features/dashboard/components/` y reemplazar los imports legacy eliminados.

#### Scenario: Legacy deleted widget imports are removed

- GIVEN que `page.tsx` referenciaba widgets borrados desde `@/components/*`
- WHEN la migración termina
- THEN el dashboard NO DEBE importar `section-cards`, `chart-area-interactive`, `top-products-table`, `stock-distribution-chart` ni `transferencias-stats` desde rutas legacy borradas
- AND DEBE importar los widgets válidos desde el feature dashboard

#### Scenario: Widget set is restored with correct boundaries

- GIVEN el dashboard principal
- WHEN se reconstruyen sus widgets
- THEN DEBEN existir componentes feature-based para:
  - `section-cards`
  - `chart-area-interactive`
  - `stock-bajo-table`
  - `top-products-table`
  - `stock-distribution-chart`
  - `transferencias-stats`
- AND `chart-area-interactive` y `stock-distribution-chart` PUEDEN ser client islands
- AND los widgets puramente presentacionales DEBEN permanecer server/presentational

### Requirement: Dashboard uses the current verified dashboard stats contract

El dashboard DEBE consumir el shape actual verificado de `getDashboardStatsAction()` sin inventar campos no expuestos por la action.

#### Scenario: Widgets consume current action output

- GIVEN `getDashboardStatsAction()` retorna `totalProductos`, `totalAlmacenes`, `totalPuntosVenta`, `totalVentas`, `totalMermas`, `totalTransferencias`, `totalIngresos`, `totalGastosMermas`, `totalBeneficio`, `valorTotalInventario`, `datosPorMes`, `datosPorSemana`, `ventasDiarias`, `productosMasVendidos`, `productosStockBajo`, `distribucionStock`, `transferenciasStats`
- WHEN el page/wrapper prepara props
- THEN los widgets DEBEN consumir esos campos o adapters derivados de ese mismo shape
- AND NO DEBEN depender de `ventasData`, `ventaItemsData`, `productosDataRaw` ni otros campos internos no expuestos por la action

### Requirement: StockBajoTable stops using useEffect for dashboard fetch

`StockBajoTable` DEBE abandonar el patrón `useEffect() + getDashboardStatsAction()` y pasar a recibir datos server-provided o resolver server-side.

#### Scenario: StockBajoTable renders from server-provided data

- GIVEN `productosStockBajo` ya fue resuelto en el wrapper server
- WHEN `StockBajoTable` renderiza
- THEN DEBE recibir los datos por props o resolverse directamente como server component presentational
- AND NO DEBE disparar fetch en `useEffect()`
- AND NO DEBE mostrar un loading state artificial derivado de ese fetch client-side

### Requirement: Chart widgets preserve dashboard behavior with client islands

Los charts del dashboard DEBEN preservar el comportamiento visual del dashboard usando client islands cuando la librería lo requiera.

#### Scenario: Area chart consumes monthly dashboard points

- GIVEN `datosPorMes` y/o `datosPorSemana`
- WHEN `chart-area-interactive` renderiza
- THEN DEBE consumir esos puntos ya preparados por la capa server
- AND PUEDE usar `recharts` en un componente `'use client'`
- AND NO DEBE volver a consultar dashboard stats por su cuenta

#### Scenario: Stock distribution chart consumes distribution props

- GIVEN `distribucionStock`
- WHEN `stock-distribution-chart` renderiza
- THEN DEBE consumir ese arreglo por props
- AND PUEDE usar `recharts` en cliente
- AND NO DEBE tener dependencia de RTK Query ni fetch client-side propio

## MODIFIED Requirements

### Requirement: Dashboard page layout composition

El dashboard principal DEBE renderizar solo su content area y confiar en el shell de `src/app/busy/layout.tsx`.

#### Scenario: Page does not own shell providers

- GIVEN el layout `busy` ya monta `SidebarProvider`, `SidebarInset`, `SiteHeader` y `AuthProvider`
- WHEN `dashboard/page.tsx` renderiza
- THEN NO DEBE reinstanciar `SidebarProvider` ni `SidebarInset`
- AND DEBE comportarse como contenido hijo del shell ya existente

### Requirement: Widget loading strategy

El dashboard DEBE eliminar los imports legacy rotos y usar una estrategia de importación coherente con server-first.

#### Scenario: Imports are valid and resolvable

- GIVEN el dashboard migrado
- WHEN corre typecheck o la app resuelve módulos
- THEN NO DEBE haber imports a módulos eliminados
- AND las importaciones DEBEN apuntar a archivos reales del feature dashboard

## REMOVED Requirements

### Requirement: Dashboard relies on deleted global widget files

Razón: esas rutas ya no existen y su uso mantiene el dashboard roto.

### Requirement: Dashboard widget data fetch happens in useEffect

Razón: contradice la arquitectura server-first buscada para esta ruta.
