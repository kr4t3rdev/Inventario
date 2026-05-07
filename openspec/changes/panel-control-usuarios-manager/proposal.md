# Proposal: Panel de Control de Usuarios para Rol Manager

## Problem Statement

El rol **manager** (asignado al aprobar un usuario tipo company) no tiene acceso a un panel de control para gestionar los usuarios de su empresa/tenant. Actualmente:

- Las APIs existentes (`/api/admin/global/users`, `/api/admin/memberships/pending`, `/api/admin/memberships/[id]`) ya soportan el rol manager filtrando por tenant
- Pero no existe una página en `/busy/` para acceder a estas funcionalidades
- El sidebar de `/busy/` no tiene un link al panel de usuarios
- El único "Panel de Control" visible es el de admin global (`/admin`), que solo se muestra si `user.role === "admin"`

Esto lleva a que el manager de una empresa no pueda:
1. Ver quiénes son los usuarios de su empresa
2. Aprobar o rechazar solicitudes de acceso de nuevos empleados
3. Gestionar roles dentro de su tenant

## Proposed Solution

Crear un **Panel de Control de Usuarios a nivel tenant** accesible desde `/busy/configuracion/usuarios` (o similar) que permita al rol manager:

### Funcionalidades
1. **Lista de usuarios del tenant**: ver todos los usuarios activos de la empresa con su rol (dependiente, economico, admin, etc.)
2. **Solicitudes pendientes**: ver y gestionar (aprobar/rechazar) solicitudes de acceso de nuevos empleados
3. **Crear usuarios directamente**: opción de invitar/crear usuarios para el tenant sin pasar por onboarding

### Cambios necesarios
1. **Página frontend**: nueva página en `/busy/configuracion/usuarios`
2. **Sidebar**: agregar link en la sección "Configuración" del AppSidebar2
3. **Componentes UI**: tabla de usuarios, tabla de solicitudes pendientes, diálogos de acción
4. **APIs**: asegurar que las APIs existentes funcionen correctamente para el rol manager (ya lo hacen en su mayoría)
5. **Permisos**: agregar rutas frontend al TENANT_PERMISSIONS para `manager`

## Benefits

1. **Autonomía**: El manager puede gestionar su equipo sin depender del admin global
2. **Flujo completo**: Los empleados pueden solicitar acceso → el manager aprueba → el empleado entra
3. **Consistencia**: El panel reutiliza componentes y patrones existentes del admin global
4. **Seguridad**: Scope por tenant garantiza que un manager no vea usuarios de otras empresas

## Scope

### In Scope
- Página `/busy/configuracion/usuarios` con lista de usuarios del tenant
- Página `/busy/configuracion/usuarios/solicitudes` (o tab) con solicitudes pendientes
- Componentes reutilizables: tabla de usuarios, tarjetas de stats, diálogo de aprobación/rechazo
- Link en AppSidebar2 para roles manager/admin del tenant
- Tests de las nuevas rutas API y componentes

### Out of Scope
- Creación de usuarios directamente desde el panel (puede hacerse en fase 2)
- Edición de roles de usuarios existentes (fase 2)
- Desactivación/bloqueo de usuarios del tenant (fase 2)
- Notificaciones en tiempo real de nuevas solicitudes (fase 2)

## Success Criteria

1. ✅ El manager puede ver todos los usuarios de su empresa en una tabla
2. ✅ El manager puede ver solicitudes pendientes de acceso
3. ✅ El manager puede aprobar/rechazar solicitudes con un click
4. ✅ Los datos están scopeados al tenant (no se ven usuarios de otras empresas)
5. ✅ El link aparece en el sidebar solo para roles manager/admin del tenant
6. ✅ Las APIs devuelven 403 si un dependiente intenta acceder
7. ✅ Tests unitarios para las rutas API y componentes principales

## Affected Areas

- Frontend: nueva página, componentes, sidebar
- APIs: validaciones de permisos existentes (no cambios mayores)
- Permisos: TENANT_PERMISSIONS y ROLE_PERMISSIONS
- Base de datos: sin cambios de schema

## Timeline

- **Investigación y diseño**: 1 hora
- **APIs y permisos**: 1 hora
- **Frontend página + componentes**: 3-4 horas
- **Tests**: 1-2 horas
- **Total**: ~6-8 horas

## Related Issues

- Bug: manager role faltaba en TENANT_PERMISSIONS
- Feature: onboarding de usuarios tipo worker/company
