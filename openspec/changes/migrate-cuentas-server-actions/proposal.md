# Proposal: Migrar Cuentas por Pagar/Cobrar a Server Actions + Bug Fixes

## Intent

Las features de **Cuentas por Cobrar (CxC)** y **Cuentas por Pagar (CxP)** siguen usando RTK Query + API routes, generando waterfalls HTTP innecesarios y exponiendo bugs críticos de seguridad (sin tenant isolation) y consistencia (PKs inconsistentes, paginación client-side). Esta change migra ambas features a Server Actions siguiendo el patrón `withAction()` establecido, y al mismo tiempo corrige los bugs identificados.

Problemas específicos:
1. **Sin tenant isolation**: Los handlers GET de CxC y CxP NO filtran por `tenantId` — bug de seguridad multi-tenant
2. **`tenantId: ''`** hardcodeado en create de CxC
3. **Paginación client-side** en CxP: el handler trae TODOS los registros y el cliente filtra/pagina
4. **PK inconsistente**: CxC usa `id`, CxP usa `cuentaPorPagarId`
5. **Componente `PagarCuentaPorPagarDialog`** NO se usa — la page usa `ReconciliacionGastosForm` directamente
6. **Dos mecanismos de pago duplicados** en CxP: el dialog y la reconciliación

## Scope

### In Scope
1. Crear `src/features/contabilidad/actions/cuentas-por-cobrar.ts` con Server Actions (getCxC, createCxC, updateCxC)
2. Crear `src/features/contabilidad/actions/cuentas-por-pagar.ts` con Server Actions (getCxP, createCxP, pagarCxP)
3. Corregir **tenant isolation** en todas las queries (usar `requireTenant(user)`)
4. Implementar **paginación server-side** en CxP con filtros (estado, tipo, search)
5. Implementar **paginación server-side** en CxC con filtros (estado, clienteId)
6. Migrar las pages `cuentas-por-cobrar/page.tsx` y `cuentas-por-pagar/page.tsx` de RTK Query a Server Actions
7. Migrar `cuentas-por-cobrar-table.tsx` y `cuentas-por-pagar/page.tsx` para usar Server Actions
8. Eliminar `PagarCuentaPorPagarDialog` (componente muerto)
9. Actualizar tests unitarios para los handlers/actions
10. Preservar re-exports de RTK Query para compatibilidad temporal

### Out of Scope
- No cambiar modelos Prisma (PKs se dejan como están por ahora — requiere migración de BD)
- No eliminar las API routes existentes (se mantienen como thin wrappers por compatibilidad)
- No migrar DeudaCash ni PrestamoCash (features separadas con sus propias Server Actions)
- No cambiar `ReconciliacionGastosForm` ni `ReconciliacionVentasForm` (exceden este scope)
- No cambiar la lógica de `pago-gastos-workflow` ni el cálculo de reconciliaciones multi-moneda

## Approach

### Fase 1: Server Actions + Schemas
- Crear schemas Zod para inputs: `getCuentasPorCobrarSchema`, `getCuentasPorPagarSchema`, `createCuentaPorCobrarSchema`, `createCuentaPorPagarSchema`, `pagarCuentaPorPagarSchema`, `updateCuentaPorCobrarSchema`
- Crear Server Actions siguiendo el patrón `withAction()` con `requireTenant(user)`
- Implementar paginación server-side en getCxP con Prisma `skip`/`take` + `where`
- Implementar filtros server-side en getCxC

### Fase 2: Migración de Clientes
- Migrar `cuentas-por-cobrar/page.tsx` para usar Server Action en lugar de RTK Query
- Migrar `cuentas-por-pagar/page.tsx` para usar Server Action en lugar de RTK Query
- Extraer data fetching a Server Components y pasar data como props a Client Components
- Migrar `cuentas-por-cobrar-table.tsx` a recibir data por props (sin RTK Query interno)

### Fase 3: Cleanup
- Eliminar `PagarCuentaPorPagarDialog` (componente no usado)
- Limpiar barrel exports de contabilidad
- Actualizar tests para apuntar a las nuevas Server Actions

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/contabilidad/actions/` | New | Nuevos archivos de Server Actions |
| `src/features/contabilidad/actions/schemas.ts` | New | Zod schemas para validación |
| `src/features/contabilidad/api/handlers.ts` | Modified | Handlers actuales (se preservan) |
| `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx` | Modified | Recibe data por props |
| `src/features/contabilidad/components/pagar-cuenta-por-pagar-dialog.tsx` | Removed | Componente muerto |
| `src/app/busy/contabilidad/cuentas-por-cobrar/page.tsx` | Modified | Server Component |
| `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx` | Modified | Server Component |
| `src/lib/redux/services/cuentasPorCobrarApi.tsx` | Modified | Agregar re-export warning |
| `src/lib/redux/services/cuentasPorPagarApi.tsx` | Modified | Agregar re-export warning |
| `src/features/contabilidad/api/__tests__/` | Modified | Tests actualizados |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cálculo de saldo multi-moneda en CxC no funciona igual en SA vs handler | Medium | Replicar exactamente la lógica de `getCuentasPorCobrarHandler` en la SA, con tests |
| La paginación server-side cambia la UX (antes era client-side) | Low | Mismos parámetros, misma interfaz visual |
| Componentes que importan de RTK Query se rompen | Medium | Mantener re-exports con `@deprecated` durante transición |
| `pago-gastos-workflow` necesita `$transaction` que SA no soporta | Low | SA puede usar `$transaction` vía Prisma directamente — ya funciona en otras SAs |

## Rollback Plan

1. Las Server Actions son archivos nuevos — no se borra nada existente
2. Las pages se pueden revertir a RTK Query importando los hooks originales
3. Los handlers API se mantienen intactos como fallback
4. Cada fase se puede revertir independientemente

## Dependencies

- Patrón `withAction()` ya establecido en `src/lib/server-actions/`
- `requireTenant()` de `src/lib/services/tenant-scope`
- `pago-gastos-workflow` existente para pagos de CxP
- Prisma models `CuentaPorCobrar` y `CuentaPorPagar` sin cambios

## Success Criteria

- [ ] Server Actions para CxC y CxP con `requireTenant()` — sin bypass de tenant
- [ ] Paginación server-side funciona correctamente en ambas features
- [ ] Pages de CxC y CxP usan Server Actions en lugar de RTK Query
- [ ] Componentes eliminados: `pagar-cuenta-por-pagar-dialog.tsx`
- [ ] Tests unitarios pasan para las nuevas Server Actions
- [ ] Los handlers API existentes siguen funcionando (compatibilidad)
- [ ] No hay `tenantId: ''` hardcodeado en ningún handler/action nuevo