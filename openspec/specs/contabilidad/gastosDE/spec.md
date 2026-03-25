# GastosDE Specification

## Purpose

This specification defines the requirements for managing GastosDE (DE Expenses) in the contabilidad (accounting) module. GastosDE represents expense records that are not directly associated with products but are essential operational costs such as rent, maintenance, utilities, and other service-based expenses. These expenses may or may not have associated invoices and are tracked for financial reconciliation and reporting purposes.

## Requirements

### Requirement: GastosDE Record Creation

The system MUST allow users to create GastosDE records with the following fields:
- tipo (expense type/category)
- proveedor (provider/vendor name) 
- monto (amount, positive number)
- descripcion (description)
- periodo (period, auto-generated from creation date)
- factura (invoice reference - optional)

#### Scenario: Creating a GastosDE with Invoice
- GIVEN the user is on the GastosDE creation form
- WHEN the user fills in amount ($5000.00), description ("Arrendamiento de Oficina"), invoice number ("INV-001"), selects a provider ("Arrendador ABC"), and sets date to today
- AND user submits the form
- THEN the system creates a new GastosDE record with all provided information including the invoice reference
- AND the system shows a success message
- AND the new GastosDE appears in the Gastos pendientes table

#### Scenario: Creating a GastosDE without Invoice
- GIVEN the user is on the GastosDE creation form
- WHEN the user fills in amount ($360.00), description ("Servicio Telefónico Mensual"), leaves invoice number empty, selects a provider ("TelCo"), and sets date to today
- AND user submits the form
- THEN the system creates a new GastosDE record with the provided data and null/empty invoice reference
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

#### Scenario: Filtering GastosDE by Period
- GIVEN there are GastosDE records from different periods
- WHEN the user applies a period filter
- THEN the system SHALL display only GastosDE records matching the selected period
- AND the system SHALL show the total count of filtered records

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

#### Scenario: Updating a GastosDE Record
- GIVEN an existing GastosDE record
- WHEN the user selects the record for editing and modifies one or more fields
- THEN the system SHALL update the record with the new values
- AND the system SHALL preserve the original creation timestamp while updating the modification timestamp
- AND the system SHALL return a success confirmation

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

### Requirement: GastosDE in Financial Reconciliation

The system MUST include GastosDE records in the financial reconciliation workflow.

#### Scenario: GastosDE Appears in Pending Expenses
- GIVEN there are unreconciled GastosDE records in the system
- WHEN the user views the gastos pendientes (pending expenses) reconciliation interface
- THEN the system SHALL include GastosDE records alongside other expense types (salario, compra)
- AND the system SHALL display GastosDE records with their provider information as the primary detail
- AND the system SHALL allow users to initiate reconciliation for GastosDE records

#### Scenario: GastosDE Reconciliation Completion
- GIVEN a GastosDE record is selected for reconciliation
- WHEN the user completes the reconciliation process with a bank transaction
- THEN the system SHALL mark the GastosDE record as reconciled
- AND the system SHALL record the reconciliation details (transaction ID, date, amount)
- AND the GastosDE record SHALL no longer appear in pending expenses lists

## Data Model

The GastosDE entity consists of the following fields:
- gastosDEId: string (unique identifier)
- tipo: string (expense type - e.g., "Arrendamiento", "Mantenimiento", "Telefonía")
- proveedor: string (provider/vendor name - can be selected from Vendor list)
- monto: number (expense amount, positive number)
- descripcion: string (expense description)
- periodo: string (accounting period - e.g., "2026-03", auto-generated from creation date)
- numeroFactura: string | null (optional invoice reference)
- isPagado: string | null (payment status)
- createdAt: Date (timestamp when record was created, auto-generated)
- updatedAt: Date (timestamp when record was last modified, auto-generated)

## Business Rules

1. The tipo, proveedor, monto, descripcion, and periodo fields are REQUIRED for creating a GastosDE record
2. The factura field is OPTIONAL - expenses may or may not have associated invoices
3. GastosDE records are included in the gastos pendientes table for reconciliation purposes
4. When displayed in the gastos pendientes table, GastosDE records show the provider as the primary detail
5. GastosDE records can be filtered by period for reporting and analysis
6. All GastosDE operations maintain an audit trail with createdAt and updatedAt timestamps
