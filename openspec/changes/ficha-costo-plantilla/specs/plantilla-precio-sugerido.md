# Ficha de Costo — Plantilla Precio Sugerido

## Purpose

Especificación para el cálculo, sugerencia y aplicación explícita del precio de venta basado en la plantilla activa de un producto.

## Requirements

### Requirement: Calcular precio sugerido desde plantilla activa

The system MUST calculate the suggested selling price from the active template using the formula `costoTotal / (1 - margenObjetivo)`.

#### Scenario: Plantilla activa con margen objetivo 30%

- GIVEN product `P` has an active template `T`
- AND `T.costoTotal` is `70.00`
- AND `T.margenObjetivo` is `0.30`
- WHEN the system calculates the suggested price for `P`
- THEN the result MUST be `70.00 / (1 - 0.30) = 100.00`

#### Scenario: Plantilla activa con margen objetivo 0%

- GIVEN product `P` has an active template `T`
- AND `T.costoTotal` is `50.00`
- AND `T.margenObjetivo` is `0.00`
- WHEN the system calculates the suggested price for `P`
- THEN the result MUST be `50.00 / (1 - 0.00) = 50.00`

#### Scenario: Sin plantilla activa

- GIVEN product `P` has no active template
- WHEN the system attempts to calculate the suggested price for `P`
- THEN the system MUST return `null` (or an explicit error indicating no active template)
- AND MUST NOT throw an unhandled exception

### Requirement: Comparar precio sugerido contra precio de venta actual

The system SHOULD allow comparing the suggested price against the current `Producto.precioVenta` to show a delta.

#### Scenario: Comparar precio sugerido vs precioVenta actual — delta positivo

- GIVEN product `P` has `precioVenta: 80.00`
- AND the active template yields `precioSugerido: 100.00`
- WHEN the system computes the comparison
- THEN the delta MUST be `+20.00` (or `+25%`)
- AND the UI SHOULD indicate that the current price is below the suggested price

#### Scenario: Comparar precio sugerido vs precioVenta actual — delta negativo

- GIVEN product `P` has `precioVenta: 120.00`
- AND the active template yields `precioSugerido: 100.00`
- WHEN the system computes the comparison
- THEN the delta MUST be `-20.00` (or `-16.67%`)
- AND the UI SHOULD indicate that the current price is above the suggested price

#### Scenario: Comparar cuando precioVenta es null o cero

- GIVEN product `P` has `precioVenta: null` (or `0`)
- AND the active template yields `precioSugerido: 100.00`
- WHEN the system computes the comparison
- THEN the delta MUST be `null` or `undefined`
- AND the UI SHOULD display "Sin precio de venta configurado"

### Requirement: Aplicar precio sugerido explícitamente

The system MUST allow explicitly applying the suggested price to `Producto.precioVenta` as a separate, intentional action.

#### Scenario: Aplicar precio sugerido a Producto.precioVenta exitosamente

- GIVEN product `P` has `precioVenta: 80.00`
- AND an active template `T` with `precioSugerido: 100.00`
- WHEN an authorized user explicitly invokes "Aplicar precio sugerido"
- THEN `P.precioVenta` MUST be updated to `100.00`
- AND the system MUST log the change with `previousValue: 80.00`, `newValue: 100.00`, `source: "template-applied"`
- AND the system MUST return the updated product

#### Scenario: Aplicar precio sugerido sin cambio real

- GIVEN product `P` has `precioVenta: 100.00`
- AND an active template `T` with `precioSugerido: 100.00`
- WHEN an authorized user invokes "Aplicar precio sugerido"
- THEN the system MAY skip the database update
- AND MUST return the product unchanged
- AND MUST NOT create an audit log entry

#### Scenario: Aplicar precio sugerido sin plantilla activa

- GIVEN product `P` has no active template
- WHEN a user attempts to apply the suggested price
- THEN the system MUST reject the operation
- AND return an error with code `NO_ACTIVE_TEMPLATE`

#### Scenario: Usuario sin permisos intenta aplicar precio sugerido

- GIVEN a user without the `products:edit-price` permission
- WHEN the user attempts to apply the suggested price to any product
- THEN the system MUST reject the operation with a `403 Forbidden` response
- AND `Producto.precioVenta` MUST remain unchanged

## Non-Functional Requirements

- The suggested price calculation MUST use decimal arithmetic to avoid floating-point errors.
- The apply operation MUST be idempotent: applying the same suggested price multiple times MUST NOT produce side effects beyond the first successful application.
- Audit log entries for price changes MUST include the `templateId` that originated the suggestion.
- The comparison endpoint SHOULD be cacheable for a short TTL (e.g., 30 seconds) if called frequently.
