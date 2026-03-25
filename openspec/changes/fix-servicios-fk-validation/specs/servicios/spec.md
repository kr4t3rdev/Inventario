# Delta for Servicios API

## Purpose

Fix foreign key validation in `/api/servicios` endpoint to prevent Prisma constraint errors when creating services with invalid references.

## ADDED Requirements

### Requirement: Validate Foreign Keys Before Service Creation

The API SHALL validate that all foreign key references (vendorId, categoriaId, subcategoriaId, unidadId) exist in their respective tables before creating a service.

When a foreign key ID is provided and is not null, the system MUST verify the referenced record exists.

#### Scenario: Create service with valid vendor

- GIVEN a valid vendorId that exists in the Vendor table
- WHEN the client creates a service with this vendorId
- THEN the service is created successfully
- AND the vendor relationship is established

#### Scenario: Create service with invalid vendorId

- GIVEN a vendorId that does NOT exist in the Vendor table
- WHEN the client creates a service with this invalid vendorId
- THEN the API returns HTTP 400 with error "El proveedor especificado no existe"
- AND no service is created

#### Scenario: Create service with null vendorId

- GIVEN vendorId is not provided (null/undefined)
- WHEN the client creates a service
- THEN the service is created successfully
- AND vendorId remains null

### Requirement: Validate All Foreign Keys

The API SHALL validate the following foreign keys:
- vendorId → Vendor table
- categoriaId → Categoria table
- subcategoriaId → Subcategoria table
- unidadId → Unidad table

#### Scenario: Create service with invalid categoriaId

- GIVEN an invalid categoriaId that does not exist
- WHEN the client creates a service with this categoriaId
- THEN the API returns HTTP 400 with error "La categoría especificada no existe"

#### Scenario: Create service with multiple invalid FKs

- GIVEN vendorId and categoriaId that both do not exist
- WHEN the client creates a service with both invalid IDs
- THEN the API returns HTTP 400 with error for the first invalid FK encountered

## MODIFIED Requirements

### Requirement: Error Handling in POST /api/servicios

The API SHOULD return specific error messages for foreign key violations instead of generic 500 errors.

(Previously: Returned generic "Error al crear el Servicio" with 500 status)

#### Scenario: Foreign key constraint error

- GIVEN a request with invalid foreign key
- WHEN the API attempts to create the service
- THEN return HTTP 400 with specific error message indicating which field is invalid
- AND log the detailed error for debugging
