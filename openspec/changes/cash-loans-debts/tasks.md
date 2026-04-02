# Tasks: Cash Loans & Debts Management

## Phase 1: Database — Schema y Migración

- [ ] 1.1 En `prisma/schema.prisma`: Add enums `CuentaPorCobrarTipo { VENTA PRESTAMO_CASH }`, `CuentaPorPagarTipo { COMPRA DEUDA_CASH }`, `TipoReconciliacion { VENTA PRESTAMO_CASH DEUDA_CASH }`, `EstadoPréstamoCash { ACTIVO PAGADO VENCIDO CANCELADO }`
- [ ] 1.2 En `prisma/schema.prisma`: Add `tipoCuenta CuentaPorCobrarTipo @default(VENTA)` al modelo `CuentaPorCobrar`
- [ ] 1.3 En `prisma/schema.prisma`: Add `tipoDeuda CuentaPorPagarTipo @default(COMPRA)` al modelo `CuentaPorPagar`
- [ ] 1.4 En `prisma/schema.prisma`: Add `tipoReconciliacion TipoReconciliacion @default(VENTA)` al modelo `ReconciliacionVenta`
- [ ] 1.5 En `prisma/schema.prisma`: Create model `PréstamoCash` (id cuid, idNumerico autoincrement, clienteId, cuentaPorCobrarId @unique, montoCapital, moneda, tasaInteres?, fechaOtorgamiento, fechaVencimiento?, estado, observaciones?, createdById, deletedAt?, @@index([clienteId, estado]), @@index([estado, fechaVencimiento]))
- [ ] 1.6 En `prisma/schema.prisma`: Create model `DeudaCash` (estructura simétrica a PréstamoCash con proveedorId y cuentaPorPagarId @unique)
- [ ] 1.7 Run: `pnpm prisma migrate dev --name add_cash_loans_debts` y verificar migración aplica sin errores
- [ ] 1.8 Run: `pnpm prisma generate` y confirmar que los tipos `PréstamoCash`, `DeudaCash` están en Prisma Client

## Phase 2: API Routes — Backend

- [ ] 2.1 Create `src/app/api/contabilidad/prestamos-cash/route.ts`: `GET` con `withAuthGet` + `querySchema` (estado, clienteId, moneda, fechas) + `prisma.préstamoCash.findMany` con include CuentaPorCobrar
- [ ] 2.2 En mismo archivo: `POST` con `withAuthPost` + `createSchema` Zod + `prisma.$transaction([create PréstamoCash + create CuentaPorCobrar{ tipoCuenta: 'PRESTAMO_CASH' }])` + `AuditLogService.log`
- [ ] 2.3 Create `src/app/api/contabilidad/prestamos-cash/[id]/route.ts`: `GET` (detalle + historial de pagos) y `PUT` con `updateSchema` Zod (solo fechaVencimiento, tasaInteres, observaciones — rechazar montoCapital/moneda)
- [ ] 2.4 Create `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.ts`: `POST` con `pagoSchema` Zod + validar `monto ≤ saldoPendiente` + `prisma.$transaction([create ReconciliacionVenta{ tipoReconciliacion: 'PRESTAMO_CASH'}, update CuentaPorCobrar montoPagado, update PréstamoCash estado si saldo=0])`
- [ ] 2.5 Create `src/app/api/contabilidad/deudas-cash/route.ts`: Idéntico a 2.1-2.2 con `DeudaCash` y `CuentaPorPagar{ tipoDeuda: 'DEUDA_CASH' }`
- [ ] 2.6 Create `src/app/api/contabilidad/deudas-cash/[id]/route.ts`: Idéntico a 2.3 para deudas
- [ ] 2.7 Create `src/app/api/contabilidad/deudas-cash/[id]/pagar/route.ts`: Idéntico a 2.4 con `tipoReconciliacion: 'DEUDA_CASH'`

## Phase 3: Redux — Services

- [ ] 3.1 En `src/lib/redux/services/apiSlice.tsx`: Add `'PréstamosCash'` y `'DeudasCash'` al array `tagTypes`
- [ ] 3.2 Create `src/lib/redux/services/prestamosApi.ts`: `apiSlice.injectEndpoints` con `getPréstamosCash` (query + providesTags), `createPréstamoCash` (mutation + invalidates), `updatePréstamoCash` (mutation), `registrarPagoPréstamo` (mutation + invalidates PréstamosCash + CuentasBancarias). Export hooks.
- [ ] 3.3 Create `src/lib/redux/services/deudasApi.ts`: Idéntico para DeudaCash. Export hooks.
- [ ] 3.4 En `src/app/models/model.ts` (o `src/lib/types/`): Add tipos `PréstamoCash`, `DeudaCash`, `CreatePréstamoCashRequest`, `RegistrarPagoRequest`

## Phase 4: UI — Componentes

- [ ] 4.1 Create `src/components/contabilidad/prestamos-cash/prestamos-cash-table.tsx`: `@tanstack/react-table` + `ColumnDef<PréstamoCash>[]` + `EstadoBadge` helper (ACTIVO=green, PAGADO=gray, VENCIDO=red, CANCELADO=orange) + `framer-motion` + `useReducedMotion()`. Props: `{ préstamos, isLoading, error, onPagar }`
- [ ] 4.2 Create `src/components/contabilidad/prestamos-cash/prestamo-cash-form.tsx`: `useForm` + `zodResolver` + `useCreatePréstamoCashMutation().unwrap()` + `sileo` toast. Dialog con campos: Cliente (searchable), montoCapital, moneda, fechaOtorgamiento, fechaVencimiento, tasaInteres?, observaciones?
- [ ] 4.3 Create `src/components/contabilidad/prestamos-cash/pago-prestamo-modal.tsx`: Dialog de pago con campos: monto, cuentaBancaria, tipoPago, moneda, tasaCambio?. Deshabilitar submit si `monto > saldoPendiente`. Cálculo live de `montoConvertido`. Usar `useRegistrarPagoPréstamoMutation().unwrap()` + `sileo`.
- [ ] 4.4 Create `src/components/contabilidad/deudas-cash/deudas-cash-table.tsx`: Simétrico a 4.1 con `DeudaCash` y badge `DEUDA_CASH`
- [ ] 4.5 Create `src/components/contabilidad/deudas-cash/deuda-cash-form.tsx`: Simétrico a 4.2 con Proveedor (searchable) en lugar de Cliente
- [ ] 4.6 Create `src/components/contabilidad/deudas-cash/pago-deuda-modal.tsx`: Simétrico a 4.3

## Phase 5: UI — Pages

- [ ] 5.1 Create `src/app/busy/contabilidad/prestamos-cash/page.tsx`: Pattern `function PréstamosCashContent()` + `export default function Page() { return <Suspense><PréstamosCashContent /></Suspense> }`. Estado: `openForm`, `préstamoSeleccionado`, `openPago`, `tabActiva`. RTK hooks + `useGetClientesQuery`. Tabs: "lista" y "reportes". Dialogs fuera del Tabs.
- [ ] 5.2 Create `src/app/busy/contabilidad/deudas-cash/page.tsx`: Simétrico a 5.1 con `useGetVendorsQuery()` en lugar de clientes
- [ ] 5.3 Add feature flags: Check `process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'` en ambas pages, retornando `<Card>Feature deshabilitada</Card>` si flag es false

## Phase 6: Integración — Navegación y Dashboard

- [ ] 6.1 Actualizar sidebar de contabilidad: agregar ítems "Préstamos en Efectivo" → `/contabilidad/prestamos-cash` y "Deudas en Efectivo" → `/contabilidad/deudas-cash` bajo submenús de Cuentas por Cobrar/Pagar
- [ ] 6.2 En `/app/busy/contabilidad/page.tsx` (dashboard principal): Agregar dos widgets-card para resumen de PréstamosCash activos y DeudasCash activas con totales por moneda

## Phase 7: Testing

- [ ] 7.1 Create `src/app/api/contabilidad/prestamos-cash/route.test.ts`: Test POST crea PréstamoCash + CuentaPorCobrar atómicamente; test GET filtra por estado; test overpayment rechazado con 400
- [ ] 7.2 Create `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.test.ts`: Test pago parcial no cambia estado; test pago final cambia estado a PAGADO; test monto > saldo rechazado
- [ ] 7.3 Create `src/app/api/contabilidad/deudas-cash/route.test.ts`: Escenarios equivalentes a 7.1 para deudas
- [ ] 7.4 Verificar manualmente: crear préstamo desde UI, registrar pago parcial, verificar saldoPendiente en dashboard, registrar pago final, confirmar estado PAGADO
- [ ] 7.5 Verificar: tabla de prestamos-cash NO muestra filas con tipoCuenta='VENTA'; tabla de cuentas-por-cobrar NO muestra filas con tipoCuenta='PRESTAMO_CASH'
