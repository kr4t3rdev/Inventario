# Spec: Salud operativa de Ofertas y Servicios en /busy/ofertas

## Purpose

Exponer la salud operativa del propio tenant (Cantidad de Ofertas y Servicios) en `/busy/ofertas`
(la página que muestra ofertas), **visible solo para admin**. La action es combinada porque en el
admin original se mostraban juntos.

## Requirements

### Requirement: Action `getOffersServicesHealthAction` por-tenant

En `src/features/ofertas/actions-health.ts` retorna
`metrics: { ofertasCount, serviciosCount }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getOffersServicesHealthAction()`
- THEN retorna counts de `prisma.oferta` y `prisma.servicio` filtrados por tenant

#### Scenario: No admin

- GIVEN role !== 'admin'
- WHEN llama
- THEN `ActionError('FORBIDDEN')`

#### Scenario: Sin tenant

- WHEN llama sin tenant
- THEN `requireTenant` lanza

#### Scenario: Cobertura 100%

- WHEN se ejecuta suite
- THEN cobertura del archivo = 100%

---

### Requirement: Componente `<OffersServicesHealthCard />`

En `src/features/ofertas/components/offers-services-health-card.tsx`.

#### Scenario: Sin ofertas ni servicios

- GIVEN `ofertasCount = 0 && serviciosCount = 0`
- WHEN renderiza
- THEN badge rojo "Sin actividad"

#### Scenario: Solo ofertas

- GIVEN `ofertasCount > 0, serviciosCount = 0`
- WHEN renderiza
- THEN badge amarillo "Solo ofertas"

#### Scenario: Ambos

- GIVEN `ofertasCount > 0 && serviciosCount > 0`
- WHEN renderiza
- THEN badge verde "Activo"

#### Scenario: role no-admin

- WHEN `userRole !== 'admin'`
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card en /busy/ofertas

#### Scenario: Admin en /busy/ofertas

- GIVEN admin logueado
- WHEN navega a `/busy/ofertas`
- THEN ve `<OffersServicesHealthCard />` con métricas propias del tenant
- AND el listado de ofertas existente sigue funcionando

#### Scenario: Manager en /busy/ofertas

- GIVEN manager logueado
- WHEN navega a `/busy/ofertas`
- THEN la card de salud NO se renderiza
