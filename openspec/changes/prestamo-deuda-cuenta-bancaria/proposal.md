# Proposal: Vincular Préstamo y Deuda a Cuenta Bancaria

## Intent

Al crear un Préstamo o Deuda Cash no hay impacto en el saldo de ninguna cuenta bancaria. Esto genera una brecha contable: el dinero sale o entra físicamente pero el sistema no lo registra. Se necesita vincular cada operación a una cuenta para reflejar el movimiento real de efectivo/tarjeta.

## Scope

### In Scope
- Agregar `cuentaBancariaId` (Select) al formulario de creación de **Préstamo Cash**
- Agregar `cuentaBancariaId` (Select) al formulario de creación de **Deuda Cash**
- Al crear Préstamo: **decrementar** `CuentaBancaria.saldo` por `montoCapital` dentro de la `$transaction` existente
- Al crear Deuda: **incrementar** `CuentaBancaria.saldo` por `montoCapital` dentro de la `$transaction` existente
- Al registrar pago de Préstamo: **incrementar** el saldo de la cuenta bancaria usada en el pago
- Al registrar pago de Deuda: **decrementar** el saldo de la cuenta bancaria usada en el pago
- Migración Prisma: agregar `cuentaBancariaId` a `PrestamoCash` y `DeudaCash`

### Out of Scope
- Rediseño del modal de pago (ya tiene `cuentaId` en su Zod schema)
- Reportes/analytics de impacto en cuentas
- Manejo de conversión de moneda al movimiento bancario (se usa el monto tal cual)

## Approach

1. **Prisma**: agregar `cuentaBancariaId String?` (nullable para no romper registros históricos) con relación a `CuentaBancaria` en `PrestamoCash` y `DeudaCash`
2. **API POST prestamos-cash**: recibir `cuentaBancariaId`, dentro de `$transaction` agregar `prisma.cuentaBancaria.update({ data: { saldo: { decrement: montoCapital } } })`
3. **API POST deudas-cash**: ídem con `increment`
4. **API pagar prestamos-cash**: dentro de la `$transaction` existente, agregar `increment` sobre la `cuentaId` que ya llega en el body del pago
5. **API pagar deudas-cash**: ídem con `decrement`
6. **Forms**: agregar `<Select>` de cuentas bancarias (el hook `useGetCuentasBancariasQuery` ya está disponible en ambas pages padre y se pasa como prop)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Agregar `cuentaBancariaId String?` + relación en `PrestamoCash` y `DeudaCash` |
| `src/components/contabilidad/prestamos-cash/prestamo-cash-form.tsx` | Modified | Agregar prop `cuentasBancarias` + campo Select `cuentaBancariaId` en Zod + form |
| `src/components/contabilidad/deudas-cash/deuda-cash-form.tsx` | Modified | Ídem para deuda |
| `src/app/api/contabilidad/prestamos-cash/route.ts` | Modified | POST: validar `cuentaBancariaId`, decrementar saldo en transacción |
| `src/app/api/contabilidad/deudas-cash/route.ts` | Modified | POST: validar `cuentaBancariaId`, incrementar saldo en transacción |
| `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.ts` | Modified | Al cobrar: incrementar saldo de la cuenta del pago |
| `src/app/api/contabilidad/deudas-cash/[id]/pagar/route.ts` | Modified | Al pagar: decrementar saldo de la cuenta del pago |
| `src/lib/redux/services/prestamosCashApi.tsx` | Modified | Agregar `cuentaBancariaId` al payload de `useCreatePrestamoCashMutation` |
| `src/lib/redux/services/deudasCashApi.tsx` | Modified | Agregar `cuentaBancariaId` al payload de `useCreateDeudaCashMutation` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Saldo negativo en cuenta bancaria | Med | Validar en API que `saldo >= montoCapital` antes de decrementar en préstamos |
| Registros históricos sin `cuentaBancariaId` | High | Campo nullable — no rompe datos existentes; solo requerido en UI para nuevas creaciones |
| Doble movimiento en pago de deuda (pago ya tenía `cuentaId`) | Med | La route de pago actualmente NO actualiza saldo — este cambio lo agrega de forma controlada |

## Rollback Plan

`git revert` de los route.ts y form changes. Prisma: el campo nullable no requiere acción urgente; en prod ejecutar `ALTER TABLE DROP COLUMN cuentaBancariaId` si es necesario. El campo ser nullable garantiza que los datos existentes no se rompen bajo ningún escenario.

## Dependencies

- `CuentaBancaria` ya existe con campo `saldo Float` — compatible con `increment`/`decrement` de Prisma
- `useGetCuentasBancariasQuery` ya importado en `prestamos-cash/page.tsx` y `deudas-cash/page.tsx`
- Routes de pago ya reciben `cuentaId` en el body — solo agregar la actualización del saldo

## Success Criteria

- [ ] Al crear un Préstamo, el saldo de la cuenta seleccionada disminuye por `montoCapital`
- [ ] Al crear una Deuda, el saldo de la cuenta seleccionada aumenta por `montoCapital`
- [ ] Al registrar un pago de Préstamo, el saldo de la cuenta vinculada aumenta por el monto cobrado
- [ ] Al registrar un pago de Deuda, el saldo de la cuenta vinculada disminuye por el monto pagado
- [ ] Ambos formularios validan `cuentaBancariaId` como obligatorio
- [ ] Las operaciones son atómicas: si falla la actualización de saldo, no se crea el préstamo/deuda
- [ ] Registros históricos sin cuenta bancaria no se ven afectados
