# Proposal: Integrar Anticipos en Reportes Contables

## Intent

Los anticipos ya generan un `AnticipoMovimiento` con trazabilidad financiera real, pero hoy no aparecen en las tablas de reportes contables (`Movimientos` y `Por cuenta`). Esto deja incompleta la trazabilidad bancaria y rompe la lectura unificada del historial de cada cuenta.

## Scope

### In Scope
- Incluir los movimientos de anticipo que afectan saldo bancario en `GET /api/contabilidad/reportes/movimientos`
- Incluir los mismos movimientos en `GET /api/contabilidad/cuentas/[id]/historial`
- Exponer tipo, referencia, descripción, saldo antes/después y relación con anticipo en ambos reportes
- Mantener `CREACION_RESERVA` fuera de las tablas bancarias si no afecta saldo de la cuenta
- Ajustar la UI para mostrar e identificar los movimientos de anticipo en ambas tablas

### Out of Scope
- Cambios al modelo de datos de Anticipo o AnticipoMovimiento
- Nuevo módulo de detalle de anticipo
- Cambios al flujo de creación/ejecución/reverso de anticipos
- Exportaciones nuevas específicas para anticipos

## Approach

1. Proyectar `AnticipoMovimiento` en el mismo formato normalizado que ya usan `Movimientos` y `Historial por cuenta`.
2. Incluir solo los eventos que representan impacto bancario (`EJECUCION` y `REVERSO`) y excluir la reserva inicial.
3. Reutilizar el contrato de tipos del sistema para que la UI reciba etiquetas y referencias consistentes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/reportes/movimientos/route.ts` | Modified | Agregar proyección de movimientos de anticipo |
| `src/app/api/contabilidad/cuentas/[id]/historial/route.ts` | Modified | Agregar proyección de movimientos de anticipo |
| `src/components/contabilidad/movimientos-table.tsx` | Modified | Mostrar etiquetas/íconos de anticipo en la tabla de movimientos |
| `src/components/contabilidad/account-transaction-history.tsx` | Modified | Mostrar etiquetas/íconos de anticipo en historial por cuenta |
| `src/lib/services/anticipos-workflow.ts` | Reference | Fuente de verdad para tipos de movimiento de anticipo |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicar un anticipo ya representado por reconciliación | Medium | Definir una sola proyección por evento: usar `AnticipoMovimiento` como fuente trazable y no agregar reservas |
| Mezclar reserva con movimientos bancarios | Medium | Excluir explícitamente `CREACION_RESERVA` |
| Cambiar el orden visual de reportes existentes | Low | Mantener el orden temporal y mapear el tipo nuevo sin alterar el resto |

## Rollback Plan

Revertir la proyección de `AnticipoMovimiento` en ambos reportes y remover los labels/badges en UI. No hay migración de datos.

## Success Criteria

- [ ] Los movimientos de anticipo aparecen en la pestaña "Movimientos"
- [ ] Los mismos movimientos aparecen en la pestaña "Por cuenta"
- [ ] `CREACION_RESERVA` no aparece como movimiento bancario
- [ ] `EJECUCION` y `REVERSO` conservan trazabilidad completa
- [ ] Los tests de reportes contables pasan sin regresiones
