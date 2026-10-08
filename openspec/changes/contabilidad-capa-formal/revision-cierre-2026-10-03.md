# Revisión de cierre — 2026-10-03

## Dictamen

**El change `contabilidad-capa-formal` no está cerrado por completo.** El primer
bloqueante (carrera de pagos de deuda) se corrigió en esta continuación; los demás
hallazgos siguen pendientes. La cobertura focal de autorización, commit y rollback no
certifica todas las garantías del writer ni del change. No marcar R0.5/R6 completos ni
considerar R7.2 globalmente verde con la evidencia actual.

**Actualización de valoración 2026-10-05:** la comparación código/documentación de FX-1,
FX-2 y FX-4 está en `auditoria-fx-1-2-4-2026-10-05.md`. Confirma funcional explícita al helper,
pero reabre FX-2/FX-4: eventos web cash vuelven a CUP/Number, gastos e inventario extranjero
generan evidencia v1 y el fingerprint no protege monedas/IDs/fecha de `crossQuote`.
Evidencia de esa revisión: 86 unitarios existentes aprobados y 6 pruebas adicionales RED,
sin ejecución PostgreSQL. Sus hallazgos prevalecen sobre las notas previas de cierre FX.

La auditoría de cierre comenzó read-only. El primer arreglo se implementó en
`accounting-cash-operations-mutation-service.ts` y en el POST web de pago. Las
reproducciones nuevas se guardaron fuera del repositorio, en la carpeta temporal del
agente. PostgreSQL usado exclusivamente:
`tcp_test_devolucion_20261001`, `127.0.0.1:5433`.

## Evidencia ejecutada en esta revisión

- Unitarias: **61/61** en 5 archivos (matriz, servicio de reconciliación, ejecución de
  anticipo, deudas web y pago web de préstamos).
- PostgreSQL: 8 archivos, **41 passed / 3 failed / 8 skipped**. Cuatro archivos pasan;
  tres tienen una prueba fallida y transferencias aborta su setup por una DB fija.
- Reproducciones adicionales: **5/5 confirmaron los comportamientos defectuosos** que
  se detallan abajo. Estos cinco PASS son evidencia del defecto, no de corrección.
  Se ejecutaron con formal/isolation `off`, auth/período/cache sustituidos y filas
  PostgreSQL reales; la carrera del servicio usa una barrera para forzar dos lecturas
  previas al lock. No son pruebas de servidor HTTP en vivo.
- Consulta PostgreSQL de solo lectura confirmó identidad de la DB y ausencia de
  checks de replay y triggers de `apertura_revisiones`/`StockMoveLine` en esa DB.

Reproducciones preservadas en:

- `/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/cta-closure-review.test.ts`
- `/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/cta-closure-review.config.mjs`

## Pendientes técnicos y criterios de cierre

### 1. P0 — Carrera de pagos de deuda — primer arreglo completado (2026-10-03)

**Corregido:** `registerCashDebtPayment` ahora adquiere el lock contable del tenant
antes de volver a leer deuda/CxP; calcula el saldo sobre esa lectura, debita la cuenta
condicionalmente y actualiza CxP/deuda con CAS. El POST web conserva su contrato, pero
aplica el mismo lock y relectura bajo la misma transacción, en vez de usar su snapshot
anterior para confirmar el pago.

**Verificado:** el RED de `deudas-cash-real.test.ts` fallaba en ambos canales: dos pagos
de 600 sobre saldo 1.000 generaban dos ganadores. Tras el arreglo, los casos web y
servicio pasan en PostgreSQL: un recibo/asiento, CxP pagada 600/saldo 400, un débito
600; web responde 201/409 y servicio permite exactamente una promesa cumplida. Pasan
además `accounting-cash-operations-mutation-service.test.ts` 8/8, `route.test.ts` de
deudas 22/22, `deudas-cash-real.test.ts` 12/12, `deudas-cash-auth-http-real.test.ts`
1/1, typecheck, ESLint focal y diff-check.

Esto cierra **solo la carrera de doble pago** en el POST web y el servicio canónico.
El débito correcto entre moneda de cuenta/pago se corrigió después para cash-debt, bajo
el punto 2. No certifica otros writers que puedan alterar CxP fuera de este lock.

### 2. P0 — Caja y valoración multimoneda — cash debts/loans corregidos; otros writers pendientes

**Parcialmente corregido (2026-10-03):** el usuario decidió aceptar pago extranjero a
obligación CUP convirtiéndolo a CUP con la tasa indicada. `resolveCashDebtCurrencyAmounts`
se aplica a creación y pago de cash debts y loans, en POST web, servicio canónico y móvil:
deuda CUP + tender USD 10×25 + cuenta CUP actualiza obligación/caja en 250; cuenta USD
conserva el movimiento nominal 10. Un desembolso USD 3.000×24 a cuenta CUP mueve 72.000 CUP
y conserva el principal/CxP en USD. Una obligación no-CUP requiere tender en su misma
moneda; una cuenta en moneda tercera sin cotización falla cerrado.

Verificado en PostgreSQL desechable: `deudas-cash-real.test.ts` 12/12,
`cash-debts-http-real.test.ts` 5/5, `prestamos-cash-pagar-real.test.ts` 12/12,
`cash-loans-http-real.test.ts` 4/4 y `prestamos-cash-pago-auth-http-real.test.ts` 2/2.
Unitarias: helper 5/5, service deuda 8/8, service préstamo 5/5, credit gate 5/5,
route deuda 22/22 y route préstamo 7/7 + pago 12/12. Typecheck, ESLint focal y
diff-check pasan.

**Corregido para reconcileService (2026-10-04):** el writer ahora exige política funcional
tenant-scoped y valora tender/documento en esa moneda; en cobro directo exige que tender y
servicio compartan moneda, y en CxC que tender y obligación compartan moneda original.
Débito y crédito bancarios se calculan por separado en la moneda nativa de cada cuenta:
nominal si coincide con el tender, importe funcional si coincide con la moneda funcional;
tercera moneda falla cerrado. `ReconciliacionServicio` conserva importe/moneda para
destino y origen, y SQL verifica que cada importe tenga su moneda. PostgreSQL
`reconciliar-servicio-real.test.ts` 22/22 incluye movimiento USD→CUP (USD 10 debitados,
CUP 240 acreditados), CxC parcial/final, replay concurrente y rollback.

**Pendiente:** la brecha multimoneda global sigue abierta en los demás writers de
cash/bancos, gastos, compras, anticipos e inyecciones; se debe verificar moneda
fuente/cuenta/funcional por writer y no inferir valoraciones. No declarar cerrada la
valoración global.

Fuente restante: writers multimoneda citados en la matriz R0.5, fuera de
`AccountingReconciliationService.reconcileService`.

### 3. P0 — Anticipos: ejecución documental completa y reversión

**Manual standalone corregido (2026-10-03):** por decisión del usuario, no se permite
ejecutar/revertir un anticipo desde un diálogo aislado. Se eliminaron los dialogs y las
opciones de tabla que fabricaban `manual-${Date.now()}`; las Server Actions fallan con
`DOCUMENT_WORKFLOW_REQUIRED`. Los POST web y móvil de ejecutar/revertir ahora exigen
tenant, feature `anticipos` y permiso contable, y responden 409 sin consultar ni mutar
el anticipo. JWT/UserSession real en los 4 endpoints: manager 409 y dependiente 403,
sin cambios de saldo/movimientos (`anticipos-fx-real.test.ts` 11/11); unit action/web/móvil
8/8; typecheck y lint sin errores. Se cerró también el bypass de `PUT`/`DELETE` directos
en rutas legacy, web y móvil: estado/saldo quedan reservados al flujo documental, el borrado
directo responde 409, y los `PUT` aceptan únicamente metadatos no financieros. La suite
unitaria de operaciones manuales cubre los tres canales (5/5); TypeScript completo y ESLint
focal pasan.

Las operaciones válidas siguen siendo las aplicaciones dentro de los
writers que crean documentos; `applyAnticipoAllocations` recibe IDs y contexto de un
caller documental y no es un workflow autónomo de modificación de CxC/CxP. Los flujos de
creación/reversión se verifican en `anticipos-devengo-bruto-real.test.ts` 10/10. La reversión de un
documento ya contabilizado no creaba el asiento inverso: `reverseExpenseEffects` podía
restaurar banco/borrar reconciliación/CxP y reponer anticipo mientras el asiento formal
original permanece.

**Reversión formal implementada (2026-10-03) para GastoDE y compra de servicio:**
`reverseExpenseEffects` ahora identifica asientos por origen directo del servicio,
reconciliaciones de gasto y aplicaciones de anticipo. `reverseFormalEntries` conserva las
líneas/evidencia FX, intercambia debe/haber, inserta `REVERSO_ASIENTO` en el período abierto
y enlaza el original con `revertidoPorId`, marcándolo `ANULADO`. Corre antes de restaurar
caja/eliminar obligaciones y dentro de la misma transacción; si el período no permite la
escritura, también se aborta la eliminación operativa. Cobertura: integración
`anticipos-devengo-bruto-real.test.ts` 10/10 (servicio con anticipo+CxP+pago, gasto pagado,
líneas inversas, evidencia FX, idempotencia, hash-chain íntegra y rollback con período
cerrado); suites unitarias de reversión GastoDE/servicio 10/10; TypeScript y ESLint focal.

### Auditoría adicional de cancelaciones formales (2026-10-03)

Se extendió el mismo reversor a los workflows activos que eliminan/revierten asientos
por otros caminos:

- `VentaLifecycleService.anularVentaPorEstado` invierte asientos de factura, costo FIFO y
  reconciliaciones antes de borrar las reconciliaciones y anular CxC/factura.
- `reversePayrollReconciliations` invierte los asientos `PAGO_NOMINA` por reconciliación
  antes de restaurar banco/CxP y eliminar la nómina.
- `anularCompraProductoAction` invierte el devengo `COMPRA_CREDITO` por `compra_documento`
  antes de eliminar la CxP/gasto y devolver inventario.

Las tres rutas comparten `reverseFormalEntries`, enlazan fuente/reverso con
`revertidoPorId`, preservan importes/evidencia FX y abortan todos los cambios si el período
actual está cerrado. `formal-shadow-cash-sale.test.ts` 10/10 cubre anulación de venta y
eliminación de nómina; `purchase-credit-fx-real.test.ts` 7/7 cubre anulación de compra;
`anticipos-devengo-bruto-real.test.ts` 10/10 cubre gasto y compra de servicios.

Se revisaron también las rutas de cancelación de compra/producción en proceso, conteos,
ajustes y transferencias de inventario: no eliminan asientos formales; la cancelación de
producción completada está bloqueada. Mermas con asiento formal no permiten editar/borrar.
`anularCuentaPorCobrarAction` no tiene caller de producto; es una acción legacy de estado
CxC sin evento contable de incobrabilidad y queda fuera de estas anulaciones documentales.

La suite de integración completa terminó **51 archivos / 298 tests, todo verde** en
`tcp_test_devolucion_20261001:5433`. `test:integration` prepara antes, únicamente en la DB
local desechable validada, los guards SQL que `db push` no representa. La prueba de
transferencias usa la identidad DB/puerto de `DATABASE_URL` en vez de fijar 55437.

Fuentes:
- `src/features/contabilidad/actions-anticipos.ts:130-154`
- `src/lib/services/anticipos-workflow.ts:512-726`
- `src/features/gastosDE/reversal.ts:61-219`
- `src/features/contabilidad-formal/services/reversal-service.ts`
- `src/lib/services/__integration__/anticipos-devengo-bruto-real.test.ts`
- `src/features/ventas/services/venta-lifecycle-service.ts`
- `src/features/empleados/payroll-reversal.ts`
- `src/features/compras-productos/actions.ts`
- `scripts/ci/prepare-disposable-integration-database.mjs`
- Rutas web/móvil `anticipos/[id]/{ejecutar,revertir}` (manual rechazado 409)
- `src/app/api/anticipos/[id]/route.ts` y `src/app/api/contabilidad/anticipos/[id]/route.ts`
- `src/app/api/mobile/v1/accounting/advances/[id]/route.ts`

### 4. P1 — Tipo de pago ajeno y gate de gastos — corregido (2026-10-04)

Los POST web de pago de deuda y préstamo ahora validan `tipoPagoId` activo y
tenant-scoped dentro de la transacción antes de mutar. El adapter de gastos aplica
feature `contabilidad` además del permiso, y los endpoints web/móvil traducen
`ActionError` de autorización a 403.

Verificación: tests unitarios de rutas/adaptador y las integraciones HTTP reales de
deuda/préstamo quedaron incluidos en la suite completa, que pasó 51 archivos/298
tests; las pruebas focales nuevas de tipo ajeno/inactivo no realizan writes.

### 5. P1 — Idempotencia del cobro parcial de servicios — corregida (2026-10-04)

El writer exige `Idempotency-Key` para cobros CxC y valida hash/payload dentro de la
transacción protegida por lock tenant. Web y móvil permiten replay: el mismo payload
devuelve los recibos previos; reutilizar la clave con otro payload devuelve 409.
La UI conserva la clave mientras reintenta y PostgreSQL impone unicidad por tenant.

Verificación PostgreSQL `reconciliar-servicio-real.test.ts` 21/21: abono parcial,
replay secuencial web+móvil, conflicto de payload y dos requests concurrentes con una
sola actualización CxC, variación de saldo, recibo, asiento y auditoría.

### 6. P1 — Garantías SQL / cobertura de despliegue — parcialmente resuelto

Fallos reproducidos:
- `apertura-revision-approval.test.ts:182`: UPDATE de revisión PRESENTADA permitido.
- `backfill.test.ts:338`: autoaprobación permitida por PostgreSQL.
- `kardex-backfill.test.ts:165`: DELETE de StockMoveLine permitido.
- `accounting-bank-transfers-real.test.ts:30`: setup exige DB 55437 distinta.

Checks/triggers existen en migraciones, pero la DB 5433 inspeccionada no los tenía:
`20260928000000_contabilidad_formal_remediacion`,
`20260930120000_formal_opening_evidence`, `20260905130000_add_stock_move_lines`.
Esto acredita drift de esa DB, no demuestra que la aplicación o cualquier otra DB
tenga el mismo defecto. `db push` no instala por sí solo todos los triggers/checks.

Corregido en la verificación local: `test:integration` prepara los guards SQL de forma
idempotente solo después de validar la DB desechable; el test de transferencias ya toma
la identidad de `DATABASE_URL`. La suite completa quedó verde en 51/298; el test focal de
reconciliación de servicios pasó 21/21, incluyendo replay concurrente.

**Sigue pendiente:** ejecutar/validar la cadena versionada completa (`migrate deploy`)
y consultar en catálogo que todos los objetos de guard están presentes. No asumir que
el helper de tests equivale al deploy productivo.

### 7. P1 — Eliminación de documentos con efectos contables publicados — corregida

`reverseFormalEntries` ahora se ejecuta en la misma transacción que restaura caja,
elimina la obligación operativa y repone inventario/anticipo. Compras de productos,
compras de servicios, GastoDE, ventas y nómina enlazan original/reverso con
`revertidoPorId`, preservan líneas y evidencia FX y fallan sin mutaciones cuando el
período está cerrado. Integraciones de reversión y la suite completa validan los flujos
descritos en §3.

### 8. P2 — Auditoría de caja/reconciliación — endurecida; otros dominios pendientes

`reconcileService`, los writers compartidos de deuda/préstamo cash, sus POST web/móvil
de creación/pago y los PUT metadata de deuda/préstamo ahora usan `AuditLogService.logStrict`
con el mismo cliente transaccional. Transferencias y ajustes bancarios también registran
auditoría estricta dentro del writer compartido; el POST web legacy de transferencias ahora
delega a ese servicio. Si falla la auditoría, operación, saldo, obligación, reconciliación
y asiento hacen rollback.

**Continuación de auditoría (2026-10-04):** `createCuentaPorCobrarAction` y
`updateCuentaPorCobrarAction` registran con `logStrict` en la transacción de la mutación;
`createCuentaPorPagarAction` ahora agrupa creación y auditoría estricta en una transacción.
Los tests de action verifican persistencia de la auditoría y fallo de la operación ante
error del audit log. Estas pruebas unitarias no sustituyen rollback físico PostgreSQL.

Verificación: `reconciliar-servicio-real.test.ts` 23/23 incluye fallo SQL de auditoría;
`deudas-cash-real.test.ts` 14/14 verifica rollback del POST y del PUT web; unitarios de
deuda/préstamo/transferencia/ajuste verifican uso de `logStrict`;
`accounting-bank-transfers-real.test.ts` 9/9 verifica rollback por fallo de auditoría;
`operations-channels-http-real.test.ts` 4/4 cubre Bearer web/móvil y posteo formal.
`src/features/contabilidad/api/__tests__` pasó 7 archivos/43 tests después de añadir
los gates de CxC/CxP; la suite PostgreSQL completa repitió 51/299 y el typecheck pasó.

**Pendiente:** escritores no cash de otros dominios aún pueden usar `AuditLogService.log`
best-effort después del commit. No confundir esos logs de negocio con la auditoría
obligatoria de PeriodoGuard, probada aparte.

**Clasificación de los callsites restantes (2026-10-04):** un grep fresco cuenta 27
llamadas a `AuditLogService.log` en `src/`. Quince son Server Actions/rutas activas de
configuración (`actions-exchange.ts` 4; `actions-cierres.ts` 3;
`actions-tipos-pago.ts` 3; `actions-cuentas-bancarias.ts` 2; API de tipos de pago 3).
Todas hacen la mutación antes del audit call, sin pasar `tx`; `AuditLogService.log`
captura la excepción y devuelve `null`, por lo que incluso los usos con `await` son
best-effort y no atómicos. Son cambios de parámetros maestros/configuración, no los
writers de posteo cubiertos por R0.5.

Nueve llamadas pertenecen a exports legacy sin ruta/caller vigente encontrado
(`api/handlers.ts` 6; mutaciones en `api/exchange-handlers.ts` 3; sus rutas exchange
actuales solo leen). Tres llamadas de `features/admin/actions.ts` quedan fuera del scope
contable. Estos tres grupos requieren decisión de retiro o endurecimiento, pero no son
evidencia de writer contable vivo. El inventario de functions/callers se contrastó con
búsqueda del árbol; el MCP graph está desactualizado para algunos archivos eliminados.

Fuente: `src/lib/services/audit-log-service.ts:52-116` y writers contables restantes.

## Conciliación de documentación y aceptación

- Matriz: cabecera, nota vigente, apéndice y prueba reproducible concilian ahora en **32/19**.
- R6.1/R6.2 siguen pendientes en `tasks.md`: quedan calls de configuración best-effort,
  adaptadores/canales aún no certificados y FX no-CUP en writers distintos a los corregidos.
- R0.5 continúa [ ]; el inventario tiene 32 callsites, pero no todos están certificados por
  actor, política funcional, moneda bancaria nativa, fuente de tasa, evidencia persistida
  y rollback por canal.
- `createTransferencia` en `src/features/contabilidad/api/handlers.ts` no tenía
  callers en el graph ni en el árbol fresco; fue retirado el 2026-10-04. El endpoint
  vivo conserva el servicio canónico de transferencias; no se cableó el handler huérfano.
- Continuación de FX: `reconcileSale` ahora obtiene la moneda funcional tenant-scoped dentro
  de la transacción, mueve saldo en moneda nativa o funcional y persiste `montoCuenta`/
  `monedaCuenta`; cuenta tercera falla sin evidencia. POST web de ventas hace lo mismo para
  cuenta destino y origen. La migración `20261004150000_reconciliacion_venta_moneda_cuenta`
  añade pares de valores/códigos y constraints SQL.
- `applyPagoGastoWorkflow` ya no usa CUP por defecto: lee la política del tenant dentro de
  `tx`, falla si no existe, registra cada reconciliación con `logStrict` en la misma
  transacción y rechaza movimiento a cuenta tercera si falta tasa específica.
- La migración hace opcionales los pares de importe/currency de `ReconciliacionVenta` para
  conservar compatibilidad histórica. Solo `reconcileSale` servicio y POST web los rellenan
  por ahora; cash deuda/préstamo, capital y facturación aún requieren transportar su delta
  en moneda bancaria a la fila correspondiente. `ReconciliacionGasto` tampoco conserva ese
  par. Los CHECKs validan coherencia cuando hay datos, no completitud global.
- `createAnticipo` persiste su audit log estricto dentro de la transacción de fondos y asiento;
  las actions de abrir/cerrar/reabrir/aprobar período y la anulación de CxC también colocan
  `logStrict` junto a la mutación.
- Actualizar estados sólo después de cerrar los criterios anteriores y contrastar
  creación, actualización, ejecución, reversión y eliminación por canal vivo.

## Gate operativo independiente del cierre técnico

R7.3/R7.4 siguen pendientes: **7 días continuos de shadow para tenant autorizado**,
métricas/cobertura/conciliación verificables, aprobación explícita por tenant y
criterio de reversión. Tests verdes no sustituyen esa ventana. No se activó ningún
modo operativo ni replay durante esta revisión.

## Despliegue de migraciones — endurecimiento de runtime (2026-10-04)

Los arranques de producción ahora seleccionan `prisma migrate deploy` por defecto y
rechazan `PRISMA_MIGRATION_MODE=db-push`; después ejecutan
`scripts/ci/verify-accounting-sql-guards.mjs`, que falla si faltan triggers/checks/indexes
críticos. CI también ejecuta el verificador inmediatamente después de `migrate deploy`.
Los entrypoints y scripts de despliegue
dejaron de usar `db push --accept-data-loss` y de ocultar fallos antes de iniciar la
aplicación. `scripts/run-prisma-schema-sync.test.ts` pasa 3/3 y `sh -n` pasa para los
scripts modificados; el test contractual del verificador también pasa. El `db-push` por
defecto se conserva solo fuera de producción.

Esto **no acredita el estado de una base heredada** ni ejecuta cambios en producción.
La inspección local anterior mostró que una DB sincronizada con `db push` puede tener
las migraciones Prisma pendientes y carecer de triggers/checks que `db push` no
representa. El baseline actual solo imprime comandos `migrate resolve --applied`; no
prueba paridad del esquema ni la ejecución histórica de SQL. Antes de habilitar
que `migrate deploy` pueda completar en un entorno heredado se requiere respaldo, comparación por migración
de DDL/backfills/triggers/checks y un plan de baseline aprobado para ese target. Por
eso, el cumplimiento real por entorno y R7.2 siguen **sin verificar**.

## Verificación final de este corte — 2026-10-04

- PostgreSQL desechable: `pnpm test:integration` — **51 archivos / 299 tests aprobados**
  contra `tcp_test_devolucion_20261001:5433`; el runner aplica guards SQL idempotentes
  solo tras validar el target local desechable y ejecuta el verifier de triggers,
  constraints e índice de idempotencia antes de Vitest. El verifier pasó en esta corrida.
- Smoke de migraciones limpio: `prisma migrate deploy` aplicó **135/135 migraciones** en
  la DB nueva `tcp_test_migrate_guards_20261004`, PostgreSQL **17.6** en
  `127.0.0.1:5433`; `prisma migrate status` reportó *Database schema is up to date* y
  el verifier confirmó todos los guards contables requeridos.
- Unitarias completas después de esta continuación: **754 archivos / 4,894 tests
  aprobados, 1 omitido y 2 todo**.
- Tests focales de esta continuación: **30/30** reconciliación de venta,
  **12/12** workflow de gasto, **5/5** anticipos, **115/115** Server Actions/servicio de
  períodos y **6/6** anulación CxC. PostgreSQL: **25/25** entre ruta HTTP/idempotencia/rollback de
  audit log y flujos de anticipos.
- Calidad: `pnpm run typecheck`, `prisma validate`, ESLint focal de los archivos tocados,
  `git diff --check`, sintaxis shell y `graphify update .` completados. El contrato `data-access-allowlists.test.ts` y el
  de clasificación de modelos también pasan tras actualizar sus inventarios.
- `pnpm run typecheck:tests` sigue fallando por errores de tipos ya extendidos en
  fixtures/suites fuera de este slice (entre ellos contratos de acciones, fixture de
  reconciliación y varios tests de modelos Prisma); no se atribuye una compilación de
  tests TypeScript completa aunque Vitest sí quedó verde.
- El smoke acredita la cadena versionada desde cero en PostgreSQL 17.6 local; no despliega
  migraciones a otros entornos ni sustituye la verificación de baseline heredado o la
  cobertura restante de R0.5.
- `test:integration` instala los guards esperados desde su harness desechable para
  esquemas creados con `db push`; esto valida los contratos del harness y del verifier,
  mientras el smoke separado valida la cadena limpia; ninguno acredita que despliegues
  existentes estén alineados.
- La auditoría estricta quedó dentro de las transacciones en `reconcileService`, cash
  debts/loans (creación, pago y metadatos), reconciliación de ventas y gastos, creación de
  anticipos, transferencias, ajustes bancarios, transiciones formales de período y CxC
  anulación. El inventario global de FX/auditoría sigue incompleto para los writers listados
  en §2 y §8; no declarar R0.5/R6 cerrados por el set focal.

## Orden propuesto

1. Continuar la auditoría por writer de FX/moneda funcional y de auditoría best-effort
   restante, actualizando la matriz sólo con evidencia por canal.
2. Contrastar el inventario R0.5/R6 completo y sus transacciones con tests globales de
   autorización, FX y rollback antes de cambiar sus estados.
3. Verificar baseline heredado por entorno con comparación aprobada; no aplicar cambios
   a producción como parte de esta revisión.
4. Completar la ventana operativa R7.3 y aprobación R7.4.
