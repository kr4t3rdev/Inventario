# Transferencias Server-First — Delta Spec

## Requirements

### Requirement 1: El reporte de movimientos MUST no depender de RTK Query para transferencias
The report of movements MUST obtain transferencias data through a server-first source. The component MUST NOT call `useGetTransferenciasQuery`.

#### Scenario: Render de reporte sin query cliente
- GIVEN un usuario abre el reporte de movimientos
- WHEN la sección de transferencias se renderiza
- THEN el componente MUST mostrar los datos de transferencias resueltos desde servidor
- AND MUST preserve the same agrupación, filtros y exportación existentes

### Requirement 2: El formulario de transferencias MUST resolver el stock por ubicación sin RTK Query
The transfer form MUST obtain location stock using server-side data access or server actions. The component MUST NOT depend on `useGetStockPorUbicacionQuery`.

#### Scenario: Selección de producto con stock de origen
- GIVEN un usuario abre el formulario de nueva transferencia
- WHEN selecciona un origen y un tipo de ubicación
- THEN the form MUST show the stock disponible calculated from server-resolved data
- AND the validation MUST continue to reject cantidades mayores al stock disponible

### Requirement 3: The main transfer listing MUST remain server-first
The listing page and edit page MUST continue to hydrate from server actions instead of RTK Query.

#### Scenario: Carga inicial de listado
- GIVEN un usuario abre `/busy/transferencias`
- WHEN the page renders
- THEN the server MUST resolve the initial transfer list before sending the page response
- AND the client wrapper MUST receive the initial data through props

### Requirement 4: The cancel flow MUST preserve cache invalidation semantics through server revalidation
Server-side mutations MUST continue to revalidate the transfer listing path after state changes.

#### Scenario: Cancelar una transferencia
- GIVEN una transferencia cancelable
- WHEN the user confirms cancellation
- THEN the server MUST cancel it through the action
- AND MUST revalidate `/busy/transferencias`
- AND MUST not require RTK Query invalidation to refresh the list

### Requirement 5: The residual RTK slice MUST become dead code only after all consumers are removed
`transferenciasApi.ts` MUST remain available until the migration removes the last consumer. After that, the slice MAY be deleted in a follow-up cleanup.

#### Scenario: Último consumidor removido
- GIVEN no components import transferencias hooks
- WHEN the codebase is scanned for transferencias RTK hooks
- THEN the slice MUST have no active consumers
- AND a cleanup change MAY delete the file safely
