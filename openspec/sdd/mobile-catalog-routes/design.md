# Design: Rutas móviles de catálogo — categorías y unidades

## Technical Approach

Rutas non-v1 (`/api/mobile/*`), patrón idéntico a `mobile/expenses/route.ts`: `authenticateUser` (bearer), check `tenantId`, Prisma directo, `successResponse`/`errorResponse`. No se reutilizan las Server Actions (cookie-auth); se replica la lógica mínima con Prisma directo, como ya hace `expenses`.

## Detailed Design

### Mappers

```ts
// categories
mapCategoria(cat) => ({
  categoryId: cat.catId,
  nombre: cat.nombre,
  descripcion: cat.descripcion ?? undefined,
  createdAt: cat.createdAt.toISOString(),
  updatedAt: cat.updatedAt.toISOString(),
})

// units
mapUnidad(u) => ({
  unitId: u.unidadId,
  nombre: u.nombre,
  abreviatura: u.simbolo,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
})
```

`color` (categoría) y `descripcion` (unidad) se ignoran: no existen en los modelos.

### Categorías

- `GET`: `prisma.categoria.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } })`.
- `POST`: validar `nombre` (trimmed 1..100) → `prisma.categoria.create({ data: { nombre, descripcion: descripcion?.trim() || null, tenantId } })`.
- `PUT`: validación + existencia (`findFirst({ catId, tenantId })`) → `update` con `nombre`/`descripcion` presentes.
- `DELETE`: existencia → `delete`.

`SELECT` mínimo: `catId, nombre, descripcion, createdAt, updatedAt`.

### Unidades

- `GET`: `prisma.unidad.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } })`.
- `POST`: validar `nombre` y `abreviatura` → `create({ nombre, simbolo: abreviatura, tenantId })`; capturar `P2002` → `409 CONFLICT`.
- `PUT`: validación + existencia → `update`; capturar `P2002` → `409`.
- `DELETE`: existencia → chequear `prisma.producto.count({ where: { unidadId } })`; si `> 0` → `409 IN_USE`; si no → `delete`.

`SELECT` mínimo: `unidadId, nombre, simbolo, createdAt, updatedAt`.

## Testing (root)

Fichero `src/app/api/mobile/__tests__/categories-units.test.ts` con el harness de `plans-referrals-expenses.test.ts` (`vi.hoisted` + mock de `@/lib/prisma` y `@/lib/auth-middleware`). Casos: mapeo de listado, create válido, 400 sin nombre, 403 sin tenant, 404 id ajeno, 409 conflicto unidades, 409 in-use.

## Riesgos y mitigación

- **`requireFeature` ausente:** la ruta no aplica feature-gating, igual que `mobile/expenses`. Los clientes de referencia son tenant-scoped; aceptable.
- **`color`/`descripcion` ignorados:** documentado; si el UI empieza a usarlos, se amplía el contrato.
- **Validación CLAS/parent ausente:** no aplica (el client móvil no envía esos campos).