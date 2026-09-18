# LP-0 — Integridad de precios server-side en ventas

## Decisión ejecutiva

El servidor deja de confiar en `precioUnitario` enviado por el cliente al crear una venta, y lo re-resuelve con la cadena de prioridad del negocio (**lista del cliente → lista del punto de venta → precio base**). Las desviaciones se rechazan por defecto (`PRICE_MISMATCH`) y solo se aceptan si el usuario posee el permiso nuevo `ventas.precio.override`, quedando auditadas. Origen: auditoría de listas de precios vs Odoo (2026-09-12, `docs/auditoria-listas-precios-vs-odoo.md`, hallazgo H1).

## Problema

`VentaMutationService.create` (punto único por donde pasan web POS y mobile) persiste el `precioUnitario` exactamente como llega en el payload (`src/features/ventas/services/venta-mutation-service.ts:126`), validado solo como `int().min(0)` (`src/features/ventas/schemas.ts:11`). Un cliente HTTP manipulado puede vender cualquier producto a cualquier precio ≥ 0, con RBAC correcto y sin dejar rastro. Es un agujero de integridad financiera activo.

Además, la resolución actual vive fragmentada y medio construida:

- La lista del cliente solo se aplica en Ofertas (server-side). En el POS web es código muerto: `getPrecioEfectivo` necesita el array `precios` del producto y el endpoint `/api/ventas/punto-venta/[id]/productos` no lo entrega (hallazgo H2 de la auditoría).
- No existe una función única de resolución: POS lo hace en el navegador, Ofertas en servidor, y la venta no lo hace en absoluto.

## Propuesta

1. **Resolver unificado server-side** (`src/features/ventas/services/precio-venta-resolver.ts`): función pura que recibe `{ precioBase, precios, pvListaId, clienteListaId }` y devuelve `{ precio, fuente: 'CLIENTE' | 'PV' | 'BASE' }`.
2. **Permiso nuevo** `ventas.precio.override` (categoría `ventas`, `sensitive`, default solo `manager`) + actualización del fixture de paridad día-1.
3. **Enforcement en `VentaMutationService.create`**: antes de la transacción, cargar PV (`listaPrecioId`), cliente (`listaPrecioId`, tenant-scoped) y productos con `precios`; resolver cada ítem:
   - coincide → flujo normal;
   - difiere y el usuario tiene override → se respeta el precio enviado y se registra en `AuditLog` (dentro de la transacción) con precio esperado, precio aplicado y fuente de cada ítem;
   - difiere sin override → `ActionError('PRICE_MISMATCH')` con precio esperado, sin tocar stock ni venta.
4. **Coherencia POS (necesaria para que el enforcement sea operable)**: `getProductosPorUbicacion` acepta `clienteId` opcional e incluye el array `precios` filtrado a las listas relevantes (PV + cliente); la ruta lo toma de `?clienteId=` y `pv-interface` lo pasa al seleccionar cliente. Con eso la rama cliente de `getPrecioEfectivo` deja de ser código muerto (cierra H2 a nivel de datos).

## No-goals

- No se cambia la cadena de prioridad ni se introduce `esDefault` en la resolución (eso es LP-1).
- No hay reglas por cantidad, vigencias ni monedas (LP-2..LP-4).
- No se toca el descuento manual por venta ni el update de venta (alcance separado).
- No se rediseña la UI del POS: solo el payload necesario para que el precio visible coincida con el exigido.
- Ofertas ya resuelven server-side; quedan como están salvo convergencia futura hacia el mismo resolver.

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Resolver | `src/features/ventas/services/precio-venta-resolver.ts` (nuevo) | Función pura + tipos |
| Permisos | `src/lib/auth/permission-registry.ts`, `src/lib/auth/__tests__/__fixtures__/permission-parity.json` | Clave `ventas.precio.override` (manager) |
| Creación de venta | `src/features/ventas/services/venta-mutation-service.ts` | Resolución + política de mismatch/override + audit |
| Payload POS | `src/lib/api/productos-ubicacion.ts`, `src/app/api/ventas/punto-venta/[puntoDeVentaId]/productos/route.ts`, wrapper `src/app/actions/productos-ubicacion.ts`, `src/features/ventas/components/pv-interface.tsx` | `clienteId` opcional + array `precios` por producto |
| Tests | `src/features/ventas/__tests__/venta-price-integrity.test.ts` (nuevo), `src/lib/api/productos-ubicacion.test.ts`, fixture paridad, mocks existentes de `ventas/__tests__/actions.test.ts` | RED→GREEN |

## Criterios de aceptación

1. Venta con `precioUnitario` manipulado y usuario sin override → rechazada con `PRICE_MISMATCH`, sin crear venta ni tocar stock.
2. Con permiso `ventas.precio.override` → la venta se crea con el precio enviado y quede audit log con ambos precios.
3. Si el cliente tiene lista asignada, el servidor exige ese precio aunque el POS haya enviado el de la lista del PV (y tras el cambio de payload, el POS muestra y cobra ese precio).
4. Sin lista de PV ni de cliente, el precio exigido es `Producto.precioVenta`; el flujo actual sin cambios para tenants que no usan listas.
5. Suite scoped de ventas/permisos/productos-ubicacion verde; `pnpm run lint` limpio en los archivos tocados.
