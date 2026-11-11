# Design: Sesión F — Brechas grandes vs Odoo

## Context

Re-auditoría 2026-09-26 (memoria `reauditoria-modulos-vs-odoo-2026-09-26`):
unidades sin conversión, sin devoluciones a proveedor, proveedor sin 360 ni
pricelist, gastos sin recurrentes/adjuntos/viáticos, `NominaConfig` y
`Empleado.userId` inexistentes, botón "Exportar PDF" del estado de cuenta
decorativo, y paridad de inventario detenida en fase 3 (lotes/FEFO,
ubicaciones, variantes en 0%). Base verificada con 4 agentes Explore sobre el
código real (modelos, actions, hooks contables y UI citados abajo).

Patrones existentes que se imitan (no se inventa infraestructura):

| Patrón | Fuente | Se reutiliza en |
|---|---|---|
| Devolución con saldo a favor | `DevolucionVenta` + `devolucion-venta-service.ts` + `buildEventoDevolucionVenta` | F-2 |
| Kardex append-only | `registrarMovimiento` / `revertirMovimientosDeOrigen` (`src/features/inventario/movimientos.ts`) | F-2, F-7 |
| Config 1:1 por tenant | `TenantAccountingPolicy` + `provisionTenantAccountingPolicy` | F-5 |
| Adjuntos polimórficos | `CloudinaryAsset` (`ownerType`/`slot`) + `cloudinary-upload.ts` | F-4 |
| FIFO por allocations | `src/lib/services/fifo-allocation.ts` (`allocateFifoForVentaItem`) | F-7 |
| Egresos unificados | `pago-gastos-workflow.ts` (`applyPagoGastoWorkflow`) | F-4, F-5 |
| Numeración por documento | patrón de transferencias (secuencia por tenant) | F-2 |
| Idempotencia por clave | `CompraDocumento.claveIdempotencia @@unique([tenantId, claveIdempotencia])` | F-4 |
| Plan de cuentas por evento | `event-builders.ts` + `plan-default.ts` + `postEvento` | F-2 |

## Goals / Non-Goals

- **Goals:** cerrar las 9 brechas con esquema aditivo, TDD estricto (test rojo
  → verde → refactor → commit por fase), gating por plan con claves del
  registry existentes, y server-authority en toda conversión/cálculo.
- **Non-Goals:** moneda propia en `GastosDE` (el set FX ya existe en
  `ReconciliacionGasto` a nivel pago); enforcement del período cerrado en
  gastos (es Sesión A, revertida con el merge — se re-integra aparte); UI de
  POS con selector de unidad (pendiente explícito); fases 7-8 de paridad
  (MRP/trazabilidad/putaway/valorizado); migraciones SQL (Railway corre
  `db-push`); tocar las ramas B-E o la capa contable de
  `feat/contabilidad-capa-formal`.

## F-1 — UdM con factor (fase 4 paridad)

Decisión heredada del plan `inventario-paridad-odoo` (design.md de ese change):
**toda persistencia en unidad stock** (`Producto.unidadId`, factor implícito
1); la conversión vive solo en el borde server y en reportes. Sin columnas de
cantidad+unidad en ítems.

- Esquema: `Unidad.factorAStock Float @default(1)` (cuántas unidades stock
  equivale 1 de esta unidad; la base del producto queda en 1) +
  `Unidad.tipoUso String @default("STOCK")` ∈ `COMPRA|STOCK|VENTA` (validado
  con Zod, no enum Prisma — mismo criterio que `CompraDocumento.estado`).
- Helpers en `src/lib/inventory-cost-utils.ts` (archivo ya existe):
  - `aUnidadStock(cantidad, unidad): Int` — `Math.round(cantidad × factor)`;
    lanza `UNIDAD_FACTOR_INVALIDO` si factor ≤ 0 o si `|cantidad×factor −
    round| > 1e-6` (fail-closed, sin fracciones: cantidades siguen `Int`).
  - `desdeUnidadStock(cantidadStock, unidad): number` — para mostrar
    equivalencias.
  - `convertirPrecioAPorUnidadStock(precioPorUnidad, unidad): Int` — divide y
    redondea; el total del documento siempre se recalcula server-side.
- Puntos de conversión (todos aceptan `items[].unidadId?` opcional en payload):
  1. `createCompraProductoAction` y `createOrdenCompraAction` +
     `registrarRecepcionAction` (`src/features/compras-productos/`): cantidad
     y `precioUnitario` llegan en la unidad de compra; se convierte cantidad a
     stock y precio a por-unidad-stock antes de validar y persistir.
     `CompraDocumentoItem`/`OrdenCompraItem` siguen guardando cantidad en
     unidad stock.
  2. `crearVentaAction` y creacion de ítems de pedido
     (`src/features/ventas/`): el precio por unidad stock se re-resuelve con
     la cadena LP-0 existente (`precio-venta-resolver.ts`) — el payload en
     caja se convierte antes de la comparación `PRICE_MISMATCH`.
  3. Producción: `RecetaIngrediente.unidadSimbolo` (texto libre) se resuelve
     contra la tabla `Unidad` del tenant por `simbolo`; si hay match usa
     `factorAStock`; si no, fallback al conversor legacy masa/volumen
     (`src/lib/utils/unit-converter.ts`). Recetas existentes no se rompen.
- Gating: `requireFeature('unidades-conversion')` solo cuando el ítem trae
  `unidadId` distinta de la unidad base del producto; sin payload de unidad el
  flujo es byte-a-byte el actual.
- UI: selector de unidad en `compra-producto-form.tsx` (unidades del tenant con
  `tipoUso COMPRA|STOCK`), precio y cantidad con etiqueta de la unidad elegida.
  POS: pendiente explícito.
- Kardex, `StockMoveLine`, `AjusteInventario`, transferencias: sin cambio
  (unidad stock).

## F-2 — Devoluciones a proveedor + anulación con OC

Modelo `DevolucionCompra`: `tenantId`, `numero String` (secuencia por tenant,
patrón transferencias), `proveedorId` (Restrict), `compraDocumentoId` (origen,
obligatorio — la devolución es siempre contra una compra existente),
`estado String` ∈ `PENDIENTE|COMPLETADA|ANULADA`, `formaImputacion String` ∈
`IMPUTACION_CXP|SALDO_FAVOR`, `motivo String?`, `montoTotal Int`,
`montoImputado Int @default(0)` (aplicado a CxP), `saldoAFavor Int
@default(0)`, `moneda String @default("CUP")`, `creadoPorId`, timestamps +
`DevolucionCompraItem`: `productoId`, `compraDocumentoItemId` (obligatorio),
`cantidad Int` (unidad stock), `costoUnitario Int` (del ítem de compra
original), `loteId String?` (para F-7).

Flujo `completarDevolucionCompraAction` (una sola transacción):

1. Validaciones fail-closed: compra origen `estado !== 'ANULADA'` y del tenant;
   por ítem `cantidad devuelta acumulada + nueva ≤ cantidad comprada −
   cantidad asignada FIFO` (cuenta `PurchaseAllocation` por
   `compraDocumentoItemId` más devoluciones previas no anuladas) — errores
   `CANTIDAD_DEVUELTA_EXCEDE` y `STOCK_INSUFICIENTE` (guarda de stock
   disponible en la ubicación del producto).
2. Descuenta stock (`upsertStockUbicacion` delta negativo) y escribe kardex
   `registrarMovimiento` con `tipoOrigen: 'DEVOLUCION_COMPRA'` (nuevo valor en
   enum Prisma `TipoOrigenMovimiento` y en `TIPOS_MOVIMIENTO_INVENTARIO`),
   `origenId: devolucionId`, `costoUnitario` del ítem de compra.
3. Imputación:
   - `IMPUTACION_CXP`: exige CxP viva de la compra (error
     `SIN_CXP_PARA_IMPUTAR` si no); `montoImputado = min(montoTotal,
     saldoPendiente)`; saldo pendiente −= montoImputado (a 0 → `PAGADA`); el
     excedente, si lo hubiera, va a `saldoAFavor`.
   - `SALDO_FAVOR`: todo queda `saldoAFavor` (visible en 360; su aplicación a
     compras futuras queda documentada como fuera de alcance).
4. Publica `buildEventoDevolucionCompra({ devolucionId, montoImputado,
   saldoAFavor, montoTotal, moneda, ... })` — nuevo `DEVOLUCION_COMPRA` en
   `TipoEventoContable`, builder y plantilla en `plan-default.ts`:
   D Proveedores/CxP por `montoImputado`, D Anticipo proveedor por
   `saldoAFavor`, H Inventario por `montoTotal` (espejo de
   `buildEventoDevolucionVenta`).
5. `anularDevolucionCompraAction` (solo `COMPLETADA` sin imputación consumida
   después): revierte kardex/stock con `revertirMovimientosDeOrigen`, devuelve
   el monto imputado al saldo de la CxP, y deja `ANULADA`.

Anulación de factura ligada a OC (hallazgo confirmado en
`anularCompraProductoAction`, `actions.ts:715` — `if (!compra.ordenCompraId)`
salta la reversión): el comportamiento de stock es correcto (el stock lo movió
la recepción; retirarlo es trabajo de `DevolucionCompra`), pero al anular hay
que **liberar la OC para refacturar**: la OC vuelve a `PARCIAL` (o
`CONFIRMADA` si nada quedó facturado) y las consultas de facturas de la OC
excluyen `ANULADA`. Se fija con test de contrato; la docstring del action se
actualiza para señalar a devoluciones como el camino para devolver mercancía.

## F-3 — 360 de proveedor + pricelist

Modelo `ProveedorProducto`: `tenantId`, `vendorId`, `productoId`,
`costoUnitario Int` (centavos), `moneda String @default("CUP")`,
`cantidadMinima Int?`, `plazoEntregaDias Int?`, `esPreferente Boolean
@default(false)`, `ultimaCompraDocumentoId String?`, timestamps,
`@@unique([tenantId, vendorId, productoId])`, índice por producto.

- Sync automático al crear `CompraDocumento` (directa u OC): upsert con el
  costo real de cada ítem y `ultimaCompraDocumentoId`; si no hay preferente,
  la compra más reciente queda marcada.
- `upsertProveedorProductoAction` (manual, permiso de compras) y
  `setProveedorProductoPreferenteAction` (único preferente por
  proveedor+producto).
- Autocompletado en `createOrdenCompraAction`: ítem sin `precioUnitario`
  explícito toma el costo del preferente (o del más reciente) del proveedor.
- `getProveedor360Action(vendorId)`: perfil + pricelist + últimas 20 compras +
  CxP abiertas (`estado != 'PAGADA'`, `deletedAt null`) + anticipos tipo PAGO
  activos + deudas cash + contratos + métricas (comprado 12 meses, fecha
  última compra).
- UI: página `/busy/vendor/[id]/detalle` (server component, tabs Resumen /
  Pricelist / Compras / CxP-Anticipos) y enlace "Ver detalle" en
  `vendor-page-client.tsx`.

## F-4 — Gastos recurrentes + adjuntos + viáticos

- `GastoRecurrente`: `tenantId`, `nombre`, `conceptoId?`, `elementoId?`,
  `proveedorId?`, `empleadoId?`, `monto Int`, `moneda String @default("CUP")`,
  `frecuencia String` ∈ `MENSUAL|BIMESTRAL|TRIMESTRAL|SEMESTRAL|ANUAL`,
  `diaGeneracion Int` (1-28), `proximaGeneracion DateTime`, `activo Boolean
  @default(true)`, `notas String?`, timestamps.
- `GastosDE` gana: `empleadoId String?` (FK Restrict — viáticos),
  `gastoRecurrenteId String?` y `claveIdempotencia String?` con
  `@@unique([tenantId, claveIdempotencia])`.
- `generarGastosRecurrentesAction({ periodo? })`: recorre plantillas activas
  con `proximaGeneracion <= fin del período objetivo`; crea `GastosDE` con
  `estado 'PENDIENTE'`, `claveIdempotencia = rec:{id}:{periodo}` (idempotente
  por unique), `periodo` correspondiente, y avanza `proximaGeneracion` según
  frecuencia. Disparo manual por botón (Railway no corre crons del repo).
- Viáticos: concepto `Viáticos` sembrado por tenant al primer uso; `empleadoId`
  opcional en form y columna/filtro en tabla. Semántica Odoo-lite: gasto por
  empleado con la aprobación existente.
- Adjuntos: `CloudinaryAsset` con `ownerType 'gastoDE'`, `slot 'comprobante'`
  (0..N); upload con la infraestructura existente (`uploadToCloudinary`,
  signatures); actions `getAdjuntosGastoAction` / `removeAdjuntoGastoAction`
  (soft delete); UI en `GastoDEForm` y en la tabla (chip adjuntos).
- Gating: `gastos` (clave existente).

## F-5 — NominaConfig + Empleado.userId

> **Ajuste verificado al ejecutar (documentado en PROGRESO.md):** el design
> original decía `jornadaDiariaHoras Float @default(8)`; se cambió a
> `horasMensualesEstandar Int @default(192)` porque la fórmula vigente
> (`calcularMontoHorasExtras`) divide el salario entre las horas del MES
> (192), no entre jornada×días. Con `horasMensualesEstandar=192` la paridad
> sin config es byte-a-byte; con 8 habría cambiado el resultado histórico.

- `NominaConfig`: `tenantId String @id` (1:1, patrón
  `TenantAccountingPolicy`), `tarifaHoraExtra Float @default(1.5)`,
  `horasMensualesEstandar Int @default(192)`, `monedaPago String
  @default("CUP")`, `updatedBy String?`, timestamps.
- `src/lib/payroll-formulas.ts`: `calcularMontoHorasExtras` acepta config
  opcional `{ tarifaHoraExtra, horasMensualesEstandar }` con los defaults
  actuales; `createPagoSalarioAction`, `updatePagoSalarioAction` (recálculo
  al editar horas) y `calculateNominaAction` cargan `NominaConfig` del tenant
  (fallback defaults) — sin config, comportamiento idéntico al actual.
  Config inválida (≤0/NaN) cae a 0 (fail-closed).
- Server actions de config: `getNominaConfigAction` (devuelve config o null +
  defaults) y `upsertNominaConfigAction` (permiso nuevo
  `rrhh.nomina.configurar`, manager, sensitive; fixture de paridad
  actualizado) en `src/features/empleados/actions-nomina-config.ts`.
- `Empleado` gana: `userId String? @unique` (FK User, `onDelete: SetNull` —
  borrar el usuario desvincula, no borra la ficha), `ci String?`,
  `email String?`, `banco String?`.
  `updateEmpleadoAction` valida que el `User` exista (vía
  `tenantMemberships.some({ tenantId })`), y no esté vinculado a otro
  empleado (`EMPLEADO_USER_TOMADO`); `userId: null` desvincula sin validar.
- UI: PENDIENTE EXPLÍCITO (convención Sesión E): campos nuevos en form de
  empleado; card de configuración de nómina en `/busy/empleados/nomina`
  (solo con permiso de nómina). Las actions server están listas y testeadas.
- Gating: `nomina`.

## F-6 — Estado de cuenta imprimible

- `getEstadoDeCuentaClienteAction({ clienteId, desde? })` compone: empresa
  (`MiEmpresa`), cliente, `generadoEn`, resumen (`deudaTotal`, `deudaVencida`,
  `saldoAFavorAnticipos`, `saldoAFavorNotasCredito`, `saldoNeto`),
  cuentas por cobrar enriquecidas (reusa `enriquecerCuentaPorCobrar`),
  anticipos tipo COBRO con `saldoDisponible > 0` y estado != ANULADO, notas de
  crédito (`DevolucionVenta` con saldo a favor), historial de facturas y pagos
  (`ReconciliacionVenta` del cliente). Todo filtrado por tenant; `desde` aplica
  a CxC e historial.
- PDF en cliente: jsPDF + autotable siguiendo `src/lib/export-utils.ts`
  (patrón de facturas-vencidas): encabezado empresa/cliente, tarjetas resumen,
  tabla CxC, tabla anticipos+NC, historial, saldo neto y línea de firma. El
  botón muerto de `analisis-cuenta-cliente/page.tsx` se cablea con el dataset
  del action; test de componente verifica el disparo.
- Los montos viajan calculados desde el server; el PDF solo compone.

## F-7 — Lotes/FEFO

- `Lote`: `tenantId`, `productoId`, `codigo`, `fechaVencimiento DateTime?`,
  `cantidadDisponible Int @default(0)`, `estado String @default("ACTIVO")` ∈
  `ACTIVO|AGOTADO|BLOQUEADO`, `@@unique([tenantId, productoId, codigo])`.
- `Producto.manejaLotes Boolean @default(false)`;
  `CompraDocumentoItem.loteId String?`; `RecepcionItem.loteId String?`;
  `PurchaseAllocation.loteId String?`; `StockMoveLine.loteId String?`.
- Entradas: si el producto `manejaLotes`, recepción/compra directa exige lote
  (`lote: { codigo, fechaVencimiento? }` por ítem) → upsert de `Lote` y
  `cantidadDisponible += cantidad` (unidad stock); sin payload de lote → error
  `LOTE_REQUERIDO`. Producto sin `manejaLotes` ignora el payload (compat).
- Salidas FEFO: en `allocateFifoForVentaItem`, si el producto maneja lotes los
  candidatos se ordenan por `fechaVencimiento ASC NULLS LAST` (dentro del FIFO
  existente); cada allocation y su `StockMoveLine` de salida llevan `loteId`,
  y `Lote.cantidadDisponible -= cantidad`. Anulación de venta restaura
  cantidad por lote junto con el resto de la reversión. Sin lotes, la función
  queda byte-a-byte igual (test de paridad FIFO).
- `getAlertasVencimientoAction`: lotes ACTIVOS con `fechaVencimiento ≤ hoy+30`
  y `cantidadDisponible > 0`, agrupados por producto con días restantes;
  sección/badge en kardex.
- Gating: `lotes-series`.

## F-8 — Ubicaciones nivel 1

- `Ubicacion`: `tenantId`, `almacenId` (FK Restrict), `codigo`, `nombre?`,
  `tipo String` ∈ `ZONA|PASILLO|ESTANTE|CAMARA`, `parentId String?`
  (self-rel, un nivel), `activo Boolean @default(true)`,
  `@@unique([tenantId, almacenId, codigo])`.
- `StockUbicacion.ubicacionId String?` (FK SetNull) = ubicación default del
  producto en ese almacén/PV (opt-in por fila, sin backfill obligatorio);
  `StockMoveLine.ubicacionId String?` para trazabilidad de kardex.
- CRUD `src/features/inventario/actions-ubicaciones.ts` con
  `requireFeature('ubicaciones-avanzadas')`; `registrarRecepcionAction` acepta
  `ubicacionId?` opcional (default: la del `StockUbicacion` del producto si
  existe); `registrarMovimiento` propaga `ubicacionId` opcional;
  `getKardex` filtra por `ubicacionId` cuando viene. UI mínima: gestor en la
  página de almacenes y select en recepción. Sin putaway automático.

## F-9 — Variantes

- `ProductoPlantilla`: `tenantId`, `nombre`, `categoriaId?`, `atributos Json`
  (`[{ nombre, valores: string[] }]`), `precioCostoBase Int`,
  `precioVentaBase Int`, `unidadId?`, `activo Boolean`, timestamps.
- `Producto` gana: `plantillaId String?` (FK SetNull), `sku String?` con
  `@@unique([tenantId, sku])`, `atributosJson Json?`. La plantilla **no es**
  `Producto` (no se vende ni tiene stock): variantes = filas `Producto` con
  `plantillaId` seteado.
- `generarVariantesAction({ plantillaId, combinaciones? })`: producto
  cartesiano de valores; crea un `Producto` por combinación con
  `nombre = "{plantilla} - {attr1} / {attr2}"`, `sku` autogenerado (prefijo
  configurable, retry ante P2002), precios/costo base copiados (editables),
  misma categoría/unidad. Idempotente por `(plantillaId, hash de atributos)`.
- Guardas: `crearVentaAction` rechaza productos `plantillaId != null`? No —
  las variantes SÍ son vendibles (son `Producto`); el bloqueo real es que no
  existe fila vendible de la plantilla. Selectores de venta/POS/compras/
  transferencias siguen listando productos normales (variantes incluidas
  porque son `Producto`); solo se agrega filtro explícito para excluir
  variantes de… nada: nada que excluir. Única regla nueva: el form de producto
  manual rechaza `plantillaId` ajeno al tenant y `deleteProductoPlantillaAction`
  bloquea si tiene variantes vivas.
- UI: `/busy/inventario/variantes` (plantillas + generar + ver variantes) con
  `requireFeature('variantes')`.

## Testing Strategy

- TDD estricto por tarea: test unitario en rojo (prisma mockeado según el
  contrato de aislamiento MM-B — `@/lib/prisma` siempre mockeado), verde con
  la implementación mínima, refactor, commit de fase con tests en verde.
- Corridas con rutas explícitas (`pnpm exec vitest run <rutas>`); cierre de
  sesión con `pnpm run typecheck`, `pnpm run lint` y verificación de 0
  offenders en `test-isolation-contract.test.ts`.
- Tests de paridad explícitos: FIFO sin lotes idéntico al actual; flujo de
  compra/venta sin payload de unidad idéntico al actual.
- UI: tests de componente solo donde hay lógica nueva visible (botón PDF,
  selector de unidad en compra, form de gastos con empleado/adjunto).

## Migration / Deploy

- Solo `schema.prisma` + `prisma generate`; Railway aplica esquema con
  `db-push`. Columnas nuevas nullable o con default aditivo; sin backfill
  obligatorio. Enum `TipoOrigenMovimiento` +`DEVOLUCION_COMPRA` y
  `TipoEventoContable` +`DEVOLUCION_COMPRA`: `ALTER TYPE ADD VALUE`, seguro
  con db-push (mismo criterio que la migración de enum de Sesión E).
- Scripts idempotentes en `prisma/scripts/` solo si aparece un backfill real.

## Open Questions

- Ninguna bloqueante. Pendientes explícitos declarados en tasks: selector de
  unidad en POS (F-1) y aplicación automática de saldo a favor de proveedor a
  compras futuras (F-2, fuera de alcance).
