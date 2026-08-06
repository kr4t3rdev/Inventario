# Design: Renovar Licencia de Tenant (panel admin)

## Technical Approach

Nueva Server Action `renewLicenciaAction` en `src/features/admin/actions.ts` usando `withAction`. Transacción Prisma única para la parte determinista (update de licencia + sincronización de usuarios + audit log). El registro de pago + comisión corre en la MISMA transacción cuando el tenant no es referido (pago simple), y como llamada subsecuente al servicio `confirmSalesAgentTenantPayment` cuando el tenant es referido (acoplamiento mínimo con la lógica de comisión ya validada, sin duplicar cálculo de tier ni notificaciones). No hay migración de schema: solo actualiza campos existentes de `TenantLicense` y crea filas en `TenantLicensePayment` + `SalesAgentCommissionLedger` ya existentes.

## Architecture Decisions

### Decision: Transacción unificada vs llamada subsecuente para comisión

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Todo en una transacción Prisma (`tx`) | Consistencia fuerte, pero duplica lógica de tier/comisión/notif | ❌ |
| Llamada subsecuente a `confirmSalesAgentTenantPayment` tras el `update` | Acoplamiento mínimo, reutiliza servicio probado; riesgo de pago sin licencia extendida si el segundo paso falla | ✅ |

**Rationale**: Separar responsabilidades: la renovación admin solo extiende fechas; el servicio de pagos es dueño de comisiones y notificaciones. Si el paso 2 falla, la licencia ya está renovada y el admin recibe toast de warning con el `idempotencyKey` para reintentar solo el pago — patrón idempotente ya diseñado en `payment-service.ts`.

### Decision: Configuración de `inicio` en renovación

| Opción | Decisión |
|--------|----------|
| Mover `inicio` a `now` | ❌ Pierde historial del ciclo original |
| Dejar `inicio` intocado | ✅ Preserva fecha de inicio del ciclo; `expiracion` es el único campo de fecha modificado |

### Decision: Renovación de licencia inactiva/expirada

**Choice**: Calcular `baseExpiracion = Math.max(license.expiracion, now)`, sumar `newPlan.duracionDias`. `activa` siempre `true` al final.
**Rationale**: una licencia revocada que se renueva reactiva el acceso; una expirada no suma días a una fecha pasada.

## Data Flow

```
RenewLicenciaDialog ──→ RenewConfirmAlertDialog ──→ renewLicenciaAction
                                                              │
                                                              ▼
                                                      prisma.$transaction
                                                      ├── leer license + plan + referred
                                                      ├── validar (TENANT_NOT_ACTIVE)
                                                      ├── newExpiracion = max(exp,now) + plan.duracionDias
                                                      ├── tenantLicense.update (planId*, max*, features, pricing, expiracion, activa)
                                                      ├── user.updateMany miembros (expiresAt, isActive)
                                                      └── AuditLog
                                                              │
                                              ▼ si registerPayment y no referido
                                      tx.tenantLicensePayment.create (sin comisión)
                                              ▼ si registerPayment y referido (sales-agent)
                                      confirmSalesAgentTenantPayment(...)  ← fuera de tx
                                              ▼ si registerPayment y referido (afiliado)
                                      confirmReferredTenantPaymentAction(...)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/admin/schemas.ts` | Modify | `renewLicenciaSchema`: `tenantLicenseId`, `planId`, `registerPayment: boolean default false`, `amountPaidUsd?`, `idempotencyKey?`; tipo `RenewLicenciaInput` |
| `src/features/admin/actions.ts` | Modify | `renewLicenciaAction` con `withAction` |
| `src/features/admin/index.ts` | Modify | Export barrel de `renewLicenciaAction` |
| `src/app/admin/licencias/page.tsx` | Modify | Botón "Renovar", `RenewLicenciaDialog`, `RenewConfirmAlertDialog`, `handleRenew`, `handleConfirmRenew` |
| `src/features/admin/__tests__/renew-licencia.test.ts` | Create | Tests unitarios de la action |

## Interfaces / Contracts

```ts
export const renewLicenciaSchema = z.object({
  tenantLicenseId: z.string().min(1),
  planId: z.string().min(1),
  registerPayment: z.boolean().optional().default(false),
  amountPaidUsd: z.number().positive().optional(),
  idempotencyKey: z.string().min(1).optional(),
}).refine(v => v.registerPayment ? Boolean(v.idempotencyKey) : true, {
  message: 'idempotencyKey es requerido si registerPayment es true',
  path: ['idempotencyKey'],
});

export const renewLicenciaAction = withAction(async (input, user) => {
  // user.role === 'admin' gate
  // retorna { tenantLicenseId, newExpiracion, newPlanId, registeredPaymentId?, commissionCredited }
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `renewLicenciaAction`: activa sin cambio plan, con cambio plan, inactiva/expirada, tenant inactivo, sincronización `expiresAt`, audit log | Vitest mocking `prisma` + `AuditLogService`; `vi.mocked(prisma.$transaction)` calls `cb(tx)` |
| Unit | Pago referido: llama `confirmSalesAgentTenantPayment` con `idempotencyKey` correcto | Spy en el servicio, asertar args |
| Unit | Pago no referido: crea `TenantLicensePayment` dentro de tx sin comisión | Assert `tx.tenantLicensePayment.create` |
| Unit | Idempotencia: reintentar con misma `idempotencyKey` retorna `duplicate` | Mock servidor existente |
| Component | `RenewLicenciaDialog` renderiza, plan default = actual, checkbox revela bloque, validación monto | Testing Library + userEvent |
| Component | `RenewConfirmAlertDialog` diff correcto, botón dispara submit | Testing Library |

## Migration / Rollback

No migration required. La action es aditiva; rollback = revert commit. No toca `updateLicenciaAction` ni `changePlanAction`.

## Open Questions

- [ ] ¿El monto `amountPaidUsd` debe ser obligatorio cuando `registerPayment: true` (o default al `expectedAmount` como hace `confirmSalesAgentTenantPayment`)? Propuesta: default a `expectedAmount` si se omite, manteniendo consistencia.
- [ ] El dialog de renovación: ¿el botón "Registrar pago" usa un `Switch` o `Checkbox` shadcn? (cosmético; `Checkbox` ya está importado en la página).
