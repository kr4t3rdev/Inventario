# Design: Clientes secundarios — contratos y servicios

## Technical Approach

Rutas non-v1 idénticas al patrón de `mobile/expenses`. Contratos escopa por `tenantId` (mejora sobre el REST web). Servicios emite `estado: 'ACTIVO'` constante porque el modelo no persiste estado de catálogo.

## Detailed Design

```ts
// contracts
const mapaEstado = { ANULADO: 'CANCELADO' } as const;
mapContrato(c) => ({
  contratoId: c.contratoId, clienteId: c.clienteId,
  titulo: c.numeroContrato, descripcion: c.observaciones,
  monto: Number(c.monto ?? 0), estado: mapaEstado[c.estado] ?? c.estado,
  fechaInicio: ISO, fechaFin: c.fechaFin ? ISO : null,
  creadoPorId: ..., cliente: c.cliente ? { nombre } : undefined,
})

// services
mapServicio(s) => ({ servicioId, nombre, descripcion, precio,
  estado: 'ACTIVO', createdAt: ISO, updatedAt: ISO })
```

`DELETE` contratos: `findFirst({ contratoId, tenantId })` → `delete`.

`DELETE` servicios: contar `ventaServicios`/`compraServicio`/`ofertaItem` por `servicioId`; `>0` → `409 HAS_REFERENCES`; si no, `delete`.

`POST` servicios: `nombre` trimmed no vacío, `precio` number ≥ 0 → `create({ nombre, precio: round, descripcion: trim||null, tenantId })`.

## Testing

`src/app/api/mobile/__tests__/contracts-services.test.ts` con harness de mocks: mapeo de listado, `ANULADO→CANCELADO`, `estado:'ACTIVO'` servicios, 404, 409 HAS_REFERENCES.

## Riesgos y mitigación

- **Fabricación `estado:'ACTIVO'`:** el modelo no tiene estado; documentado. Si el catálogo gana soft-delete, se mapeará.
- **`titulo←numeroContrato`:** aproximación; el client móvil no tiene campo de título real.