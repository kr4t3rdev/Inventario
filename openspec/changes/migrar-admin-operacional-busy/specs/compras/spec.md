# Spec: Salud operativa de Compras en /busy/compras-productos

## Purpose

Exponer la salud operativa del propio tenant (Cantidad y Total de Compras, Items, Proveedores
activos) en `/busy/compras-productos`, **visible solo para admin**.

## Requirements

### Requirement: Action `getPurchaseHealthAction` por-tenant

En `src/features/compras-productos/actions-health.ts` retorna
`metrics: { comprasCount, comprasTotal, itemsCount, vendorActiveCount }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getPurchaseHealthAction()`
- THEN retorna counts de `prisma.compraDocumento`, `prisma.compraProducto`, `prisma.vendor`
  filtrados por tenant
- AND `comprasTotal` = suma de `prisma.compraProducto.total` del tenant

#### Scenario: No admin

- GIVEN role !== 'admin'
- WHEN llama
- THEN retorna `{ success: false, error: { code: "FORBIDDEN" } }`

#### Scenario: Sin tenant

- GIVEN user sin tenantId
- WHEN llama
- THEN retorna error de `requireTenant`

#### Scenario: Cobertura 100%

- WHEN se ejecuta la suite de tests de la action
- THEN cobertura de líneas = 100%

---

### Requirement: Componente `<PurchaseHealthCard />`

En `src/features/compras-productos/components/purchase-health-card.tsx`.

#### Scenario: Sin compras

- GIVEN `metrics.comprasCount === 0`
- WHEN renderiza
- THEN muestra badge rojo con texto "Crítico"

#### Scenario: Bajo volumen

- GIVEN `0 < metrics.comprasCount < 20`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Bajo Volumen"

#### Scenario: Saludable

- GIVEN `metrics.comprasCount >= 20`
- WHEN renderiza
- THEN muestra badge verde con texto "Saludable"

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/compras-productos`

#### Scenario: Admin en /busy/compras-productos

- GIVEN admin logueado
- WHEN navega a `/busy/compras-productos`
- THEN ve `<PurchaseHealthCard />` con métricas propias del tenant
- AND la tabla/listado existente sigue funcionando

#### Scenario: Manager en /busy/compras-productos

- GIVEN manager logueado
- WHEN navega a `/busy/compras-productos`
- THEN la card de salud NO se renderiza
