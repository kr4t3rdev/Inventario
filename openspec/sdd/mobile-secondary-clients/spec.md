# Spec: Clientes secundarios — contratos y servicios

## Requisitos funcionales

### RF-1 — Listado de contratos

`GET /api/mobile/contracts` → `200 { items }` con contratos filtrados por `tenantId`, mapeando `{ contratoId, clienteId, titulo: numeroContrato, descripcion: observaciones, monto: Number(monto), estado, fechaInicio: ISO, fechaFin: ISO|null, cliente: { nombre } }`. `estado` DEBE mapear `ANULADO → CANCELADO`; el resto pasa tal cual.

### RF-2 — Detalle y borrado de contratos

`GET [id]` → mapeado o 404. `DELETE [id]` → hard-delete (404 si no pertenece al tenant).

### RF-3 — Servicios (list/detail/create/delete)

- `GET /api/mobile/services` → `{ items }` con `{ servicioId, nombre, descripcion, precio, estado: 'ACTIVO' }`.
- `GET [id]` → mapeado o 404.
- `POST` valida `nombre` (trimmed) y `precio ≥ 0`; crea con `moneda` default.
- `DELETE [id]` con guard: si tiene `VentaServicios`/`CompraServicio`/`OfertaItem` → `409 HAS_REFERENCES`; si no, borra.

### RF-4 — Autenticación y tenant

`401` sin token, `403 TENANT_REQUIRED` sin `tenantId`. Todo filtrado por `tenantId` (a diferencia del REST web de contratos, que no escopa — aquí sí).

## Requisitos no funcionales

### RNF-1 — Sin regresión

Rutas non-v1; no afectan paridad `mobile/v1`.

## RFC 2119

- "DEBE" expresa requisito normativo. "mapear ANULADO" expresa transformación de enumerado.