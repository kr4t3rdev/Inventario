# Design: Migrar transferencias a server-first

## Overview

La migración no cambia la lógica de negocio de transferencias. El objetivo es reemplazar dos caminos cliente que todavía leen datos por RTK Query y dejar el dominio completamente servido por Server Actions + Server Components donde ya existe esa infraestructura.

## Current State

- `src/app/busy/transferencias/page.tsx` ya resuelve el listado inicial con `getTransferenciasAction`
- `src/app/busy/transferencias/edit/[id]/page.tsx` ya carga una transferencia por Server Action
- `src/features/transferencias/actions.ts` concentra lectura, creación y cancelación
- `src/features/reportes-financieros/components/reporte-movimientos.tsx` sigue usando `useGetTransferenciasQuery`
- `src/features/transferencias/components/transferencias-form.tsx` sigue importando `useGetStockPorUbicacionQuery`
- `src/features/transferencias/api/transferenciasApi.ts` queda como residuo de la migración

## Proposed Architecture

### 1. Transferencias listing
The listing page MUST keep initial data on the server and the client wrapper MUST receive it by props. Refresh after cancelation SHOULD come from `revalidatePath('/busy/transferencias')`, not from client-side cache invalidation.

### 2. Reporte de movimientos
The report component SHOULD receive transferencias data from a server-first source. The preferred path is to fetch transferencias with a Server Action or a server-resolved helper and pass them into the client presentation layer. The component MUST preserve the current aggregation and export behavior.

### 3. Transferencia form
The form SHOULD resolve location stock from a server action already available in the productos domain, not from RTK Query. That keeps the validation boundary server-backed while preserving the current client UX.

### 4. Residual slice cleanup
Once the two consumers are migrated, `transferenciasApi.ts` becomes dead code and SHOULD be removed in a follow-up cleanup. This keeps the migration atomic and rollback-friendly.

## Client/Server Validation Split

- Server MUST remain the source of truth for transfer list, detail, creation, cancelation, and stock calculations
- Client MUST only handle interaction, optimistic UI affordances, and rendering
- Validation errors from server actions MUST continue to surface through the existing toast/error path

## Toast Behavior

- Success toast on cancelation MUST remain unchanged
- Validation and stock errors MUST continue to be reported to the user without silent failures
- The migration MUST not change user-facing copy unless needed to preserve server-first flow

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| The report of movements may need a new server data contract | Medium | Keep the same normalized transfer shape as the RTK query response |
| The form may need additional server props for stock | Medium | Reuse existing `getStockPorUbicacionAction` or an equivalent server helper |
| Removing RTK too early could break another hidden consumer | Low | Keep the slice until the grep-based consumer audit is re-run during verify |

## Notes

This change intentionally avoids UI redesign. The only behavioral shift is where data is resolved from.
