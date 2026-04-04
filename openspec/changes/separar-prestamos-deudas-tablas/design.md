# Design: Separar Préstamos y Deudas de CxC/CxP

## Technical Approach

3 capas: (1) filtro en APIs CxC/CxP para excluir tipos dedicados, (2) includes de reconciliaciones/pagos en APIs dedicadas, (3) copiar patrón `PagosExpandidos` + `getExpandedRowModel` a tablas dedicadas y limpiar lógica condicional de CxC/CxP.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Filtro de exclusión | `where: { tipoCuenta: { not: 'PRESTAMO_CASH' } }` en Prisma | Filtrar en mapper JS post-query | Prisma filtra en DB = menos data transferida, paginación correcta |
| Reconciliaciones préstamos | Include nested en API préstamos-cash existente | Nuevo endpoint `/reconciliaciones` | Consistente con patrón CxC, evita N+1 |
| Pagos deudas | Include `cuentaPorPagar.pagos` con tipoPago/cuentaBancaria | Query separada | Mismo patrón que reconciliaciones en préstamos |
| PagosExpandidos | Copiar componente inline en cada tabla (no compartir) | Componente compartido en `/components/contabilidad/shared/` | Tablas consumen datos distintos (reconciliaciones vs pagos), complejidad de abstracción innecesaria |

## Data Flow

```
Préstamos:
  API prestamos-cash → Prisma include reconciliaciones → JSON → prestamos-cash-table → PagosExpandidos

Deudas:
  API deudas-cash → Prisma include cuentaPorPagar.pagos → JSON → deudas-cash-table → PagosExpandidos

CxC (después):
  API cxc → where: tipoCuenta != PRESTAMO_CASH → solo ventas → cuentas-por-cobrar-table (limpia)

CxP (después):
  API cxp → where: tipoDeuda != DEUDA_CASH → solo compras/servicios → cuentas-por-pagar-table (limpia)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` | Modify | Add `tipoCuenta: { not: 'PRESTAMO_CASH' }` to whereClause. Remove `prestamoCash` include. Remove `esPrestamo` mapper logic |
| `src/app/api/contabilidad/cuentas-por-pagar/route.ts` | Modify | Add `tipoDeuda: { not: 'DEUDA_CASH' }` to whereClause. Remove `deudaCash` include |
| `src/components/contabilidad/cuentas-por-cobrar-table.tsx` | Modify | Remove: 12+ locations con `esPrestamo`/`PRESTAMO_CASH`, badge PREST-, comprobante download, conditional acciones. Simplify `PagosExpandidos` (no `esPrestamo` branch). Remove `_reconciliaciones` fallback |
| `src/components/contabilidad/cuentas-por-pagar-table.tsx` | Modify | Remove: `handleOpenPago` DEUDA_CASH branch (lines 91-99), `PagoDeudaModal` import, `selectedDeuda`/`openPagoDeuda` states |
| `src/app/api/contabilidad/prestamos-cash/route.ts` | Modify | Add nested include: `reconciliaciones: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } }` |
| `src/app/api/contabilidad/deudas-cash/route.ts` | Modify | Change `cuentaPorPagar: true` → `cuentaPorPagar: { include: { pagos: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaPago: 'desc' } } } }` |
| `src/components/contabilidad/prestamos-cash/prestamos-cash-table.tsx` | Modify | Add: `getExpandedRowModel`, expander column, `PagosExpandidos` component consuming `reconciliaciones` from PrestamoCash |
| `src/components/contabilidad/deudas-cash/deudas-cash-table.tsx` | Modify | Add: `getExpandedRowModel`, expander column, `PagosExpandidos` component consuming `cuentaPorPagar.pagos` from DeudaCash |

## Interfaces / Contracts

### Préstamos API response (after change)
```typescript
// Each prestamo now includes:
prestamo.reconciliaciones: Array<{
  reconciliacionId: string
  monto: Decimal
  fechaReconciliacion: DateTime
  idTransferencia?: string
  tipoPago: { tipoPagoId: string, nombre: string }
  cuentaBancaria?: { cuentaBancariaId: string, nombreBanco: string }
}>
```

### Deudas API response (after change)
```typescript
// Each deuda.cuentaPorPagar now includes:
deuda.cuentaPorPagar.pagos: Array<{
  pagoId: string
  monto: Decimal
  fechaPago: DateTime
  referencia?: string
  tipoPago: { tipoPagoId: string, nombre: string }
  cuentaBancaria?: { cuentaBancariaId: string, nombreBanco: string }
}>
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Manual | CxC no muestra préstamos, CxP no muestra deudas | Verificar visualmente con datos mixtos |
| Manual | Expander préstamos/deudas funciona | Crear préstamo con pagos, expandir |
| Manual | Botones pago siguen funcionando | Registrar pago desde tabla dedicada |

## Migration / Rollout

No migration required. Filtros Prisma son backward-compatible. Tablas dedicadas ya existen con sus propias rutas.

## Open Questions

- (ninguno)
