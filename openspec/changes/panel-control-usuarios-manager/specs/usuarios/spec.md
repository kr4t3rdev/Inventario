# Specification: Panel de Control de Usuarios para Manager

## Overview

Este spec define el comportamiento del panel de control de usuarios a nivel tenant, accesible para el rol **manager** (y **admin** de tenant). Permite gestionar los usuarios de una empresa y las solicitudes de acceso pendientes.

## Requirements

### R1: Acceso al Panel

**R1.1** El panel DEBE estar accesible en la ruta `/busy/configuracion/usuarios`.

**R1.2** El link al panel DEBE aparecer en el sidebar de `/busy/` bajo la sección "Configuración".

**R1.3** El link DEBE ser visible solo para usuarios cuyo `tenantRole` sea `manager` o `admin`.

**R1.4** Si un usuario sin permisos intenta acceder a la URL directamente, DEBE ser redirigido al dashboard.

### R2: Lista de Usuarios del Tenant

**R2.1** El panel DEBE mostrar una tabla con todos los usuarios activos (`isActive: true`) del tenant actual.

**R2.2** Cada fila DEBE mostrar:
- Nombre del usuario
- Email
- Rol dentro del tenant (`tenantRole`)
- Estado (Activo/Inactivo)
- Fecha de ingreso (`createdAt`)

**R2.3** La tabla DEBE permitir búsqueda por nombre o email.

**R2.4** La tabla DEBE soportar paginación.

**R2.5** Los datos DEBEN provenir del endpoint `GET /api/admin/global/users` (que ya filtra por tenant para managers).

### R3: Solicitudes Pendientes

**R3.1** El panel DEBE mostrar una sección/tab con las solicitudes de acceso pendientes al tenant.

**R3.2** Cada solicitud DEBE mostrar:
- Nombre del solicitante
- Email
- Tipo de onboarding (`worker` o `company`)
- Fecha de solicitud

**R3.3** El manager DEBE poder aprobar una solicitud seleccionando el rol a asignar (`dependiente`, `economico`, `admin`).

**R3.4** El manager DEBE poder rechazar una solicitud.

**R3.5** Al aprobar, el usuario DEBE recibir acceso inmediato al tenant.

**R3.6** Al rechazar, la membresía DEBE ser eliminada y el usuario DEBE volver al estado `selecting_tenant`.

### R4: Permisos y Seguridad

**R4.1** El endpoint `GET /api/admin/global/users` DEBE continuar filtrando por `tenantId` cuando el usuario es manager (ya implementado).

**R4.2** El endpoint `GET /api/admin/memberships/pending` DEBE continuar verificando `isTenantAdminRole` (ya implementado).

**R4.3** El endpoint `PATCH /api/admin/memberships/[id]` DEBE continuar verificando que la membresía pertenezca al tenant del usuario (ya implementado).

**R4.4** Las rutas frontend `/busy/configuracion/usuarios` y `/busy/configuracion/usuarios/*` DEBEN estar incluidas en los permisos del rol `manager`.

### R5: UI/UX

**R5.1** El panel DEBE usar el mismo diseño visual que el resto de la aplicación (`/busy/`).

**R5.2** DEBE haber un contador de badge en el sidebar mostrando la cantidad de solicitudes pendientes.

**R5.3** La tabla de usuarios DEBE mostrar un mensaje vacío cuando no hay usuarios.

**R5.4** Las acciones de aprobar/rechazar DEBEN mostrar un diálogo de confirmación.

## Scenarios

### Scenario 1: Manager ve usuarios de su empresa

**Given** un usuario autenticado con `tenantRole: 'manager'` y `tenantId: 'tenant-123'`
**When** navega a `/busy/configuracion/usuarios`
**Then** ve una tabla con los usuarios de `tenant-123`
**And** no ve usuarios de otros tenants

### Scenario 2: Manager aprueba solicitud

**Given** un usuario autenticado con `tenantRole: 'manager'`
**And** existe una solicitud pendiente de acceso al tenant
**When** el manager selecciona "Aprobar" y elige rol `dependiente`
**Then** la membresía se activa con `tenantRole: 'dependiente'`
**And** el usuario pasa a estado `onboardingStatus: 'completed'`
**And** el solicitante puede iniciar sesión inmediatamente

### Scenario 3: Dependiente no ve el link

**Given** un usuario autenticado con `tenantRole: 'dependiente'`
**When** mira el sidebar
**Then** NO ve el link "Usuarios" en la sección Configuración

### Scenario 4: Sin solicitudes pendientes

**Given** un usuario autenticado con `tenantRole: 'manager'`
**And** no hay solicitudes pendientes en el tenant
**When** navega al panel
**Then** ve el mensaje "No hay solicitudes pendientes"
**And** el badge del sidebar muestra "0"

## Data Model

No hay cambios al schema de Prisma. Se usan los modelos existentes:

- `User`: datos del usuario
- `TenantMembership`: relación usuario-tenant con rol
- `Tenant`: datos del tenant

## API Endpoints

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/api/admin/global/users?tenantId=<id>` | Listar usuarios del tenant |
| GET | `/api/admin/memberships/pending` | Listar solicitudes pendientes |
| PATCH | `/api/admin/memberships/<id>` | Aprobar/rechazar solicitud |

## Frontend Routes

| Ruta | Descripción |
|------|-------------|
| `/busy/configuracion/usuarios` | Panel principal con tabs |

## Error Handling

| Error | Código | Mensaje |
|-------|--------|---------|
| Sin permisos | 403 | "No autorizado" |
| Membresía no encontrada | 404 | "Membresía no encontrada" |
| Membresía de otro tenant | 403 | "La membresía no pertenece a tu empresa" |
| Acción inválida | 400 | "Acción inválida. Usá approve o reject." |
