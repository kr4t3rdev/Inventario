# Affiliate validation scripts

Scripts operativos para validar el flujo de referidos contra Railway DB y el host de producción.

## Requisitos

- `DATABASE_URL` apuntando a Railway
- `pnpm exec tsx`
- Railway CLI autenticado para leer logs cuando haga falta
- Para scripts Playwright: credenciales admin temporales en variables de entorno

## Dominio / DB

- `create-referrer.ts` — crea un tenant referidor elegible y devuelve `referralCode`
- `verify-pending-referral-flow.ts` — valida `pendingReferralCode -> AffiliateReferral`
- `run-domain-validation.sh` — wrapper con retry para la validación de dominio
- `check-user.ts` — inspecciona un usuario por email

## Producción / Host

- `create-temp-admin.ts` — crea admin temporal para pruebas de UI
- `cleanup-user.ts` — elimina un usuario temporal por email
- `playwright-approve-host.ts` — aprueba un company user desde `/admin/usuarios`
- `playwright-confirm-payment-host.ts` — confirma pago desde `/admin/referidos`
- `playwright-preview-credit-host.ts` — ejecuta preview del crédito en `/admin/referidos`
- `check-approved-flow.ts` — valida creación de tenant y referral
- `check-ledger-after-confirm.ts` — valida ledger y balance tras confirmar pago
- `check-credit-preview.ts` — valida snapshot económico de la licencia

## Ejemplos

```bash
DATABASE_URL=... pnpm exec tsx scripts/ops/affiliate/create-referrer.ts
DATABASE_URL=... pnpm exec tsx scripts/ops/affiliate/check-user.ts hostflow@test.local
DATABASE_URL=... scripts/ops/affiliate/run-domain-validation.sh
```

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... TARGET_EMAIL=... TENANT_NAME='Affiliate HostFlow Co' \
  pnpm exec tsx scripts/ops/affiliate/playwright-approve-host.ts
```
