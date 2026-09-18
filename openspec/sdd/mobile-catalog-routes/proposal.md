# SDD Proposal: Rutas móviles de catálogo — categorías y unidades

## Business Problem

Los clients móviles `categories-api` y `units-api` llaman a `/api/mobile/categories` y `/api/mobile/units`, rutas que **no existen** en el backend (confirmado: sin catch-all ni rewrites). El resultado es que las pantallas Categorías y Unidades de la app fallan con 404 contra el backend real. La lógica de dominio ya existe como Server Actions (`features/categorias`, `features/unidades`) y los modelos Prisma (`Categoria`, `Unidad`) están creados; solo falta la plomería HTTP con auth bearer para la superficie móvil.

## Hallazgos (Evidence)

### H1 — Rutas inexistentes

`find src/app/api/mobile` no muestra `categories/` ni `units/`. No hay `[...catch-all]` ni `rewrites()` en `next.config.mjs`.

### H2 — Contrato de cliente móvil

- `mobile/src/categories-api.ts`: `list()→{items}`, `getById`, `create({nombre,descripcion?,color?})`, `update`, `remove`. Clave primaria `categoryId` (back: `catId`). El campo `color` no existe en el modelo `Categoria`.
- `mobile/src/units-api.ts`: `list()→{items}`, `getById`, `create({nombre,abreviatura,descripcion?})`, `update`, `remove`. Clave `unitId` (back: `unidadId`); `abreviatura` mapea a `simbolo`; `descripcion` no existe en `Unidad`.

### H3 — Dominio reutilizable

- `src/features/categorias/actions.ts` — CRUD completo con validación Zod (`categoriaCreateSchema`) y validación de negocio CLI.
- `src/features/unidades/actions.ts` + `validators.ts` — CRUD con unicidad scoped por tenant (P2002) y chequeo de "en uso" al eliminar.
- Modelos: `Categoria { catId, tenantId, nombre, descripcion?, parentId?, clasSectionId?, clasSpecificId? }`; `Unidad { unidadId, tenantId, nombre, simbolo, @@unique([tenantId,nombre]), @@unique([tenantId,simbolo]) }`.

### H4 — Patrón de referencia

`src/app/api/mobile/expenses/route.ts` usa `authenticateUser` (bearer) + `requireTenant` (via `tenantId` check) + Prisma directo + `successResponse`/`errorResponse`. Los tests usan `vi.hoisted` para mockear `prisma` y `auth-middleware` (ver `src/app/api/mobile/__tests__/plans-referrals-expenses.test.ts`).

## Target Users

- Compradores que administran el catálogo (categorías) y las unidades de medida desde dispositivos móviles.

## Scope

### Incluye

- `GET/POST /api/mobile/categories`, `GET/PUT/DELETE /api/mobile/categories/[id]`.
- `GET/POST /api/mobile/units`, `GET/PUT/DELETE /api/mobile/units/[id]`.
- Mappers `categoryId←catId`, `unitId←unidadId`, `abreviatura←simbolo`.
- Tests vitest en root (mapeo, 401, 403 sin tenant, validación, P2002→409, in-use→409).
- Validar shapes en móvil sin cambios de contrato (los clients ya usan `{items}`).
- Actualizar `mobile/docs/mobile-endpoint-matrix.md`.

### Excluye

- Jerarquía de categorías (subcategorías/parentId) y clasificación EAN-13: el client móvil no las envía.
- `color` de categoría y `descripcion` de unidad: no existen en los modelos; se ignoran.
- Otros endpoints 404 (transfers, mermas, purchases, services, contracts, exchange) — SDD-04 y SDD-05.

## Data Sources

- `prisma/.Categoria`, `prisma/.Unidad` (ya existentes, sin migración).

## Rollback

Reversible: revert del commit (rutas nuevas, sin cambios de esquema).