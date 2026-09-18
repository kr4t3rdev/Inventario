# Proposal: Historial de Cuadres por Turno

## Intent

Agregar una vista para consultar cuadres de turnos POS ya cerrados y reusar el detalle existente por `turnoId` en modo solo lectura, sin introducir un modelo snapshot nuevo mientras las fuentes actuales alcancen para el listado y el resumen financiero.

## Scope

### In Scope
- Nueva página de historial para listar turnos `CERRADO` con datos mínimos del cuadre.
- CTA por fila para abrir `/busy/sales/cuadre/[turnoId]` en modo consulta.
- Ajuste del detalle existente para ocultar acciones mutables cuando el turno ya está cerrado.
- Reuso de `TurnoPuntoVenta`, `ArqueoCaja` y ventas existentes como fuente del historial.

### Out of Scope
- Nuevo modelo o snapshot histórico de inventario por turno.
- Reabrir turnos, editar arqueos cerrados o rehacer cierres desde el historial.
- Exportación, paginación avanzada o filtros complejos más allá del historial básico.

## Capabilities

### New Capabilities
- `historial-cuadres-turno`: Consulta de turnos cerrados con acceso al detalle reutilizando la pantalla de cuadre existente en modo lectura.

### Modified Capabilities
- None.

## Approach

Extender la feature `turnos-pos` para listar turnos cerrados con su último arqueo y métricas básicas ya derivables desde `getTurnosAction`. La página de detalle seguirá resolviendo por `turnoId`, pero detectará `estado=CERRADO` para entrar en modo consulta y deshabilitar cierre/rearqueo/navegación de flujo activo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/turnos-pos/actions.ts` | Modified | Consulta de turnos cerrados para historial. |
| `src/app/busy/sales/cuadre/[turnoId]/page.tsx` | Modified | Modo consulta para turnos cerrados. |
| `src/features/turnos-pos/actions-cuadre.ts` | Reviewed | Fuente actual del detalle reutilizado. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| El detalle de productos no sea un snapshot histórico exacto | High | Documentar explícitamente el límite; evaluar snapshot en cambio futuro si negocio exige fidelidad histórica. |
| La lista necesite más métricas de las que devuelve el include actual | Medium | Extender la query sin cambiar el modelo. |

## Rollback Plan

Revertir la nueva ruta de historial y el modo consulta del detalle; el flujo de cuadre/cierre actual queda intacto.

## Dependencies

- `TurnoPuntoVenta.estado = CERRADO`
- Último `ArqueoCaja` asociado al turno
- Ventas asociadas por `Venta.turnoId`

## Success Criteria

- [ ] Existe una página para consultar turnos cerrados con datos mínimos del cuadre.
- [ ] Cada fila permite abrir el detalle del cuadre por `turnoId` sin habilitar mutaciones.
- [ ] El cambio no introduce tablas ni snapshots nuevos para el historial MVP.
