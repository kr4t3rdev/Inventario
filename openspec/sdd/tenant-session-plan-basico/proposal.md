# SDD Proposal: Reparar sesión tenant para usuarios plan básico

## Business Problem

Usuarios con plan básico (tipo "company") no pueden operar el sistema después de ser aprobados por el admin global. El dashboard muestra "Usuario autenticado sin tenant asignado" y el sidebar aparece vacío porque no hay contexto de tenant (`tenantId`, `tenantRole`, `planLimits`).

## Current State

1. **Flujo "company"**: Usuario se registra → `onboardingStatus: "awaiting_global_approval"` → admin aprueba via `approveGlobalUserAction` → solo se setea `isActive: true` → **no se crea Tenant, TenantMembership ni TenantLicense**

2. **Flujo "worker"**: Usuario se registra → `onboardingStatus: "selecting_tenant"` → selecciona tenant → `onboardingTenant()` crea `TenantMembership` con `isActive: false` → manager aprueba via `approveMembershipAction` → activa membership → **funciona correctamente**

3. **Bug en refreshSessionAction**: Guarda `newRefreshToken` en `UserSession` en lugar de `newToken` (auth token). `getCurrentUser()` busca por el auth token → no lo encuentra → retorna null → sesión inválida tras 15 min.

4. **Bug en Usuario interface**: No incluye `tenantId`, forzando typecasts y accesos inseguros en el frontend.

5. **TenantLicense faltante**: Tenants creados antes de la migración de `TenantLicense` no tienen licencia activa → `resolveTenantContext` retorna `planLimits: undefined`.

## Target Users

- Usuarios tipo "company" (dueños de empresa que se registran con plan básico)
- Usuarios tipo "worker" que se unen a tenants sin licencia activa
- Admin global que aprueba usuarios "company"

## Constraints & Non-Goals

- Mantener backward compatibility con tenants existentes sin `TenantLicense`
- No modificar el flujo de `approveMembershipAction` ni `onboardingTenant` (ya funcionan)
- No cambiar el modelo de datos existente (solo insertar registros faltantes)
- No abordar el refactor del sidebar (fuera de scope)
- No cambiar el login de API routes (solo server actions)

## Solution Sketch

5 fixes independientes con orden de aplicación:

1. **Fix `approveGlobalUserAction`**: Al aprobar tipo "company", crear automáticamente:
   - `Tenant` con nombre derivado
   - `TenantMembership` con rol "manager" activa
   - `TenantLicense` vinculada al plan básico o plan seleccionado
   - Limpiar `onboardingStatus` a `null`
   - Setear `expiresAt` del usuario desde la licencia

2. **Fix `refreshSessionAction`**: Guardar `newToken` (auth token) en `UserSession`, no `newRefreshToken`.

3. **Fix `Usuario` interface**: Agregar `tenantId` opcional.

4. **Fix `resolveTenantContext` logging**: No silenciar errores en catch, loguear con más contexto.

5. **Seed/migration**: Script para crear `TenantLicense` para tenants existentes sin licencia.

## Risk Assessment

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Crear `Tenant` con nombre incorrecto o duplicado | Medio | Validar nombre único, usar slug como fallback |
| `approveGlobalUserAction` cambia comportamiento existente | Bajo | Solo agregar creación de tenant, no modificar lógica existente |
| Seed afecta tenants con licencia ya activa | Bajo | Upsert condicional, solo crear si no existe |
| refreshSessionAction bug no testeable sin integración | Medio | Tests unitarios de getCurrentUser con mock de Prisma |

## Acceptance Criteria

- [ ] Usuario tipo "company" aprobado por admin puede loguearse y ver dashboard con datos
- [ ] Usuario tipo "company" aprobado ve sidebar completo según plan básico
- [ ] `planLimits` se resuelve correctamente con valores del plan
- [ ] Refresh de sesión no rompe autenticación
- [ ] Tenants existentes sin licencia obtienen `TenantLicense` automáticamente
- [ ] Sidebar no crashea si `planLimits` es undefined (graceful degradation)
