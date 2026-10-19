# Integridad de precios en ventas (LP-0)

> El servidor — no el cliente — decide qué precio vale al vender. El `precioUnitario` que llega en el payload se trata como una *declaración* que debe coincidir con el precio vigente; si no coincide y el usuario no tiene permiso de excepción, la venta se rechaza sin efectos.

**Estado**: implementado y desplegado (2026-09-12, commits T1–T5 + cierre; change archivado en `openspec/changes/archive/2026-09-12-ventas-precio-server-lp0/`). Cadena extendida con la lista default del tenant y resolver unificado en POS/Ofertas (LP-1.2/LP-1.3, 2026-10-18).

## Por qué existe

Antes de LP-0, `VentaMutationService.create` persistía el `precioUnitario` exactamente como llegaba del navegador o de la app móvil, con la única validación de ser un entero ≥ 0. Cualquier cliente HTTP manipulado podía vender a precios arbitrarios con credenciales válidas. Además, la lista de precios del cliente solo se aplicaba en Ofertas: en el POS era código muerto porque el endpoint de productos no enviaba el array `precios`.

## La cadena de resolución

Toda asignación de precio sigue esta prioridad:

```
1. Lista del cliente        (Cliente.listaPrecioId → PrecioProducto)
2. Lista del POS            (PuntoDeVenta.listaPrecioId → PrecioProducto)
3. Lista default del tenant (ListaPrecio.esDefault → PrecioProducto; LP-1.2)
4. Precio base              (Producto.precioVenta)
```

La lógica vive en una función pura, sin I/O ni redondeos (todos los precios son `Int`):

- `src/features/ventas/services/precio-venta-resolver.ts` → `resolvePrecioVenta({ precioBase, precios, pvListaId, clienteListaId, defaultListaId })` devuelve `{ precio, fuente: 'CLIENTE' | 'PV' | 'DEFAULT' | 'BASE' }`.

En el navegador, el POS replica la misma cadena con `getPrecioEfectivo` (`src/lib/types/pricing.ts`), que desde LP-1.3 es un adaptador puro que delega en `resolvePrecioVenta`, alimentado por el array `precios` y los ids de lista del payload. Ofertas (`createOfertaAction`) llama directo al resolver con la default del tenant.

## Enforcement en la creación de venta

`VentaMutationService.create` (punto único de web POS, API legacy y mobile) hace, **antes de abrir la transacción**:

1. Carga el punto de venta con `tenantId` explícito → `NOT_FOUND` si no existe en el tenant.
2. Carga la lista marcada `esDefault` del tenant con `tenantId` explícito → fallback intermedio de la cadena (LP-1.2).
3. Si hay `clienteId`, carga el cliente con `tenantId` explícito → `NOT_FOUND` si no existe (un cliente ajeno no filtra su lista).
4. Carga en una sola query los productos con sus `precios` → `NOT_FOUND` si alguno falta.
5. Resuelve cada ítem y compara con el `precioUnitario` enviado:
   - **Coincide** → flujo normal, sin ruido.
   - **Difiere y el usuario tiene `ventas.precio.override`** → se persiste el precio enviado y, dentro de la transacción, `AuditLogService.logStrict` registra `tipo: 'PRICE_OVERRIDE'` con `precioEsperado`, `precioAplicado` y `fuente` por ítem (si la auditoría falla, la venta hace rollback).
   - **Difiere sin permiso** → `ActionError('PRICE_MISMATCH')`, HTTP 400, antes de tocar stock o crear la venta.

El precio persistido en `VentaItem` y los totales derivan solo de esta resolución validada.

## Permiso `ventas.precio.override`

- Categoría `ventas`, marcado `sensitive`, default solo para `manager` (ver `src/lib/auth/permission-registry.ts`).
- El admin global lo posee implícitamente (bypass estándar del sistema).
- Para otorgarlo a otro rol: edición de roles en el panel del tenant (el permiso aparece en el registry; el fixture de paridad día-1 quedó actualizado).

## Flujo del POS (coherencia UI ↔ servidor)

1. Al seleccionar PV (y al cambiar de cliente) el POS llama `GET /api/ventas/punto-venta/[id]/productos?clienteId=…`.
2. La respuesta incluye por producto `precios: [{ listaPrecioId, precio }]` con las entradas de la lista del PV, la del cliente y la lista default del tenant, además de `listaPrecioDefaultId` (solo en puntos de venta; en almacén la default no participa).
3. `getPrecioEfectivo` — adaptador del resolver compartido (LP-1.3) — aplica la cadena cliente > PV > default > base y el carrito se recalcula mostrando toast por cada ítem cuyo precio cambió.
4. Mientras `isFetchingProductos` está activo los botones de cobro se deshabilitan, para evitar cobrar en la ventana entre el cambio de cliente y el refetch.

Contrato de lectura del endpoint: sin `tenantId` en el contexto responde 403 (fail-closed); PV, almacén, productos y cliente se filtran siempre por tenant. En almacenes nunca se devuelven precios de listas.

> ⚠️ No introducir caché por `ubicacionId` en este endpoint: con `clienteId` el payload varía por cliente y una caché compartida mezclaría precios entre clientes.

## Fix transversal incluido: clasificación de errores en `withAction`

`withAction` clasificaba como error de Prisma cualquier error con `code` que empieza por "P", así que `ActionError` de negocio como `PRICE_MISMATCH`, `PAYMENT_TYPE_NOT_FOUND`, `PERIODO_CERRADO` o `PLAN_NOT_FOUND` llegaban al cliente con el mensaje genérico "Error de base de datos (…)" en vez del mensaje real. Desde LP-0 el check `instanceof ActionError` ocurre antes del duck-typing de Prisma, con tests que cubren ambos lados (`src/lib/server-actions/__tests__/with-action.test.ts`).

## Notas de rollout (mobile y overrides)

- Web POS, API legacy y `/api/mobile/v1/sales/create` comparten el mismo servicio: los clientes móviles viejos que calculen precio distinto del vigente recibirán 400 `PRICE_MISMATCH` hasta actualizarse.
- Quien editaba precios "a mano" en el carrito ahora necesita `ventas.precio.override` (los managers lo tienen por defecto).

## Limitaciones conocidas (intencionales, con plan)

- **TOCTOU**: la resolución ocurre antes de la transacción; si una lista cambia en esa ventana de milisegundos, la auditoría registra el precio esperado de ese instante. Trade-off aceptado para no alargar la transacción.
- `esDefault` de `ListaPrecio` **ya participa** en la cadena desde LP-1.2 (2026-10-18): la lista default es fallback intermedio en el POS, Ofertas y la validación server-side; el E2E `e2e/pos-lista-precio-cliente.spec.ts` valida el ciclo completo.
- Reglas por cantidad, vigencias, monedas por lista y descuento por línea: planificadas en LP-2 a LP-5 (ver `docs/auditoria-listas-precios-vs-odoo.md`).

## Referencias

- Change archivado: `openspec/changes/archive/2026-09-12-ventas-precio-server-lp0/` (proposal, design, tasks y evidencias RED/GREEN).
- Tests de enforcement: `src/features/ventas/__tests__/venta-price-integrity.test.ts`.
- Tests del resolver: `src/features/ventas/__tests__/precio-venta-resolver.test.ts`.
- Tests del payload POS: `src/lib/api/productos-ubicacion.test.ts`.
- Auditoría y plan general: `docs/auditoria-listas-precios-vs-odoo.md`.
