# Spec: Salud operativa de Gastos en /busy/gastosDE

## Purpose

Exponer la salud operativa del propio tenant (Cantidad y Total de Gastos) en `/busy/gastosDE`,
**visible solo para admin**.

## Requirements

### Requirement: Action `getExpenseHealthAction` por-tenant

En `src/features/gastosDE/actions-health.ts` retorna
`metrics: { gastosCount, gastosTotal }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getExpenseHealthAction()`
- THEN retorna counts de `prisma.gastosDE` filtrados por tenant
- AND `gastosTotal` = suma de `prisma.gastosDE.monto` del tenant

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

### Requirement: Componente `<ExpenseHealthCard />`

En `src/features/gastosDE/components/expense-health-card.tsx`.

#### Scenario: Sin gastos

- GIVEN `metrics.gastosCount === 0`
- WHEN renderiza
- THEN muestra badge gris con texto "Sin actividad"

#### Scenario: Bajo volumen

- GIVEN `0 < metrics.gastosCount < 50`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Bajo Volumen"

#### Scenario: Activo

- GIVEN `metrics.gastosCount >= 50`
- WHEN renderiza
- THEN muestra badge verde con texto "Activo"

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/gastosDE`

#### Scenario: Admin en /busy/gastosDE

- GIVEN admin logueado
- WHEN navega a `/busy/gastosDE`
- THEN ve `<ExpenseHealthCard />` con métricas propias del tenant
- AND la tabla/listado existente sigue funcionando

#### Scenario: Manager en /busy/gastosDE

- GIVEN manager logueado
- WHEN navega a `/busy/gastosDE`
- THEN la card de salud NO se renderiza
