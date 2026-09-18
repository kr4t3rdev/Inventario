# Spec: Salud operativa de Contabilidad en /busy/contabilidad

## Purpose

Exponer la salud operativa del propio tenant (Periodo Contable Activo, Último Cierre, Total
Periodos) en `/busy/contabilidad`, **visible solo para admin**.

## Requirements

### Requirement: Action `getAccountingHealthAction` por-tenant

En `src/features/contabilidad/actions-health.ts` retorna
`metrics: { hasActivePeriod, currentPeriodStatus, lastClosedPeriod, totalPeriods }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getAccountingHealthAction()`
- THEN `hasActivePeriod` = existe `prisma.periodoContable` con `estado = 'ABIERTO'`
- AND `currentPeriodStatus` = estado del periodo activo o `null`
- AND `lastClosedPeriod` = codigo del último periodo `CERRADO` por `fechaFin desc` o `null`
- AND `totalPeriods` = count de `prisma.periodoContable`

#### Scenario: Tenant sin periodos

- GIVEN tenant sin periodos
- WHEN llama
- THEN `hasActivePeriod === false`, `currentPeriodStatus === null`,
  `lastClosedPeriod === null`, `totalPeriods === 0`

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

### Requirement: Componente `<AccountingHealthCard />`

En `src/features/contabilidad/components/accounting-health-card.tsx`.

#### Scenario: Bloqueado

- GIVEN `metrics.hasActivePeriod === false`
- WHEN renderiza
- THEN muestra badge rojo con texto "Bloqueado"
- AND icono `AlertCircle`

#### Scenario: Iniciando

- GIVEN `hasActivePeriod === true && totalPeriods < 2`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Iniciando"
- AND icono `Clock`

#### Scenario: Operativo

- GIVEN `hasActivePeriod === true && totalPeriods >= 2`
- WHEN renderiza
- THEN muestra badge verde con texto "Operativo"
- AND icono `CheckCircle2`

#### Scenario: Muestra estado del periodo activo

- GIVEN `currentPeriodStatus = "ABIERTO"`
- WHEN renderiza la celda "Periodo Activo"
- THEN muestra un badge verde con texto "ABIERTO"

#### Scenario: Muestra sin periodo activo

- GIVEN `hasActivePeriod === false`
- WHEN renderiza la celda "Periodo Activo"
- THEN muestra un badge rojo con texto "Ninguno"

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/contabilidad`

#### Scenario: Admin en /busy/contabilidad

- GIVEN admin logueado
- WHEN navega a `/busy/contabilidad`
- THEN ve `<AccountingHealthCard />` con métricas propias del tenant
- AND el dashboard contable existente sigue funcionando

#### Scenario: Manager en /busy/contabilidad

- GIVEN manager logueado
- WHEN navega a `/busy/contabilidad`
- THEN la card de salud NO se renderiza
