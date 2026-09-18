# Proposal: Renovar Licencia de Tenant (panel admin)

## Intent

El panel admin (`/admin/licencias`) no permite renovar la vigencia de un tenant con licencia activa. `updateLicenciaAction` acepta `expiracion` en su schema pero ninguna UI lo usa; `changePlanAction` cambia plan sin tocar fechas; `convertDemoToPaidPlanAction` solo aplica a demos. Los flujos de pago de sales-agent/affiliate acreditan comisión sin extender `expiracion`. Resultado: un tenant que paga su renovación no ve extendida su vigencia — gap funcional P0. Esta change añade la operación central del ciclo de vida de una licencia paga.

## Scope

### In Scope
- Server action `renewLicenciaAction` con `withAction` que extiende `expiracion` (suma `plan.duracionDias` a la expiración actual, preservando días pendientes), sincroniza `expiresAt` de los usuarios del tenant, reactiva `activa: true`, audita y opcionalmente registra `TenantLicensePayment` idempotente + comisión al gestor/afiliado.
- Schema Zod `renewLicenciaSchema` (`tenantLicenseId`, `planId` default actual, `registerPayment` boolean, `idempotencyKey?`).
- `RenewLicenciaDialog` (plan seleccionable default actual, duración fija = plan seleccionado, checkbox "Registrar pago" que revela bloque monto exigible + idempotencyKey + comisión estimada).
- `RenewConfirmAlertDialog` con diff visual antes → después (plan, días, expiración, precio, comisión).
- Botón "Renovar" en la fila de `/admin/licencias` con icono `RefreshCcw`, disponible para activas e inactivas.
- Reuso de `resolveLicensePricing` + `isTenantReferred` + `confirmSalesAgentTenantPayment`/`confirmReferredTenantPaymentAction` (transacción unificada o llamada subsecuente — decide implementación).
- Tests Vitest para la action (cambios plan, sin pago, con pago, licencia inactiva, monto inválido, idempotencia, sincronización `expiresAt`).

### Out of Scope
- Pasarela de pago / checkout (el admin confirma un pago presencial ya cobrado).
- Edición manual de días (fija = `plan.duracionDias`).
- Renovación masiva (bulk renew) — trabajo futuro.
- Rediseño visual general de `/admin/licencias` (colorize/adapt resueltos por separado vía audit).

## Approach

Extender el módulo `features/admin` siguiendo el patrón Server Actions existente. La action en una transacción Prisma:
1. Lee la licencia + plan actual + nuevo plan (si difiere) + `isTenantReferred` + membresías activas.
2. Valida tenant activo (gate `TENANT_NOT_ACTIVE`).
3. Calcula `newExpiracion = license.expiracion + newPlan.duracionDias` (renovación desde expiración actual, preserva días pendientes).
4. `tenantLicense.update` con `planId`, `inicio` no se toca, `expiracion: newExpiracion`, `activa: true`, `max*` del nuevo plan, `features: Prisma.JsonNull`, `featureOverrides: {}`, pricing vía `resolveLicensePricing`.
5. `user.updateMany` de miembros activos → `expiresAt: newExpiracion, isActive: true`.
6. `AuditLogService.log` con diff.
7. Si `registerPayment`: persistir `TenantLicensePayment` (status `confirmed`, `paymentKind: 'renewal'`) con `idempotencyKey` y `paymentCycleEndsAt = newExpiracion`; si el tenant es referido por sales-agent, acreditar comisión vía la lógica de `confirmSalesAgentTenantPayment` (reuso del servicio, no duplicar cálculo); si es afiliado, `confirmReferredTenantPaymentAction`.

Decisión abierta para implementación (sdd-design): si la comisión corre dentro de la misma transacción del `update` de la licencia (consistencia fuerte, reusa `tx`) o como llamada subsecuente al servicio existente (acoplamiento mínimo, riesgo de doble escritura). El design lo resuelve.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/actions.ts` | Modified | Añadir `renewLicenciaAction` |
| `src/features/admin/schemas.ts` | Modified | Añadir `renewLicenciaSchema` + tipos |
| `src/features/admin/index.ts` | Modified | Export `renewLicenciaAction` |
| `src/app/admin/licencias/page.tsx` | Modified | Botón "Renovar", `RenewLicenciaDialog`, `RenewConfirmAlertDialog`, handler `handleRenew` |
| `src/features/sales-agent/services/payment-service.ts` | Possibly Modified | Exponer helper interno para reuso dentro de la transacción (si design opta por transacción unificada) |
| `tests` | New | `src/features/admin/__tests__/renew-licencia.test.ts` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Comisión duplicada si el pago se confirma por dos paths | Med | `idempotencyKey` visible + constraint único `tenantLicenseId_paymentCycleEndsAt`; tests de colisión |
| `expiracion` actual ya vencida → suma días a fecha pasada | Baja | Usar `Math.max(license.expiracion, now)` implícito al sumar; test explícito |
| Inconsistencia `expiresAt` usuario vs `expiracion` licencia | Baja | Mismo `updateMany` que `convertDemoToPaidPlanAction`; test de sincronización |
| Conflicto con flujo existente de sales-agent | Media | Reuso del servicio, no invención nueva; design valida punto de integración |

## Rollback Plan

Revertir el commit. La action es aditiva (no modifica `updateLicenciaAction` ni `changePlanAction`); quitar `renewLicenciaAction`, el schema, el botón y los dialogos devuelve la app al estado previo. No hay migración de schema Prisma — la renovación solo actualiza campos existentes.

## Dependencies

- `@/features/sales-agent/services/payment-service.ts` (reuso de `confirmSalesAgentTenantPayment`)
- `@/lib/services/plan-pricing` (`resolveLicensePricing`, `isTenantReferred`)
- `@/lib/services/audit-log-service`

## Success Criteria

- [ ] El admin puede renovar desde `/admin/licencias` una licencia activa extendiendo `expiracion` en `plan.duracionDias` días desde el vencimiento actual.
- [ ] Renovar una licencia revocada/expirada la reactiva (`activa: true`).
- [ ] Cambiar plan al renovar sincroniza `planId`, `max*`, `features`, `featureOverrides` y pricing.
- [ ] Si se marca "Registrar pago" y el tenant es referido, se acredita comisión al gestor/afiliado de forma idempotente.
- [ ] `expiresAt` de los usuarios del tenant se sincroniza con la nueva `expiracion`.
- [ ] `AuditLog` registra el diff (plan anterior/nuevo, fechas, paymentId si aplica).
- [ ] Tests pasan: `pnpm run test:run` con cobertura de los 6 escenarios.
- [ ] `pnpm run lint` y `pnpm run typecheck` limpios.
