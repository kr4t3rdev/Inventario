# Ficha de Costo — Plantilla UI

## Purpose

Especificación para la interfaz de usuario que muestra la plantilla activa, lista versiones, compara contra la ficha actual, y permite aplicar el precio sugerido.

## Requirements

### Requirement: Mostrar plantilla activa con desglose de costos

The UI MUST display the active template for a product with a clear breakdown of cost components.

#### Scenario: Mostrar plantilla activa con todos los componentes

- GIVEN the user is viewing the "Plantilla" tab for product `P`
- AND `P` has an active template `T` with:
  - `materiales: [{nombre: "Madera", cantidad: 2, costoUnitario: 5.00, subtotal: 10.00}]`
  - `manoObra: 15.00`
  - `indirectos: 5.00`
  - `margenObjetivo: 0.30`
  - `costoTotal: 30.00`
  - `precioSugerido: 42.86`
- WHEN the tab renders
- THEN the UI MUST show:
  - A section "Materiales" listing each material with cantidad, costoUnitario, and subtotal
  - A line item "Mano de obra" with `15.00`
  - A line item "Indirectos" with `5.00`
  - A summary "Costo total" with `30.00`
  - A line "Margen objetivo" with `30%`
  - A highlighted "Precio sugerido" with `42.86`

#### Scenario: Mostrar plantilla activa sin materiales

- GIVEN the user is viewing the "Plantilla" tab for product `P`
- AND `P` has an active template with `materiales: []`
- WHEN the tab renders
- THEN the "Materiales" section MUST display "No hay materiales configurados"
- AND the rest of the cost breakdown MUST still render correctly

### Requirement: Listar versiones con acción de activar

The UI MUST list all template versions for the product and allow activating a non-active version.

#### Scenario: Listar versiones con botón "Activar"

- GIVEN product `P` has three templates:
  - `T1` (v1, active)
  - `T2` (v2, inactive)
  - `T3` (v3, inactive)
- WHEN the versions list renders
- THEN the list MUST show v1, v2, v3 ordered by version descending (v3 first)
- AND the active version MUST have a green "Activa" badge
- AND each inactive version MUST have a button labeled "Activar"
- AND clicking "Activar" for v2 MUST trigger a confirmation dialog
- AND upon confirmation, v2 MUST become active and v1 MUST become inactive

#### Scenario: Versión activa no tiene botón "Activar"

- GIVEN the versions list includes the currently active version
- WHEN the row for the active version renders
- THEN the "Activar" button MUST be hidden or disabled
- AND the row MUST be visually highlighted (e.g., bolder text or background)

### Requirement: Comparar ficha actual vs plantilla activa

The UI SHOULD display a comparison between the on-demand cost sheet (ficha actual) and the active template.

#### Scenario: Comparar costo plantilla vs costo real vs precioVenta

- GIVEN the Resumen de Costo view is open for product `P`
- AND the on-demand ficha actual yields `costoReal: 32.00`
- AND the active template yields `costoTotal: 30.00` and `precioSugerido: 42.86`
- AND `P.precioVenta` is `45.00`
- WHEN the comparison card renders
- THEN the UI MUST show:
  - "Costo real (ficha actual)": `32.00`
  - "Costo plantilla": `30.00`
  - "Diferencia de costo": `-2.00` (or an indicator that real is higher)
  - "Precio de venta actual": `45.00`
  - "Precio sugerido": `42.86`
  - "Diferencia de precio": `+2.14` (or an indicator that current is above suggestion)

#### Scenario: No hay plantilla activa para comparar

- GIVEN the Resumen de Costo view is open for product `P`
- AND `P` has no active template
- WHEN the comparison section renders
- THEN the comparison card MUST show the empty state (see below)
- AND the on-demand ficha actual MUST still be displayed normally

### Requirement: Botón "Aplicar precio sugerido" con control de permisos

The UI MUST conditionally show the "Aplicar precio sugerido" button based on user role.

#### Scenario: Botón visible solo para managers

- GIVEN a manager user is viewing the Plantilla tab
- AND an active template with `precioSugerido: 42.86` exists
- AND `Producto.precioVenta` is `80.00`
- THEN the button "Aplicar precio sugerido" MUST be visible and enabled

#### Scenario: Botón oculto para usuarios no managers

- GIVEN a non-manager user (e.g., viewer or clerk) is viewing the Plantilla tab
- AND an active template exists
- THEN the button "Aplicar precio sugerido" MUST NOT be rendered
- OR MUST be rendered in a disabled state with a tooltip explaining insufficient permissions

#### Scenario: Precio sugerido igual a precioVenta actual

- GIVEN the active template's `precioSugerido` equals `Producto.precioVenta`
- WHEN the Plantilla tab renders
- THEN the "Aplicar precio sugerido" button MAY be disabled
- AND a message "El precio actual ya coincide con la sugerencia" SHOULD be shown

### Requirement: Empty state cuando no hay plantilla

The UI MUST provide a clear empty state when no template is configured.

#### Scenario: Empty state — "No hay plantilla configurada"

- GIVEN product `P` has zero templates
- WHEN the user navigates to the "Plantilla" tab
- THEN the UI MUST display:
  - An illustration or icon indicating empty state
  - The text "No hay plantilla configurada"
  - A subtitle "Crea una plantilla para calcular precios sugeridos"
  - A primary button "Crear plantilla" that navigates to or opens the creation flow

#### Scenario: Empty state en resumen cuando no hay plantilla activa

- GIVEN product `P` has templates but none is active
- WHEN the Resumen de Costo comparison section renders
- THEN the UI MUST display:
  - "No hay plantilla activa"
  - A link or button to the "Plantilla" tab to activate a version

## Non-Functional Requirements

- The "Plantilla" tab MUST lazy-load its content to avoid blocking the main ficha-costo view.
- All monetary values MUST be formatted with the tenant's configured currency and locale.
- The "Activar" confirmation dialog MUST include a warning that this will replace the current active template.
- The comparison card SHOULD update in real-time or near-real-time when the user modifies the on-demand ficha (if feasible within the same view session).
