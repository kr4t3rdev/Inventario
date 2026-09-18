# Spec: Reparaciones en la app móvil

## Requisitos funcionales

### RF-1 — Listar órdenes

`GET /api/reparaciones/ordenes` mapea a `[{ ordenId, clienteId, clienteNombre, comando numeroOrden, equipoId, equipoNombre, marca, modelo, numeroSerie, problemaReportado, estado, prioridad, esGarantia, total, createdAt, fechaEstimada }]`.

### RF-2 — Nueva orden

`POST /api/reparaciones/ordenes` con `{ clienteId, equipoTipoId, marca, modelo?, numeroSerie?, problemaReportado, fechaEstimada?, prioridad?, contrasena?, accesorios? }` → `201` con la orden creada.

### RF-3 — Detalle y edición

`GET /api/reparaciones/ordenes/[id]` → la orden mapeada; `PUT [id]` → edición del estado o notas. `404` si la orden no pertenece al tenant.

## RFC 2119

"DEBE" expresa requisito normativo.