# Spec: Salud operativa de Mermas en /busy/mermas

## Purpose

Exponer la salud operativa del propio tenant (Cantidad y Valor Total de Mermas) en
`/busy/mermas`, **visible solo para admin**.

## Requirements

### Requirement: Action `getWastageHealthAction` por-tenant

En `src/features/mermas/actions-health.ts` retorna
`metrics: { mermasCount, mermasTotalValue }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getWastageHealthAction()`
- THEN retorna counts de `prisma.merma` filtrados por tenant
- AND `mermasTotalValue` = suma de `prisma.merma.costoTotal` del tenant

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

### Requirement: Componente `<WastageHealthCard />`

En `src/features/mermas/components/wastage-health-card.tsx`.

#### Scenario: Sin mermas (positivo)

- GIVEN `metrics.mermasCount === 0`
- WHEN renderiza
- THEN muestra badge verde con texto "Saludable"
- AND icono `CheckCircle2`

#### Scenario: Pocas mermas

- GIVEN `0 < metrics.mermasCount <= 10`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Atención"
- AND icono `Clock`

#### Scenario: Muchas mermas

- GIVEN `metrics.mermasCount > 10 && mermasCount <= 50`
- WHEN renderiza
- THEN muestra badge naranja con texto "Elevado"

#### Scenario: Excesivo

- GIVEN `metrics.mermasCount > 50`
- WHEN renderiza
- THEN muestra badge rojo con texto "Crítico"
- AND icono `AlertCircle`

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/mermas`

#### Scenario: Admin en /busy/mermas

- GIVEN admin logueado
- WHEN navega a `/busy/mermas`
- THEN ve `<WastageHealthCard />` con métricas propias del tenant
- AND la tabla/listado existente sigue funcionando

#### Scenario: Manager en /busy/mermas

- GIVEN manager logueado
- WHEN navega a `/busy/mermas`
- THEN la card de salud NO se renderiza
