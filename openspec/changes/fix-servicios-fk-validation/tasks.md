# Tasks: Fix FK Validation in Servicios API

## Phase 1: Validation Functions

- [x] 1.1 Add `InvalidFkError` helper class in `src/app/api/servicios/route.ts`
- [x] 1.2 Add `validateVendor()` function to check if vendorId exists
- [x] 1.3 Add `validateCategoria()` function to check if categoriaId exists
- [x] 1.4 Add `validateSubcategoria()` function to check if subcategoriaId exists
- [x] 1.5 Add `validateUnidad()` function to check if unidadId exists

## Phase 2: Integration

- [x] 2.1 Call validation functions in POST handler before `prisma.servicios.create()`
- [x] 2.2 Return 400 with specific error message when FK is invalid
- [x] 2.3 Update catch block to handle Zod errors and Prisma errors distinctly

## Phase 3: Testing

- [x] 3.1 Test: POST with invalid vendorId returns 400
- [x] 3.2 Test: POST with invalid categoriaId returns 400
- [x] 3.3 Test: POST with valid FKs returns 201
- [x] 3.4 Test: POST with null FKs returns 201

## Phase 4: Verification

- [x] 4.1 Run `pnpm run lint` to verify code style
- [x] 4.2 Test manually with invalid FK via curl/Postman (covered by unit tests)
