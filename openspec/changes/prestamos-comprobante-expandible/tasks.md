# Tasks: Comprobante y Detalle de Pagos para Préstamos en CxC

## Phase 1: Foundation (Types + API)

- [x] 1.1 `src/app/models/model.ts` — Agregar `_reconciliaciones?: any[]` y `prestamoCash?: { id: string; idNumerico: number; montoCapital: number; moneda: string; tasaCambioAlCrear?: number; observaciones?: string }` a interface `CuentaPorCobrar`
- [x] 1.2 `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` — Agregar `prestamoCash: { include: { reconciliaciones: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } } } }` al include de la query Prisma
- [x] 1.3 Mismo archivo — En el mapper `cuentasUnicas`, normalizar `_reconciliaciones`: si `tipoCuenta === 'PRESTAMO_CASH'` usar `cuenta.prestamoCash?.reconciliaciones ?? []`, else usar `cuenta.factura?.venta?.reconciliaciones ?? []`. Incluir `prestamoCash: { id, idNumerico, montoCapital, moneda, tasaCambioAlCrear, observaciones }` en la respuesta.

## Phase 2: Frontend — Tabla CxC

- [x] 2.1 `src/components/contabilidad/cuentas-por-cobrar-table.tsx` columna `idFactura` — Si `tipoCuenta === 'PRESTAMO_CASH'`, mostrar `cuenta.id.slice(-8)` con tooltip del ID completo en lugar de `-`
- [x] 2.2 Columna `numeroFactura` — Si `tipoCuenta === 'PRESTAMO_CASH'`, mostrar `PREST-{cuenta.prestamoCash?.idNumerico}` con badge violet
- [x] 2.3 Columna `expander` — Cambiar `tienePagos` de `factura?.venta?.reconciliaciones?.length > 0` a `(cuenta as any)._reconciliaciones?.length > 0`
- [x] 2.4 `PagosExpandidos` — Cambiar fuente de `reconciliaciones` de `cuenta.factura?.venta?.reconciliaciones` a `cuenta._reconciliaciones`. Ajustar mensaje vacío: "este préstamo" si es PRESTAMO_CASH, "esta factura" si no
- [x] 2.5 Columna `acciones` — Si `esPrestamo`: botón FileText descarga `/api/contabilidad/prestamos-cash/${cuenta.prestamoCash?.id}/comprobante` con filename `comprobante-PREST-{idNumerico}.pdf`. Mantener badge "Préstamo" existente.

## Phase 3: Endpoint PDF Comprobante

- [x] 3.1 Crear `src/app/api/contabilidad/prestamos-cash/[id]/comprobante/route.ts` — Handler GET con `runtime = 'nodejs'`. Query: `prisma.prestamoCash.findUnique({ where: { id }, include: { cliente: true, cuentaPorCobrar: true } })`. Retornar 404 si no existe.
- [x] 3.2 Mismo archivo — Función `generateComprobantePDF(page, fontRegular, fontBold, prestamo)`: página A4, mitad superior = Copia Cliente (comprobante PREST-{idNumerico}, nombre cliente, capital, monto a pagar, moneda, tasa de cambio si ≠ CUP, fechas). Línea de corte punteada al medio.
- [x] 3.3 Mismo archivo — Mitad inferior = Copia Interna: mismos campos que copia cliente + sección "Observaciones" con `prestamo.observaciones`. Response: `Content-Type: application/pdf`, filename `comprobante-PREST-{idNumerico}.pdf`.

## Phase 4: Verification

- [ ] 4.1 Manual: Crear préstamo, registrar pago, verificar tabla CxC muestra `PREST-{id}` en columna Factura y es expandible con detalle de pagos
- [ ] 4.2 Manual: Verificar ventas regulares no tienen regresión (columnas, expander, botón pagar)
- [ ] 4.3 Manual: Descargar comprobante PDF — verificar 2 copias, observaciones solo en copia interna, tasa de cambio condicional
