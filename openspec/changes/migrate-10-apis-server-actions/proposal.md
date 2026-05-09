# Proposal: Migrar 10 RTK Query APIs a Server Actions

## Intent

Migrar las últimas 10 RTK Query API slices a Server Actions puras, eliminando completamente
las dependencias de RTK Query en la aplicación. Algunas APIs ya tienen Server Actions implementadas
(solo requieren migrar consumidores), otras requieren crearlas desde cero.

**Antecedente**: `exchangeIntelligenceApi` fue eliminada por ser código muerto (0 consumidores).

## Scope

### In Scope

7 tandas de migración por dominio lógico:

1. **Tanda 1 — Empleados + Pago Salario**: Consumidores de `empleadosApi` y `pagoSalarioApi`
2. **Tanda 2 — Gastos**: Consumidores de `gastosDEApi` y `gastosConceptosApi`
3. **Tanda 3 — Facturas**: Consumidores de `facturasApi`
4. **Tanda 4 — Notificaciones**: Consumidores de `notificacionesApi` (con polling)
5. **Tanda 5 — Configuración + Cuadre Diario**: Crear Server Actions y migrar consumidores
6. **Tanda 6 — Dashboard**: Evaluar migración (handler 1509 líneas con cache)
7. **Tanda 7 — Órdenes Reparación**: Crear feature completa con Server Actions

### Out of Scope

- Modificar la lógica de negocio de los handlers (solo cambiar la capa de transporte)
- Migrar funcionalidad de admin/users/tenants (ya migrada en tandas anteriores)

## Approach

### APIs con Server Actions existentes (Tandas 1-4)

Solo cambiar imports en los componentes consumidores de hooks RTKQ a Server Actions,
usando el patrón `useState` + `useEffect` para queries y llamada directa para mutations.

### APIs sin Server Actions (Tandas 5-7)

Extraer la lógica de los handlers HTTP existentes a Server Actions con `withAction` + `requireTenant`.

## Success Criteria

- [ ] 10 RTKQ slices eliminados
- [ ] 32+ consumidores migrados a Server Actions
- [ ] 0 hooks RTKQ restantes en la aplicación
- [ ] Cero regresiones verificadas con typecheck
