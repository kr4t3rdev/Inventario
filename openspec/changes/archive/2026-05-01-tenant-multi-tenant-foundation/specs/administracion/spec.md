# Delta for administracion

## MODIFIED Requirements

### Requirement: User Management - Full CRUD Operations

The system MUST provide CRUD de usuarios limitado al tenant autenticado y MUST separar administración de empresa de cualquier operación global de plataforma.

#### Scenario: Listar usuarios del tenant actual

- GIVEN un usuario con rol tenant `director` o `admin`
- WHEN consulta `/api/admin/users`
- THEN el sistema MUST devolver únicamente usuarios con membresía en su tenant activo
- AND MUST ordenar y paginar sin incluir usuarios de otros tenants

#### Scenario: Crear usuario dentro del tenant

- GIVEN un director del tenant con cupo disponible según plan
- WHEN crea un nuevo usuario desde administración
- THEN el sistema MUST crear la identidad global del usuario si no existe
- AND MUST asociarla al tenant actual mediante membresía con `tenantRole`
- AND MUST NOT asignar acceso a otros tenants de forma implícita

#### Scenario: Rechazar creación por límite de plan

- GIVEN un tenant que alcanzó su máximo de usuarios
- WHEN un admin intenta dar alta a otro usuario
- THEN el sistema MUST rechazar la operación con 409 o 403 según convención del endpoint
- AND MUST informar que el límite del plan fue excedido

### Requirement: Role and Permission System

The system MUST enforce tenant roles para administración empresarial y MAY mantener roles de plataforma para soporte interno.

#### Scenario: Rol tenant autorizado para gestión

- GIVEN un usuario con `tenantRole` `admin`
- WHEN intenta editar usuarios de su tenant
- THEN el sistema MUST permitir la operación dentro de los límites del tenant

#### Scenario: Usuario sin rol tenant suficiente

- GIVEN un usuario con `tenantRole` `dependiente` o `economico`
- WHEN intenta acceder al panel o endpoints de administración de usuarios
- THEN el sistema MUST responder 403
- AND MUST NOT basarse solo en un rol global `admin` para autorizar acceso empresarial
