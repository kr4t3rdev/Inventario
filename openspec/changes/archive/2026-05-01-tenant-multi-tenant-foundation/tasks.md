# Tasks: Tenant Multi-Tenant Foundation

## Phase 1: Spec Baseline And Data Model

- [x] 1.1 Modificar `prisma/schema.prisma` para definir `Tenant`, `TenantMembership`, `TenantLicense` y la relación tenant-`MiEmpresa`.
- [x] 1.2 Inventariar en `prisma/schema.prisma` las tablas de negocio que requieren `tenantId` y marcar cuáles entran primero en la migración.
- [x] 1.3 Diseñar reemplazo de uniques globales conflictivos (`Vendor.vendorCode`, `Producto.codigoInterno`, `Producto.codigoNegocio`, `User.email`) con estrategia documentada por campo.

## Phase 2: Migration Safety

- [x] 2.1 Crear migración Prisma inicial para agregar `tenantId` nullable y tablas tenant sin endurecer constraints.
- [x] 2.2 Crear script de backfill en `scripts/` para generar tenant default y asociar datos existentes.
- [x] 2.3 Crear script de validación post-backfill que detecte registros sin `tenantId`, memberships faltantes y uniques conflictivos.

## Phase 3: Auth And Permissions

- [x] 3.1 Modificar `src/lib/auth-middleware.ts` para devolver `tenantId`, `tenantRole` y límites/licencia del tenant.
- [x] 3.2 Modificar `src/lib/auth/roles.ts` para separar roles de plataforma y tenant, conservando normalización legada.
- [x] 3.3 Modificar `src/lib/permissions.ts` para incorporar `hasTenantPermission(...)` y rechazar acceso fuera del tenant.

## Phase 4: Scoped Services And APIs

- [x] 4.1 Crear helpers tenant-aware en `src/lib/services/` o `src/lib/` (`scopedWhere`, `assertTenantAccess`, wrappers Prisma).
- [x] 4.2 Modificar `src/app/api/mi-empresa/route.ts` para leer/escribir el perfil del tenant autenticado.
- [x] 4.3 Modificar `src/app/api/admin/users/route.ts` para listar/crear usuarios por tenant y validar cupos del plan.
- [x] 4.4 Auditar `src/app/api/**` y migrar endpoints críticos de catálogo, ventas y compras a filtro obligatorio por `tenantId`.

## Phase 5: Licensing And Tenant Admin

- [x] 5.1 Mover el enforcement de planes/licencias desde `User` a entidades tenant en backend y contratos de API.
- [x] 5.2 Ajustar UI/admin para mostrar usuarios del tenant, roles tenant y consumo de cupos.

## Phase 6: Test-First Verification

- [x] 6.1 Escribir tests unitarios para helpers de scoping y roles tenant antes de implementar su lógica final.
- [x] 6.2 Escribir tests de integración para `src/lib/auth-middleware.ts`, `/api/admin/users` y `/api/mi-empresa` con tenant A/B.
- [x] 6.3 Agregar smoke/E2E tests que prueben aislamiento entre tenants y bloqueo por límites de plan.
