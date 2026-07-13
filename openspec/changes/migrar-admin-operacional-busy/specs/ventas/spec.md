# Spec: Salud operativa de Ventas en /busy/sales

## Purpose

Exponer la salud operativa del propio tenant (Cantidad y Total de Ventas, Facturas, Ofertas y
Servicios) en `/busy/sales`, **visible solo para admin**.

## Requirements

### Requirement: Action `getSalesHealthAction` por-tenant

En `src/features/ventas/actions-health.ts` retorna
`metrics: { ventasCount, ventasTotal, facturasCount, ofertasCount, serviciosCount }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getSalesHealthAction()`
- THEN retorna counts de `prisma.venta`, `prisma.factura`, `prisma.oferta`, `prisma.servicio`
  filtrados por tenant
- AND `ventasTotal` = suma de `prisma.venta.total` del tenant

#### Scenario: No admin

- GIVEN role !== 'admin'
- WHEN llama
- THEN retorna `{ success: false, error: { code: "FORBIDDEN" } }`

#### Scenario: Sin tenant

- GIVEN user sin tenantId
- WHEN llama
- THEN retorna error de `requireTenant`

#### Scenario: Tenant sin ventas

- GIVEN tenant con 0 ventas
- WHEN llama
- THEN `ventasCount = 0` y `ventasTotal = 0`
- AND los demás counts siguen retornando su valor

#### Scenario: Cobertura 100%

- WHEN se ejecuta la suite de tests de la action
- THEN cobertura de líneas = 100%

---

### Requirement: Componente `<SalesHealthCard />`

En `src/features/ventas/components/sales-health-card.tsx`.

#### Scenario: Inactivo

- GIVEN `metrics.ventasCount === 0`
- WHEN renderiza
- THEN muestra badge rojo con texto "Inactivo"
- AND icono `AlertCircle`

#### Scenario: Bajo Volumen

- GIVEN `0 < metrics.ventasCount < 50`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Bajo Volumen"
- AND icono `TrendingUp`

#### Scenario: Activo

- GIVEN `metrics.ventasCount >= 50`
- WHEN renderiza
- THEN muestra badge verde con texto "Activo"
- AND icono `CheckCircle2`

#### Scenario: Total formateado

- GIVEN `ventasTotal = 1234567.5`
- WHEN renderiza la celda
- THEN muestra `$1,234,568` (locale en-US con `.toLocaleString()`)

#### Scenario: Lista vacía

- GIVEN `metrics` con todos los counts en 0
- WHEN renderiza
- THEN muestra fila "No se encontraron datos de ventas."

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/sales`

#### Scenario: Admin en /busy/sales

- GIVEN admin logueado
- WHEN navega a `/busy/sales`
- THEN ve `<SalesHealthCard />` con métricas propias del tenant
- AND la tabla de ventas existente sigue funcionando

#### Scenario: Manager en /busy/sales

- GIVEN manager logueado
- WHEN navega a `/busy/sales`
- THEN la card de salud NO se renderiza
