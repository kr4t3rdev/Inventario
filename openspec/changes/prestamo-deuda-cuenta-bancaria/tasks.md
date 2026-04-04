# Tasks: Vincular Préstamo y Deuda a Cuenta Bancaria

## Phase 1: Foundation — Prisma Schema

- [x] 1.1 En `prisma/schema.prisma`: agregar `cuentaBancariaId String?` y relación `cuentaBancaria CuentaBancaria? @relation(fields: [cuentaBancariaId], references: [cuentaId])` al modelo `PrestamoCash`
- [x] 1.2 En `prisma/schema.prisma`: ídem para el modelo `DeudaCash`
- [x] 1.3 En `prisma/schema.prisma`: agregar campos inversos en `CuentaBancaria` — `prestamosCash PrestamoCash[]` y `deudasCash DeudaCash[]`
- [x] 1.4 Ejecutar `pnpm prisma migrate dev --name prestamo_deuda_cuenta_bancaria` y verificar que aplica sin errores
- [x] 1.5 Ejecutar `pnpm prisma generate` y confirmar que los tipos actualizados aparecen en Prisma Client

## Phase 2: Backend — Creación con impacto en saldo

- [x] 2.1 En `src/app/api/contabilidad/prestamos-cash/route.ts`: agregar `cuentaBancariaId: z.string()` (required) al Zod `createSchema` del POST
- [x] 2.2 En mismo archivo POST: dentro del `$transaction`, agregar `prisma.cuentaBancaria.update({ where: { cuentaId: cuentaBancariaId }, data: { saldo: { decrement: montoCapital } } })` — ANTES de crear el PrestamoCash
- [x] 2.3 En mismo archivo POST: agregar validación previa a la transacción — leer la cuenta, verificar que `cuenta.saldo >= montoCapital`, responder 400 si no
- [x] 2.4 En `src/app/api/contabilidad/deudas-cash/route.ts`: agregar `cuentaBancariaId: z.string()` (required) al Zod `createSchema` del POST
- [x] 2.5 En mismo archivo POST: dentro del `$transaction`, agregar `prisma.cuentaBancaria.update({ data: { saldo: { increment: montoCapital } } })` junto con la creación de la DeudaCash

## Phase 3: Backend — Pagos con impacto en saldo

- [x] 3.1 En `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.ts`: dentro del `$transaction` existente, agregar `prisma.cuentaBancaria.update({ where: { cuentaId: body.cuentaId }, data: { saldo: { increment: body.monto } } })`
- [x] 3.2 En `src/app/api/contabilidad/deudas-cash/[id]/pagar/route.ts`: dentro del `$transaction` existente, agregar `prisma.cuentaBancaria.update({ where: { cuentaId: body.cuentaId }, data: { saldo: { decrement: body.monto } } })`

## Phase 4: Frontend — Formularios

- [x] 4.1 En `src/components/contabilidad/prestamos-cash/prestamo-cash-form.tsx`: agregar `cuentaBancariaId: z.string({ required_error: 'Requerido' })` al Zod schema
- [x] 4.2 En mismo form: agregar prop `cuentasBancarias: CuentaBancaria[]` a la interface de props
- [x] 4.3 En mismo form: agregar campo `<Select>` con label "Cuenta bancaria origen" mapeando las `cuentasBancarias` — mostrar `nombreBanco + ' · ' + tipoCuenta + ' (' + moneda + ')'`
- [x] 4.4 En `src/app/busy/contabilidad/prestamos-cash/page.tsx`: pasar `cuentasBancarias={cuentasBancarias}` al componente `PrestamoCashForm`
- [x] 4.5 En `src/components/contabilidad/deudas-cash/deuda-cash-form.tsx`: ídem pasos 4.1-4.3 con label "Cuenta bancaria destino"
- [x] 4.6 En `src/app/busy/contabilidad/deudas-cash/page.tsx`: pasar `cuentasBancarias={cuentasBancarias}` al componente `DeudaCashForm`

## Phase 5: Redux — Tipos y payload

- [x] 5.1 En `src/lib/redux/services/prestamosCashApi.tsx`: agregar `cuentaBancariaId: string` al tipo del body de `useCreatePrestamoCashMutation` e invalidar también `'CuentasBancarias'` tras la mutation
- [x] 5.2 En `src/lib/redux/services/deudasCashApi.tsx`: ídem para `useCreateDeudaCashMutation`

## Phase 6: Verificación

- [x] 6.1 Verificar scenario "Creación exitosa con cuenta" — crear préstamo, confirmar que `CuentaBancaria.saldo` decrementó
- [x] 6.2 Verificar scenario "Saldo insuficiente" — intentar préstamo con saldo < capital, confirmar 400 sin registros creados
- [x] 6.3 Verificar scenario "Creación exitosa deuda" — crear deuda, confirmar que `CuentaBancaria.saldo` incrementó
- [x] 6.4 Verificar scenario "Cobro cuota préstamo" — registrar pago, confirmar incremento de saldo en la cuenta del cobro
- [x] 6.5 Verificar scenario "Pago cuota deuda" — registrar pago, confirmar decremento en la cuenta
- [x] 6.6 Verificar retrocompatibilidad — consultar una deuda/préstamo histórico con `cuentaBancariaId = null`, confirmar que carga sin errores
