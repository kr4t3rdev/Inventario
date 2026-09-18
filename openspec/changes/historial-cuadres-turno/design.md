# Design: Historial de Cuadres por Turno

## Technical Approach

Crear una ruta de consulta para turnos POS cerrados (`/busy/sales/cuadres`) apoyada en `turnos-pos`, no en un módulo nuevo. La lista se resolverá con una Server Action específica para historial y renderizará un shell visual consistente con el lenguaje ya usado en reportes financieros: superficie limpia, badges de estado y CTA claro de consulta. El detalle seguirá usando `/busy/sales/cuadre/[turnoId]`, pero detectará `estado=CERRADO` para entrar en modo lectura.

## Architecture Decisions

| Decision | Alternatives | Choice | Rationale |
|---|---|---|---|
| Fuente del historial | Nuevo snapshot persistido / query sobre turno+arqueo | Query sobre `TurnoPuntoVenta` + último `ArqueoCaja` + agregado de ventas | El código actual ya guarda cierre, arqueo y ventas por `turnoId`; para MVP evita complejidad y migraciones. |
| Ubicación UI | Módulo nuevo / reuso `turnos-pos` | Reuso `src/features/turnos-pos` | El comportamiento pertenece al dominio de turnos POS; mantiene actions, tipos y tests cerca de la lógica existente. |
| Detalle de consulta | Nueva página readonly / adaptar la actual | Adaptar la actual con `viewMode` derivado del estado | Reusa gráficos, comparación contra arqueo y tablas ya verificadas; minimiza duplicación. |
| Estética frontend | Tabla administrativa genérica / shell visual tipo auditoría | Shell tipo “audit console” sobrio | Sigue la calidad visual reciente del repo y da contexto de revisión sin meter ornamento inútil. |

## Data Flow

`/busy/sales/cuadres/page.tsx`
→ `getCuadresCerradosAction(filters)`
→ Prisma `turnoPuntoVenta.findMany({ estado: 'CERRADO' ... })`
→ include último arqueo + empleado + PV + `_count/aggregate` de ventas
→ mapper a `CuadreCerradoListItem`
→ tabla/cards con CTA `router.push('/busy/sales/cuadre/{turnoId}?from=history')`
→ `getCuadreTurnoAction(turnoId)`
→ página existente calcula `isReadOnly = turno.estado === 'CERRADO'`
→ oculta `Cerrar Turno` y `Repetir Arqueo`, muestra badge “Consulta histórica”
→ renderiza una advertencia visible aclarando que el bloque de inventario no es un snapshot histórico exacto.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/sales/cuadres/page.tsx` | Create | Entry point server de la nueva página de historial. |
| `src/features/turnos-pos/actions-historial.ts` | Create | Server Action con query de turnos cerrados y shape de lista. |
| `src/features/turnos-pos/components/cuadres-history-page-client.tsx` | Create | Shell visual y estado de carga/vacío/lista con CTA de detalle. |
| `src/features/turnos-pos/index.ts` | Modify | Barrel exports del historial. |
| `src/app/busy/sales/cuadre/[turnoId]/page.tsx` | Modify | Modo consulta, badge contextual, advertencia histórica y bloqueo de acciones mutables. |
| `src/features/turnos-pos/actions-cuadre.ts` | Modify | Exponer `estado` y `fechaCierre` en el payload del detalle. |
| `src/features/turnos-pos/__tests__/actions.test.ts` | Modify | Cobertura de query de turnos cerrados. |
| `src/features/turnos-pos/__tests__/actions-cuadre.test.ts` | Modify | Cobertura de detalle readonly para turno cerrado. |

## Interfaces / Contracts

```ts
interface CuadreCerradoListItem {
  turnoId: string;
  puntoDeVentaNombre: string;
  empleadoNombre: string | null;
  fechaApertura: Date;
  fechaCierre: Date | null;
  totalVentas: number;
  diferenciaCup: number | null;
  arqueado: boolean;
}
```

```ts
interface CuadreTurnoData {
  turno: {
    id: string;
    estado: 'ABIERTO' | 'CERRADO';
    fechaCierre: Date | null;
    // resto existente
  };
}
```

## Frontend Direction

Aplicar una estética de **consola de auditoría refinada**: fondo claro con profundidad suave, encabezado editorial corto, badges funcionales y una tabla principal con filas respiradas, hover discreto y CTA “Ver cuadre” muy visible. Nada de dashboard gritón: PRIORIDAD a legibilidad, jerarquía y sensación de control. En mobile, la lista colapsa a cards compactas con estado, ventas, diferencia y CTA al final.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Mapper/query de historial cerrado | Vitest con mocks Prisma para `estado=CERRADO`, arqueo ausente y empleado nulo. |
| Integration | Page client render de vacío/lista/read-only | Testing Library verificando badge, CTA y ausencia de botones mutables al cerrar turno. |
| E2E | Navegación historial → detalle | Playwright opcional si el flujo queda visible en navegación principal. |

## Migration / Rollout

No migration required. El rollout es directo porque solo agrega consulta y endurece la UI del detalle cerrado.

## Open Questions

- [ ] Confirmar si el historial necesita filtro por fecha/PV en esta primera entrega o si sale con `limit` + orden descendente.
- [ ] Definir si la navegación al historial entra desde sidebar ahora o en un commit siguiente.
