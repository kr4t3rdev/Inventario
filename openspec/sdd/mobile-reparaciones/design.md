# Design: Reparaciones en la app móvil

## Technical Approach

1. Mobile client `reparaciones-api.ts` con `createHttpClient` (Bearer, retry, refresh).
2. `ReparacionesSurface` con `view: lista | detalle` y formulario de nueva orden.
3. Nueva entrada `Reparaciones` en `AccionesSurface` (gridId `reparaciones`).

## Detailed Design

### Cliente (`reparaciones-api.ts`)

```
list(): { items, total }
create(params): Orden
update(id, params): Orden
getById(id): Orden
```

El payload se mapea desde la ruta REST (usa el array crudo final, sin cambios).

### Superficie (`ReparacionesSurface`)

Estados:
- `lista`: órdenes con filtro por `estado` (TODOS/NUEVAS, ABIERTAS, EN DIAGNÓSTICO, etc.).
- `form`: cliente (dropdown ClientesSurface style), equipoTipoId, marca, modelo?, numeroSerie?, problema?, prioridad?, fechaEstimada?.

Cross-cutting: `onBack` prop (como otros Surfaces) para volver a Gestión si el flujo crece.

### Wiring

`AccionesSurface` recibe `onSelectReparaciones`. `BusinessShell.renderAccionesScreen` añade `case 'repairs': return <ReparacionesSurface api={reparacionesApi} />`.

## Riesgos y mitigación

- **Behemoth endpoint**: la ruta `ordenes` devuelve el join (cliente, equipoTipo, técnicos) y un array plano, así que el client lo mapea sin concurrencia.
- **Prioridad de autenticación**: la ruta para crear órdenes cambia de estado. Si se necesita, uso los helpers `createSessionBasedFetch` del client.