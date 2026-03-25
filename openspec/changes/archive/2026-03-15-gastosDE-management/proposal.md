# GastosDE Management Enhancement

## User Request
Create a table/form for managing GastosDE (DE Expenses) where expenses are amounts and values, not associated with products. Examples include:
- Arrendamientos de Inmuebles - $5,000.00
- Mantenimiento de Inmuebles - $3,500.00
- Telefonía - $360.00

Some expenses have invoices, others don't - invoice field should be optional.
Keep the provider field due to receiving invoices from service providers that are obligatory to pay.

## Change Name
gastosDE-management

## Affected Areas
- contabilidad/gastosDE API service
- GastosDE model (if extension needed)
- Gastos pendientes table/component
- Financial reconciliation workflow

## Approach
Enhance the existing GastosDE functionality to better support the management of service-based expenses with optional invoice tracking, ensuring proper integration with the existing gastos pendientes reconciliation system.

## Goals
1. Ensure GastosDE properly handles expenses with and without invoices
2. Maintain provider tracking for service-based expenses
3. Integrate seamlessly with existing financial reconciliation workflows
4. Provide clear UI/UX for managing these expense types