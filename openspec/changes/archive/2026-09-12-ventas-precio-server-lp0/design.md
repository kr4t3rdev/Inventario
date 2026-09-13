# Design — LP-0 Integridad de precios server-side

## Resolver unificado

```ts
// src/features/ventas/services/precio-venta-resolver.ts
export type PrecioVentaFuente = 'CLIENTE' | 'PV' | 'BASE';

export interface PrecioListaEntrada {
  listaPrecioId: string;
  precio: number;
}

export interface ResolvePrecioVentaInput {
  precioBase: number;
  precios: PrecioListaEntrada[];
  pvListaId: string | null;
  clienteListaId: string | null;
}

export function resolvePrecioVenta(input): { precio: number; fuente: PrecioVentaFuente }
```

Cadena: entrada con `listaPrecioId === clienteListaId` → `CLIENTE`; si no, entrada con `pvListaId` → `PV`; si no, `precioBase` → `BASE`. Función pura, sin I/O, precios `Int` (sin redondeos: los `precio` ya son enteros persistidos).

## Enforcement en `VentaMutationService.create`

Orden dentro de `create`, antes de abrir `prisma.$transaction`:

1. `puntoDeVenta.findFirst({ pvId, tenantId })` → `pvListaId` (si no existe el PV → `NOT_FOUND`; hoy el flujo lo daría igualmente por los guards de stock).
2. Si `clienteId`: `cliente.findFirst({ clienteId, tenantId })` → `clienteListaId` (el gate de facturación ya corre antes; inexistente → `NOT_FOUND`).
3. `producto.findMany({ where: { id: { in: ids }, tenantId }, select: { id, nombre, precioVenta, precios } })` — una sola query; producto faltante → mismo `NOT_FOUND` que hoy da el loop de stock (se anticipa).
4. Por ítem: `resolvePrecioVenta`. Comparación estricta (`Int === Int`).
   - match → `itemsData` con el precio resuelto (idéntico al enviado).
   - mismatch + `hasPermission(user, 'ventas.precio.override')` → se conserva el precio enviado y se acumula `{ productoId, nombre, esperado, aplicado, fuente }`.
   - mismatch sin permiso → `throw new ActionError(mensaje, 'PRICE_MISMATCH')` (mensaje neutro con producto y precio esperado).
5. Si hubo overrides: dentro de la transacción, tras `tx.venta.create`, `AuditLogService.logStrict` con `accion: 'EXECUTE'`, `entidad: 'VENTA'`, entidadId de la venta y `detalles: { tipo: 'PRICE_OVERRIDE', items: [...] }`.

El precio persistido en `VentaItem` y los totales (`subtotalVenta`, `totalVenta`) se calculan **solo** desde el resultado de este paso; el `precioUnitario` del payload posterior no se vuelve a leer.

## Concurrencia y rendimiento

- La resolución ocurre antes de la transacción (reads sin lock). Entre la resolución y el commit podría cambiar un precio: aceptado; la venta registra un precio vigente al momento de la resolución, igual que Odoo. Hard-blockers reales (stock) ya viven dentro de la tx.
- Coste: +3 queries por venta (PV, cliente opcional, productos batch). Las del loop de stock por ítem quedan intactas.

## Compatibilidad hacia atrás

- Tenants sin listas: resolver devuelve `precioVenta`; el POS ya enviaba exactamente eso → sin cambio visible.
- Tenants con lista en PV: `precios` se carga con la lista del PV; el POS ya enviaba ese precio → sin cambio.
- Tenants con lista en cliente: **cambio intencional** — el servidor ahora exige el precio de la lista del cliente (hasta hoy nunca se aplicó en POS, así que no hay flujo funcional que romper; sí lo aplican Ofertas).
- Mobile (`/api/mobile/v1/sales/create`) pasa por el mismo servicio: hereda el enforcement sin cambios de contrato.

## Payload del POS

`getProductosPorUbicacion(ubicacionId, clienteId?)`:

- Si hay `pvListaId` o `clienteListaId`, incluye `precios: [{ listaPrecioId, precio }]` filtrado a esas dos listas (una query extra sobre `precioProducto` con `in`).
- `precioVentaResuelto`/`precioFuente` se mantienen idénticos (lista del PV o base); la prioridad de cliente la aplica el cliente vía `getPrecioEfectivo`, ahora con datos reales.
- Ruta: `GET /api/ventas/punto-venta/[id]/productos?clienteId=<id>`; `pv-interface` lo pasa al cargar y al cambiar de cliente (recarga ya existente al cambiar PV).

## Permiso

```ts
{
  key: 'ventas.precio.override',
  label: 'Modificar precios en venta',
  description: 'Aplicar en una venta un precio distinto al de las listas vigentes.',
  category: 'ventas',
  defaultRoles: ['manager'],
  sensitive: true,
}
```

El fixture de paridad agrega la clave solo a `manager` (orden alfabético: tras `ventas.ofertas.gestionar`, antes de `ventas.servicios.editar`).

## Riesgos

- Tests existentes de `createVentaAction` dejarán de pasar hasta actualizar los mocks (`producto.findMany` nuevo): ajuste mecánico, incluido en LP0-T2.
- `getProductosPorUbicacion` se usa también para almacenes: con `clienteId` ausente el payload devuelve `precios: []` y no toca listas.
- **TOCTOU conocido**: la resolución ocurre antes de `prisma.$transaction`; si una lista cambia en la ventana (ms), la venta se persiste con el precio del payload y el audit registra el `precioEsperado` de ese instante. Trade-off aceptado para no alargar la transacción; revisar solo si aparece abuso real.
- **Rollout**: web y mobile comparten `VentaMutationService.create`; clientes móviles que calculen precio distinto al vigente empezarán a recibir 400 `PRICE_MISMATCH`. Coordinar release móvil y avisar a tenants que editaban precio a mano (ahora requiere `ventas.precio.override`, default manager).

## Notas post-review (LP0-T5)

- `getProductosPorUbicacion` quedó **fail-closed**: sin `tenantId` en el contexto responde 403, y PV, almacén, productos y cliente se consultan con filtro de tenant explícito (cierra también el P-0 pre-existente del endpoint).
- El POS bloquea el cobro mientras se recargan productos (`isFetchingProductos`) para evitar la carrera entre refetch por cambio de cliente y confirmación de venta.
