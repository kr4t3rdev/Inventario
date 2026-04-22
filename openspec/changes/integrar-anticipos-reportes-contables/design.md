# Design: Integrar Anticipos en Reportes Contables

## Technical Approach

Se incorporará `AnticipoMovimiento` a la proyección normalizada que alimenta los reportes contables. La idea es tratar los movimientos de anticipo como una fuente bancaria más, igual que reconciliaciones, transferencias y ajustes, pero solo para los eventos que realmente impactan saldo (`EJECUCION` y `REVERSO`). La reserva inicial (`CREACION_RESERVA`) seguirá fuera de las tablas bancarias porque no representa un movimiento de cuenta.

## Architecture Decisions

### Decision: Fuente única de normalización para reportes

**Choice**: Crear una proyección común de movimientos de contabilidad que incluya reconciliaciones y anticipos.
**Alternatives considered**: Repetir la lógica de mapeo en cada endpoint de reporte.
**Rationale**: Evita divergencia entre `movimientos` y `por cuenta`, reduce duplicación y asegura trazabilidad coherente.

### Decision: Integrar solo eventos bancarios de anticipo

**Choice**: Incluir `EJECUCION` y `REVERSO`, excluir `CREACION_RESERVA`.
**Alternatives considered**: Mostrar todos los `AnticipoMovimiento` en reportes bancarios.
**Rationale**: La reserva no mueve saldo en cuenta; mezclarla en el historial bancario confunde el reporte contable.

### Decision: Mantener el contrato visual existente

**Choice**: Reutilizar el patrón actual de `tipo`, `descripcion`, `referencia` y `detalles` para que la UI solo agregue nuevos labels/badges.
**Alternatives considered**: Crear un bloque separado de UI para anticipos dentro de movimientos.
**Rationale**: El sistema ya exige trazabilidad unificada; separar anticipos rompería la lectura del historial por cuenta.

## Data Flow

```
AnticipoWorkflow
  ├─ createAnticipo() -> AnticipoMovimiento(CREACION_RESERVA)
  ├─ executeAnticipo() -> AnticipoMovimiento(EJECUCION)
  └─ reverseAnticipo() -> AnticipoMovimiento(REVERSO)

              ▼

API Reportes
  ├─ /api/contabilidad/reportes/movimientos
  └─ /api/contabilidad/cuentas/[id]/historial

              ▼

Proyección normalizada
  ├─ reconciliaciones de ventas/servicios/gastos
  ├─ transferencias y ajustes
  └─ AnticipoMovimiento (solo EJECUCION/REVERSO)

              ▼

UI Contable
  ├─ MovimientosTable
  └─ AccountTransactionHistory
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/reportes/movimientos/route.ts` | Modify | Agregar proyección de `AnticipoMovimiento` al resultado normalizado |
| `src/app/api/contabilidad/cuentas/[id]/historial/route.ts` | Modify | Agregar proyección de `AnticipoMovimiento` al historial por cuenta |
| `src/components/contabilidad/movimientos-table.tsx` | Modify | Renderizar labels/badges para anticipo en la tabla |
| `src/components/contabilidad/account-transaction-history.tsx` | Modify | Renderizar labels/badges para anticipo en el historial |
| `src/lib/services/anticipos-workflow.ts` | Reference | Fuente de verdad para estados/tipos de movimientos de anticipo |
| `src/app/models/model.ts` | Reference | Contratos `Anticipo` y `AnticipoMovimiento` |

## Interfaces / Contracts

### Movimiento contable normalizado

```typescript
interface MovimientoContableNormalizado {
  id: string
  tipo: 'venta' | 'servicio' | 'gasto' | 'salario' | 'transferencia_entrada' | 'transferencia_salida' | 'ajuste_ingreso' | 'ajuste_egreso' | 'prestamo_cash_desembolso' | 'prestamo_cash_pago' | 'deuda_cash_desembolso' | 'deuda_cash_pago' | 'anticipo_ejecucion' | 'anticipo_reverso'
  fecha: string
  monto: number
  moneda: string
  montoConvertido: number | null
  tasaCambio: number | null
  descripcion: string
  cuenta: string
  referencia: string | null
  detalles: Record<string, unknown>
}
```

### Regla de integración de anticipos

- `CREACION_RESERVA` se excluye del historial bancario.
- `EJECUCION` se proyecta como egreso o ingreso según el contexto bancario generado por la ejecución.
- `REVERSO` se proyecta como el movimiento inverso correspondiente.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Proyección de `AnticipoMovimiento` | Tests de mapeo por tipo en los routes |
| Integration | Inclusión en reportes contables | Tests de API para `movimientos` y `historial` |
| Component | Render y etiquetas de anticipo | Testing Library en `MovimientosTable` y `AccountTransactionHistory` |

## Migration / Rollout

No migration required. Los datos ya existen; solo cambia la forma en que se proyectan y muestran.

## Open Questions

- [ ] ¿La UI debe diferenciar visualmente `EJECUCION` y `REVERSO` con iconos distintos o basta con una etiqueta común de anticipo?
- [ ] ¿Se debe incluir un enlace al detalle del anticipo desde cada fila proyectada?
