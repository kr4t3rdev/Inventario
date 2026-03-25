# Tasks: Transferencia Costos

## Phase 1: Database Schema

- [x] 1.1 Modify `prisma/schema.prisma`: Add `costoUnitario Int?` and `costoTotal Int?` to the `Transferencia` model.
- [x] 1.2 Run migration: Execute `npx prisma migrate dev --name add_cost_to_transferencia`.

## Phase 2: API Implementation

- [x] 2.1 Update `src/app/api/transferencias/route.ts` (POST): In the transaction, fetch `Producto.precioCosto`, calculate `costoTotal`, and save both.
- [x] 2.2 Update `src/app/api/transferencias/route.ts` (GET): Ensure the new fields are included in the response.

## Phase 3: Verification

- [ ] 3.1 Verify manually: Create a transfer via the UI or API and check the database to ensure `costoUnitario` and `costoTotal` are correctly populated.
