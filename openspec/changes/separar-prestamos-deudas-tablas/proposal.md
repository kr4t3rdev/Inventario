# Proposal: Separar Préstamos y Deudas de CxC/CxP

## Intent

Préstamos cash aparecen mezclados en Cuentas por Cobrar y deudas cash en Cuentas por Pagar. Cada uno ya tiene su tabla dedicada (`prestamos-cash-table`, `deudas-cash-table`), pero sin historial de pagos expandible. Hay que: (1) mover la lógica de pagos expandibles a las tablas dedicadas, (2) excluir esos registros de CxC/CxP.

## Scope

### In Scope
- Agregar rows expandibles con historial de pagos a `prestamos-cash-table.tsx`
- Agregar rows expandibles con historial de pagos a `deudas-cash-table.tsx`
- Filtrar `tipoCuenta !== 'PRESTAMO_CASH'` en API de CxC
- Filtrar `tipoDeuda !== 'DEUDA_CASH'` en API de CxP
- Limpiar código de préstamos en `cuentas-por-cobrar-table.tsx` (badge PREST-, comprobante button, detección préstamo)
- Limpiar código de deudas en `cuentas-por-pagar-table.tsx` (PagoDeudaModal routing)

### Out of Scope
- Cambios al endpoint PDF de comprobante (ya funciona)
- Cambios al schema de Prisma (filtro es a nivel query)
- Nuevas rutas API para préstamos/deudas (ya existen)

## Approach

1. **APIs**: Agregar `where: { tipoCuenta: { not: 'PRESTAMO_CASH' } }` en CxC y `tipoDeuda: { not: 'DEUDA_CASH' }` en CxP
2. **Tablas dedicadas**: Copiar patrón `PagosExpandidos` + `getExpandedRowModel()` de CxC a ambas tablas. Incluir reconciliaciones desde sus APIs existentes.
3. **Limpieza CxC/CxP**: Remover toda lógica condicional de préstamos/deudas que ya no aplica

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` | Modified | Excluir PRESTAMO_CASH del where |
| `src/app/api/contabilidad/cuentas-por-pagar/route.ts` | Modified | Excluir DEUDA_CASH del where |
| `src/components/contabilidad/cuentas-por-cobrar-table.tsx` | Modified | Remover lógica préstamos |
| `src/components/contabilidad/cuentas-por-pagar-table.tsx` | Modified | Remover lógica deudas |
| `src/components/contabilidad/prestamos-cash/prestamos-cash-table.tsx` | Modified | Agregar expandable rows + reconciliaciones |
| `src/components/contabilidad/deudas-cash/deudas-cash-table.tsx` | Modified | Agregar expandable rows + reconciliaciones |
| `src/app/api/contabilidad/prestamos-cash/route.ts` | Modified | Include reconciliaciones en response |
| `src/app/api/contabilidad/deudas-cash/route.ts` | Modified | Include pagos/reconciliaciones en response |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Préstamos/deudas desaparecen de ambas vistas | Low | Verificar que tablas dedicadas cargan antes de filtrar APIs |
| Reconciliaciones no incluidas en APIs dedicadas | Med | Verificar includes de Prisma en APIs de préstamos y deudas |

## Rollback Plan

Revertir los `where` filters en CxC/CxP APIs para volver a mostrar todo mezclado. Las tablas dedicadas mantienen nueva funcionalidad sin conflicto.

## Dependencies

- APIs de préstamos-cash y deudas-cash deben incluir reconciliaciones/pagos (puede requerir ajuste de includes)

## Success Criteria

- [ ] CxC no muestra registros con `tipoCuenta: 'PRESTAMO_CASH'`
- [ ] CxP no muestra registros con `tipoDeuda: 'DEUDA_CASH'`
- [ ] Tabla préstamos-cash muestra rows expandibles con historial de pagos
- [ ] Tabla deudas-cash muestra rows expandibles con historial de pagos
- [ ] No hay código de detección préstamo en CxC table
- [ ] No hay código de detección deuda en CxP table
