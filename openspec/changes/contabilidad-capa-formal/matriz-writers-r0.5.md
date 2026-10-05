# R0.5 — Inventario de posteo y reconciliaciones (25-09-2026)

**Alcance:** inspección estática de `src/` en el worktree actual; no prueba ejecutada ni
certificación global de seguridad. El inventario reproducible vigente detecta **32 callsites
productivos en 19 archivos** (excluidos definición, tests e integración); «16 writers / 18
estimados» de CTA-1 no es un conteo exhaustivo de rutas. Se contrastó además
`reconciliacion{Venta,Servicio,Gasto}.create` en rutas y servicios. No se activó `shadow`,
`enforce` ni replay.

Leyenda: **PASS** = evidencia local explícita para el atributo indicado, NO aprobación
global del writer; **GAP** = falta o contradicción visible; **UNKNOWN** = requiere traza
de todos los adaptadores o test. En las tablas, `tx` = misma `Prisma.$transaction`
para operación y hook (PASS estructural, no prueba de rollback); `F` = gate de licencia
vigente y feature efectiva de `contabilidad-formal` dentro de `postEvento`, condicionado
a modo != off (`src/features/contabilidad-formal/services/posting-engine.ts:341+`);
**F no sustituye permiso del writer, pertenencia de referencias ni aprobación enforce**.
`∅` = fingerprint/tasa no pasados, no evidencia de que la operación sea monomoneda.
Los orígenes vienen de `src/features/contabilidad-formal/lib/event-builders.ts:42-615`:
unicidad de DB `(tenantId, origenTipo, origenId)` en `prisma/schema.prisma` modelo Asiento;
ID generado del registro no equivale a idempotencia del request ante reintento.
`usuario` significa `user.userId` autenticado **si el adaptador lo acredita**; ningún
hook listado constituye por sí solo prueba de permiso. Tests existentes de builders
(`src/features/contabilidad-formal/__tests__/hooks-writers-*.test.ts`) no acreditan
las 31 rutas con permisos, FX y rollback en tres modos.

## Actualización vigente (2026-10-03)

Esta actualización complementa el historial de cortes anteriores conservado más abajo.
La moneda canónica de `Producto.precioCosto` es la moneda funcional indicada en
`TenantAccountingPolicy`; compras convierten costos extranjeros usando la tasa de origen
a CUP y, cuando hace falta, la tasa funcional a CUP vigente a la fecha efectiva. Mermas y
producción escriben importes en esa moneda. Las filas 21, 27 y 29 tienen evidencia focal
actualizada y están cerradas según sus pruebas locales descritas en la tabla.

Las filas 25/26 están cerradas para sus writers y callers documentales (venta, compra y
facturación de ofertas). La ejecución/reversión standalone está desactivada; además, los
`PUT`/`DELETE` legacy, web y móvil ya no pueden cambiar estado/saldo ni eliminar anticipos
fuera del flujo documental. Los `PUT` conservan solo la edición de metadatos no financieros.

Los workflows activos que anulan/eliminan ventas, nóminas, compras a crédito, GastoDE y
compras de servicios ahora crean su asiento inverso atómico con `revertidoPorId`; se
conservan las líneas y la evidencia FX del original. La suite de integración cerró 51/51
archivos y 299/299 tests en la DB desechable local. El alcance auditado y los flujos sin
posteo formal están detallados en `revision-cierre-2026-10-03.md` §3.

**R0.5/R6 global sigue abierto:** cerrar estas filas no certifica los 32 callsites ni sus
adaptadores. Las filas todavía parciales, huérfanas o sin cobertura HTTP permanecen
señaladas en la matriz y en `tasks.md`; no se habilitó el rollout operativo.

## Continuación de auditoría (2026-10-04)

- Filas 6/7 (`reconcileSale` Server Action y POST web): la política funcional ahora se
  consulta dentro de la transacción. El delta de cuenta se resuelve como tender nominal
  si la cuenta coincide con el tender, como importe funcional si coincide con la política,
  y falla cerrado para una tercera moneda. `ReconciliacionVenta` persiste los pares de
  importe/moneda de cuenta destino y origen con CHECK constraints. La migración
  `20261004150000_reconciliacion_venta_moneda_cuenta` añade columnas y los tests HTTP
  comprueban USD 40×25 → CUP 1,000 y rollback contable por fallo del AuditLog.
- Fila 24: `applyPagoGastoWorkflow` obtiene la política del tenant dentro de `tx` en vez de
  asumir CUP. Cada `ReconciliacionGasto` audita con `logStrict` dentro de la transacción;
  falta política o cambio de moneda rechaza, y una cuenta tercera requiere cotización de
  cuenta explícita.
- `createAnticipo`, cambios de período formal y anulación CxC ahora registran auditoría
  estricta junto con la mutación. La suite completa corre 51 archivos/299 tests; integración
  focal de ventas/anticipos: 25/25.
- Guard global de moneda funcional (04-10): `postEvento` valida que `evento.monedaFuncional`
  coincida con `TenantAccountingPolicy.functionalCurrencyCode`; la discrepancia lanza
  `MONEDA_FUNCIONAL_INCONSISTENTE` (falla cerrado en enforce, se registra en shadow).
  Decisión del usuario: sin política o sin moneda funcional configurada también falla
  cerrado — ningún asiento formal se postea sin moneda funcional verificada.
  Units en `posting-engine.test.ts` (53/53: discrepancia, política ausente y moneda vacía).
- **Nota histórica reemplazada el 05-10:** las filas cash deuda/préstamo (web + servicio),
  operaciones de transferencia/ajuste/capital y pagos POS/mixtos ya consultan/pasan política
  funcional explícita. La re-inspección contabiliza 18 callsites fuera de tests del builder en
  10 archivos (17 activos + `reconciliarVentaDirecta` sin caller), ninguno con el sexto argumento
  por defecto; esto acredita propagación de política al helper,
  no aceptación completa de FX por moneda ni rollback (R0.5-ACCEPT/FX-2/FX-3/FX-4).
- R0.5/R6 sigue abierto; no interpretar el smoke de migración limpia local ni estos tests
  focales como certificación por ambiente ni cobertura de los 32 callsites.

## Integración re-ejecutada (2026-10-05)

- Suite completa `pnpm test:integration` en DB desechable local (`tcp_test_local`):
  **51/51 archivos y 299/299 tests**, duración 46.88 s. Guards SQL contables verificados
  presentes (`verify-accounting-sql-guards.mjs`).
- La re-ejecución era necesaria porque el guard fail-closed del 04-10 (política
  funcional obligatoria en `postEvento`) dejó 13 fixtures de integración sin política:
  se restauraron en los 13 archivos (creación de `TenantAccountingPolicy` con
  `functionalCurrencyCode: 'CUP'` en el fixture + borrado antes del tenant).
- `posting-engine.test.ts` 29/29: el escenario FX declara explícitamente
  `monedaFuncional: 'CUP'` (25 USD × 100 → 2,500 CUP) y el caso "sin plan contable"
  crea política CUP para seguir alcanzando `PLAN_NO_INICIALIZADO`.
- Ruido conocido en `stderr` (no falla la suite): `notificarMerma` registra error por
  filtro heredado `User.tenantId` inexistente en el Prisma client; el catch evita
  afectar el commit contable (ver fila 27).

## Continuación de auditoría (2026-10-05) — slice FX-1: política funcional explícita en callsites vivos

Se eliminaron los últimos defaults CUP productivos en `buildPersistedAccountingAmount`
(filas 2, 12, 17–19, 30):

- **Filas 2/30** (`facturacion-workflow.ts`: rama `contra_pago`, porción contado mixta y
  `reconciliarVentaDirecta` por consistencia): `requireMonedaFuncionalVenta(tx, tenantId)`
  dentro de la transacción; la moneda funcional se pasa explícita al builder. Sin
  política → `FX_INSUFICIENTE` antes de crear reconciliación o mover banco.
- **Fila 17** (`createBankTransfer`): la política y la valoración se movieron dentro del
  tx tras el lock; ramas CUP reemplazadas por `monedaFuncional`. USD→USD con funcional
  USD no exige tasa; origen extranjero→destino funcional usa `montoConvertido`;
  origen funcional→destino extranjero usa `montoOrigen / tasaCambio`; dos extranjeras
  sin cotización cruzada fallan cerrado (falta quote cruzada persistida).
- **Filas 18/19** (`createBankAdjustment`, `createCapitalInjection`): abren el tx, toman
  el lock, obtienen `TenantAccountingPolicy` dentro del tx y pasan `monedaFuncional`
  como sexto argumento al builder; fallan cerrado antes de mutar si falta valoración.
- **Fila 12** (`resolveCashDebtCurrencyAmounts`): la excepción CUP hardcodeada se
  generalizó a `monedaObligacion !== monedaFondos && monedaObligacion !== monedaFuncional`.
  **Decisión del usuario 05-10:** mantener el rechazo `FX_INSUFICIENTE` en ese caso, sin
  conversión adicional para liquidar una obligación CUP cuando la funcional es no-CUP.

**Evidencia 05-10:** `pnpm run typecheck` limpio + unit focal 43/43:
`cash-debt-payment-valuation.test.ts` 8/8 (incl. funcional USD: obligación USD pagada
con CUP, cuenta USD → montoObligacion 10 / montoCuenta 10),
`accounting-operations-mutation-service.test.ts` 22/22 (3 transferencia, 2 ajuste,
1 inyección, casos FX_INSUFICIENTE sin mutación), `facturacion-workflow-gate.test.ts`
13/13 (contra_pago y mixta contado USD con funcional USD; sin política rechazo sin
mutación). Los tests de transferencia mockean `findFirst` (el writer lee cuentas con
`findFirst`, no `findUnique`).

**Continuación 05-10 — cobertura MLC parcial de pago web de préstamo:** se agregó USD 10 ×
tasa 2.5, tenant funcional MLC y cuenta MLC al POST `[id]/pagar`; verifica crédito bancario MLC
25, snapshot nativo y el importe 25 entregado al mock de posteo. No verifica moneda funcional
del evento ni posteo real. RED inicial fue una expectativa del
test que asumía Decimal en `saldo.increment`; la implementación pasa el número 25 (no hay fallo
de producto). GREEN: `src/app/api/contabilidad/prestamos-cash/[id]/pagar/__tests__/route.test.ts`
13/13. **Rectificación:** el probe de auditoría captura ese evento con funcional CUP y Number;
la omisión de `monedaFuncionalCodigo` activa el default del builder (hallazgo F1).
La CxC todavía se actualiza nominalmente (`montoPagado`) en este flujo y no se actualiza
`montoPagadoFuncional`; esa persistencia corresponde a FX-3/R0.4 y no queda certificada por el
test de caja.

**GAP confirmado por auditoría 05-10:** FX-2 y FX-4 se reabren por conversión a Number antes
del posteo, productores activos de evidencia v1 y fingerprint incompleto de `crossQuote`.
FX-1 confirma el contrato al invocar el helper, pero los eventos web cash no propagan la
funcional del tenant. FX-3 cerrado 05-10 para snapshots de cuenta nativa; la certificación
integral por caller continúa en el backlog;
esta revisión no certifica su cierre. Ver `auditoria-fx-1-2-4-2026-10-05.md`.

## Continuación de auditoría (2026-10-05) — slice FX-2: Decimal exacto y evidencia v2

`buildPersistedAccountingAmount` reescrito sobre `buildAppliedFxEvidenceExact`:

- Acepta `number | string | Prisma.Decimal`; devuelve `montoConvertido`/`tasaCambio` como
  `Prisma.Decimal | null` y `fxEvidence` v2 con `fxEvidenceJson` canónico + fingerprint SHA-256
  (importe original/funcional, monedas, tasa, fecha efectiva, procedencia, `fxCatalogRateId`,
  versión 2). Sin tasa para moneda extranjera → nulos; el contrato fail-closed se preserva
  (los callers convierten nulos en `FX_INSUFICIENTE` antes de mutar).
- **Operaciones (filas 17–20):** transferencia con división Decimal a 4 decimales y tolerancia
  `0.0001` por `.sub().abs()`; ajuste con `montoAjuste` Decimal; inyección con interés
  redondeado a 2 decimales (`ROUND_HALF_UP`); pago de deuda capital con `.gt()/.gte()`.
  Eventos formales reciben Decimal directo, sin `Number(...)`.
- **Cash (filas 9–12) + 4 rutas web con lógica duplicada (adaptadores vivos):** crear/pagar
  préstamo y crear/pagar deuda; saldos y acumulados con `.add/.sub/.gt/.lte`;
  `calcularMontoTotalACobrar` usado en crear préstamo (servicio y ruta).
  **Parcial:** las cuatro rutas web aún convierten a Number el importe y la tasa persistidos
  antes del evento y omiten `monedaFuncionalCodigo`; el builder vuelve a CUP.
- **Facturación (filas 2, 30):** venta directa, contra_pago y contado mixto con Decimal;
  fail-closed nuevo si la valoración no trae evidencia (antes persistía sin ella en silencio).
- **Restock:** `cantidad × precio` exacto, comparación de monto convertido con `.eq()`,
  débito con Decimal.
- **Bordes no-Decimal:** `CuentaBancaria.saldo` es `Float` y `GastoCompra.total` /
  `CompraProducto.total` son `Int`; crédito y UI también tienen fronteras Number.
  **Rectificación:** Number no está limitado a esos bordes: además de las rutas cash, el
  POST web de reconciliación de ventas convierte la valoración persistida antes del posteo.
  Este último era el callsite omitido del conteo FX-2 (13 + 4 + 1 = 18).
- **Generación nueva de evidencia pendiente:** `pago-gastos-workflow` y valoración extranjera
  de `inventory-cost-valuation` todavía llaman a `buildAppliedFxEvidence`, versión 1.

**Evidencia 05-10:** `pnpm run typecheck` limpio + 50/50 unit focales:
`cash-debt-payment-valuation.test.ts` 8/8, `facturacion-workflow-gate.test.ts` 14/14 (incl.
fail-closed nuevo sin evidencia), `accounting-operations-mutation-service.test.ts` 22/22,
`accounting-reconciliation-service.test.ts` 6/6 (incl. `0.1 × 0.2 = 0.02` exacto y rechazo de
>4 decimales funcionales). El primer typecheck reportó 36 errores (rutas duplicadas,
componentes UI, columnas Float/Int); todos corregidos y re-verificados.

## Continuación de auditoría (2026-10-05) — slice FX-4: cotización cruzada con política explícita

Nuevo `resolveCrossQuote` (`src/features/contabilidad/domain/fx-cross-quote.ts`) que resuelve
A→B desde el catálogo `TasaCambio` en orden determinista: par directo → par inverso (1/tasa
con precisión Decimal completa) → triangulación vía la moneda funcional
(`tasa(A→F)/tasa(B→F)`). La búsqueda es histórica (`fechaVigencia <= fecha operación`,
orden fechaVigencia/createdAt/tasaId DESC); sin cobertura devuelve null para fallar cerrado.

`createBankTransfer` (fila 17) lo usa cuando ambas monedas difieren de la funcional del
tenant:

- La pata funcional (origen→F) valora el asiento vía `buildPersistedAccountingAmount` con
  proveniencia `CATALOG_RATE`, `fxCatalogRateId` de la pata y `rateEffectiveAt` = vigencia
  del catálogo (no la fecha de operación).
- La pata destino se deriva por multiplicación con la tasa cruzada y se redondea a 4
  decimales; `montoDestino` informado por el caller se valida contra la cruzada con
  tolerancia `0.0001` (`VALIDATION_ERROR` si discrepa).
- La cotización cruzada (tasa, par, estrategia, ids de catálogo, vigencia) queda en
  `fxEvidenceJson.crossQuote`. **Parcial:** el SHA-256 solo incluye `rate`/`kind` de ese objeto;
  omite monedas, IDs y fecha por el filtro de `JSON.stringify` (hallazgo F2, cuatro RED).
- Tasa manual **rechazada** para pares cruzados con `FX_INSUFICIENTE` (decisión FX-1: la
  cruzada "requiere una cotización cruzada persistida"); pares F↔X siguen exigiendo tasa
  manual como antes.
- `buildPersistedAccountingAmount` acepta ahora un 7º parámetro opcional
  `{ fxProvenanceKind, crossQuote }`.
- Los callers de `resolveAccountingAccountMovement` (reconcileSale, reconcileService,
  restock) no tienen campo de tasa cuenta y mantienen el rechazo `FX_INSUFICIENTE` antes de
  crear reconciliación, obligación o mover saldo.

**Evidencia 05-10:** `pnpm run typecheck` limpio + 40/40 unit focales:
`fx-cross-quote.test.ts` 8/8 (directo, inverso, triangulación, sin cobertura→null, vigencia
futura ignorada), `accounting-operations-mutation-service.test.ts` 26/26 (triangulación
EUR→GBP 100→88 con funcional USD 110 y evidencia `CATALOG_RATE`; par directo; rechazo sin
quote; rechazo de tasa manual en par cruzado; `montoDestino` inconsistente),
`accounting-reconciliation-service.test.ts` 6/6. El primer typecheck reportó 11 errores
(`CrossQuoteEvidence` sin firma de índice para columnas JSON; `pataFuncional` posiblemente
null); corregidos y re-verificados.

## Continuación de auditoría (2026-10-05) — slice FX-3: snapshots de cuenta nativa

Las tres ramas de facturación que crean `ReconciliacionVenta` ahora persisten
`montoCuenta`/`monedaCuenta` vía `resolveAccountingAccountMovement` (importe del cobro
en la moneda de la cuenta): venta directa, `contra_pago` y porción contado de la venta
mixta (filas 1, 2, 30). `ReconciliacionGasto` ganó las columnas
`montoCuenta Decimal(20,4)?` / `monedaCuenta String?` (migración
`20261005120000_reconciliacion_gasto_moneda_cuenta` con CHECK
`ReconciliacionGasto_accountAmountPair_check` de paridad atómica: ambos null o ambos
presentes con monto > 0 y moneda no vacía) y `applyPagoGastoWorkflow` (fila 24) las
llena por cada distribución bancaria con el débito en moneda de cuenta — valor que ya
se calculaba con `convertMontoToCuentaMoneda` para descontar saldo pero no se persistía.
El resultado del workflow también expone el snapshot. El predicado del CHECK es idéntico
al guard de la DB desechable de integración
(`scripts/ci/prepare-disposable-integration-database.mjs`), que ahora lo incluye.

**Evidencia 05-10:** `pnpm run typecheck` limpio + 48/48 unit focales:
`pago-gastos-workflow.test.ts` 15/15 (3 casos FX-3 nuevos: pago CUP desde cuenta CUP →
snapshot 120 CUP; pago USD desde cuenta USD con funcional CUP → snapshot 100 USD con
`montoConvertido` 2450; pago USD desde cuenta CUP → snapshot 2450 CUP),
`facturacion-workflow-venta-credito.test.ts` 19/19,
`facturacion-workflow-gate.test.ts` 14/14 (aserción de snapshot nativo en `contra_pago`).
Columnas aplicadas a la base de desarrollo `TCPBD` vía `prisma db execute` +
`migrate resolve --applied` + `prisma generate` (el historial `migrate dev` no es viable
en esa base por drift preexistente: ~80 migraciones con checksum modificado tras
aplicarse y esquema fuera de sync con los archivos; tres reparaciones huérfanas
registradas como aplicadas tras verificar su efecto presente). El archivo de migración
queda como fuente de verdad para entornos frescos.
**Alcance verificado:** operaciones de capital no crean `ReconciliacionVenta` (nada que
completar ahí); devolución no crea reconciliaciones directamente. **Pendiente fuera de
este slice:** CxC funcional de préstamos cash (`montoDeudaFuncional`/`montoPagadoFuncional`)
y snapshot equivalente de CxP para deudas cash.

## Rectificación de cierre FX-1/FX-2/FX-4 — auditoría código/documentación 05-10

Prevalece `auditoria-fx-1-2-4-2026-10-05.md` sobre las notas anteriores y los “CERRADO” de
valoración que se pretendan extender a funcional no-CUP o integridad de cotización cruzada:

- FX-1: 18 llamadas fuera de tests en 10 archivos pasan funcional explícita al helper;
  17 activas y una sin caller. Los cuatro POST web cash omiten la funcional en el evento.
- FX-2: parcial. Las rutas web cash y de ventas convierten los valores persistidos a Number;
  gastos e inventario extranjero aún generan evidencia v1. Reabierto en `tasks.md`.
- FX-4: resolución y rechazo sin quote confirmados; fingerprint incompleto. Reabierto.
- FX-3: cerrado 05-10 para snapshots de cuenta nativa (filas 1, 2, 24, 30): typecheck
  limpio + 48/48 unit focales; columnas y CHECK aplicados a `TCPBD` vía `db execute`.
  Pendientes fuera del slice: CxC funcional de préstamos cash y snapshot de CxP para
  deudas cash.
- Evidencia de esta revisión: **8 archivos/86 tests existentes aprobados**, y **6 RED** en
  probe temporal fuera del repositorio. No se ejecutó PostgreSQL ni typecheck completo.
- La evidencia histórica de autorización/CUP/rollback conserva su alcance; no certifica
  eventos MLC en las cuatro rutas web cash ni sensibilidad del hash a los campos anidados.

## Matriz de llamadas (una fila por callsite)

Prefijos de rutas: `V=src/features/ventas/services/`,
`C=src/features/contabilidad/`, `L=src/lib/services/`,
`A=src/app/api/`, `B=src/features/contabilidad-formal/lib/event-builders.ts`.
Todas las filas tienen F y tx a menos que se indique otra cosa. «Permiso» diferencia
feature funcional del permiso explícito `requirePermission`: `—` indica no observado
en el writer, y requiere inspección del adaptador; no se presume autorizado.

| # | Writer:línea → evento; origen tipo/id | Actor, tenant y permiso | FX / moneda / tasa / fingerprint | Estado y acción/test focal |
|---|---|---|---|---|
| 1 | `V/facturacion-workflow.ts:595` (antes `:534`) → VENTA_CONTADO; `reconciliacion_venta/reconciliacion.reconciliacionId` | `params.usuarioId`, `params.tenantId`; no adaptador productivo localizado (reverificado 02-10: `reconciliarVentaDirecta` conserva cero callers productivos en `src/` fuera de su definición) | Cuenta bancaria y conversión local, CUP por defecto. **FX-3 (05-10):** persiste `montoCuenta`/`monedaCuenta` nativos por consistencia, sin caller que lo ejercite | **SIN CALLER DE PRODUCCIÓN (30-09):** code graph + búsqueda del árbol encontraron solo la definición y dos tests; fuera del inventario de writers vivos hasta que exista un caller. No certificar permiso por delegación |
| 2 | `V/facturacion-workflow.ts:692` (antes `:623`) → VENTA_CONTADO; `reconciliacion_venta/reconciliacion.reconciliacionId` | **CERRADO (30-09):** `createVentaAction` exige `ventas.venta.registrar`; tenant/actor llegan desde el usuario de `withAction`; la prueba SQL comprueba `Asiento.createdBy` y tenant | **CERRADO (05-10):** `requireMonedaFuncionalVenta` lee la política dentro del tx (antes CUP por defecto); USD con funcional USD no exige tasa y persiste evidencia funcional; sin política falla cerrado `FX_INSUFICIENTE` antes de crear la reconciliación o mover banco | **CERRADO para contra_pago POS:** 41 unitarios/3 suites caller+builder; integración PostgreSQL `formal-shadow-cash-sale.test.ts` 8/8 (incluye fila 4): asiento enforce cuadrado, USD sin FX rollback completo, shadow con error SQL conserva operación/outbox y error de outbox revierte writer/stock/caja. No incluye la integración auth HTTP del framework Next. **Evidencia 05-10:** unit `facturacion-workflow-gate.test.ts` 14/14 (contra_pago USD con funcional USD; sin política `FX_INSUFICIENTE` sin mutación; **FX-3:** aserción de snapshot `montoCuenta`/`monedaCuenta` nativo persistido); typecheck limpio |
| 3 | `V/facturacion-workflow.ts:872` (antes `:790`, `:384`) → VENTA_CREDITO; `factura/params.facturaId` (`B:99-125`) | **CERRADO (30-09):** actor y tenant vienen del usuario autenticado en POS/lifecycle/ofertas; callers exigen `ventas.venta.registrar`, `ventas.pedido.gestionar` y `ventas.ofertas.gestionar`. Server Action deniega manager sin permiso con `FORBIDDEN` antes de consultar la oferta; el asiento real persiste `createdBy=userId` y tenant del writer | **CERRADO (30-09):** POS sin moneda explícita usa exclusivamente la política funcional tenant; FX extranjera exige moneda original + evidencia v2. Oferta propaga moneda de servicio leída dentro de la transacción; divisas extranjeras/mezcladas sin evidencia fallan cerrado en enforce y shadow conserva caja con causa durable | **CERRADO para esta fila:** RED/GREEN de modos off/shadow/enforce, tesorería, snapshot inmutable, moneda explícita, nominal, autorización y reintento concurrente. 7 suites/70 unitarios + 2 suites/13 PostgreSQL en DB disposable `tcp_test_r61_venta_credito`: asiento CUP/USD cuadrado, FX heredada por líneas, origen único, outbox shadow durable, rollback SQL e aislamiento. Typecheck, ESLint focal, diff-check y graphify pasan. El gate R0.5/R6 global sigue abierto para los otros callsites/writers |
| 4 | `V/venta-mutation-service.ts:480` (antes `:449`) → COSTO_VENTA_DEVENGADO; `venta_costo/venta.ventaId` (`B:132-159`). Callsite gemelo exclusivo en la rama `catch` shadow del mismo origen: **fila 31 (`:498`)** | **CERRADO (01-10):** `createVentaAction` exige feature POS, permiso `ventas.venta.registrar` y deriva tenant/actor del usuario autenticado; el asiento real persiste `createdBy` y tenant | **CERRADO:** nuevo `getCostoFifoVentaValorado` suma asignaciones en moneda funcional explícita. Compras extranjeras exigen snapshot `CompraDocumento` completo (tasa, functionalCurrency, fecha, fingerprint v1 comprobado); suma Decimal exacta, escala ≤4. El evento usa la funcional real, no CUP fijo. FX ausente enforce fail-closed; shadow conserva venta con outbox no valorizado; off no consulta | **CERRADO:** RED PostgreSQL reprodujo COGS USD 300 contabilizado como CUP 300 en vez de 7,200. GREEN: COGS USD 300×24→CUP 7,200, snapshots múltiples/tasas por asignación, FX alterada/ausente y precisión >4 rechazada. Unit focal 8 suites/94 tests + `formal-shadow-cash-sale.test.ts` 8/8 PostgreSQL: COGS enforce cuadrado, shadow durable sin FX, rollback venta/stock/FIFO por falta FX y SQL fail. Typecheck, ESLint focal, diff-check y graphify pasan |
| 5 | `V/devolucion-venta-service.ts:548` → DEVOLUCION_VENTA; `devolucion_venta/devolucion.devolucionId` (`B:625-660`) | **CERRADO (01-10):** servicio aplica feature `ventas-pos`, permiso `ventas.devolucion.registrar`, `requireTenant`; valida la venta tenant-scoped, bloquea cliente/sale y usa `idempotencyKey`; actor real se conserva en devolución, NC, kardex y asiento | **CERRADO en fuente soportada:** si hay CxC, resuelve desde snapshot FX v2, valida fingerprint/importe/moneda y hereda tasa; venta funcional sin CxC usa política tenant; source de reconciliación extranjera sin CxC fail-closed (no inferir desde `Factura.tasaCambio`). COGS parcial se reconvierte desde lotes FIFO y `CompraDocumento` snapshot exacto; actualiza `montoPagadoFuncional` al reducir CxC con snapshot válido | **CERRADO:** RED builder mostró CUP forzado al devolver USD; unit valoración/CxC/FX, coste FIFO parcial, snapshot alterado/incompleto y modos. 6 suites/58 unitarios + `devolucion-fifo.test.ts` 5/5 PostgreSQL: devolución USD 1,000→CUP 24,000, COGS funcional CUP 4,800, asiento cuadrado, CxC pagada nominal/funcional y trigger SQL demuestra rollback de devolución/item/kardex/CxC si falla el posteo. Enforce histórica sin FX falla antes de escribir; shadow registra outbox durable sin asiento. Typecheck, ESLint focal, diff-check y graphify pasan |
| 6 | `C/actions-reconciliacion.ts:307` → COBRO_CXC o VENTA_CONTADO; `reconciliacion_venta/reconciliacion.reconciliacionId` | **CERRADO (01-10):** `reconciliarVentaAction` exige `requireFeature('contabilidad')`, tenant y `requirePermission('financiero.contabilidad.acceder')`, luego delega a `AccountingReconciliationService.reconcileSale`; el servicio revalida gates, referencias tenant, cuenta/tipo de pago y FX | **CERRADO:** para CxC, cobros homogéneos con snapshot actualizan principal y saldo funcional; la diferencia FX usa Decimal desde valoración persistida; moneda sin evidencia → `FX_INSUFICIENTE` | **CERRADO:** RED action sin permiso devolvía NOT_FOUND/entraba al writer; GREEN deniega antes de abrir tx y elimina la lógica nominal duplicada. 5 suites/40 unitarios + `reconciliar-servicio-real.test.ts` 18/18 PostgreSQL (service/mobile, action y legacy web incluidos): CxC USD nominal/funcional, actor, FX, rollback SQL, permisos, serialización/tenant. Typecheck, ESLint focal, diff-check y Graphify pasan |
| 7 | `A/contabilidad/reconciliacion/ventas/route.ts:856` → COBRO_CXC o VENTA_CONTADO; `reconciliacion_venta/reconciliacion.reconciliacionId` | **CERRADO (01-10):** POST autentica, requiere tenant, feature `contabilidad`, permiso `financiero.contabilidad.acceder`, valida período y referencias tenant-scoped. Sesión HTTP real certificada: JWT firmado con el secreto de la app, `UserSession` activa, membresía manager y licencia con plan reales resuelven contexto y permisos sin sustituir `authenticateUser`; 401 sin token (`http-real-idempotencia.test.ts`) | **CERRADO:** convierte una vez y persiste evidencia FX; para CxC con snapshot v2 valida fingerprint/moneda, acumula pagos nominales y funcionales, actualiza `montoPagadoFuncional` y transmite la diferencia FX al asiento. Rechaza snapshot FX ausente/inconsistente en `shadow`/`enforce` | **CERRADO (01-10):** integración `reconciliar-servicio-real.test.ts` 18/18 (POST legacy con FX, asiento heredado, rollback SQL 22012) + `http-real-idempotencia.test.ts` 3/3 (sesión HTTP real 201/401; reintento con `Idempotency-Key` devuelve 200 con el mismo `reconciliacionId`, un único asiento y CxC sin doble cobro; misma clave con payload distinto → 409 `IDEMPOTENCY_CONFLICT`; carrera P2002 protegida por unique `(tenantId, idempotencyKey)` con migración `20261001090000_reconciliacion_venta_idempotencia`). Typecheck, ESLint focal y diff-check pasan |
| 8 | **RETIRADO (03-10):** `handlers-reconciliacion-servicios.ts` y sus tres handlers no tenían callers en `src`; se eliminó el archivo tras confirmar `trace_path` sin callers y rutas activas para GET, historial y POST | No es writer vigente | — | Entrada histórica retirada; el canal vivo permanece en la fila 116 |
| 9 | `C/services/accounting-cash-operations-mutation-service.ts:199` → PRESTAMO_OTORGADO; `prestamo_cash/prestamoCreado.id` | **CERRADO (02-10):** cliente/cuenta activa tenant-scoped; `requireTenant` + `requireFeature('prestamos-cash')` + `requirePermission('financiero.contabilidad.acceder')` en servicio común. Sesión HTTP Bearer real certificada end-to-end: JWT con secreto de la app, UserSession activa, membresía manager y licencia/plan reales; 401 sin token (`cash-loans-http-real.test.ts`) | **CERRADO (26-09):** FX validada antes de tx, persistida en reconciliación y pasada al evento desde fila; fecha/tipoCuenta heredados | Unit 4/4 + gate 5/5; integración `cash-loans-http-real.test.ts` 3/3 (create Bearer 200, pago Bearer con asiento/CxC, carrera multi-conexión: pagos concurrentes 600+600 sobre deuda 1000 → uno gana, otro `CREDITO_CONFLICTO`, CxC 600 y tesorería exacta) + `prestamos-cash-pagar-real.test.ts` 11/11 (rollback físico crear/pagar). Fixture legacy actualizada al mes corriente (el período hardcodeado septiembre ya no cubría hoy); aserción de identidad ahora usa `DATABASE_URL` |
| 10 | mismo `:361` → COBRO_PRESTAMO; `reconciliacion_venta/reconciliacion.reconciliacionId` | **CERRADO (02-10):** préstamo buscado `(id,tenantId,deletedAt)` tras lock dentro tx; cuenta/tipoPago activos tenant-scoped; feature y permiso común. Sesión HTTP Bearer real del pago móvil certificada (`cash-loans-http-real.test.ts`) | **CERRADO (26-09):** conversión y evidencia persistidas y heredadas; FX insuficiente falla; sin split de intereses (v1) | **CERRADO (02-10):** carrera multi-conexión probada: dos pagos concurrentes de 600 sobre deuda 1000 se serializan por el lock del tenant; el perdedor recibe `CREDITO_CONFLICTO` y ni CxC ni tesorería duplican. Pago Bearer end-to-end acredita cuenta, CxC PARCIAL y un asiento con fingerprint heredado |
| 11 | mismo `:428` → DEUDA_RECIBIDA; `deuda_cash/deudaCreada.id` | **CERRADO (02-10):** proveedor y cuenta activa tenant-scoped; saldo acreditado con `updateMany` tenant-scoped dentro tx; actor `user.userId`. Nuevo gate `requireDeudaMutationAccess`: `requireFeature('deudas-cash')` + `requirePermission('financiero.contabilidad.acceder')` (RED: sin permiso entraba al writer). Sesión HTTP Bearer real certificada en el canal móvil (`cash-debts-http-real.test.ts`: 401 sin token, 200 con token) | **CERRADO (26-09):** monto/tasa/fingerprint se persisten en reconciliación y se heredan desde la fila persistida; moneda extranjera sin tasa válida rechazada antes de tx; tasa no se recalcula | Unit 7/7 (4 previos + 3 nuevos: FORBIDDEN dependiente, plan sin feature, pago sin permiso) + integración `cash-debts-http-real.test.ts` 3/3 (create Bearer, pago Bearer con CxP/asiento, carrera DC-N) + `deudas-cash-real.test.ts` 8/8. Numeración concurrente probada: dos creaciones simultáneas se serializan por el lock del tenant y asignan `DC-N` distinta sin duplicar `numeroFactura` (unique `(tenantId, numeroFactura)`) |
| 12 | mismo `:590` → PAGO_DEUDA; `reconciliacion_venta/reconciliacion.reconciliacionId` | **CERRADO (02-10):** deuda consultada por `(id,tenantId,deletedAt)`, cuenta y tipo de pago activos tenant-scoped, débito condicional tenant-scoped; actor `user.userId`. Nuevo gate `requireDeudaMutationAccess` (RED: pago sin permiso fallaba con `FX_INSUFICIENTE` antes de denegar). Sesión HTTP Bearer real del pago móvil certificada | **CERRADO (26-09):** conversión persistida en reconciliación y evento heredado de esos valores; moneda extranjera sin tasa rechazada antes de tx; sin split interés (decisión v1). **Cambio 05-10:** la excepción CUP hardcodeada en `resolveCashDebtCurrencyAmounts` se generalizó — falla cerrado cuando obligación≠fondos y obligación≠funcional (antes solo se exceptuaba funcional CUP); `reconciliarVentaDirecta` (fila 1, sin caller) también usa política explícita por consistencia | **CERRADO (02-10):** unit 7/7 + integración: pago Bearer end-to-end debita cuenta (5,000→4,960), CxP PARCIAL y un asiento con fingerprint/tasa heredados; rollback SQL 22012 ya probado en `deudas-cash-real.test.ts`. Sin split interés queda como decisión v1. **Evidencia 05-10:** unit `cash-debt-payment-valuation.test.ts` 8/8 (incl. caso nuevo funcional USD: obligación USD pagada con CUP y cuenta USD resuelve montoObligacion 10 / montoCuenta 10); typecheck limpio |
| 13 | **RETIRADO (03-10):** `handlePostPrestamosCash` no tenía callers productivos; se eliminó `handlers-prestamos-cash.ts` junto con su prueba exclusiva. El canal vivo es `A/contabilidad/prestamos-cash/route.ts` (fila 118; feature/permiso y Bearer real cubiertos) | **No es writer vigente** | — | Tombstone de inventario: retirado para evitar una segunda implementación sin ruta consumidora |
| 14 | **RETIRADO (03-10):** `handlePostPrestamoCashPago` no tenía callers productivos; se eliminó junto con el handler legacy. El canal vivo es `A/contabilidad/prestamos-cash/[id]/pagar/route.ts` | **CERRADO (03-10) en canal vivo:** `requireTenant`, feature `prestamos-cash`, permiso `financiero.contabilidad.acceder` antes de consultar referencias; préstamo/cuenta tenant-scoped | **CERRADO:** FX persiste en reconciliación y se hereda al evento; sin split interés (decisión v1) | Route unit 12/12; integración de writer 11/11 y HTTP real 1/1 (401 anónimo, manager Bearer 201, dependiente 403 sin mutación). Handler duplicado retirado |
| 15 | **RETIRADO (03-10):** `handlePostDeudasCash` no tenía callers productivos; se eliminó `handlers-deudas-cash.ts` junto con su prueba exclusiva. El canal vivo es `A/contabilidad/deudas-cash/route.ts` (fila 117) | **No es writer vigente** | — | Tombstone de inventario; gate feature/permiso de la ruta viva cubierto unitariamente |
| 16 | **RETIRADO (03-10):** `handlePostDeudaCashPago` no tenía callers productivos; se eliminó junto con el handler legacy. El canal vivo es `A/contabilidad/deudas-cash/[id]/pagar/route.ts` (fila 117) | **No es writer vigente** | — | Tombstone de inventario; gate feature/permiso de la ruta viva cubierto unitariamente |
| 17 | `C/services/accounting-operations-mutation-service.ts:313` → TRANSFERENCIA_BANCARIA; `transferencia_bancaria/creada.transferenciaId` | **CERRADO (03-10):** feature `transferencias-bancarias` + permiso contable; ambas cuentas y updates scoped tenant/activa; débito condicional y numeración tenant. **Canal HTTP real certificado:** sesión Bearer (JWT firma real + UserSession + membresía manager + licencia). El POST web `/api/contabilidad/transferencias` delega al mismo writer canónico; el GET web ahora filtra por tenant. | **CERRADO (05-10):** la política funcional se consulta dentro del tx tras el lock (antes ramas CUP hardcodeadas); USD→USD con política USD no exige tasa y persiste evidencia funcional; funcional→extranjera convierte con la tasa de la pata extranjera (110 USD→100 EUR con tasa 1.1); **FX-4:** dos extranjeras resuelven cotización cruzada del catálogo `TasaCambio` (directo → inverso → triangulación vía funcional, histórico por `fechaVigencia`) con evidencia `CATALOG_RATE` y `crossQuote` en el fingerprint; sin cobertura o con tasa manual fallan cerrado `FX_INSUFICIENTE` | **CERRADO (04-10):** unit 4/4; `accounting-bank-transfers-real.test.ts` 9/9 cubre saldo/asiento y rollback por error SQL de auditoría; `operations-channels-http-real.test.ts` 4/4 cubre Bearer web/móvil y asiento único. Auditoría strict dentro del tx. **Evidencia 05-10:** 3 casos nuevos en `accounting-operations-mutation-service.test.ts` (USD→USD sin tasa; USD→EUR 110→100; EUR→GBP rechazo sin mutación); typecheck limpio |
| 18 | mismo `:384` → AJUSTE_BANCARIO_CARGO/ABONO; `ajuste_bancario/ajuste.ajusteId` | **CERRADO (03-10):** idéntico gate + sesión HTTP real en canal móvil `/bank-adjustments` | **CERRADO (05-10):** abre el tx y toma el lock antes de mutar; obtiene `TenantAccountingPolicy` dentro del tx y pasa `monedaFuncional` como sexto argumento a `buildPersistedAccountingAmount` (antes CUP por defecto); ajuste USD con funcional USD usa tasa 1 y evidencia USD; extranjera sin tasa falla cerrado `FX_INSUFICIENTE` sin mutar | **CERRADO (03-10):** unit 3 casos + integración 8/8 + canal HTTP real con ajuste `ingreso` posteando asiento único. **Evidencia 05-10:** 2 casos nuevos en `accounting-operations-mutation-service.test.ts` (USD funcional tasa 1 y evidencia USD; extranjera sin tasa sin mutación); typecheck limpio |
| 19 | mismo `:483` → DEUDA_RECIBIDA (`DEUDA_EXTERNA`) o INYECCION_CAPITAL; `deuda_cash/created.id` o `inyeccion_capital/created.id` | **CERRADO (03-10):** `requireTenant`, feature `inyeccion-capital`, permiso; canal HTTP real `/capital-injections` (401 sin sesión, 200 Bearer con asiento `inyeccion_capital`) | **CERRADO (05-10):** mismo patrón que fila 18: política funcional dentro del tx tras el lock, `monedaFuncional` explícita a `buildPersistedAccountingAmount` (antes CUP por defecto); inyección USD con funcional USD usa tasa 1 y evidencia USD; extranjera sin evidencia falla cerrado antes de mutar | **CERRADO (03-10):** unit + integración 8/8 previas + HTTP real 2/2 (misma suite compartida con filas 17/18). **Evidencia 05-10:** caso nuevo USD funcional (tasa 1, evidencia USD); typecheck limpio |
| 20 | mismo `:598` → PAGO_DEUDA_CAPITAL; `pago_deuda_capital/created.id` | **CERRADO (03-10):** canal móvil `/capital-injections/[id]/payments` autentica sesión Bearer real y delega gates de feature/permiso al servicio compartido | **CERRADO (26-09):** snapshot FX aditivo | **CERRADO (03-10)** en comportamiento previo (`operations-channels-http-real.test.ts` 3/3: pago HTTP con asiento `createdBy` real; carrera 350+350 contra saldo 500). **Cambio 04-10:** política funcional tenant-scoped en el tx, `InyeccionCapital` persiste `moneda`, y el pago falla cerrado si su moneda difiere de la cuenta o de la deuda. **Evidencia 04-10:** unit `accounting-operations-mutation-service.test.ts` 17/17 + typecheck limpio. **Evidencia 05-10:** re-ejecución del HTTP real `operations-channels-http-real.test.ts` 4/4 (filas 17–20, Bearer real, pago deuda capital con política funcional CUP obligatoria creada en el fixture); suite completa de integración 51/51 archivos y 299/299 tests en DB desechable local el 2026-10-05 |
| 21 | `src/features/compras-productos/actions.ts` → COMPRA_CREDITO (`compra_documento`) y PAGO_COMPLETO → COMPRA_CONTADO (`reconciliacion_gasto`); `compra_documento/compra.compraDocumentoId` + `reconciliacion_gasto/reconciliacion.reconciliacionId` | **CERRADO (03-10):** `requireTenant`, feature `compras`, permiso `compras.compras.gestionar`; actor real, proveedor/producto tenant-scoped. PAGO_COMPLETO exige cuenta y tipo de pago explícitos; workflow valida tenant/activo. Cambios posteriores de forma/estado bloqueados si implican pago o reverso sin workflow | **CERRADO (03-10):** moneda funcional leída de `TenantAccountingPolicy`; FX de compra resuelto a la fecha efectiva y guardado en el documento; costo unitario y promedio de inventario se guardan en moneda funcional. PAGO_COMPLETO crea reconciliación y postea `COMPRA_CONTADO` en la misma tx; tasa de valoración funcional separada de la tasa usada para debitar una cuenta en otra moneda | **CERRADO (03-10):** `purchase-credit-fx-real.test.ts` 6/6: USD 100×24→CUP 2,400, debita una vez/idempotencia, trigger SQL 22012 revierte compra+reconciliación+saldo, y tenant funcional USD conserva costo/asiento USD 100 aunque debite CUP 2,400. Unit compras-productos 32/32 + formulario 2/2; workflow de pago 9/9; ofertas 13/13; typecheck/ESLint focal pasan. Integración con actor manager sintético; no valida sesión HTTP |
| 22 | `src/features/compras-servicios/actions.ts:210` → GASTO_CON_ANTICIPO_PROVEEDOR; `reconciliacion_gasto/recAnticipo.reconciliacionId` | **CERRADO (03-10):** feature `servicios`, permiso `compras.servicios.crear`, tenant y cuenta origen verificadas; actor autenticado | **CERRADO (26-09):** evidencia FX persistida y heredada desde la fila | **CERRADO (03-10):** re-verificado hoy en DB aislada: `anticipos-devengo-bruto-real.test.ts` 7/7 incluyen compra-servicios (GASTO_CREDITO con CxP, liquidación anticipo proveedor con diferencia FX, rollback SQL de documento+obligación+aplicación); cross-tenant cubierto por unit `compras-servicios/actions.test.ts` 17/17 |
| 23 | `src/features/venta-servicios/actions.ts:413` → COBRO_SERVICIO; `reconciliacion_servicio/recServicio.reconciliacionId` | **CERRADO (02-10):** `user.userId`, permiso de registro validado por el action; cuenta/tipoPago tenant-scoped. Sesión HTTP real certificada end-to-end en el canal `/api/contabilidad/reconciliacion/servicios` (`service-cxc-pago-fx-real.test.ts`: 401 sin token, 201 con Bearer y contexto resuelto real) | **CERRADO (04-10):** `reconcileService` usa la política funcional tenant-scoped, convierte con evidencia exacta y actualiza origen/destino en moneda nativa; persiste ambos deltas. CxC liquida en moneda original y hereda snapshot FX; una tercera moneda bancaria sin cotización cruzada falla cerrado | Unit `accounting-reconciliation-service.test.ts` 25/25 + helper 4/4; `reconciliar-servicio-real.test.ts` 23/23 (USD 10 debitados/CUP 240 acreditados, replay concurrente, rollback CxC y auditoría transaccional); `service-cxc-pago-fx-real.test.ts` 4/4 (snapshot v2, cobros parciales/finales, diferencia FX y HTTP real). Otros writers de moneda nativa siguen abiertos en R0.5 §2 |
| 24 | `L/pago-gastos-workflow.ts:623` → PAGO_CXP / PAGO_NOMINA / COMPRA_CONTADO / GASTO_CONTADO; `reconciliacion_gasto/reconciliacion.reconciliacionId` | **CERRADO (02-10):** `params.reconciliadoPor`, tenant delegado. **Permiso certificada en ambos invocadores:** `reconciliarGastoAction` y `reconciliarGastoAdapter` exigen `requireFeature('contabilidad')` + `requirePermission('financiero.contabilidad.acceder')` (RED: dependiente sin permiso ejecutaba el workflow; el adapter llegaba a validaciones internas sin denegar) | **CERRADO (03-10):** moneda funcional explícita opcional (default CUP para callers existentes) y tasa de débito a cuenta separada de la valoración funcional | **CERRADO (03-10):** workflow 9/9 + `reconciliar-gasto-cxp.test.ts` 7/7. Writer `PAGO_COMPLETO` valida tasa/importe funcional y débito bancario en moneda distinta mediante tasas separadas; typecheck/ESLint focal pasan. **Evidencia FX-3 05-10:** `ReconciliacionGasto` persiste `montoCuenta`/`monedaCuenta` por distribución (migración `20261005120000` + CHECK `ReconciliacionGasto_accountAmountPair_check`); `pago-gastos-workflow.test.ts` 15/15 con 3 casos FX-3 nuevos (CUP→CUP, USD→USD con funcional CUP, USD→CUP); el resultado del workflow expone el snapshot; typecheck limpio |
| 25 | `L/anticipos-workflow.ts:248` → ANTICIPO_CLIENTE_RECIBIDO / ANTICIPO_PROVEEDOR_ENTREGADO; `anticipo/anticipo.anticipoId` | **CERRADO (02-10):** tenant/actor delegados; gates en los canales vivos: POST web `/api/contabilidad/anticipos`, legacy `/api/anticipos`, móvil `/api/mobile/v1/accounting/advances` y Server Action `createAnticipoAction` exigen feature `anticipos` + `financiero.contabilidad.acceder`; legacy GET tenant-scoped. Cuentas y tipo de pago obligatorios/tenant-scoped | **CERRADO (02-10):** `valueAnticipo` resuelve moneda funcional de `TenantAccountingPolicy`, tasa exacta y fingerprint v2; snapshot se persiste en Anticipo y movimiento inicial. Por decisión del usuario, crear representa dinero ya recibido/entregado: COBRO acredita, PAGO debita saldo condicional, y el evento formal se postea en la misma transacción. `Idempotency-Key` durable tenant-scoped (hash + advisory lock) evita doble movimiento; payload distinto → 409. DNC persiste snapshot sin movimiento bancario (crédito de nota, no ingreso de dinero) | **CERRADO (02-10):** `anticipos-fx-real.test.ts` 10/10: USD/CUP snapshot, web/móvil/legacy Bearer real, denegación dependiente, reintento concurrente, conflicto de payload, snapshot alterado, rollback SQL de creación y fondos. Unit workflow 7/7 + Server Action 2/2. Migraciones `20261002090000_anticipo_fx_snapshot` y `20261002110000_anticipo_creation_idempotency` |
| 26 | `L/anticipos-workflow.ts:683` → ANTICIPO_CLIENTE_APLICADO / ANTICIPO_PROVEEDOR_APLICADO; `anticipo_movimiento/movimiento.movimientoId` | **CERRADO para flujos documentales:** callers venta-servicios, compras-servicios, compras-productos y ofertas aplican dentro de la tx que crea/devenga el documento; el caller resuelve el documento, valida cliente/proveedor y actualiza obligación; `applyAnticipoAllocations` valida snapshot, bloquea el anticipo y decrementa saldo con CAS | **CERRADO para esos flujos:** `valueAnticipoApplication` conserva evidencia de reconocimiento y diferencia FX; devengo bruto previo mantiene CxC/CxP por el total y evita asientos duplicados de resultados | **Standalone manual desactivado (03-10):** Server Actions y POST web/móvil de ejecutar/revertir responden `DOCUMENT_WORKFLOW_REQUIRED`; también se bloquean cambios de estado/saldo y DELETE directo en rutas legacy/web/móvil (unit focal 5/5), mientras PUT permite solo metadatos no financieros. **Reversión formal cerrada para GastoDE/compra-servicio:** `reverseExpenseEffects` usa `reverseFormalEntries` para asientos de devengo, pagos y aplicaciones de anticipo; conserva líneas/evidencia FX, crea asiento inverso en período abierto y enlaza original como `ANULADO`. `anticipos-devengo-bruto-real.test.ts` 10/10 cubre rollback por período cerrado, reversión de gasto/servicio, integridad hash e idempotencia; unitarios de reversión 10/10. Bearer real previo certifica 409 manager/403 dependiente para ejecutar/revertir (`anticipos-fx-real.test.ts` 11/11). Otros workflows de reversión siguen fuera de este alcance; ver `revision-cierre-2026-10-03.md` §3. |
| 27 | `src/features/mermas/actions.ts` → MERMA_INVENTARIO; `merma/merma.mermaId` | **CERRADO (03-10):** tenant + feature `mermas` + permisos registrar/editar/eliminar. Una merma con asiento/outbox formal no puede editarse ni borrarse sin reverso contable | **CERRADO (03-10):** decisión del usuario: `Producto.precioCosto` se almacena en moneda funcional del tenant; costo de merma = costo vigente funcional × cantidad. Compras extranjeras convierten el costo al valor funcional con evidencia a fecha efectiva. Builder recibe explícitamente la moneda funcional | **CERRADO (03-10):** `merma-formal-real.test.ts` 3/3 en DB desechable: policy USD produce asiento MERMA_INVENTARIO cuadrado 50 USD; trigger SQL revierte merma+stock+ajuste+asiento; edición/eliminación posteriores denegadas. Unit mermas 20/20. `notificarMerma` aún registra error de notificación por filtro heredado `User.tenantId` inexistente; el catch evita afectar el commit contable |
| 28 | `src/features/productos/actions-restock.ts:575` → egreso COMPRA_CONTADO; `reconciliacion_gasto/restockRec.reconciliacionId` | **CERRADO (03-10):** permiso `inventario.productos.restock`; producto/cuenta tenant-scoped | **CERRADO (03-10):** FX snapshot persistido en ReconciliacionGasto; postEvento hereda fila | **CERRADO (03-10)** en comportamiento previo (`restock-formal-real.test.ts` 2/2: enforce postea egreso 120/120 en mismo tx; trigger SQL revierte stock+gasto+reconciliación). **Cambio 04-10:** política funcional tenant-scoped en el tx; débito bancario vía `resolveAccountingAccountMovement` (tender nominal si la cuenta coincide con el tender, funcional si coincide con la política; tercera moneda falla cerrado). **Evidencia 04-10:** unit `productos/__tests__/actions.test.ts` 27/27 + typecheck limpio. **Evidencia 05-10:** re-ejecución del real `restock-formal-real.test.ts` 2/2 (política funcional CUP obligatoria creada en el fixture; guard de saldo `gte`); suite completa de integración 51/51 archivos y 299/299 tests en DB desechable local el 2026-10-05 |
| 29 | `A/produccion/ordenes/[id]/completar/route.ts` → PRODUCCION_SALIDA; `orden_produccion/ordenId` | **CERRADO (03-10):** `withAuthPost`, requireTenant, feature/permisos; cuenta y tipo de pago se validan tenant-scoped y la cuenta debe usar moneda funcional | **CERRADO (03-10):** decisión del usuario: ingredientes se valorizan desde `Producto.precioCosto` en moneda funcional del tenant; reconciliación y builder reciben moneda/importe funcionales explícitos. El costo sigue siendo suma de costo unitario funcional × cantidad base × desperdicio × cantidad producida | **CERRADO (03-10):** `rollback-real.test.ts` 3/3 en DB desechable: USD funcional calcula/postea costo USD 10 cuadrado, rollback SQL revierte stock/orden/historial/reconciliación/asiento, dependiente denegado sin mutaciones. `withAuthPost` se inyecta en test; sesión HTTP real no cubierta |
| 30 | `V/facturacion-workflow.ts:761` → VENTA_CONTADO (porción cobrada hoy de una venta mixta con vencimiento); `reconciliacion_venta/reconciliacionContado.reconciliacionId` | **CERTIFICADO ESTRUCTURAL (02-10):** mismo `tx: Prisma.TransactionClient` recibido por `applyFacturacionCobroWorkflow`; actor `params.usuarioId` y `params.tenantId` propagados desde la acción autenticada (callers y gates: fila 3); la `ReconciliacionVenta` contado se crea dentro del mismo tx inmediatamente antes del hook; rama exclusiva: `contra_pago`/cobro total retorna en fila 2, aquí solo corre si `0 < cobradoHoy < montoTotal`; coexiste con VENTA_CREDITO (fila 3) por origen distinto; unicidad DB `(tenantId, origenTipo, origenId)` | **CERRADO (05-10), mismo patrón de fila 2:** `requireMonedaFuncionalVenta` dentro del tx (antes CUP por defecto); porción contado USD con funcional USD usa tasa 1 y evidencia USD; sin política falla cerrado `FX_INSUFICIENTE` antes de crear la reconciliación o mover banco | **Drift del conteo detectado y certificado 02-10 (37→39):** callsite nuevo del flujo MIXTO con vencimiento. Cobertura propia existente: unitario `src/features/ventas/__tests__/venta-mixto-vencimiento.test.ts` (3) e integración PostgreSQL `src/features/ventas/__integration__/facturacion-workflow-cxc-real.test.ts` (8); suites caller+builder de filas 2/3. **Evidencia 05-10:** 2 casos nuevos en `facturacion-workflow-gate.test.ts` (mixta contado USD con funcional USD; sin política `FX_INSUFICIENTE` sin mutación); **FX-3:** la rama persiste `montoCuenta`/`monedaCuenta` nativos vía `resolveAccountingAccountMovement` (mismo patrón que fila 2); typecheck limpio |
| 31 | `V/venta-mutation-service.ts:498` → COSTO_VENTA_DEVENGADO **sin valoración** (`costoFifo: null, monedaFuncional: null`); `venta_costo/venta.ventaId` (mismo origen que fila 4, entrega mutuamente excluyente por try/catch) | **CERTIFICADO ESTRUCTURAL (02-10):** mismo tx de creación de venta del servicio (fila 4); actor `user.userId` y `tenantId` del contexto autenticado; la rama `catch` solo alcanza este callsite en modo `shadow` cuando el resolvedor `getCostoFifoVentaValorado` lanzó `ActionError FX_INSUFICIENTE`; con cualquier otro modo (`off` no entra al bloque; `enforce`) u otro error relanza antes, fail-closed | **Sin valoración a propósito:** el motor shadow no inserta asiento y registra la carencia en el outbox con causa durable; la venta se conserva | **Drift del conteo detectado y certificado 02-10 (37→39):** el apéndice contaba 1 callsite en el archivo y existen 2 desde el slice COGS valorado (fila 4, 01-10). Semántica cubierta por `formal-shadow-cash-sale.test.ts` 8/8 PostgreSQL (shadow conserva venta con outbox no valorizado; rollback por falta FX) |
**Nota de conteo vigente (04-10):** las filas 1–31 reúnen callsites activos y cinco entradas
RETIRADO (filas 8 y 13–16); el apéndice reproducible detecta 32 invocaciones productivas
en 19 archivos. El conteo detecta drift, no declara R0.5 terminado ni convierte esta tabla
en aceptación. **Exactitud de líneas:** las filas 1–4 y 30–31 citan líneas del
árbol al 02-10; las demás filas conservan la línea del slice que las certificó (el código
creció después) — la identidad vigente por archivo es la del apéndice.

### Inventario reproducible de archivos (32 callsites productivos en 19 archivos)

La prueba `src/features/contabilidad-formal/__tests__/writers-matrix.test.ts` recorre
`src/`, excluye definición, tests e integración, cuenta `postEvento(` y exige que cada
archivo aparezca aquí. El conteo sirve para detectar drift del inventario; no certifica
por sí solo permisos, FX, atomicidad ni autorización. Conteos y líneas verificados
contra el árbol el 2026-10-03 (19 archivos, 32 invocaciones; tres handlers legacy retirados y la ruta legacy de servicios delega al servicio canónico):

- `src/app/api/contabilidad/deudas-cash/[id]/pagar/route.ts` — 1: `:164` PAGO_DEUDA
- `src/app/api/contabilidad/deudas-cash/route.ts` — 1: `:284` DEUDA_RECIBIDA
- `src/app/api/contabilidad/prestamos-cash/[id]/pagar/route.ts` — 1: `:181` COBRO_PRESTAMO
- `src/app/api/contabilidad/prestamos-cash/route.ts` — 1: `:273` PRESTAMO_OTORGADO
- `src/app/api/contabilidad/reconciliacion/ventas/route.ts` — 1: `:933` COBRO_CXC
- `src/app/api/produccion/ordenes/[id]/completar/route.ts` — 1: `:207` PRODUCCION_SALIDA
- `src/features/compras-productos/actions.ts` — 1: `:445` COMPRA_CREDITO
- `src/features/compras-servicios/actions.ts` — 1: `:141` GASTO_CON_ANTICIPO_PROVEEDOR
- `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts` — 4: `:208` PRESTAMO_OTORGADO, `:406` COBRO_PRESTAMO, `:560` DEUDA_RECIBIDA, `:725` PAGO_DEUDA
- `src/features/contabilidad/services/accounting-operations-mutation-service.ts` — 4: `:307` TRANSFERENCIA_BANCARIA, `:424` AJUSTE_BANCARIO, `:568` DEUDA_RECIBIDA/INYECCION_CAPITAL, `:698` PAGO_DEUDA_CAPITAL
- `src/features/contabilidad/services/accounting-reconciliation-service.ts` — 2: `:547` COBRO_CXC/VENTA_CONTADO (reconcileSale), `:1140` COBRO_SERVICIO (reconcileService)
- `src/features/mermas/actions.ts` — 1: `:183` MERMA_INVENTARIO
- `src/features/productos/actions-restock.ts` — 1: `:575` COMPRA_CONTADO (restock)
- `src/features/venta-servicios/actions.ts` — 2: `:267` y `:397` VENTA_SERVICIO_CREDITO (devengo bruto del documento)
- `src/features/ventas/services/devolucion-venta-service.ts` — 1: `:585` DEVOLUCION_VENTA
- `src/features/ventas/services/facturacion-workflow.ts` — 4: `:595`, `:692`, `:761` VENTA_CONTADO; `:872` VENTA_CREDITO
- `src/features/ventas/services/venta-mutation-service.ts` — 2: `:480` y `:498` COSTO_VENTA_DEVENGADO (valorado / shadow no valorizado, exclusivos)
- `src/lib/services/anticipos-workflow.ts` — 2: `:248` ANTICIPO_CLIENTE_RECIBIDO/PROVEEDOR_ENTREGADO, `:686` ANTICIPO_*_APLICADO
- `src/lib/services/pago-gastos-workflow.ts` — 1: `:623` PAGO_CXP/PAGO_NOMINA/COMPRA_CONTADO/GASTO_CONTADO

## Writers de reconciliación SIN hook local (no confundir con llamadas anteriores)

| Ruta/servicio:línea de escritura | Actor/gate/FX y acción | Estado |
|---|---|---|
| `C/actions-reconciliacion.ts` (acciones `reconciliarServicioAction`/`reconciliarVentaAction`) | **DELEGADO (03-10):** ambas acciones llaman `AccountingReconciliationService.reconcileService`/`reconcileSale`; sin `postEvento` directo en el archivo (verificado por el guard de la matriz) | actor del `withAction`; `requireFeature('servicios')`, `requireTenant`, `requirePermission('financiero.contabilidad.acceder')`; servicio/cuenta/tipoPago tenant-scoped; una reconciliación y hook por cada distribución dentro del mismo tx, FX heredada. Unit `reconciliar-servicio-action.test.ts` 4/4 y PostgreSQL `reconciliar-servicio-real.test.ts` 20/20 cubren distribución/FX, CxC parcial/final, cross-tenant, retry, rollback SQL y auditoría durable post-commit. En integración, auth del wrapper de action se sustituye. | CERRADO |
| `C/services/accounting-reconciliation-service.ts:306` (venta), `:540` (distribución de servicios), `:569` (servicio simple; `reconcileService`, fuente alrededor de :715+) | **CANÓNICO:** gates tenant/feature/permiso antes de la transacción; dentro del mismo tx actualiza tesorería, recibos, CxC, asiento y AuditLog estricto. Para CxC exige clave idempotente, compara hash bajo lock tenant y devuelve resultado previo en replay; clave reutilizada con otro payload → conflicto. Cada saldo bancario se mueve y persiste en su moneda nativa. Unit 25/25; integración PostgreSQL 23/23 incluye replay secuencial/concurrente, USD→CUP, parcial/final, rollback CxC y de auditoría. | CERRADO para idempotencia, moneda de cuenta y auditoría transaccional; otros writers multimoneda permanecen abiertos (revisión §2/§8) |
| `A/contabilidad/reconciliacion/servicios/route.ts` | **DELEGADA:** POST valida auth, feature, permiso y período; adapta el contrato web de pago único y delega en `AccountingReconciliationService.reconcileService`. Se conserva la respuesta web compatible y la ruta ya no invoca `postEvento` directo. | `route.test.ts` + `servicios/route.test.ts` 7/7; `reconciliar-servicio-real.test.ts` verifica PostgreSQL, aislamiento tenant, reintento, rollback SQL y auditoría persistida. Auth helper se sustituye en esa integración. | CERRADO |
| `A/contabilidad/deudas-cash/route.ts`; `A/contabilidad/deudas-cash/[id]/pagar/route.ts` | **GATE Y AUTH CERRADOS:** ambos POST exigen feature `deudas-cash` + permiso contable antes de leer/escribir; referencias tenant-scoped, FX fail-closed y pago transaccional. Unit `route.test.ts` (22 tests) y `deudas-cash-auth-http-real.test.ts` 1/1 ejercitan ambos POST con JWT+sesión Bearer: 401 anónimo, manager permitido, dependiente 403 sin mutaciones y auditoría durable de alta/pago. | CERRADO |
| `A/contabilidad/prestamos-cash/route.ts:205`; `A/contabilidad/prestamos-cash/[id]/pagar/route.ts:91` | **CERRADO (03-10):** ambos POST exigen feature/permiso; create requiere override específico si supera cupo. Sesión Bearer real certifica create web y pago web; manager autorizado, dependiente denegado sin mutación | **CERRADO (03-10):** FX persiste y asiento hereda valoración; sin split interés (decisión v1) | `prestamos-cash-pago-auth-http-real.test.ts` 2/2 cubre create/pago Bearer real, 401 y 403 dependiente; route unit manager/override cubierta; integración writer de pago 11/11 |
| `C/services/accounting-cash-operations-mutation-service.ts:199,361` vía Server Actions y `/api/mobile/v1/accounting/cash-loans/**` | **CERRADO (03-10):** gates server-side: `requireTenant`, feature y permiso; referencias tenant-scoped; pago bajo lock, CxC revalidada y CAS. | **CERRADO:** FX persistida y heredada; saldo no puede sobrepagarse en carrera | `cash-loans-http-real.test.ts` 3/3: 401 anónimo, create y pago Bearer end-to-end, carrera multi-conexión de pagos con exactamente un ganador y débito único |
| `A/produccion/ordenes/[id]/completar/route.ts` | **CERRADO (03-10):** policy funcional tenant-scoped; cuenta/tipoPago tenant-scoped con moneda funcional; reconciliación y `PRODUCCION_SALIDA` en la misma tx, actor real | **CERRADO (03-10):** suma de costo de insumos desde `Producto.precioCosto` funcional; evento y reconciliación heredan moneda/importes funcionales | **CERRADO (03-10):** `rollback-real.test.ts` 3/3 en DB desechable (USD functional commit 10/10, rollback SQL 22012, denegación dependiente); auth wrapper sigue inyectado en prueba |
| `C/api/handlers.ts` (`createTransferencia`) | **RETIRADO (2026-10-04):** code graph y búsqueda fresca en `src/` confirmaron cero callers/imports; se eliminó el handler que mutaba antes de autenticar. El endpoint vivo usa `accounting-operations-mutation-service`. | No es writer vigente |

**Separación importante:** `generarAsientoCierre`/`generarAsientoApertura` en
`src/features/contabilidad-formal/services/cierre-formal-service.ts` insertan asientos
sin llamar `postEvento`; autoaprobación/servicio de períodos se revisa en R3.3–R3.4,
no se cuenta como caller de los 29. Tests `__integration__` existentes prueban motor,
no estas rutas productivas. Las rutas de deuda/préstamo legacy requieren cotejar
delegación y ejecución real, no sumarlas automáticamente como callsites del handler.

### Slice action servicio 25-09 (parcial)

`reconciliarServicioAction` valida servicio, cuenta y tipo de pago por tenant,
permiso `financiero.contabilidad.acceder` y reintento de servicio ya reconciliado.
Emite `postEvento` una vez por reconciliación persistida dentro del mismo tx;
para moneda extranjera exige fingerprint, tasa y monto funcional de la fila, sin
recalcular FX. RED unitario: `findUnique is not a function` (mock que requería
consulta tenant-scoped); GREEN/REFACTOR 4/4, typecheck heap 8192 y lint focal
exit 0. **GAP:** sin prueba PostgreSQL de rollback/commit ni canales API y servicio
compartido; reintento se rechaza, no devuelve resultado idempotente. No activar modos.

## Prioridad para R6.1 (sin implementar aquí)

### Continuación anticipos — evidencia focal, sin cierre global

**Continuación de snapshot/fondos:** decisión explícita del usuario: crear significa
dinero recibido/entregado. `Anticipo.fxSnapshot` y `AnticipoMovimiento.fxSnapshot`
persisten valoración exacta v2; la aplicación valida el reconocimiento sin consultar
otra tasa. El tenant determina moneda funcional (sin CUP fijo). Creación exige cuenta
y tipoPago propios; COBRO acredita y PAGO debita condicionalmente en la misma tx.
La aplicación no vuelve a mover banco. `/api/anticipos` ya no usa tenant vacío.
Integración focal 4/4 (incluye catálogo posterior 30 conservando reconocimiento 24),
regresión de anticipos y callers 94/94, TypeScript y ESLint pasan.
**Bloqueante de cierre:** venta-servicios postea COBRO_SERVICIO bancario además de
ANTICIPO_CLIENTE_APLICADO contra CXC; compras-servicios postea gasto contra anticipo
además de ANTICIPO_PROVEEDOR_APLICADO contra CXP. Se debe definir y verificar el
devengo bruto del documento antes de aplicar, o una plantilla de aplicación directa
a resultados. No retirar asientos sin resolver esa contrapartida y sus pruebas SQL.

`anticipos-fx-real.test.ts` pasó 4/4 en PostgreSQL desechable: creación y aplicación
USD con tasa/fingerprint al asiento y denegación de dependiente en web/móvil.
El POST web añade feature `anticipos`, permiso contable y respuesta 403.
`baseEvento` conserva la fecha predeterminada cuando el caller entrega `fecha: undefined`.
Regresión focal 31/31, typecheck y ESLint focal pasan. El diff-check global detecta
whitespace en `fiscal-emision-service.ts`, archivo ajeno a este slice.
**Corte histórico 25-09 (superado por la actualización vigente):** las filas 25/26 estaban
**PARCIALES**: faltaba persistir snapshot FX autoritativo del
anticipo/movimiento, resolver moneda funcional tenant sin CUP fijo, acreditar origen
de fondos, permisos de todos los invocadores y demostrar ausencia de doble posteo
en ventas/compras. La prueba invoca handlers con NextRequest; no ejecuta un servidor HTTP.

1. Cobertura ausente: action de servicio con distribuciones, API servicio, servicio
   compartido reconciliación venta/servicio y transferencia legacy; confirmar rutas
   efectivamente usadas por web/móvil para evitar dobles asientos.
2. Autoridad: eliminar identidad `|| 'system'` para acciones humanas, comprobar
   `requirePermission` y propiedad tenant de cuentas/préstamos/deudas/documentos en
   servicio **y** adaptador, no solo gate formal interno.
3. FX: comparar `fxEvidenceFingerprint`, tasa, monto funcional y moneda almacenados
   con evento de **cada** branch (principalmente cash legacy, servicios, capital,
   devolución y transferencia); reconciliación sin evidencia no es PASS.
4. Atomicidad: producción crea ReconciliacionGasto dentro de tx; probar rollback
   operación+asiento+reconciliación, por canal y modo. Validar autoaprobación R3.

**Resultado histórico del corte 25-09:** R0.5 PARCIAL, mantener `[ ]` en tasks.md:93. No había pruebas RED→GREEN
de inventario exhaustivo. La prueba focal de producción demuestra el fallo previo
de HTTP 200 tras error de reconciliación, no certifica rollback PostgreSQL.

### Trazas adicionales verificadas 25-09 (sin adjudicar cobertura por delegación)

- Las rutas legacy `api/contabilidad/{deudas-cash,prestamos-cash}/route.ts` tienen
  `prisma.$transaction` propia y crean `reconciliacionVenta` directamente
  (`deudas-cash/route.ts:171,215`; `prestamos-cash/route.ts:176,205`). No delegan
  esos POST a `handlers-{deudas,prestamos}-cash.ts`; sus hooks no cubren estas rutas.
  **GAP**: probar cada POST y su endpoint `[id]/pagar` por separado antes de cablear
  un solo hook por reconciliación; heredar conversión persistida y verificar actor,
  referencias tenant y rollback. No asumir que la tasa enviada implica fingerprint.
  **Deudas resuelto 25-09** (ver slice «POST legacy deudas» más abajo): los POST de
  deudas y su `[id]/pagar` tienen hook propio una vez por origen dentro del tx.
  **Préstamos resuelto 26-09** (ver slice «POST legacy préstamos pagar» más abajo):
  `[id]/pagar` (fila 14) tiene hook propio una vez por origen dentro del tx y el
  handler huérfano fue verificado con cero callers (no cablear).
- `actions-reconciliacion.ts:631-714` hace un loop por distribución, crea cada
  `reconciliacionServicio` con evidencia de `buildPersistedAccountingAmount`
  (`:678-701`) pero sin hook. Cuenta y servicio se consultan/actualizan por ID
  sin cotejo tenant (`:634-660`). **GAP**: test dos distribuciones, otro tenant,
  reintento y modos off/shadow/enforce; exigir propiedad y postear una vez por ID
  de reconciliación dentro del mismo tx, sin volver a convertir.
- `accounting-reconciliation-service.ts:379-403,543-593` es otra implementación
  transaccional (venta y servicio), no mero wrapper: venta pierde `fxEvidence` de
  `conversion`, servicio usa spread del helper sin prueba de fingerprint y ambos
  carecen de hook local. **GAP**: mapear adaptadores web/móvil, probar origen estable,
  FX persistida y 2 tenants antes de elegir un único punto de posteo; no postear
  también en adaptador si se incorpora al servicio.
- `api/contabilidad/reconciliacion/servicios/route.ts:103-224` es POST propio con
  auth/tenant/feature, consulta referencias tenant-scoped (`:130-170`), calcula
  conversión manual (`:173-176`) y crea registro sin fingerprint ni hook (`:205`).
  **GAP**: test moneda/tasa de cuenta y documento, evidencia persistida, tx y permiso;
  no inferir FX a partir de tasa opcional. Los otros callers FX de filas 3,5,7,9–26,28
   siguen GAP/UNKNOWN hasta auditar fuente persistida por branch, sin inventar CUP.

### Slice producción 25-09 (parcial)

`completar/route.ts` exige permiso `produccion.recetas.gestionar` al usuario autenticado
antes de abrir transacción. Si el costo es positivo exige cuenta bancaria activa CUP del
tenant y tipo de pago activo del tenant (default legacy `efectivo`) antes de modificar
stock; omitir cuenta retorna 400. El mismo tx contiene stock, historial, reconciliación
y `postEvento`. RED unitario: 4 fallos 200 vs 400/403; GREEN 6/6 + identidad 1/1,
typecheck heap 8192 y lint focal exit 0. SQL y Prisma **solo lectura** confirmaron
`tcp_test_shadow_rev_contabilidad`, `arturo`, `55437`, recovery=false y `cta-isolated-pg`
antes de cualquier potencial escritura. **No se ejecutó fixture ni prueba PostgreSQL
de rollback**: la ruta requiere orden EN_PROCESO, receta/insumos/productos/stock y
tenant con usuario/permisos; los tests mock no prueban commit/rollback físico. Sigue
GAP de costo histórico CUP, tipo pago default si falta en tenant, rollback real y
   permisos del resto de canales. No activar shadow/enforce/replay.

### Verificación PostgreSQL de producción (25-09, sin activación)

`src/app/api/produccion/ordenes/[id]/completar/__integration__/rollback-real.test.ts`
ejercita la ruta POST real con tenant, orden, receta, insumo, producto, cuenta CUP y
tipo de pago persistidos. Un trigger condicionado por tenant falla en INSERT de
`ReconciliacionGasto` con SQLSTATE 22012 después de los writes anteriores.
Resultado GREEN 1/1: HTTP 500; stock permanece 2, orden EN_PROCESO, historial 0,
reconciliaciones 0. Evidencia adicional para fila 29 y tabla sin hook: **rollback
físico de reconciliación**, no posteo formal (modo `off`), ni autorización real
del middleware (el test inyecta usuario y sustituye `requirePermission`). No es RED
de producto: el arreglo transaccional precede a este test. SQL y Prisma comprobaron
identidad exacta del clúster aislado antes de escribir; no se usó 5432. Continúan
pendientes postEvento fallido en la ruta, autorización real y los otros canales.

### Continuación focal de action servicio (25-09)

RED 1/6: `reconciliarServicioAction` aceptaba `updateMany.count=0` de cuenta bancaria
y publicaba el evento pese a no acreditar el ingreso. GREEN 6/6: rechaza antes de
crear reconciliación/postear si el saldo no se actualiza. Tests adicionales validan
permiso previo a transacción y actor/tenant del evento; son unitarios con mocks, no
certifican permiso real ni rollback SQL de la action. Typecheck heap 8192 y lint focal
exit 0. SQL y Prisma solo lectura verificaron DB aislada, usuario arturo, puerto 55437,
recovery=false y `cta-isolated-pg`; integración real de producción existente pasó 1/1
con rollback por error SQL en reconciliación (modo off). **No es prueba de falla en
postEvento ni de action servicio en PostgreSQL.** R0.5/R6 siguen abiertos.

### Integración PostgreSQL de action servicio (25-09, scope acotado)

`src/features/contabilidad/__integration__/reconciliar-servicio-real.test.ts`
ejecutó 3/3 con Prisma real, `postEvento` real y trigger SQL tenant-scoped sobre
`asientos` que falla con 22012. Confirma commit enforce de un asiento por fila,
fingerprint y tasa 24 heredados, funcional 240; rollback de saldo,
reconciliación y estado de servicio ante error **dentro** del motor, además de
aislamiento de referencias de otro tenant. Solo se sustituyeron boundary de auth
(`withAction`, `requireFeature` y `requirePermission`) y `next/cache` fuera de
request; no se probó autorización real. SQL y Prisma comprobaron identidad
`tcp_test_shadow_rev_contabilidad`, `arturo`, puerto 55437, recovery=false y
`cta-isolated-pg` antes de writes. RED observados corresponden a fixture de período
cerrado y boundary Next ausente, no bug de producto; no se modificó producción.
R0.5 sigue parcial: API legacy, servicio compartido y demás canales sin certificar.

### Continuación API servicios FX (25-09, parcial)

El POST de la ruta API independiente aceptaba `moneda`/`tasaCambio` antes del rechazo
temporal de FX. RED unitario 1/6: con USD, tasa 24 y fecha efectiva explícita devolvía
400. GREEN/REFACTOR 6/6: utiliza `buildPersistedAccountingAmount`, guarda la evidencia
en la fila y pasa fingerprint, tasa y monto funcional **desde la fila creada** al hook.
Si falta tasa o fecha, conserva rechazo previo sin abrir transacción. TypeScript heap
8192 y ESLint focal exit 0. Antes de cualquier potencial escritura se verificó identidad
SQL **y** Prisma (solo lectura): base exacta `tcp_test_shadow_rev_contabilidad`, rol
`arturo`, puerto 55437, recovery=false y `cta-isolated-pg`. **No se ejecutó integración
real del POST**, ni pruebas de permiso, retry concurrente o rollback PostgreSQL de este
canal; autenticación está mockeada. R0.5/R6 siguen abiertos; no activar modos.

### POST legacy préstamos: desembolso (parcial)

`api/contabilidad/prestamos-cash/route.ts` no delega al servicio compartido ni a
`handlers-prestamos-cash`. Su POST ahora verifica cliente y cuenta del tenant antes del
tx, debita condicionalmente dentro del tx, crea la reconciliación y llama una vez a
`postEvento(PRESTAMO_OTORGADO)` con origen préstamo creado y valoración copiada de la
reconciliación persistida; falla del hook revierte el tx. No contabiliza interés del
saldo de CxC como parte del desembolso. RED 201/400 para banco de otro tenant;
GREEN 7/7 unitarios, `tsc` heap8192 y lint focal exit 0. Autenticación mockeada;
sin integración PostgreSQL ni permiso de operación aprobado. Quedan POST deuda, rutas
`[id]/pagar`, FX extranjero probado, servicio compartido y autorización real: R0.5/R6
continúan abiertos; no habilitar modos ni replay.

### POST legacy deudas 25-09 (parcial — scope UNO)

Investigación de delegación: `api/contabilidad/deudas-cash/route.ts` y su
`[id]/pagar` **duplican** la lógica del handler `handlers-deudas-cash.ts` (no
delegan) y tampoco delegan al servicio canónico
`accounting-cash-operations-mutation-service.ts`; el handler es huérfano con
cero callers en producción y tests (verificado por búsqueda de imports y
referencias). Por eso sus hooks (filas 15/16) no cubren ningún request real.
Los POST legacy son el canal vivo; se corrigieron en el lugar con hook propio,
sin cablear el handler ni duplicar posteo con el servicio canónico.

`POST crear` (`route.ts:215`): proveedor, cuenta bancaria (activa) y tipo de
pago resueltos por tenant antes del tx; débito condicional `updateMany` con
tenant dentro del tx (acredita saldo del desembolso); reconciliación con
evidencia FX de `buildPersistedAccountingAmount` (tasa opcional añadida al
schema); `postEvento(DEUDA_RECIBIDA)` una vez por origen `deuda_cash/deuda.id`
con valoración copiada de la fila persistida; falla del hook revierte el tx.
`POST [id]/pagar` (`[id]/pagar/route.ts:91`): `requireTenant` (firma
`AuthenticatedUser`) y búsqueda tenant-scoped de la deuda (404 cross-tenant);
cuenta resuelta por tenant antes del tx; débito condicional con tenant;
`postEvento(PAGO_DEUDA)` una vez por origen `reconciliacion_venta/rec.id`,
valoración de la fila, sin split capital/interés (decisión v1). FX fail-closed
en ambos POST: moneda extranjera sin tasa se rechaza 400 `FX_INSUFICIENTE`
antes de abrir transacción; el camino CUP legítimo (evidencia con tasa 1 y
fingerprint) sigue admitido. Sin doble conversión: la conversión se calcula una
vez antes del tx y se reutiliza.

RED reproducible: `pnpm exec vitest run src/app/api/contabilidad/deudas-cash
src/features/contabilidad/__tests__/handlers-deudas-cash.test.ts` → 13 fallos
nuevos (hook sin llamar, cross-tenant 201→404/400, FX sin tasa 201→400,
evidencia no propagada al evento; 4 del handler con valoración sin FX,
proveedor/deuda sin tenant y ausencia de requireTenant). GREEN 23/23 (19 ruta
+ 4 handler). Integración PostgreSQL `__integration__/deudas-cash-real.test.ts`
6/6: SQL `psql -X -w` y Prisma generado, ambos de solo lectura, confirmaron
antes de escribir base exacta `tcp_test_shadow_rev_contabilidad`, rol `arturo`,
puerto 55437, recovery=false y directorio `cta-isolated-pg`. Commit crear CUP
(saldo 3000, rec tasa 1, asiento por origen), crear USD+tasa 24 (rec 72000/24,
fingerprint heredado por línea), pagar CUP (saldo 5000→4600, CxP PARCIAL 400,
asiento por origen), rollback trigger SQL 22012 dentro de postEvento en ambos
POST (saldo intacto, cero deuda/reconciliación/asiento) y aislamiento de
referencias de otro tenant (404/404, sin escrituras cruzadas). Typecheck heap
8192 exit 0 y ESLint focal exit 0 (rutas, handler, tests, integración).

**GAP**: auth (`withAuthPost` con usuario inyectado) y `validarEscrituraPeriodo`
mockeadas — no prueba middleware ni autorización real; sin permiso específico
de operación aprobado; handler huérfano persiste (filas 15/16 PARCIAL); filas
11/12 del servicio canónico (FX sin propagación, referencias sin tenant) siguen
GAP; numeración `DC-N` global sin filtro tenant (contrato caja, no en scope);
préstamos `[id]/pagar` (fila 14) y demás canales sin certificar. No activar
shadow/enforce/replay. R0.5/R6 siguen abiertos.

## Revalidación de valoración de VENTA_CREDITO (2026-09-27)

La fila 3 queda **PARCIAL**: `buildEventoVentaCredito` ya no inventa CUP ni una
valoración funcional cuando no recibe evidencia explícita. En modos formales activos,
`postEvento`/replay fallan cerrado sin esa valoración; `off` permanece no-op. Este
guard evita un asiento monetariamente falso, pero no completa el canal.

`applyFacturacionCobroWorkflow` recibe `montoTotal: number` y sus tres callers
(`facturarVenta`, `venta-mutation-service.create` y `facturarOfertaWorkflow`) no pasan
moneda ni evidencia FX. `Factura` persiste `total` y `tasaCambio?`, pero no moneda,
monto funcional ni fingerprint; `CuentaPorCobrar` tampoco aporta esos datos.
`Factura.tasaCambio` por sí sola no prueba moneda ni conversión.

Siguiente corrección requerida: definir y propagar una valoración autoritativa desde
el origen persistido por todos los callers, o mantener el canal formal bloqueado.
Agregar pruebas de workflow para factura extranjera, reintento y rollback; no crear
un asiento CUP aparente.

## Slice R0.5/R6.1 VENTA_CREDITO (2026-09-30, parcial)

El workflow ya persiste en `CuentaPorCobrar` la valoración canónica de la factura
(`monedaOriginal`, importe original/funcional, moneda funcional, tasa, fecha,
proveniencia, catálogo, JSON, fingerprint y versión) dentro de la misma transacción.
El `VENTA_CREDITO` se construye desde la fila devuelta por Prisma, no desde una tasa
transitoria. La rama de crédito no resuelve cuentas bancarias ni tipos de pago. El
dominio POS actual, que no persiste moneda de venta, solo permite usar la moneda
funcional del tenant cuando el caller no entrega moneda; una moneda distinta exige
valoración FX v2 explícita y verificable. No se infiere moneda desde tesorería ni desde
`Factura.tasaCambio`.

RED: `pnpm exec vitest run
src/features/ventas/services/__tests__/facturacion-workflow-venta-credito.test.ts
-t 'crédito funcional no requiere banco ni tipo de pago'` fallaba porque se intentaba
resolver tipos de pago en una venta a crédito. GREEN: regresión focal de cinco suites,
**44/44 tests**, typecheck, ESLint y `git diff --check` verdes. La integración real y
la prueba de auth HTTP permanecen pendientes; no marcar PASS global ni activar modos.

## Actualización de brechas R0.5/R6 (2026-09-26)

La fila 23 anterior queda **PARCIAL** con la siguiente evidencia: `createVentaServicioAction`
exige `ventas.venta.registrar`; cuenta de anticipo tenant-scoped; actor humano se pasa sin
fallback `system`; postEvento ahora usa monto funcional, tasa, fingerprint y fecha de la
reconciliación persistida. `actions.test.ts`: denegación de permiso + FX, unit focal verde.
Falta integración PostgreSQL de ese canal y test de cuenta ajena/rollback. La fila 21 compras,
22 compras servicios, 25/26 anticipos, 28 restock y otros FX siguen GAP/UNKNOWN.

### POST legacy préstamos pagar 26-09 (parcial — scope UNO)

Investigación de delegación: `api/contabilidad/prestamos-cash/route.ts` (crear) y
su `[id]/pagar` **duplican** la lógica del handler `handlers-prestamos-cash.ts`
(no delegan) y tampoco delegan al servicio canónico
`accounting-cash-operations-mutation-service.ts`; el handler es huérfano con
cero callers en producción y tests (verificado por búsqueda de contenido
`handlers-prestamos-cash`/`handlersPrestamos` en `src`: 0 referencias). Por eso
sus hooks (filas 13/14) no cubren ningún request real; los POST legacy son el
canal vivo y se corrigieron en el lugar, sin cablear el handler ni duplicar
posteo con el servicio canónico (filas 9/10 intactas).

`POST [id]/pagar` (`[id]/pagar/route.ts`): `requireTenant` (firma
`AuthenticatedUser`) y búsqueda tenant-scoped del préstamo (404 cross-tenant);
cuenta bancaria resuelta por tenant (activa) antes del tx (400 cross-tenant);
crédito condicional `updateMany` con tenant dentro del tx (acredita el cobro en
la cuenta que recibe el pago); reconciliación con evidencia FX de
`buildPersistedAccountingAmount` (tasa opcional); FX fail-closed: moneda
extranjera sin tasa se rechaza 400 `FX_INSUFICIENTE` antes de abrir
transacción; el camino CUP legítimo (evidencia con tasa 1 y fingerprint) sigue
admitido. `postEvento(COBRO_PRESTAMO)` una vez por origen
`reconciliacion_venta/rec.reconciliacionId` dentro del mismo tx, valoración
copiada de la fila persistida (monto, moneda, funcional desde `montoConvertido`,
tasa y fingerprint), sin split capital/interés (decisión v1: no se pasa
`intereses` al builder). Sin doble conversión: la conversión se calcula una vez
antes del tx y se reutiliza. Falla del hook revierte el tx. La creación del
préstamo (crear, 25-09) no se tocó en este slice.

RED reproducible: `pnpm exec vitest run
'src/app/api/contabilidad/prestamos-cash/[id]/pagar/__tests__/route.test.ts'` →
4 fallos nuevos (hook `postEvento` sin llamar «0 times»; cross-tenant
201→404; cuenta ajena 201→400; FX sin tasa 201→400 `FX_INSUFICIENTE`), 5
previos verdes. GREEN 9/9. Regresión focal 7 archivos/46 tests (prestamos-cash
completo, handler deudas, deudas completo). Integración PostgreSQL
`src/features/contabilidad/__integration__/prestamos-cash-pagar-real.test.ts`
4/4: SQL `psql -X -w` y Prisma generado, ambos de solo lectura, confirmaron
antes de escribir base exacta `tcp_test_shadow_rev_contabilidad`, rol `arturo`,
puerto 55437, recovery=false y directorio `cta-isolated-pg`. Aislamiento de
referencias (préstamo inexistente 404, cuenta ajena 400, sin escrituras
cruzadas), commit pagar CUP (saldo 0→400, rec tasa 1, CxP PARCIAL 400, asiento
por origen con fingerprint heredado), commit pagar USD+tasa 24 (rec 9600/24,
fingerprint y tasa 24 heredados por línea) y rollback trigger SQL 22012 dentro
de postEvento (saldo intacto, cero rec/asiento, CxP sin cambios). Typecheck
heap 8192 exit 0 y ESLint focal exit 0 (ruta, tests, integración). Regresión
de integración de deudas 6/6 (comparte DB, sin interferencias).

**GAP**: auth (`withAuthPost` con usuario inyectado) y `validarEscrituraPeriodo`
mockeadas — no prueba middleware ni autorización real; sin permiso específico
de operación aprobado; handler huérfano persiste (filas 13/14, sin ruta que lo
consuma); filas 9/10 del servicio canónico (referencias `findUnique` sin
tenant, interés sin split) siguen GAP; préstamos crear sin integración
PostgreSQL de rollback; demás canales sin certificar. No activar
shadow/enforce/replay. R0.5/R6 siguen abiertos.
