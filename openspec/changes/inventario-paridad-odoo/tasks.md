# Tasks: Paridad de Inventario vs Odoo por Planes

> TDD obligatorio (`strict_tdd: true`). Cada tarea de lógica empieza en
> ROJO (test que falla) y luego GREEN. Unitarios mockean `@/lib/prisma`.
> Solo `src/**/__integration__/` usa BD real con `DATABASE_URL_TEST`.
> Texto visible en español neutro.

## Fase 0 — Registry, gating y base ✅

* [x] 0.1 11 claves en `feature-registry.ts` + test
  `inventario-paridad-odoo.test.ts`.
* [x] 0.2 Seed por tier en `prisma/seed/plans-seed.ts` +
  migración `20260905130001_inventario_flags_plans` para planes y
  licencias existentes + test estático `inventario-flags-migration.test.ts`.
* [x] 0.3 `requireFeature` con claves nuevas en `tenant-scope.test.ts`.
* [x] 0.4 Entradas en `SIDEBAR_FEATURE_MAP`
  (`src/features/sidebar/sidebar-config.ts`). Las páginas se crean en Fase 1.6.

## Fase 1 — P0 Kardex ✅ (con hardening post-review)

* [x] 1.1 Migración `20260905130000_add_stock_move_lines`: enum
  `TipoOrigenMovimiento`, FK compuesta `(productoTenantId, productoId)`,
  `ON DELETE RESTRICT` para producto, FK a `User` con `SetNull`,
  clave única `eventoKey` y triggers `BEFORE UPDATE/DELETE`.
* [x] 1.2 `src/features/inventario/movimientos.ts`:
  `registrarMovimiento` con upsert idempotente, `getKardex` con saldo
  de apertura y paginación, `getMovimientosDeOrigen`,
  `revertirMovimientosDeOrigen` con costo histórico.
* [x] 1.3 `getKardexAction` (producto requerido; paginado).
* [x] 1.4 Doble escritura: ventas (crear/anular con costo histórico),
  compras, transferencias (crear/completar + compensación en
  editar/eliminar), mermas (crear/editar/eliminar), producción
  (aprobar consumo/completar ingreso/cancelar reposición+compensación).
  Vales de salida no mueven stock hoy → sin kardex (cubiertos en Fase 2).
* [x] 1.5 Backfill idempotente `prisma/scripts/backfill-stock-move.ts` +
  test de integración `src/lib/__integration__/kardex-backfill.test.ts`
  (incluye paridad kardex↔StockUbicacion e inmutabilidad; requiere PG).
* [x] 1.5b Scoping por tenant en validación de origen/destino de
  transferencias (`findFirst` con tenantId).
* [x] 1.6 UI lectura: `src/app/busy/inventario/kardex/page.tsx` + tabla
  + exportación CSV (flag `kardex`).

## Fase 2 — P0 Ajuste unificado + Conteo ✅ (7d633cfd)

* [x] 2.1 Migración `20260906090000_ajuste_conteo_inventario`:
  `AjusteInventario` + `ConteoInventario` + `ConteoLinea`.
* [x] 2.2 Schemas Zod en `src/features/inventario/schemas.ts`
  (motivo catálogo, doble captura, conciliación).
* [x] 2.3 `actions-ajustes.ts`: `createAjusteAction` (teórico de
  `StockUbicacion`, valoriza a CPP, kardex AJUSTE, bloquea con conteo
  activo), `anularAjusteAction` (compensa con costo histórico),
  `getAjustesAction`.
* [x] 2.4 Puente legacy: `createMermaAction` crea su ajuste espejo con
  `mapearMotivoLegacy`; `updateMermaAction` anula y recrea;
  `deleteMermaAction` anula el espejo. Vales de salida siguen sin
  mover stock (entran al ajuste unificado en una fase posterior).
* [x] 2.5 `actions-conteos.ts`: iniciar (líneas desde StockUbicacion),
  registrar captura 1/2 (usuario distinto en la segunda), conciliar
  (ajustes con motivo ERROR_CONTEO + kardex + stock por varianza),
  cancelar (solo estados pre-ajuste) + `getConteosAction`.
* [x] 2.6 UI: `/busy/inventario/ajustes` y `/busy/inventario/conteos` +
  sidebar (`SIDEBAR_FEATURE_MAP` + permisos), con tests de componente.

## Fase 3 — P1 Compras y reabastecimiento (Profesional) ✅ Backend/UI (E2E pendiente)

* [x] 3.1 Migración `20260906120000_ordenes_compra_recepciones_reabastecimiento`:
  `OrdenCompra`, `OrdenCompraItem`, `Recepcion`, `RecepcionItem`,
  `ReglaReabastecimiento`; `CompraDocumento.ordenCompraId?` nullable.
* [x] 3.2 `src/features/compras-productos/actions-oc.ts`:
  crear/confirmar OC, registrar recepción (descuenta pendiente,
  transiciona `PARCIAL/RECIBIDA`), cancelar con validación.
  - RED/GREEN: recepción 60/100 deja `PARCIAL`; 40 restantes cierran;
    exceso rechazado.
* [x] 3.3 Vincular factura: `createCompraProductoAction` valida proveedor,
  estado y cantidades contra recepciones; genera movimiento solo para
  compra directa, nunca duplica el `StockMoveLine` ya creado por recepción.
* [x] 3.4 `sugerirReabastecimientoAction` (flag `reabastecimiento`):
  disponible < min propone `max - disponible`; con receta propone
  fabricación, sin receta propone OC. Incluye CRUD de reglas.
* [x] 3.5 UI: `/busy/compras/ordenes`, `/busy/compras/recepciones` y
  `/busy/compras/reabastecimiento`; backorder visible en líneas y sidebar.
* [x] 3.5b Endurecimiento post-auditoría: recepción idempotente
  (`Recepcion.claveIdempotencia` única), verificación post-incremento contra
  sobre-recepción concurrente, confirmación/cancelación/cierre con
  compare-and-set, factura vinculada que descuenta cantidades ya facturadas,
  agrega líneas repetidas por producto y ajusta CPP solo por diferencia de
  precio (sin doble entrada física), validación de ubicación en reglas
  min/max, FKs compuestas `(tenantId, id)` en tablas de OC/recepción, UI
  multilínea con selector de línea pendiente, gating por feature en páginas
  y corrección del render del formulario de compra (`index` fuera de scope).
* [x] 3.6 E2E Playwright (plan Profesional): OC → recepción parcial (60) →
  recepción total (40) → factura vinculada → kardex cuadra. El spec usa las
  credenciales e IDs dinámicos del global setup; el seed exige plan Profesional.
  Ejecutado en DB local desechable `tcp_test_e2e_lp1_20261102`: **1/1 passed**;
  el teardown confirmó limpieza y reinició el esquema.

<!-- Diseño original de Fase 3:
* [ ] 3.1 Migración: `OrdenCompra`, `OrdenCompraItem`,
  `Recepcion`, `RecepcionItem`, `ReglaReabastecimiento`.
  `CompraDocumento.ordenCompraId?` nullable.
* [ ] 3.2 `src/features/inventario/actions-oc.ts` con
  `requireFeature(user, 'ordenes-compra', ...)`:
  crear/confirmar OC, registrar recepción (descuenta pendiente,
  transiciona `PARCIAL/RECIBIDA`), cancelar con validación.
  - RED: recepción 60/100 deja `PARCIAL`; 40 restantes cierran;
    exceso rechazado.
* [ ] 3.3 Vincular factura: al crear `CompraDocumento` con `ordenCompraId`,
  validar proveedor y cantidades contra recepciones; genera
  `StockMoveLine` de entrada por recepción (no duplicar con factura).
* [ ] 3.4 `sugerirReabastecimientoAction` (flag `reabastecimiento`):
  disponible < min propone `max - disponible`; con receta propone
  fabricación, sin receta propone OC.
* [ ] 3.5 UI OC: `src/app/busy/compras/ordenes/*` + recepciones +
  backorder visible; compra directa intacta.
* [ ] 3.6 E2E Playwright (plan Profesional): OC → recepción parcial →
  recepción total → factura → kardex cuadra.
-->

## Fase 4 — P1 UdM con factor (Profesional)

* [x] 4.1 Reutilizar `UnidadConversion.factorAStock` por producto; no añadir
  un factor global en `Unidad` porque el mismo empaque puede variar entre productos.
* [x] 4.2 Reutilizar conversión exacta `calculateUnitQuantityCost()` y cubrir
  cantidad/costo en unidad stock; añadir conversión exacta de precio de venta.
* [x] 4.3 Aplicar conversión antes de persistir: compra directa normaliza;
  ventas normalizan cantidad/precio y guardan snapshots antes de stock/FIFO;
  recetas normalizan factores por producto y el consumo usa cantidad en unidad stock.
* [x] 4.4 Verificar costo/FIFO usando la cantidad y costo en unidad stock;
  prueba FIFO confirma que una línea con snapshot de empaque asigna las unidades
  stock persistidas. `cost-calculator.ts` y `venta-costo.ts` reciben cantidades/
  precios ya normalizados, por lo que no necesitan una conversión adicional.

## Fase 5 — P1 Lotes/FEFO + Ubicaciones (Profesional)

* [ ] 5.1 Migración: `Lote` + `PurchaseAllocation.loteId?` +
  `Ubicacion` (parentId, tipo).
* [ ] 5.2 Entradas crean lote (código = factura + fecha o manual);
  `cantidadDisponible` por lote.
  - RED: `lotes.test.ts`: entrada 10 crea lote con 10 disponibles.
* [ ] 5.3 FEFO en `allocateFifoForVentaItem`: ordenar por
  `fechaVencimiento` NULLS LAST dentro del FIFO.
  - RED: A(10 días,5) + B(60 días,5), venta 6 → 5 de A + 1 de B.
* [ ] 5.4 `getAlertasVencimientoAction` (≤30 días, configurable) +
  badge en inventario.
* [ ] 5.5 Kardex y conteo filtran por `Ubicacion` hija; migración de
  `StockUbicacion` plano a hoja de la jerarquía sin pérdida.
* [ ] 5.6 Seed demo Profesional (`professional-seed.ts`): lotes con
  vencimientos y ubicaciones hijas.

## Fase 6 — P1 Variantes (Profesional)

* [ ] 6.1 Migración: `ProductoPlantilla` + columnas en `Producto`:
  `plantillaId?`, `atributoJson?`, `sku?`, `esVariante @default(false)`.
* [ ] 6.2 `actions-variantes.ts` (flag `variantes`): crear plantilla,
  generar variantes (producto cartesiano validado), bloquear venta de
  plantilla.
  - RED: plantilla no vende; variante M descuenta solo su stock.
* [ ] 6.3 Precios/costos/stock independientes por variante; listas de
  precios resuelven por `varianteId`.
* [ ] 6.4 UI: `src/app/busy/inventario/variantes/*` (plantilla →
  matriz de variantes con SKU/stock/precio).

## Fase 7 — P2 Empresarial (MRP + trazabilidad + forecast)

* [ ] 7.1 BOM multinivel: `RecetaIngrediente.recetaIngredienteId?`
  (ingrediente = producto o subreceta) + validación anti-ciclos.
  - RED: ciclo A→B→A rechazado; explosión 10 P = 20 S = 60 I.
* [ ] 7.2 `planificarNecesidadesAction` (flag `mrp-avanzado`):
  explosión vs disponible + lotes reservados → sugiere OC y órdenes.
* [ ] 7.3 Trazabilidad lote → documentos: `getTrazabilidadLoteAction`
  (compras origen → ventas destino) + UI.
* [ ] 7.4 Putaway simple: `ReglaPutaway { productoId?, categoriaId?,
  ubicacionId }` + sugerencia de ubicación en recepción.
* [ ] 7.5 Reportes: valorizado oficial (CPP/FIFO a fecha), rotación y
  forecast de quiebre; exportables. Reutiliza kardex, no reconstruye.

## Fase 8 — Verificación y archivo

* [x] 8.1 `pnpm run test:run` por feature + `test-isolation-contract`
  en verde (0 offenders); integración solo con `DATABASE_URL_TEST`. La suite
  completa pasó con un worker: **803 archivos aprobados, 1 omitido; 5,455
  pruebas aprobadas, 1 omitida y 2 todo**. Las pruebas focalizadas de seed E2E
  y allowlist también pasaron **11/11**.

## Auditoría posterior de Sesión F — merma tenant-scope + LP-1 (2026-11-02)

- [x] Merma desktop: listado/lectura filtran por `tenantId`; create verifica
  producto y ubicación; update/delete leen la merma por `(mermaId, tenantId)`;
  el espejo `AjusteInventario` y kardex filtran por tenant.
- [x] Hallazgo adicional en el alcance: `almacenId` explícito de create/update
  no se comprobaba contra el tenant y la ubicación de producto usada en POST
  móvil tampoco se volvía a validar. Ahora ambas rutas validan almacén mediante
  `findFirst({ almacenId, tenantId })` antes de consultar stock o mutar datos.
  RED desktop: `src/features/mermas/__tests__/actions.test.ts` — 2 casos
  fallaban al recibir `STOCK_INSUFICIENTE` en vez de `NOT_FOUND`; GREEN desktop
  y móvil: suites de mermas + mobile.
- [x] LP-1 cotejado contra `5e37f30e8`: fuente única
  `resolvePrecioVenta` (cliente > PV > default del tenant > base); el writer
  de ventas tenant-scopes PV, cliente, productos y lista default, y rechaza
  divergencia con `PRICE_MISMATCH` sin override; `getPrecioEfectivo` y el
  endpoint por ubicación comparten resolver y restringen datos a listas
  aplicables del tenant. Docs en `content/docs/modules/ventas/integridad-precios.md`
  y `docs/auditoria-listas-precios-vs-odoo.md` concuerdan.
- [x] E2E LP-1.4 cotejado: fixtures base 180/default 165/cliente 150 en
  `scripts/seed-e2e-user.ts`; `e2e/pos-lista-precio-cliente.spec.ts` comprueba
  el default en POS, cambio de cliente, total y precio persistido por el
  endpoint de venta.
- [x] Pruebas unitarias focalizadas: `src/features/mermas`, mobile mermas,
  resolver/price-integrity, orquestación de venta, pricing adapter y endpoint
  de productos por ubicación → 97/97 (11 archivos).
- [x] E2E LP-1.4 ejecutado en `tcp_test_e2e_lp1_20261102`, DB local desechable
  nueva en `127.0.0.1:5433`; migraciones y planes sembrados. Se corrigió el
  feature `clientes` faltante en la licencia fixture, se añadieron cuenta/tipo
  de pago E2E y se ajustaron aserciones a copy/formato monetario reales. El
  test verifica que la venta facturada quede listada en 150 CUP; **1/1 passed**.
  El global teardown verifica limpieza de fixtures y reinicia el esquema.
  Reproducir con `NODE_OPTIONS='--import=tsx'`, `ALLOW_DISPOSABLE_TEST_DB=1`,
  `DATABASE_URL` igual a `DATABASE_URL_TEST` y un `E2E_TEST_PASSWORD` de 16+
  caracteres.
- [x] **Drift de esquema encontrado por el E2E y corregido**: Prisma incluía
  `OrdenReparacion.tenantId`, pero la columna no existía en migraciones. Se
  agregó `20261106000000_add_tenant_id_to_orden_reparacion`, que deriva el
  tenant del cliente, falla ante datos huérfanos/cruzados y agrega NOT NULL,
  índice y FK a `tenants`. Contrato RED→GREEN en
  `src/lib/__tests__/orden-reparacion-tenant-migration-contract.test.ts`; se
  aplicó a la DB TCP y el E2E LP-1.4 volvió a pasar 1/1, cargando la factura.
- [x] La corrida limpia expuso carrera en la creación lazy de monedas CUP/USD:
  solicitudes simultáneas hacían `upsert` contra `codigo` único y una registraba
  P2002 aunque el error se absorbía. Se reemplazó por `createMany` con
  `skipDuplicates`; test en `exchange-rate-provider.test.ts` y E2E repetido
  → **1/1 passed sin errores de monedas**.
* [x] 8.2 `pnpm run lint` y `tsc --noEmit` en archivos tocados. Lint completó
  con **0 errores y 680 advertencias**; el chequeo global de tipos pasó con
  `NODE_OPTIONS='--max-old-space-size=4096' pnpm exec tsc --noEmit --pretty false`
  (el límite Node predeterminado de 2 GB no alcanzaba para este proyecto).
* [ ] 8.3 Matriz manual por plan: Básico no ve OC/lotes/variantes/MRP
  (toast upgrade); Profesional ve P1; Empresarial ve todo. La prueba de
  configuración `src/features/planes/__tests__/inventario-paridad-odoo.test.ts`
  pasó **5/5** (flags por plan); falta la comprobación manual de navegación,
  acciones y mensajes de upgrade en la UI. El cierre manual de lotes, variantes
  y MRP se verificará cuando existan sus pantallas (fases 5–7); no bloquea el
  inicio de Fase 4.
* [ ] 8.4 Actualizar `PLANES-SUSCRIPCION.md` y demo seeds
  (`base-seed.ts`, `professional-seed.ts`, `enterprise-seed.ts`).
