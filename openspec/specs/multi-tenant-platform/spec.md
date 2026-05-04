# Multi-Tenant Platform Specification

## Purpose

Esta especificación define cómo TCP pasa de un contexto global único a un modelo multi-tenant con aislamiento por empresa, autenticación con tenant activo, roles por tenant, licenciamiento organizacional y migración incremental segura.

## Requirements

### Requirement: Tenant Domain Foundation

The system MUST represent each empresa as a `Tenant` separado y MUST desacoplar la identidad global del usuario de su pertenencia operativa a una empresa.

#### Scenario: Crear tenant inicial por migración

- GIVEN que la base actual contiene datos globales de una sola empresa
- WHEN se ejecuta la migración inicial de multi-tenant
- THEN el sistema MUST crear un tenant default para representar la empresa existente
- AND MUST asociar el perfil actual de `MiEmpresa` a ese tenant
- AND MUST conservar acceso funcional al sistema durante la transición

#### Scenario: Usuario con membresía tenant

- GIVEN un usuario autenticado con identidad global válida
- WHEN el sistema resuelve su acceso operativo
- THEN MUST obtener una membresía activa `TenantMembership`
- AND MUST derivar desde esa membresía el `tenantId` y `tenantRole`
- AND MUST NOT inferir el tenant solo desde el rol global del usuario

### Requirement: Incremental Tenant Migration

The system MUST migrate datos existentes a tenancy de forma incremental y reversible.

#### Scenario: Backfill antes de endurecer constraints

- GIVEN una tabla de negocio que hoy no tiene `tenantId`
- WHEN se introduce soporte multi-tenant
- THEN el sistema MUST agregar `tenantId` como nullable en la primera fase
- AND MUST backfillear todos los registros al tenant default
- AND MUST convertir `tenantId` en required solo después de validar integridad

#### Scenario: Reemplazar uniques globales por compuestos

- GIVEN campos globalmente únicos como email o códigos de negocio
- WHEN esos datos deban coexistir entre tenants
- THEN el sistema MUST revisar cada restricción única global
- AND SHOULD reemplazarla por un unique compuesto con `tenantId` cuando el dato pertenezca al dominio tenant
- AND MUST documentar explícitamente cuáles uniques permanecen globales

### Requirement: Tenant-Aware Authentication Context

The authentication layer MUST resolver el contexto operativo completo del tenant por request.

#### Scenario: Request autenticado con tenant activo

- GIVEN un request con JWT válido y sesión activa
- WHEN el middleware autentica al usuario
- THEN la respuesta de autenticación MUST incluir `userId`, `tenantId`, `tenantRole` y estado/licencias relevantes del tenant
- AND MUST actualizar la sesión sin perder el contexto tenant

#### Scenario: Tenant inexistente o no perteneciente

- GIVEN un usuario autenticado que intenta operar sobre un tenant no asociado
- WHEN el middleware o el servicio valida acceso
- THEN el sistema MUST responder 403 o 404 según corresponda
- AND MUST impedir que el request llegue a consultas de negocio no scopeadas

### Requirement: Tenant RBAC

The system MUST separar permisos de plataforma de permisos por tenant.

#### Scenario: Director administra usuarios de su tenant

- GIVEN un usuario con rol tenant `manager`
- WHEN accede a administración de usuarios de su empresa
- THEN el sistema MUST permitir listar, crear, activar, desactivar y cambiar roles solo dentro de su tenant

#### Scenario: Dependiente intenta entrar a administración tenant

- GIVEN un usuario con rol tenant `dependiente`
- WHEN intenta acceder a endpoints o UI administrativa del tenant
- THEN el sistema MUST rechazar el acceso con 403
- AND MUST mantener habilitados solo sus permisos operativos permitidos

### Requirement: Tenant-Scoped Data Access

Every tenant-owned read and write MUST filtrar por `tenantId` sin excepciones.

#### Scenario: Lectura scopeada de recursos de negocio

- GIVEN recursos de dos tenants distintos en la misma base compartida
- WHEN un usuario del tenant A consulta productos, ventas o almacenes
- THEN el sistema MUST devolver solo registros del tenant A
- AND MUST NOT exponer conteos, IDs o metadatos del tenant B

#### Scenario: Escritura contra recurso ajeno

- GIVEN un recurso perteneciente al tenant B
- WHEN un usuario del tenant A intenta actualizarlo o eliminarlo
- THEN el sistema MUST rechazar la operación
- AND MUST registrar el intento para auditoría si aplica

### Requirement: Tenant Company Profile

`MiEmpresa` MUST comportarse como el perfil empresarial del tenant autenticado, no como singleton global.

#### Scenario: Obtener empresa del tenant actual

- GIVEN un usuario autenticado con tenant activo
- WHEN consulta `/api/mi-empresa`
- THEN el sistema MUST devolver la configuración empresarial asociada a su tenant
- AND MUST NOT leer ni escribir un registro global compartido por todos

#### Scenario: Actualizar empresa sin afectar otros tenants

- GIVEN dos tenants con datos fiscales distintos
- WHEN el tenant A actualiza nombre, logo o configuración fiscal
- THEN el sistema MUST persistir el cambio solo en el perfil del tenant A
- AND MUST mantener intacto el perfil del tenant B

### Requirement: Tenant Licensing And Limits

Plans and licenses MUST apply at tenant level, not user level.

#### Scenario: Alta de usuario respetando límite del plan

- GIVEN un tenant con plan activo y cupo máximo de usuarios alcanzado
- WHEN un manager o admin intenta crear un nuevo usuario
- THEN el sistema MUST rechazar la alta
- AND MUST informar el límite consumido y permitido

#### Scenario: Enforcement de límites operativos

- GIVEN un tenant con límites de almacenes o productos definidos por plan
- WHEN intenta crear un recurso que excede el plan
- THEN el sistema MUST bloquear la operación antes de persistir
- AND MUST devolver un mensaje claro orientado al límite superado

### Requirement: Isolation Verification And Rollout Safety

The system MUST prove tenant isolation through tests and phased rollout controls.

#### Scenario: Test de aislamiento entre tenants

- GIVEN fixtures con tenant A y tenant B
- WHEN se ejecutan pruebas de integración sobre endpoints críticos
- THEN la suite MUST verificar que un usuario del tenant A no puede leer ni modificar datos del tenant B

#### Scenario: Rollout por endurecimiento progresivo

- GIVEN que multi-tenant se despliega sobre producción existente
- WHEN se activa el rollout
- THEN el sistema MUST introducir primero schema y backfill, luego scoping en lectura, después scoping en escritura y finalmente constraints finales
- AND MUST definir métricas, auditoría y plan de rollback por fase
