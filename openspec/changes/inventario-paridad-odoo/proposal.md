# Proposal: Paridad de Inventario vs Odoo por Planes

## Intent

Cerrar las brechas auditadas contra Odoo Inventory sin romper el modelo
actual (multi-almacén plano, FIFO real con `PurchaseAllocation`, recetas
simples). La implementación se segmenta por plan para monetizar las
capacidades costosas:

* **Núcleo (todos los planes):** kardex auditable, ajuste unificado,
  conteo físico ciego. Sin esto ninguna fase posterior es defendible
  ante auditoría.
* **Profesional:** compras con recepción parcial, reabastecimiento,
  UdM con factor, lotes/series/vencimiento con FEFO, variantes,
  ubicaciones anidadas nivel 1.
* **Empresarial:** MRP extendido (BOM multinivel + planificación),
  trazabilidad completa, reglas putaway, forecast y rotación.

## Scope

### In Scope

1. **P0 — Núcleo auditable (base de todo):**
   - `StockMoveLine` apendicular e inmutable (kardex).
   - `AjusteInventario` unificado con catálogo de motivos y costo
     valorizado (reemplaza lógicamente `Merma` y `ValeSalida`).
   - `ConteoInventario` con doble conteo ciego y varianza que genera
     ajuste.
   - Backfill de movimientos históricos desde `Venta`, `CompraDocumento`,
     `Transferencia`, `Merma`, `OrdenProduccion`.
2. **P1 — Profesional:**
   - `OrdenCompra` + `Recepcion` parcial + backorder residual; la
     `CompraDocumento` actual pasa a ser la factura que cierra la OC.
   - `ReglaReabastecimiento` (min/max) con sugerencia de OC o fabricación.
   - `Unidad.factorAStock` + tipo de uso (compra/stock/venta).
   - `Lote` (código, vencimiento) + FEFO en salidas + alertas.
   - `ProductoPlantilla + Variante` (talla/color, SKU propio).
   - `Ubicacion` anidada nivel 1 (zona/pasillo/estante) sin putaway
     automático.
3. **P2 — Empresarial:**
   - BOM multinivel + planificación de necesidades + subcontratación
     básica (sin PLM/calidad/mantenimiento).
   - Trazabilidad upstream/downstream por lote a documento origen.
   - Reglas putaway simples + valorizado oficial + rotación/forecast.
4. **Gating por plan:** 10 claves nuevas en `feature-registry.ts`,
   `requireFeature` en cada Server Action, `SIDEBAR_FEATURE_MAP` y seed
   de planes.

### Out of Scope

* Contabilidad anglosajona con asientos automáticos por movimiento
  (solo se valoriza; el asiento completo queda fuera).
* PLM, control de calidad, mantenimiento, subcontratación avanzada.
* Rutas inter-empresa y tránsito valorizado multi-compañía (el tenant
  sigue siendo la frontera).
* Landed costs completos (fletes/prorrateos). Solo costo de compra +
  `GastoCompra` existente.
* Migración de datos de Odoo (solo backfill interno).

## Approach

1. **P0 primero, sin gate comercial agresivo.** `StockMoveLine` se
   escribe en la misma transacción que cada flujo existente. Lectura de
   kardex disponible en todos los planes; el conteo y el ajuste quedan
   habilitados en Básico para pasar auditoría.
2. **P1 detrás de `requireFeature`.** Cada capacidad profesional falla
   con `FEATURE_NOT_AVAILABLE` si el plan no la incluye. La UI oculta
   la opción vía sidebar.
3. **P2 como extensión, no rewrite.** Lotes y variantes extienden
   `PurchaseAllocation` y `Producto` sin romper el FIFO actual. MRP
   reutiliza `Receta/OrdenProduccion` existentes.
4. **TDD estricto** según `openspec/config.yaml` (`strict_tdd: true`):
   test en rojo antes de cada modelo/action, mock de `@/lib/prisma`
   en unitarios, `__integration__` solo con `DATABASE_URL_TEST`.

## Affected Areas

| Área | Impacto | Descripción |
|------|--------|-------------|
| `prisma/schema.prisma` | Modificado | 9 modelos nuevos + `Unidad.factorAStock` + índices |
| `src/features/planes/feature-registry.ts` | Modificado | 10 claves nuevas de inventario |
| `prisma/seed/plans-seed.ts` | Modificado | Asignación de claves por plan |
| `src/lib/services/tenant-scope.ts` | Reutilizado | `requireFeature` existente, nuevos casos en test |
| `src/features/inventario/*` | Nuevo | Actions `withAction` de kardex/ajuste/conteo/OC/lotes/variantes |
| `src/features/compras-productos/*` | Modificado | OC y recepción antes de `CompraDocumento` |
| `src/features/produccion/*` | Modificado | BOM multinivel solo Empresarial |
| `src/features/ficha-costo/*` | Modificado | FEFO y factor UdM en `cost-calculator` y FIFO |
| `src/app/busy/inventario/*` | Nuevo/Modificado | Páginas de kardex, conteos, OC, lotes, variantes |
| `src/components/app-sidebar2.tsx` | Modificado | `SIDEBAR_FEATURE_MAP` con nuevas claves |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Backfill histórico inconsistente | Media | Script idempotente + reconciliador como el de `ficha-costo`; conteo inicial cuadra diferencias |
| Doble escritura olvida un flujo | Media | Helper central `registrarMovimiento()` + test por cada origen; CI exige pasar por el helper |
| FIFO se rompe con factor UdM/lotes | Media | Conversión siempre a unidad stock antes de `allocateFifo`; FEFO ordena por vencimiento dentro del FIFO |
| Variantes explotan catálogo | Baja | Límite por plan (`maxProductos` ya existe); plantilla no vende, solo variantes |
| Gate por plan bloquea demo | Baja | Seed demo asigna plan Empresarial temporal como hoy |

## Rollback Plan

1. Revertir migración Prisma (modelos nuevos están aislados; ningún
   modelo existente se elimina, solo se agrega `factorAStock` nullable).
2. Desactivar flags en `TenantLicense.features` (vuelve a flujo actual).
3. Las escrituras duales tienen interruptor: si `StockMoveLine` falla,
   la transacción completa falla (no hay estado intermedio).
4. Backfill es re-ejecutable y marca `origenId` para purga por rango.

## Dependencies

* `StockUbicacion`, `PurchaseAllocation`, `fifo-allocation.ts`,
  `cost-calculator.ts` existentes.
* `withAction`, `requireTenant`, `requireFeature` existentes.
* `Plan.features` / `TenantLicense.features` y sidebar existentes.

## Success Criteria

* [ ] Kardex por producto/ubicación/fecha cuadra con `StockUbicacion`.
* [ ] Ajuste con motivo genera movimiento trazable y valorizado.
* [ ] Conteo ciego genera varianza y ajuste sin edición directa de stock.
* [ ] OC parcial + backorder cierra contra factura (3-way visible).
* [ ] Lote FEFO descuenta el próximo a vencer; alerta a 30 días.
* [ ] Variante vende con SKU propio y descuenta su stock.
* [ ] Plan Básico no ve OC/lotes/variantes/MRP (toast de upgrade).
* [ ] Tests unitarios mockean prisma; 0 offenders en
  `test-isolation-contract.test.ts`.
