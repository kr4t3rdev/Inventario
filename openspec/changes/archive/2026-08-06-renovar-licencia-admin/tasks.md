# Tasks: Renovar Licencia de Tenant (panel admin)

## Phase 1: Foundation — Schema y tipos

- [x] 1.1 En `src/features/admin/schemas.ts` añadir `renewLicenciaSchema` (Zod): `tenantLicenseId: z.string().min(1)`, `planId: z.string().min(1)`, `registerPayment: z.boolean().optional().default(false)`, `amountPaidUsd: z.number().positive().optional()`, `idempotencyKey: z.string().min(1).optional()` con `.refine` exigiendo `idempotencyKey` si `registerPayment: true`.
- [x] 1.2 Exportar tipo `RenewLicenciaInput = z.infer<typeof renewLicenciaSchema>` y añadirlo al bloque de tipos del archivo.

## Phase 2: Server Action (TDD)

- [x] 2.1 RED: Crear `src/features/admin/__tests__/renew-licencia.test.ts` con suite inicial: mock de `prisma`, `AuditLogService`, `confirmSalesAgentTenantPayment`, `confirmReferredTenantPaymentAction`; caso "renueva activa sin cambio de plan ni pago" falla porque `renewLicenciaAction` no existe.
- [x] 2.2 En `src/features/admin/actions.ts` importar `renewLicenciaSchema`, `RenewLicenciaInput`, `confirmSalesAgentTenantPayment` de `@/features/sales-agent/services/payment-service`, `confirmReferredTenantPaymentAction` de `@/features/affiliate/actions`, añadir `renewLicenciaAction` con `withAction`:
  - gate `user.role !== 'admin'` → `ActionError('Acceso restringido','FORBIDDEN')`
  - `parsed = renewLicenciaSchema.parse(input)`
  - `prisma.$transaction(async (tx) => {…})` devuelve `{ tenantLicenseId, newExpiracion, newPlanId, registeredPaymentId, commissionCredited }`
  - dentro de tx: leer `license` (`include plan`), `newPlan` (`findUnique`), `activeMembership` (`findFirst` tenant+isActive+user.isActive); validar `NOT_FOUND`/`TENANT_NOT_ACTIVE`
  - `baseExpiracion = license.expiracion.getTime() > Date.now() ? license.expiracion : new Date()`; `newExpiracion = new Date(baseExpiracion.getTime() + newPlan.duracionDias*86400000)`
  - `referred = await isTenantReferred(license.tenantId)` (fuera de tx por simplicidad, antes del update)
  - `tx.tenantLicense.update({ planId: newPlan.planId, expiracion: newExpiracion, activa: true, maxUsuarios/maxAlmacenes/maxProductos/maxClientes del newPlan, features: Prisma.JsonNull, featureOverrides: {}, …resolveLicensePricing(Number(newPlan.precio), referred) })`
  - `tx.user.updateMany({ where: { tenantId: license.tenantId, isActive: true, tenantMemberships: { some: { isActive: true } } }, data: { expiresAt: newExpiracion, isActive: true } })`
  - `tx.auditLogService.log` (usar `AuditLogService.log`) con `detalles: { previousExpiracion, newExpiracion, previousPlanId, newPlanId }`
  - si `parsed.registerPayment && !referred`: `tx.tenantLicensePayment.create({…paymentKind:'renewal', status:'confirmed', paymentCycleEndsAt:newExpiracion, confirmedByAdminId:user.userId, expectedAmountUsd, amountPaidUsd ?? expectedAmount, idempotencyKey })` → guarda `registeredPaymentId`
  - retornar objeto de tx
  - FUERA de tx: si `parsed.registerPayment && referred` (sales-agent): `await confirmSalesAgentTenantPayment({ tenantId: license.tenantId, tenantLicenseId: license.tenantLicenseId, idempotencyKey: parsed.idempotencyKey!, amountPaidUsd: parsed.amountPaidUsd, confirmedByAdminId: user.userId })`; capturar `ledgerId` → `commissionCredited: result.credited`
  - FUERA de tx: si `parsed.registerPayment && referred` (afiliado): invocar `confirmReferredTenantPaymentAction({ referralId?, referredTenantId: license.tenantId, sourceTenantLicenseId: license.tenantLicenseId })` — adaptar según schema del affiliate
  - `revalidatePath('/admin/licencias')` + `revalidatePath('/admin')`; retornar resultado
- [x] 2.3 GREEN: implementar hasta que el test 2.1 pase. Validar el test escupe el shape de retorno esperado.
- [x] 2.4 RED/GREEN: añadir tests para los 6 escenarios del spec — (a) activa sin cambio plan ni pago, (b) con cambio plan (assert `planId/max*/features`), (c) inactiva/expirada (assert `baseExpiracion` desde `now`, `activa:true`), (d) `TENANT_NOT_ACTIVE` (sin membresía activa → `ActionError`), (e) pago no referido crea `tenantLicensePayment` en tx, sin spy a sales-agent, (f) pago referido invoca `confirmSalesAgentTenantPayment` con `idempotencyKey` correcto. Confirmar pass con `pnpm test -- renew-licencia`.

## Phase 3: UI — Dialog, confirmación y botón

- [x] 3.1 En `src/app/admin/licencias/page.tsx` importar `renewLicenciaAction` desde `@/features/admin`, `RefreshCcw` (ya importado), `AlertDialog*` desde `@/components/ui/alert-dialog`. Añadir estados: `renewDialogOpen`, `renewConfirmOpen`, `licenseToRenew`, `renewDraft` (`{ planId, registerPayment, amountPaidUsd, idempotencyKey }`), `isRenewing`.
- [x] 3.2 Añadir `RenewLicenciaDialog` (componente local en el mismo archivo, patrón `CambiarPlanDialog`): props `{ open, onClose, planes, licencia, onContinue }`. Cards read-only Tenant/Plan actual/Expiración actual (con badge `formatDistanceToNow`). `<Select>` "Nuevo plan" default `licencia.planId`. `<Checkbox>` "Registrar pago de renovación" → al marcar revela: monto exigible readOnly (`finalPriceUsd ?? listPriceUsd ?? plan.precio`), `idempotencyKey` autogen (helper `genRenewalKey(tenantId, planId)`) copiable, comisión estimada solo si `isTenantReferred` (leer flag vía prop derivada). Footer Cancelar / Continuar → llama `onContinue(draft)`.
- [x] 3.3 Añadir `RenewConfirmAlertDialog` (componente local): props `{ open, onClose, onConfirm, licencia, draft, preview }`. Diff vertical/horizontal: Plan `actual → nuevo`, Días (`plan.duracionDias`), Expiración `actual → nueva`, Precio, Comisión estimada. Botón `Confirmar renovación` (destructivo/primario). `preview` calculado en el padre (`useMemo`) y `{ newExpiracion }` para no repetir lógica.
- [x] 3.4 Añadir handler `handleRenew(draft)` en el componente página: abre `RenewConfirmAlertDialog`. `handleConfirmRenew` llama `renewLicenciaAction(draft)`: toast success `Expiración extendida al <fmt>` o toast error con `r.error?.message`; cierra ambos; `setLicenseToRenew(null)`; `await refreshLicenciasData()`. Si error con código `PAYMENT_ALREADY_CONFIRMED`/`IDEMPOTENCY_CONFLICT` → toast warning manteniendo `idempotencyKey`.
- [x] 3.5 Insertar botón "Renovar" entre "Cambiar Plan" y "Overrides" (línea ~822): `<Button variant="outline" size="sm" onClick={() => { setLicenseToRenew(licencia); setRenewDraft({ planId: licencia.planId ?? '', registerPayment: false }); setRenewDialogOpen(true) }} aria-label={\`Renovar ${licencia.tenantLicenseId}\`}><RefreshCcw className="h-4 w-4 mr-1" /> Renovar</Button>`. Disponible para toda fila (activa/inactiva).
- [x] 3.6 Renderizar `<RenewLicenciasDialog>` y `<RenewConfirmAlertDialog>` al final del JSX de `AdminLicenciasPage` junto a los otros dialogs.

## Phase 4: Export barrel y verificación

- [x] 4.1 En `src/features/admin/index.ts` añadir `renewLicenciaAction` al export de `./actions`.
- [x] 4.2 Ejecutar `pnpm run lint` y `pnpm run typecheck`. Corregir lo que reporten.
- [x] 4.3 Ejecutar `pnpm run test:run`. Todos los tests de `renew-licencia.test.ts` deben pasar.
- [x] 4.4 `pnpm run build` (o `pnpm run dev` + navegación manual a `/admin/licencias`) y verificar: botón visible, abre dialog, cambio de plan habilitado, checkbox revela bloque, AlertDialog con diff correcto, éxito refresca la fila.

## Phase 5: Cleanup

- [x] 5.1 Verificar que no quede el campo fantasma de `expiracion` en `updateLicenciaAction` sin uso documentado (dejarlo, se reutiliza en futuras features inline); añadir `@remarks` JSDoc indicando que `renewLicenciaAction` es la vía canónica.
- [x] 5.2 `graphify update .` para mantener el grafo AST al día.
