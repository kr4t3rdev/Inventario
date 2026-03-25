# Proposal: Fix FK Validation in Servicios API

## Problem

When creating a service via POST `/api/servicios` with an invalid `vendorId` (or other foreign key), Prisma throws a foreign key constraint error:

```
Foreign key constraint violated on the constraint: `Servicios_vendorId_fkey`
```

The API returns a generic 500 error, making debugging difficult for frontend users.

## Solution

Add validation in the POST endpoint to verify foreign key IDs exist before attempting to create the service.

## Affected Areas

- `src/app/api/servicios/route.ts` — Add FK validation logic
- `src/app/models/model.ts` — (No changes needed)

## Approach

1. Check if vendorId, categoriaId, subcategoriaId, unidadId exist before create
2. Return 400 with specific error messages for each invalid FK
3. Handle validation errors gracefully

## Risk

Low — Adding validation before existing logic.
