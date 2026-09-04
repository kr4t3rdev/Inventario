# Spec: Rutas móviles de catálogo — categorías y unidades

## Requisitos funcionales

### RF-1 — Listado de categorías

DADO que un usuario autenticado llama `GET /api/mobile/categories`
CUANDO su token es válido y tiene `tenantId`
ENTONCES la respuesta es `200 { items: [{ categoryId, nombre, descripcion, createdAt, updatedAt }] }` con las categorías de su tenant (sin `catId`, `parentId`, `clasSectionId`, `clasSpecificId`).

### RF-2 — CRUD de categoría

DADO `POST /api/mobile/categories` con `{ nombre }`
ENTONCES se crea una `Categoria` (nombre trimmed 1..100) y se devuelve `201` con la categoría mapeada. `PUT`/`DELETE` de `[id]` operan solo si la categoría pertenece al tenant; en caso contrario `404`. `DELETE` devuelve `{ success, categoryId }`.

### RF-3 — Listado y CRUD de unidades

DADO `GET /api/mobile/units` → `200 { items: [{ unitId, nombre, abreviatura, createdAt, updatedAt }] }` mapeando `simbolo`→`abreviatura`. `POST` valida `nombre` y `abreviatura`; duplicados de `nombre`/`simbolo` devuelven `409 CONFLICT`. `DELETE` con productos asociados devuelve `409 IN_USE`.

### RF-4 — Autenticación y tenant

Sin token → `401`. Con token sin `tenantId` → `403 TENANT_REQUIRED`. Todas las lecturas/escrituras DEBEN estar filtradas por `tenantId`.

## Requisitos no funcionales

### RNF-1 — Sin regresión

Las rutas nuevas NO DEBEN romper los tests existentes de openapi/parity (no pertenecen a `mobile/v1`).

### RNF-2 — Factura de respuesta

Datos exitosos: `successResponse(data, status?)` con cuerpo JSON plano. Errores: `errorResponse(msg, status, code)`.

## RFC 2119

- "DEBE(N)" expresa requisito normativo; "mapeando" expresa transformación de campos.