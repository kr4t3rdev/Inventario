# Multi-Tenant Core — Estado Real de Implementación

> Documento actualizado 2026-05-01. Refleja el código actual en el repo.

## Arquitectura Real

### Identidad y membresía
- `User` mantiene identidad global (email único, password, etc.)
- `TenantMembership` vincula usuario a empresa con `tenantRole`
- Un usuario PUEDE pertenecer a múltiples tenants (modelado con `@@unique([tenantId, userId])`)

### Resolución de tenant activo
- **Header `x-tenant-id`**: prioridad máxima si viene en el request
- **Primera membresía activa**: fallback cuando no hay header
- **JWT**: incluye `tenantId` + `tenantRole` desde el login
- El middleware `auth-middleware.ts` expone `tenantId`, `tenantRole` y `planLimits` en cada request

### RBAC
- **Roles de plataforma** (User.role): `admin`, `regularUser`, `dependiente`
- **Roles de tenant** (TenantMembership.tenantRole): `manager`, `admin`, `economico`, `dependiente`
- El middleware central usa `checkTenantApiPermission` cuando hay contexto tenant, `checkApiPermission` como fallback

### Licenciamiento
- `TenantLicense` vincula un tenant a un `Plan` (catálogo global)
- El login verifica `TenantLicense` (tenant-level) con sin fallback a `Licencia` (user-level)
- Enforcement: `validateTenantLimit()` en creación de usuarios

### Scoping de datos
- Helpers centralizados: `scopedWhere()`, `assertTenantAccess()`, `requireTenant()`, `validateTenantLimit()`
- 31+ endpoints de API scopeados con `requireTenant(user)` + filtro `tenantId`

### Schema
- 55 tablas de negocio con `tenantId` NOT NULL + FK + índices
- 11+ uniques globales reemplazados por compuestos con `tenantId`
- Tablas globales: `User`, `Plan`, `UserSession`, `Moneda`, `AuditLog`, etc.

### Migración
- Backfill incremental con tenant default "YOGON - COMERCIAL"
- Scripts: `backfill-tenant-default.ts`, `validate-tenant-migration.ts`, `production-tenant-migration.sql`
- DB Neon sincronizada con schema completo

## Lo que NO coincide con el plan original
- ❌ "Un usuario por tenant" → AHORA: `TenantMembership` soporta múltiples tenants
- ❌ "Resolución por subdomain" → AHORA: `x-tenant-id` header + membresía
- ❌ "Prisma Client Extension inyecta tenantId" → AHORA: helpers explícitos (`scopedWhere`, etc.)
- ❌ "No hay migración de datos existentes" → AHORA: backfill completo ejecutado
