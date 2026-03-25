# GastosDE Specification

## Purpose

Specification for managing GastosDE (DE Expenses) which are service-based expenses that are not associated with products. These expenses represent amounts and values like rent, maintenance, telephony, etc., and may or may not have associated invoices. The system needs to track these expenses for financial management and reconciliation purposes.

## Requirements

### Requirement: GastosDE Creation

The system MUST allow creation of GastosDE records with the following fields:
- Amount (required, positive number)
- Description/Concept (required, text)
- Invoice number (optional, text)
- Provider (required for tracking service providers)
- Date (required, date of expense)

#### Scenario: Create GastosDE with Invoice

- GIVEN user is on the GastosDE management form
- WHEN user fills in amount ($5000.00), description ("Arrendamiento de Oficina"), invoice number ("INV-001"), selects a provider ("Arrendador ABC"), and sets date to today
- AND user submits the form
- THEN the system creates a new GastosDE record with all provided information
- AND the system shows a success message
- AND the new GastosDE appears in the Gastos pendientes table

#### Scenario: Create GastosDE without Invoice

- GIVEN user is on the GastosDE management form
- WHEN user fills in amount ($360.00), description ("Servicio Telefónico Mensual"), leaves invoice number empty, selects a provider ("TelCo"), and sets date to today
- AND user submits the form
- THEN the system creates a new GastosDE record with the provided information and empty invoice number
- AND the system shows a success message
- AND the new GastosDE appears in the Gastos pendientes table

#### Scenario: Validation - Required Amount

- GIVEN user is on the GastosDE management form
- WHEN user leaves amount field empty or enters zero/negative value
- AND user attempts to submit the form
- THEN the system shows validation error: "El monto debe ser mayor a 0"
- AND the form is not submitted

#### Scenario: Validation - Required Description

- GIVEN user is on the GastosDE management form
- WHEN user leaves description field empty
- AND user attempts to submit the form
- THEN the system shows validation error: "La descripción es requerida"
- AND the form is not submitted

#### Scenario: Validation - Required Provider

- GIVEN user is on the GastosDE management form
- WHEN user leaves provider field empty
- AND user attempts to submit the form
- THEN the system shows validation error: "El proveedor es requerido"
- AND the form is not submitted

### Requirement: GastosDE Listing and Filtering

The system MUST display GastosDE records in a table with filtering capabilities.

#### Scenario: View GastosDE List

- GIVEN there are existing GastosDE records in the system
- WHEN user navigates to the GastosDE management section
- THEN the system displays a table showing all GastosDE records
- AND each record shows: amount, description, invoice number (or "Sin factura" if empty), provider, and date
- AND the table is sorted by date descending (newest first)

#### Scenario: Filter GastosDE by Provider

- GIVEN there are GastosDE records from multiple providers
- WHEN user selects a specific provider from the filter dropdown
- AND user applies the filter
- THEN the system displays only GastosDE records from the selected provider
- AND the filter maintains state until changed or cleared

#### Scenario: Filter GastosDE by Date Range

- GIVEN there are GastosDE records across different dates
- WHEN user specifies a start date and end date in the date filter
- AND user applies the filter
- THEN the system displays only GastosDE records within the specified date range (inclusive)
- AND records outside the date range are hidden

### Requirement: GastosDE Editing

The system MUST allow editing of existing GastosDE records.

#### Scenario: Edit GastosDE with Invoice

- GIVEN there is an existing GastosDE record without an invoice number
- WHEN user clicks the edit button on that record
- AND user adds an invoice number ("INV-002") to the form
- AND user saves the changes
- THEN the system updates the GastosDE record with the new invoice number
- AND the system shows a success message
- AND the updated record shows the invoice number in the list

#### Scenario: Edit GastosDE Amount

- GIVEN there is an existing GastosDE record with amount $1000.00
- WHEN user edits the amount to $1500.00
- AND user saves the changes
- THEN the system updates the GastosDE record with the new amount
- AND the system shows a success message
- AND the updated record shows the new amount in the list

### Requirement: GastosDE Deletion

The system MUST allow deletion of GastosDE records with confirmation.

#### Scenario: Delete GastosDE

- GIVEN there is an existing GastosDE record
- WHEN user clicks the delete button on that record
- AND user confirms the deletion in the confirmation dialog
- THEN the system removes the GastosDE record from the database
- AND the system shows a success message
- AND the record no longer appears in the Gastos pendientes table

#### Scenario: Cancel GastosDE Deletion

- GIVEN there is an existing GastosDE record
- WHEN user clicks the delete button on that record
- AND user cancels the deletion in the confirmation dialog
- THEN the system does not delete the GastosDE record
- AND the record remains unchanged in the Gastos pendientes table

### Requirement: Integration with Gastos Pendientes Reconciliation

The system MUST ensure GastosDE records properly integrate with the existing gastos pendientes reconciliation workflow.

#### Scenario: GastosDE Appears in Reconciliation

- GIVEN there are GastosDE records created in the system
- WHEN user navigates to the gastos pendientes reconciliation section
- THEN the system includes GastosDE records in the reconciliation view
- AND GastosDE records are identifiable as service-based expenses (not product-based)
- AND the reconciliation process can mark GastosDE as paid/reconciled

#### Scenario: GastosDE Payment Tracking

- GIVEN there is a GastosDE record representing an expense
- WHEN user marks the GastosDE as paid in the reconciliation workflow
- THEN the system updates the GastosDE record status to "paid"
- AND the system records the payment date
- AND the GastosDE no longer appears in pending expenses for reconciliation

## Coverage
- Happy paths: covered
- Edge cases: covered (validation, empty invoices)
- Error states: covered (foreign key constraints handled via validation)

## Next Step
Ready for design (sdd-design).