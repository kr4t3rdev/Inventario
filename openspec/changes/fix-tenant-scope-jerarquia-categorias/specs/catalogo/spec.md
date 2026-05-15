# Delta for Catálogo: Tenant isolation en jerarquía de categorías

## Purpose

Corregir la falta de filtro multi-tenant en `getCategoriaHierarchyAction` para que cada tenant vea exclusivamente su propia jerarquía de categorías.

## MODIFIED Requirements

### Requirement: Consulta de jerarquía con aislamiento de tenant

El sistema MUST filtrar la jerarquía de categorías por `tenantId` cuando un usuario autenticado consulta `getCategoriaHierarchyAction`.

(Anteriormente: la jerarquía se retornaba sin filtrar, exponiendo categorías de todos los tenants.)

#### Scenario: Usuario ve solo su propia jerarquía

- GIVEN un usuario autenticado del tenant "A"
- AND existen categorías en los tenants "A", "B" y "C"
- WHEN el usuario consulta `getCategoriaHierarchyAction`
- THEN el sistema MUST retornar solo las categorías del tenant "A"
- AND la respuesta MUST incluir la jerarquía completa (raíces + subcategorías) del tenant "A"

#### Scenario: Tenant sin categorías

- GIVEN un usuario autenticado de un tenant que no tiene categorías creadas
- WHEN el usuario consulta `getCategoriaHierarchyAction`
- THEN el sistema MUST retornar un arreglo vacío `[]`
- AND la respuesta MUST tener `success: true`

#### Scenario: Usuario sin tenant activo

- GIVEN un usuario autenticado que no tiene una membresía de tenant activa
- WHEN el usuario consulta `getCategoriaHierarchyAction`
- THEN el sistema MUST retornar un error con `success: false`
- AND el error code MUST ser el mismo que usa `requireTenant` para falta de tenant

#### Scenario: Aislamiento entre tenants

- GIVEN un usuario del tenant "A" con categorías "C1", "C2"
- AND un usuario del tenant "B" con categorías "C3", "C4"
- WHEN ambos usuarios consultan `getCategoriaHierarchyAction`
- THEN el usuario del tenant "A" ve solo "C1" y "C2"
- AND el usuario del tenant "B" ve solo "C3" y "C4"
- AND ningún usuario ve categorías del otro tenant
