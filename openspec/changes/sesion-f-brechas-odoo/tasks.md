# Tasks: Sesión F — Brechas grandes vs Odoo

> TDD estricto (`openspec/config.yaml: strict_tdd: true`). Cada tarea:
> **RED** (test unitario que falla, prisma mockeado según contrato MM-B) →
> **GREEN** (implementación mínima) → **refactor** → verificar con rutas
> explícitas (`pnpm exec vitest run <rutas>`). Un commit por fase
> (`F-n:`), revisando `git diff --cached --name-only` antes de cada commit
> (worktree sucio por diseño). Suite completa ~26 min con fallos
> preexistentes: solo rutas explícitas + `typecheck` + `lint` al cierre de
> cada fase.

## 0. Plan (F-0)

- [x] 0.1 `openspec/changes/sesion-f-brechas-odoo/{proposal,design}.md` + 9 specs + tasks
- [x] 0.2 Worktree `TCP-sesion-f-brechas-odoo` + rama `feat/sesion-f-brechas-odoo` desde `main` (b4be12ba)
- [x] 0.3 `pnpm install` en el worktree
- [ ] 0.4 Commit del plan (`F-0: plan SDD Sesión F — brechas grandes vs Odoo`)

## 1. F-1 — UdM con factor (`unidades-conversion`)

- [x] 1.1 [RED] `src/lib/__tests__/inventory-cost-utils-unidad.test.ts`:
  `aUnidadStock` convierte con factor (12×2=24), fail-closed con fracción
  (`UNIDAD_FACTOR_INVALIDO`) y factor ≤ 0; `convertirPrecioAPorUnidadStock`
  divide precio por unidad.
- [x] 1.2 [GREEN] Helpers en `src/lib/inventory-cost-utils.ts` + tipos en
  `src/features/unidades/schemas.ts` (`factorAStock` positivo, `tipoUso` enum).
- [x] 1.3 [RED] Tests de schema/migración aditiva: `Unidad.factorAStock`,
  `Unidad.tipoUso` (schema.prisma + validación Zod).
- [x] 1.4 [GREEN] Schema aditivo; sin backfill (default 1).
- [x] 1.5 [RED] `createCompraDocumentoAction` acepta `items[].unidadId?`:
  convierte cantidad+precio antes de validar LP-0 y persistir; test con caja
  (factor 12) → 24 stock, total recalculado server-side; sin unidad → byte-a-byte
  igual (paridad).
- [x] 1.6 [GREEN] Conversión en `src/features/compras-productos/actions.ts`
  (+ OC en `actions-oc.ts` y recepción).
- [x] 1.7 [RED] `crearVentaAction` con `unidadId` en items: convierte cantidad
  y precio por unidad stock ANTES del resolver de precios (LP-0 intacto);
  paridad sin unidad.
- [x] 1.8 [GREEN] Conversión en `src/features/ventas/services/` (crear venta +
  POS pedido si el flujo lo comparte).
- [ ] 1.9 [PENDIENTE EXPLÍCITO] Producción: el conversor legacy de recetas (símbolos libres masa/volumen, ya en producción) cambia de semántica si se le inyecta el factor de tabla; se difiere para no arriesgar el flujo vivo de producción. El helper acepta `campoCantidad` y es reutilizable cuando se ejecute.
  `Unidad.simbolo` del tenant usa `factorAStock`; sin match → fallback legacy
  (`convertToBase` actual); test de los dos caminos.
- [ ] 1.10 [GREEN] Integración en `src/features/produccion/actions.ts` + routes
  de recetas.
- [x] 1.11 [RED] Gating: sin payload de unidad el flujo no exige feature; con
  unidad distinta → `requireFeature('unidades-conversion')`.
- [x] 1.12 [GREEN] Gating en los 3 puntos de entrada.
- [ ] 1.13 [PENDIENTE EXPLÍCITO] UI: selector de unidad en `compra-producto-form.tsx` y en POS (unidades del
  tenant, muestra factor); POS queda pendiente explícito.
- [x] 1.14 Verificación (134/134 + typecheck 0): `pnpm exec vitest run <rutas nuevas y tocadas>` +
  `pnpm run typecheck` + eslint de archivos tocados → commit `F-1:`.

## 2. F-2 — Devoluciones a proveedor

- [x] 2.1 [RED] Tests de schema: `DevolucionCompra` + items (campos según
  design.md), enum `DEVOLUCION_COMPRA` en `TipoOrigenMovimiento`.
- [x] 2.2 [GREEN] Schema aditivo (nullable/opt-in).
- [x] 2.3 [RED] `crearDevolucionCompraAction`: valida compra origen no
  ANULADA, cantidad ≤ comprada − devuelta − asignada FIFO
  (`STOCK_DEVUELTO_ASIGNADO`), stock suficiente en ubicación
  (`STOCK_INSUFICIENTE`).
- [x] 2.4 [GREEN] Action + validaciones en `src/features/compras-productos/devoluciones.ts`.
- [x] 2.5 [RED] Kardex: descontar stock + `registrarMovimiento` tipo
  `DEVOLUCION_COMPRA` con costo del ítem de compra; idempotente.
- [x] 2.6 [GREEN] Movimiento kardex + enum + `TIPOS_MOVIMIENTO_INVENTARIO`.
- [ ] 2.7-2.8 [PENDIENTE EXPLÍCITO] Asiento formal: la capa
  `contabilidad-formal` (event-builders/plan-default/postEvento) vive solo en
  `feat/contabilidad-capa-formal` sin merge; `DEVOLUCION_COMPRA` se agrega a
  `TipoEventoContable` al integrarse. El estado operativo (CxP
  montoPagado/saldoPendiente, PAGADA a 0) y el saldo a favor quedan
  consistentes desde esta sesión.
- [x] 2.9 [RED] Anulación de devolución: revierte kardex
  (`revertirMovimientosDeOrigen`), restaura CxP/saldo, deja `ANULADA`; bloqueada
  si la imputación ya se pagó después.
- [x] 2.10 [GREEN] `anularDevolucionCompraAction`.
- [x] 2.11 [RED] Anulación de compra ligada a OC: comportamiento lockeado por
  test (no revierte stock — lo movió la recepción) + OC vuelve a
  facturable/facturas ANULADA excluidas de la OC.
- [x] 2.12 [GREEN] Ajuste en `anularCompraProductoAction` + docstring.
- [ ] 2.13 [PENDIENTE EXPLÍCITO] UI mínima: form/lista de devoluciones en compras (server component
  + actions), permiso de compras.
- [x] 2.14 Verificación (81/81 compras + typecheck 0) + commit `F-2:`.

## 3. F-3 — 360 de proveedor + pricelist

- [x] 3.1 [RED] Schema `ProveedorProducto` (único por tenant+vendor+producto,
  esPreferente único por pareja vía validación).
- [x] 3.2 [GREEN] Schema + índices.
- [x] 3.3 [RED] Sync automático al crear `CompraDocumento` (directa y OC
  completada): upsert costo real por ítem + `ultimaCompra`.
- [x] 3.4 [GREEN] Sync en `createCompraProductoAction` + cierre de OC.
- [x] 3.5 [RED] `upsertProveedorProductoAction` + regla de preferente único
  (`PROVEEDOR_PREFERENTE_YA_EXISTE`).
- [x] 3.6 [GREEN] Actions CRUD + validación de unicidad.
- [x] 3.7 [RED] `createOrdenCompraAction` autocompleta precioUnitario desde
  preferente (o más reciente) si el item no trae precio; test del origen.
- [x] 3.8 [GREEN] Autocompletado + `origenPrecio` en respuesta.
- [x] 3.9 [RED] `getProveedor360Action`: perfil, pricelist, últimas 20
  compras, CxP abiertas, anticipos PAGO activos, deudas cash, contratos,
  métricas 12m — todo tenant-scoped.
- [x] 3.10 [GREEN] Action compuesta.
- [ ] 3.11 [PENDIENTE EXPLÍCITO] UI: página `/busy/vendor/[id]/detalle` (server component con tabs)
  + enlace "Ver detalle" en tabla de vendors.
- [x] 3.12 Verificación (106/106 compras+vendors, typecheck 0) + commit `F-3:`.

## 4. F-4 — Gastos recurrentes + adjuntos + viáticos

- [x] 4.1 [RED] Schema `GastoRecurrente` + `GastosDE.gastoRecurrenteId` +
  `claveIdempotencia @unique` + `empleadoId`.
- [x] 4.2 [GREEN] Schema aditivo.
- [x] 4.3 [RED] `generarGastosRecurrentesAction`: idempotente por período
  (`rec:{id}:{periodo}`), avanza `proximaGeneracion` por frecuencia, crea
  GastosDE `PENDIENTE`; re-ejecución crea 0.
- [x] 4.4 [GREEN] Action de generación + cálculo de períodos por frecuencia.
- [x] 4.5 [RED] CRUD plantillas (`withAction` + `requireFeature('gastos')`).
- [x] 4.6 [GREEN] Actions + validación `diaGeneracion` 1-28.
- [x] 4.7 [RED] Adjuntos: `CloudinaryAsset` ownerType `gastoDE` slot
  `comprobante`; actions listar/eliminar (soft-delete); mock de upload.
- [x] 4.8 [GREEN] Actions de adjuntos reutilizando `cloudinary-upload`.
- [x] 4.9 [RED] (concepto sembrado + empleadoId en schema/create/listado) Viáticos: concepto sembrado por tenant
  (`ensureConceptoViaticos` idempotente) + `empleadoId` en schema de gasto +
  filtro por empleado en listado.
- [x] 4.10 [GREEN] (ensureConceptoViaticos + filtro) Semilla + form/filtro.
- [ ] 4.11 [PENDIENTE EXPLÍCITO] UI: sección "Recurrentes" en gastosDE (lista + crear plantilla +
  botón Generar pendientes), upload de comprobante en `GastoDEForm`, selector
  empleado.
- [x] 4.12 Verificación (52/52 gastosDE + typecheck 0) + commit `F-4:`.

## 5. F-5 — NominaConfig + Empleado.userId

> Ejecutado con TDD (RED 13 fallos correctos → GREEN). Ajuste de diseño
> documentado en design.md: `horasMensualesEstandar Int @default(192)` en
> vez de `jornadaDiariaHoras` (la fórmula vigente divide por horas del mes).

- [x] 5.1 [RED] Schema `NominaConfig` (tenantId @id, patrón
  TenantAccountingPolicy) + `Empleado.userId @unique` + `ci/email/banco`.
- [x] 5.2 [GREEN] Schema aditivo (`prisma generate` OK; `Empleado.user`
  `onDelete: SetNull`, inversa `User.empleado`, inversa `Tenant.nominaConfig`).
- [x] 5.3 [RED] `calcularMontoHorasExtras` acepta config opcional
  (`tarifaHoraExtra`, `horasMensualesEstandar`) con defaults actuales; sin
  config → byte-a-byte igual (tests en `payroll-formulas.test.ts`:
  config parcial 2.0 → 800, 200 h → 576, config inválida → 0).
- [x] 5.4 [GREEN] `src/lib/payroll-formulas.ts` + carga de config en
  `createPagoSalarioAction`, `updatePagoSalarioAction` (recálculo al editar
  horas) y `calculateNominaAction` (sin tocar devengado/deducciones).
- [x] 5.5 [RED] Vinculación `Empleado.userId`: User debe existir y ser del
  tenant (`tenantMemberships.some`), no estar vinculado a otro empleado
  (`EMPLEADO_USER_TOMADO`); desvinculación (`userId: null`) permitida;
  re-vincular al mismo empleado es idempotente; ajeno al tenant → `NOT_FOUND`.
- [x] 5.6 [GREEN] Extensión de `updateEmpleadoAction`/schema Zod
  (+ persistencia `ci/email/banco` en create y update). Además:
  `actions-nomina-config.ts` con `getNominaConfigAction`
  (config|null + defaults) y `upsertNominaConfigAction` (permiso nuevo
  `rrhh.nomina.configurar` en registry + fixture de paridad actualizado).
- [x] 5.7 UI: campos CI/email/banco + selector de usuario en el formulario;
  tarjeta de configuración en nómina, visible solo con `rrhh.nomina.configurar`.
  El cálculo de horas extra en edición de nómina usa la configuración del tenant.
- [x] 5.8 Verificación: 70/70 tests focalizados (incluye isolation-contract
  7/7), typecheck, ESLint focalizado y `prisma validate` con URL ficticia; commit
  separado de F-5.

## 6. F-6 — Estado de cuenta imprimible

> Ejecutado con TDD. Nota de entorno: el Popover de Radix en jsdom abre con
> `fireEvent.pointerDown` + `click` (userEvent no dispara su apertura); el
> patrón quedó en el test de la página.

- [x] 6.1 [RED] `getEstadoDeCuentaClienteAction({ clienteId, desde? })`:
  compone empresa, cliente, resumen separado por moneda (deudaTotal, deudaVencida,
  saldoAFavorAnticipos/NotasCredito, saldoAFavor, saldoNeto), CxC
  enriquecidas, anticipos COBRO activos, NC saldo a favor, facturas y pagos —
  todo tenant-scoped (6 tests en
  `src/features/contabilidad/__tests__/estado-cuenta-cliente.test.ts`,
  incluida la verificación del scenario del spec: 1000/300/700).
- [x] 6.2 [GREEN] Action en `src/features/contabilidad/actions-cuentas.ts`
  (reusa `enriquecerCuentaPorCobrar` + `ACTIVE_RECEIVABLE_STATES`; resultado
  serializable con montos ya resueltos server-side; `desde` filtra CxC
  createdAt, facturas fechaEmision y pagos fechaReconciliacion; VALIDATION_ERROR
  en `desde` inválido).
- [x] 6.3 [RED] UI: test de componente del disparo en
  `analisis-cuenta-cliente/page.test.tsx` — selecciona cliente y pulsa
  "Exportar PDF"; verifica llamada al action con clienteId + invocación de
  `exportEstadoDeCuentaPdf` con el dataset, y que con action fallido NO se
  genera el PDF.
- [x] 6.4 [GREEN] Botón cableado en `analisis-cuenta-cliente/page.tsx`
  (fail-closed con toast, estado "Generando...") + generador
  `src/features/contabilidad/utils/estado-cuenta-pdf.ts` (jsPDF+autotable,
  patrón facturas-vencidas: encabezado empresa/cliente, tabla resumen, CxC,
  anticipos+NC, historial facturas, historial pagos, saldo neto y línea de
  firma). Importes del resumen y de cada detalle se muestran con su moneda; no
  se agregan saldos CUP/USD en un total ficticio.
- [x] 6.5 Verificación (10/10 pruebas F-6 focalizadas; typecheck 0; ESLint
  focalizado 0) + commit separado `F-6:`.

## 7. F-7 — Lotes/FEFO (`lotes-series`)

- [ ] 7.1 [RED] Schema `Lote` + `Producto.manejaLotes` + `loteId` nullable en
  CompraDocumentoItem, RecepcionItem, PurchaseAllocation, StockMoveLine.
- [ ] 7.2 [GREEN] Schema aditivo.
- [ ] 7.3 [RED] Entradas con lote: recepción/compra directa de producto con
  `manejaLotes` exige `lote` y crea/actualiza `Lote.cantidadDisponible`;
  producto sin lotes ignora payload (paridad).
- [ ] 7.4 [GREEN] Creación de lote en recepción + compra directa.
- [ ] 7.5 [RED] Paridad FIFO sin lotes: `allocateFifoForVentaItem` byte-a-byte
  igual cuando el producto no maneja lotes (test de paridad explícito).
- [ ] 7.6 [RED] FEFO con lotes: candidatos ordenados por
  `fechaVencimiento ASC NULLS LAST` dentro del FIFO; allocation con `loteId`;
  decremento de `Lote.cantidadDisponible` y AGOTADO a 0; anulación de venta
  restaura.
- [ ] 7.7 [GREEN] FEFO en `src/lib/services/fifo-allocation.ts` + decremento
  en la tx de venta.
- [ ] 7.8 [RED] `getAlertasVencimientoAction`: ≤30 días, saldo > 0,
  `diasRestantes`; gating `lotes-series`.
- [ ] 7.9 [GREEN] Action + sección de alertas en página de inventario.
- [ ] 7.10 Verificación (incluye suites de ventas y compras tocadas) + commit `F-7:`.

## 8. F-8 — Ubicaciones nivel 1 (`ubicaciones-avanzadas`)

- [ ] 8.1 [RED] Schema `Ubicacion` (self-rel 1 nivel) + `StockUbicacion.
  ubicacionId?` + `StockMoveLine.ubicacionId?`.
- [ ] 8.2 [GREEN] Schema aditivo.
- [ ] 8.3 [RED] CRUD ubicaciones: hijo solo un nivel (`UBICACION_NIVEL_
  MAXIMO`), delete bloqueado con hijos o referencias; tenant-scoped.
- [ ] 8.4 [GREEN] `src/features/inventario/actions-ubicaciones.ts` + gating.
- [ ] 8.5 [RED] Recepción con `ubicacionId?` fija default del par
  producto+almacén; sin ubicación usa default existente si hay.
- [ ] 8.6 [GREEN] Integración en `registrarRecepcionAction`.
- [ ] 8.7 [RED] `registrarMovimiento` acepta `ubicacionId?` (fuera de la clave
  idempotente) y `getKardex` filtra por ubicación.
- [ ] 8.8 [GREEN] Movimientos + filtro de kardex + selector en UI de kardex
  (solo con feature).
- [ ] 8.9 Verificación + commit `F-8:`.

## 9. F-9 — Variantes (`variantes`)

- [ ] 9.1 [RED] Schema `ProductoPlantilla` + `Producto.plantillaId/sku/
  atributosJson` (plantilla NO es Producto).
- [ ] 9.2 [GREEN] Schema aditivo + índices.
- [ ] 9.3 [RED] `generarVariantesAction`: cartesiano completo, nombre/sku
  generados, precios base copiados; re-ejecución idempotente (0 nuevas);
  colisión de SKU reintenta y falla cerrada (`SKU_NO_DISPONIBLE`).
- [ ] 9.4 [GREEN] `src/features/productos/actions-variantes.ts` + gating.
- [ ] 9.5 [RED] Guards: `deleteProductoPlantillaAction` bloqueado con
  variantes; `createProductoAction` rechaza `plantillaId` ajeno al tenant;
  selectores de venta/POS/compras NO listan la plantilla (no es Producto) y
  sí las variantes.
- [ ] 9.6 [GREEN] Guards + verificación de selectores.
- [ ] 9.7 [RED] Venta de variante: descuenta SU stock con SU precio (los
  flujos existentes funcionan sin cambio por diseño).
- [ ] 9.8 UI: página `/busy/inventario/variantes` (plantillas + generar +
  listar variantes), enlace en sidebar con `SIDEBAR_FEATURE_MAP`.
- [ ] 9.9 Verificación + commit `F-9:`.

## 10. Cierre (F-10)

- [ ] 10.1 `graphify update .` en el worktree (AST-only).
- [ ] 10.2 Lint global de archivos tocados + `pnpm run typecheck` + correr
  las suites de los módulos tocados en bloque + `test-isolation-contract` (0
  offenders).
- [ ] 10.3 Marcar tasks [x] con evidencia de comandos reales (sin narrar
  estado no verificado).
- [ ] 10.4 Commit `F-10: cierre`.
- [ ] 10.5 Reporte final: resumen por fase, commits, comandos verificados,
  pendientes explícitos (POS unidades, saldo a favor automático) y que la
  rama queda LISTA para merge a `main` — sin mergear (espera aviso).
