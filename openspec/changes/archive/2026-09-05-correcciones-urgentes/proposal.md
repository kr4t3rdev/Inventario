# Correcciones Urgentes: contratos, Ofertas, Almacenes, Venta de Servicios, Mermas y Cliente

## Decisión ejecutiva

Cerrar los 6 agujeros críticos detectados en la auditoría comparativa TCP vs Odoo (2026-09-05) antes de cualquier trabajo de roadmap. Son correcciones de seguridad, integridad de datos y confiabilidad financiera, no features nuevas. Cada fase sigue TDD estricto (RED → GREEN → REFACTOR), code review y commit propio; la numeración de fases define el orden de ejecución recomendado.

## Problema

La auditoría comparativa (14 módulos, evidencia en sesión de análisis) reveló defectos que afectan datos y seguridad de todos los tenants:

1. **Contratos (IDOR cross-tenant)** — Las rutas REST de `src/features/contratos/api/handlers.ts` (update/delete/get/bulk/firmas/aprobaciones/alertas/versiones/check-diff) consultan por `contratoId` **sin filtrar por `tenantId`**. Cualquier usuario autenticado lee, modifica, firma o aprueba contratos de otro tenant. Además, `generarProximoConsecutivo` en `src/features/contratos/lib/numeroContratoGenerator.ts` calcula el consecutivo **sin `tenantId`**, mezclando la numeración entre empresas y filtrando actividad comercial entre tenants.
2. **Ofertas (endpoints públicos + corrupción de datos)** — Los handlers de PDF y Excel en `src/features/ofertas/api/handlers.ts` no autentican ni filtran por tenant: cualquiera con el `id` de una oferta descarga su contenido. Además, `facturarOfertaAction` (`src/features/ofertas/services/facturar-oferta-workflow.ts`) crea la `Venta` y descuenta stock pero **nunca crea `VentaItem`**, por lo que esas ventas no entran a reportes por producto ni a la asignación FIFO (`allocateFifoForSale`), corrompiendo silenciosamente rentabilidad y costos.
3. **Almacenes (borrado destructivo en cascada)** — `Producto.almacen` tiene `onDelete: Cascade` y `deleteAlmacenAction` no valida dependencias: eliminar un almacén **borra físicamente todos sus productos**.
4. **Venta de servicios / Ofertas (precios y totales confiados al cliente)** — `createVentaServicioAction` acepta `precioUnitario` del cliente sin contrastarlo con el catálogo (el total ya se recalcula server-side desde fase 2, pero con un precio inyectable). `createOfertaAction` acepta precios, subtotal, impuestos y total del cliente **y no valida que los items pertenezcan al tenant**. Es el mismo vector que ya se cerró para el total en la fase 2 de servicios.
5. **Mermas (sin trazabilidad + costo obsoleto)** — El modelo `Merma` no registra quién la creó (`creadoPorId` inexistente) y `updateMermaAction` no recalcula `costoTotal` al cambiar cantidad/producto, dejando el costo almacenado inconsistente con el movimiento real.
6. **Cliente.listaPrecioId (código roto)** — El POS (`pv-interface.tsx`) lee `(cliente as any)?.listaPrecioId` para priorizar la lista de precios del cliente, pero el campo **no existe en el modelo `Cliente`**: la funcionalidad opera sobre un campo fantasma.

## Metas

1. Toda ruta/handler de contratos y ofertas exige `tenantId` del usuario autenticado y responde 404 genérico (no revelador) ante IDs de otro tenant.
2. La numeración de contratos es por tenant, transaccional y tolerante a colisiones concurrentes.
3. Facturar una oferta genera `VentaItem` por línea de producto, dispara la asignación FIFO y alimenta los reportes por producto igual que una venta directa.
4. Eliminar un almacén con dependencias es imposible por aplicación y por base de datos.
5. Los precios de venta de servicios y ofertas provienen del catálogo del tenant en el servidor; el cliente solo elige qué compra y cuánto.
6. Toda merma registra su autor y su costo refleja el estado real al momento del movimiento.
7. El precio preferencial por cliente en el POS funciona de punta a punta con un campo real, validado y auditable por feature flag.

## No-metas

- No se rediseñan módulos (máquina de estados de contratos, ciclo de estados de ofertas, alertas automáticas de vencimiento son roadmap aparte).
- No se convierte `TipoContratoCustom` a por-tenant en este change; se marca la decisión en `design.md` (opción mínima: restringir su creación a manager).
- No se implementan devoluciones a proveedor, recepciones parciales ni límites de crédito (roadmap).
- No se toca `EAN-13`/CLAS ni el motor FX (ya auditados como sanos).

## Alcance y archivos principales

| Corrección | Archivos primarios |
|---|---|
| CU-01 Contratos IDOR | `src/features/contratos/api/handlers.ts`, rutas `src/app/api/contratos/**`, tests `src/features/contratos/__tests__/` |
| CU-02 Numeración contratos | `src/features/contratos/lib/numeroContratoGenerator.ts`, `handlers.ts` (create), tests del generador |
| CU-03 Ofertas auth PDF/Excel | `src/features/ofertas/api/handlers.ts`, rutas `src/app/api/ofertas/[id]/{pdf,excel}/route.ts` |
| CU-04 Almacenes anti-cascada | `prisma/schema.prisma` (relación `Producto.almacen`), migración nueva, `src/features/almacenes/actions.ts` |
| CU-05 Precios/totales server-side | `src/features/venta-servicios/actions.ts`, `src/features/venta-servicios/schemas.ts`, `src/features/ofertas/actions.ts`, `src/features/ofertas/schemas.ts` |
| CU-06 VentaItem en facturar oferta | `src/features/ofertas/services/facturar-oferta-workflow.ts`, reuse de `venta-mutation-service.ts` / `fifo-allocation.ts` |
| CU-07 Mermas trazabilidad | `prisma/schema.prisma` (modelo `Merma`), `src/features/mermas/actions.ts`, UI de listado de mermas |
| CU-08 Cliente.listaPrecioId | `prisma/schema.prisma` (modelo `Cliente`), `src/features/clientes/{actions.ts,schemas.ts}`, `src/features/ventas/components/pv-interface.tsx`, `src/lib/types/pricing.ts` |

## Criterios de aceptación

1. Tests tenant-negativos prueban que contratos y ofertas (incluidos PDF/Excel) de un tenant B son inaccesibles para el tenant A con respuesta idéntica a "no existe" (sin fuga de existencia).
2. Dos creaciones concurrentes de contrato del mismo tenant/types distinto producen consecutivos correctos por tenant sin colisión.
3. Facturar una oferta con líneas de producto crea `VentaItem`s, ejecuta asignación FIFO y la venta aparece en reportes por producto (test de regresión contra dashboard/rentabilidad).
4. Intentar borrar un almacén con productos/stock/transferencias/mermas/PV devuelve error tipado con conteos; con base de datos simulada la FK ya no permite cascada.
5. Enviar un `precioUnitario` manipulado desde el cliente no altera el resultado persistido (servicio y oferta); los totales persistidos derivan 100% del catálogo server-side.
6. Crear/editar merma persiste `creadoPorId` y `costoTotal` coherente con `cantidad × precioCosto` vigente en cada escritura.
7. Crear/editar cliente persiste `listaPrecioId` (validado por tenant y feature `listas-precios`), y el POS aplica el precio de esa lista sin casts `any`.
8. Toda la evidencia sigue el workflow del proyecto: TDD (RED primero), tests con rutas explícitas (`pnpm exec vitest run <rutas>`), code review por fase y commit por fase con stage selectivo (el worktree contiene cambios ajenos).
