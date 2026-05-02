# Proposal: Tenant Multi-Tenant Foundation

## Intent

Convertir TCP de instalación single-tenant implícita a plataforma multi-tenant con aislamiento fuerte por empresa. El problema real no es crear `Tenant`, sino eliminar supuestos globales en schema, auth, permisos, administración de usuarios, `MiEmpresa` y licenciamiento para evitar fugas entre empresas.

## Scope

### In Scope
- Introducir `Tenant`, `TenantMembership` y licencias por tenant en el diseño objetivo.
- Definir migración incremental desde datos globales actuales a un tenant default.
- Especificar contexto de tenant en auth, RBAC por tenant y scoping obligatorio en APIs/servicios.
- Convertir `MiEmpresa` y la administración de usuarios a comportamiento tenant-scoped.

### Out of Scope
- Implementar todo el rollout en una sola iteración de código.
- Multi-base-de-datos por tenant.
- Features comerciales futuras fuera de límites/licencias por tenant.

## Capabilities

### New Capabilities
- `multi-tenant-platform`: modelo `Tenant`, membresías, auth con tenant activo, scoping de datos, `MiEmpresa` por tenant y rollout seguro.
- `tenant-licensing`: planes, licencias y enforcement de límites a nivel organización.

### Modified Capabilities
- `administracion`: la gestión de usuarios deja de ser global y pasa a estar limitada al tenant autenticado.

## Approach

Adoptar `shared DB + tenantId` con identidad global de usuario y pertenencia por `TenantMembership`. La migración se hace por fases: schema nuevo, backfill a tenant default, scoping en lectura/escritura, luego endurecimiento de constraints y permisos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Nuevos modelos tenant, refactor de uniques y relaciones globales. |
| `src/lib/auth-middleware.ts` | Modified | Resolver tenant activo, rol tenant y límites. |
| `src/lib/auth/roles.ts` | Modified | Separar roles de plataforma y tenant. |
| `src/lib/permissions.ts` | Modified | Permisos y helpers tenant-scoped. |
| `src/app/api/admin/users/route.ts` | Modified | CRUD y listados por tenant. |
| `src/app/api/mi-empresa/route.ts` | Modified | Perfil empresarial del tenant autenticado. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Query sin `tenantId` | High | Capa centralizada de scoping + tests de aislamiento. |
| Unique global incompatible | High | Backfill y migraciones en dos pasos con compuestos por tenant. |
| Mezcla de rol global y tenant | Medium | Separar `platformRole` de `tenantRole` en auth/specs. |

## Rollback Plan

Mantener `tenantId` nullable durante backfill, desplegar scoping primero en lectura, conservar tenant default y revertir a rutas globales previas antes de endurecer `NOT NULL` o reemplazar uniques.

## Dependencies

- Prisma migrations seguras con scripts de backfill y validación.
- Suite mínima de tests de aislamiento y RBAC.

## Success Criteria

- [ ] Existe spec aprobada para modelo tenant, auth, RBAC, licencias y scoping.
- [ ] La migración incremental y rollback quedan definidos sin cambios destructivos tempranos.
- [ ] `administracion` y `mi-empresa` quedan especificados como tenant-scoped.
