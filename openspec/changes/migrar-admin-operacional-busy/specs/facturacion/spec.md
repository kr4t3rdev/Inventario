# Spec: Salud operativa de Facturación en /busy/facturas

## Purpose

Exponer la salud operativa del propio tenant (Cantidad de Facturas y Ventas + Tasa de
Formalización) en `/busy/facturas`, **visible solo para admin**.

## Requirements

### Requirement: Action `getBillingHealthAction` por-tenant

En `src/features/facturas/actions-health.ts` retorna
`metrics: { facturasCount, ventasCount, formalizationRate }`.

`formalizationRate` = `Math.round((facturasCount / ventasCount) * 100)` si `ventasCount > 0`,
si no `0`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getBillingHealthAction()`
- THEN retorna counts de `prisma.factura` y `prisma.venta` filtrados por tenant

#### Scenario: Cálculo de tasa con ventas

- GIVEN 4 facturas y 10 ventas
- WHEN llama
- THEN `formalizationRate === 40`

#### Scenario: Cálculo de tasa sin ventas

- GIVEN 0 ventas (con o sin facturas)
- WHEN llama
- THEN `formalizationRate === 0`

#### Scenario: No admin

- GIVEN role !== 'admin'
- WHEN llama
- THEN retorna `{ success: false, error: { code: "FORBIDDEN" } }`

#### Scenario: Sin tenant

- GIVEN user sin tenantId
- WHEN llama
- THEN retorna error de `requireTenant`

#### Scenario: Cobertura 100%

---

### Requirement: Componente `<BillingHealthCard />`

En `src/features/facturas/components/billing-health-card.tsx`.

#### Scenario: Tasa baja

- GIVEN `metrics.formalizationRate < 30`
- WHEN renderiza
- THEN muestra badge rojo con texto "Bajo"
- AND icono `AlertCircle`

#### Scenario: Tasa media

- GIVEN `30 <= metrics.formalizationRate < 70`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Medio"
- AND icono `Clock`

#### Scenario: Tasa alta

- GIVEN `metrics.formalizationRate >= 70`
- WHEN renderiza
- THEN muestra badge verde con texto "Alto"
- AND icono `CheckCircle2`

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/facturas`

#### Scenario: Admin en /busy/facturas

- GIVEN admin logueado
- WHEN navega a `/busy/facturas`
- THEN ve `<BillingHealthCard />` con métricas propias del tenant

#### Scenario: Manager en /busy/facturas

- GIVEN manager logueado
- WHEN navega a `/busy/facturas`
- THEN la card de salud NO se renderiza
