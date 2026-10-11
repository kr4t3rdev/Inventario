# Auditoría de correcciones y coherencia de cierre — 2026-10-07

> **Reconciliación de firma R0.5/G5 — 2026-10-11:**
> `reconciliacion-r05-g5-2026-10-11.md` firma G5 identidad/reintento cash para 18
> combinaciones y cierra las cuatro condiciones nominativas. Continuación: 78/78
> PostgreSQL y suite final ampliada 12/12; unit helper 9/9, typechecks/lint limpios.
> Se reprodujo/corrigió `PERIODO_CERRADO` en replay válido de las cuatro actions.
> El mapa R6 de 31 callsites ya existe. R0.5 sigue sin firma por A9/baseline/R6-R7.
> Continuación tras commit G5 `dd0d30c4`: evidencia física nueva R6 #4 (también #2),
> #5 y #15: POST cash/reconciliación con sesión real y auditoría SQL tardía; alta de
> deuda externa diferenciada de capital. Suites cash/capital 29/29 y reconciliación
> 4/4 en corridas separadas. R6 global conserva sus límites por variante y adapter.

> **ESTADO ACTUAL — 2026-10-11:** el dictamen vigente es la sección «Estado A9 actualizado —
> 2026-10-11» al final. Correcciones locales no son `31/31 PASS`;
> R0.5-ACCEPT no está firmada, R6-ROLLBACK global y baseline por entorno siguen abiertos,
> A9 permanece pendiente y la ventana R7 real no inició (no hay waiver de los siete días);
> no se certifica comparabilidad histórica global de
> snapshots. A10 de captura actual tiene evidencia focal verificada.

## Dictamen original — 2026-10-07 (histórico)

Este dictamen describe el corte original, no defectos vigentes. La reconciliación
actual al final documenta las correcciones verificadas y los gates aún abiertos.

**Hay correcciones reales, pero no se acredita el cierre global `31/31` ni R6 completo.**
Los reintentos secuenciales con clave de capital, ajuste y pago parcial de préstamo
funcionan en los casos cubiertos. Siguen brechas reproducidas de concurrencia,
payload incompleto, precisión funcional y contrato de venta-servicios. Parte de la
evidencia de períodos depende de cambios locales; el test de devengo directo no
acredita el rollback anunciado. La ventana llamada shadow REAL ejecuta al menos
una suite que fuerza `enforce`, por lo que sus métricas no certifican R7.3.

### Corte y alcance

- HEAD revisado: `395a4e9ba205aa504f061d15671efba53083237a`.
- Worktree compartido con cambios numerosos: se comparó HEAD con el árbol actual
  en períodos, orphans, matriz y pruebas. No se atribuye autoría de cambios locales.
- Documentos contrastados: `tasks.md`, `matriz-accept-r0.5.md`, auditoría del 06-10,
  diseño de snapshots y registro de ventana R7.3.
- Las pruebas aquí ejecutadas certifican el **worktree**, salvo archivos sin diff
  respecto de HEAD; no constituyen aceptación universal writer × canal × moneda.
- No se cambió lógica productiva, no se hizo commit ni se activó un modo operativo.

## Verificación ejecutada

En `tcp_test_g3_20261005`, PostgreSQL loopback 5432, se comprobó identidad SQL.
La base reutilizada carecía de columnas/tablas recientes. Se aplicaron directamente,
en transacciones SQL, estas migraciones aditivas solo al target desechable:

- `20261006010000_capital_idempotency_key`.
- `20261006100000_cxp_montos_funcionales`.
- `20261006120000_venta_servicios_idempotency`.
- `20261006150000_cash_snapshots_funcionales`.

Esto prepara fixtures; **no demuestra `migrate deploy` fresco ni baseline heredado**.
No se usó `db push --accept-data-loss` ni se modificaron entornos operativos.

Con `ALLOW_DISPOSABLE_TEST_DB=1` y las tres URLs iguales al target anterior:

| Verificación | Resultado | Alcance |
|---|---|---|
| Integración capital, pago parcial, ajuste, configuración, período | 5 archivos / 10 tests PASS | Replay secuencial y cambio de monto; rollback configuración/período actual |
| `cash-snapshots-real.test.ts` | 4/4 PASS | Copia, omisión y deduplicación por día según contrato local |
| Unitarios CxP create, CxC create/anular y writers-matrix | 4 archivos / 16 tests PASS | Contratos mockeados y conteo, no rollback físico CxP/CxC |
| `tsc --noEmit --incremental false`, heap 8192 | exit 0 | Tipos de aplicación |
| `pnpm run typecheck:tests` | exit 2 | Errores también en contabilidad, posting, FX y fixtures |
| `service-devengo-directo-real.test.ts`, aislado | 1 PASS / 1 FAIL | Happy path falla por usuario undefined; negativo pasa por el mismo error previo |
| Probe temporal adicional | Resultado histórico no reproducible | 8 aserciones de comportamiento y 1 contrato legacy; el archivo no está versionado. No cuenta como prueba verificable ni como GREEN actual. |

Comando base de integración: `pnpm exec vitest run --config
vitest.integration.config.mjs <rutas exactas>`. No se repitió toda la suite ni se
afirma que sus resultados históricos sigan vigentes.

Referencia histórica de un probe temporal no versionado (no está disponible en el árbol actual):
`/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/audit-closure-20261007-probe.test.ts`.
El path temporal documenta qué se intentó, no prueba que el archivo siga disponible ni
permite reproducir hoy el conteo exacto. No atribuirle un `9/9 GREEN` o usarlo como RED/GREEN
TDD confiable. El probe histórico usaba motor `off` únicamente en el proceso de prueba y
Prisma real; pretendía cubrir contratos de petición/persistencia, no asientos adicionales
en `enforce`.

## Cierres consistentes y límites

| Corrección | Evaluación |
|---|---|
| R6-LOGS, `7c3aa2e9` | **Consistente con su alcance representativo.** Test físico 2/2 confirma los cinco writers seleccionados. No representa 15 pruebas físicas individuales. |
| Idempotencia, `0fee6fe7` | **Cierre parcial válido.** Capital/pago parcial/ajuste deduplican replay secuencial con clave; el cambio de monto devuelve conflicto. No cierra payload completo, concurrencia ni UI/canales. |
| CxP/CxC strict, `2af8e4e7` | **Implementado y contratos unitarios verdes.** Falta aceptación física específica de auditoría para create/update/anular CxC y create CxP. |
| Snapshots cash, `395a4e9b` | **Consistente como servicio aislado de copia.** Integración 4/4. No acredita uso operativo en cierre ni conciliación histórica por fecha. |
| G4 / inventario | **Conteo confirmado.** Guard 1/1 acredita 31 callsites, no ocho dimensiones PASS por canal. |
| Devengo directo, `df90f984` | **Código/test reforzados, cierre no verificable actualmente.** El test happy path falla; el negativo acepta cualquier excepción previa. |
| R6-ORPHANS, código actual | **Disposición alineada en el corte actual.** Se verifican 9 mutadores legacy marcados junto a su definición (6 en `api/handlers.ts`, 3 en `api/exchange-handlers.ts`); la aceptación R6 no se infiere de ese inventario. |
| R6-BASELINE / R7 | **Plan y evidencia histórica parcial.** No equivalen a despliegue certificado por entorno ni ventana operativa medida. |

## Corte posterior de evidencia — 2026-10-07

Esta sección actualiza el estado de A1–A6 después del dictamen histórico anterior. Las
descripciones de los hallazgos A1–A6 se conservan como registro de lo que se reprodujo
en el corte previo; no deben leerse como el estado actual del worktree. La evidencia
nueva confirma correcciones focales, pero no firma `31/31`, no sustituye la aceptación
por adaptador y no cierra A8–A10.

| Hallazgo | Evidencia actual | Estado en este corte |
|---|---|---|
| A1 — venta-servicios | Actions: **40/40**; `typecheck` de aplicación verde. Se cubren las ramas de contrato idempotente y la respuesta estable según las suites actuales. | **Corrección focal verificada**; no equivale a aceptación global. |
| A2 — payload | Unitarios combinados A2/A3/A5: **84/84**; además **12 integraciones** verdes. El payload compara los campos funcionales documentados, sin convertir el conteo en cobertura universal. | **Corrección focal verificada**. |
| A3 — carreras | Incluido en los **84/84 unitarios** y las **12 integraciones** del bloque A2/A3/A5; el resultado actual cubre la resolución bajo lock y el replay/conflicto esperado. | **Corrección focal verificada**; no certifica todos los canales. |
| A4 — canales cash | `cash-actions` integración **4/4**, cubriendo altas, deuda y pagos parciales; los schemas incluyen `idempotencyKey`. | **Corrección focal verificada**; no cierra por sí sola altas y todos los adaptadores HTTP. |
| A5 — precisión funcional | Incluido en los **84/84 unitarios** y las **12 integraciones** del bloque A2/A3/A5. | **Corrección focal verificada**; quedan límites de aceptación global. |
| A6 — devengo directo | `service-devengo-directo-real.test.ts`: **2/2**; `service-credit-cxc-real.test.ts`: **2/2**. | **Corrección focal verificada** para esos flujos; no elimina los gates de rollback global. |
| Períodos | `periodo-rollback-real.test.ts`: **1/1** en el worktree actual. | **Evidencia focal**; A8 sigue abierta porque depende del commit/entorno y de cobertura física adicional. |

El `typecheck:tests` global continúa rojo (`exit 2`): quedan **65 errores fuera del
alcance contabilidad/contabilidad-formal/venta-servicios CxC** (app, admin, producción,
ventas y librerías). El filtro del alcance corregido queda en **0 errores**. Por tanto,
el typecheck de aplicación y los conteos focales anteriores no permiten declarar cerrada
la suite global de tests ni el gate R0.5.

La regresión focal introducida al tipar los fixtures se corrigió y la tanda de siete
suites formales queda en **194/194**; este resultado no elimina los errores globales
fuera de alcance.

### Corte posterior de evidencia A10 — 2026-10-07

Se corrigió la integración del snapshot cash con el cierre de período:
`CashSnapshotService.capturar` acepta el `Prisma.TransactionClient` del cierre y
`cerrarPeriodoAction` captura el estado cash dentro de la misma transacción
serializable, con `motivo=CIERRE_PERIODO` y `periodoId`. Si la captura o la auditoría
fallan, el cierre y sus snapshots revierten juntos. La captura sigue etiquetando el
estado funcional observado al instante (`fechaCorte = ahora`); no se presenta como
reconstrucción histórica por la fecha fin del período.

Evidencia actual en PostgreSQL desechable `tcp_test_a10_20261007`:

- `cash-snapshots-real.test.ts`: **4/4**.
- `periodo-rollback-real.test.ts`, `cierre-formal.test.ts` y
  `cierre-apertura-positiva.test.ts`: **8/8**.
- `pnpm run typecheck`: **exit 0** con heap explícito.

Esto cierra la brecha de caller transaccional de A10, pero A10 continúa abierta para
aceptación global porque aún no existe reconstrucción histórica por corte ni una
ventana operativa durable por tenant; la evidencia sigue siendo focal y el
`typecheck:tests` global permanece rojo.

### Corte posterior de evidencia G5 — contratos de clave en canales vivos

Se cerró la brecha reproducida de propagación de clave para capital y ajuste:

- `docs/openapi/mobile-v1.json` declara `idempotencyKey` en los cinco esquemas de
  petición afectados, manteniendo `additionalProperties: false`.
- Las rutas mobile de inyección de capital y ajuste bancario aceptan la clave del
  body o del header `Idempotency-Key`, con precedencia del body, y traducen
  `IDEMPOTENCY_CONFLICT` a HTTP 409.
- Los formularios web de capital y ajuste generan una clave por intento lógico,
  la conservan durante reintentos y la limpian después de éxito o cancelación.

Evidencia focal nueva: rutas mobile **14/14**, helpers de formularios **2/2**,
contrato OpenAPI **11/11**; tanda combinada **27/27**. `pnpm run typecheck`
termina en **0**. Esto acredita la propagación de la clave en estos canales, pero
no cierra G5 global: aún faltan la matriz completa de altas/pagos parciales por
canal y la ventana operativa R7.

En el frente de precisión de pagos, los modales web de préstamo y deuda aceptan
`step=0.0001`, muestran saldos y conversión con cuatro decimales y conservan una
clave por intento lógico durante el reintento. La prueba focal
`cash-payment-modal-precision.test.tsx` queda en **4/4**; `pnpm run typecheck`
continúa en **exit 0**. Esto corrige la pérdida de precisión observada en la UI,
sin convertirla en evidencia de cobertura global de G5.

### Corte posterior de evidencia A1 — replay de anticipos

Se corrigió la diferencia de contrato detectada en venta-servicios legacy:
cuando una venta a crédito incluye anticipos, el replay normal y el replay por
`P2002` reconstruyen `allocationsResult` leyendo los movimientos `EJECUCION`
persistidos de `AnticipoMovimiento`, sin volver a aplicar efectos.

Evidencia: `src/features/venta-servicios/__tests__/actions.test.ts` **42/42**,
incluyendo creación con anticipo, replay con la misma clave y carrera `P2002`;
`pnpm run typecheck` **exit 0**. La aceptación sigue siendo focal y no firma la
matriz global de writers.

## Hallazgos prioritarios

### A1 — Alta: venta-servicios no cierra su contrato idempotente

`src/features/venta-servicios/actions.ts:197–208, 304–320, 334–375` y
`schemas.ts:29–55`:

- Solo la rama mixta acepta/persiste clave. El schema legacy es `strict` y no
  declara `idempotencyKey`; el probe que la envía obtiene `success:false`, antes
  de crear una venta. Es falta de contrato, no un fallo de fixture SQL.
- Replay mixto secuencial devuelve un array (`existentes`), mientras que creación
  y recuperación P2002 devuelven `{ mode, lineasProcesadas, ventasServicios, ... }`.
  **Reproducido:** la respuesta de replay no contiene `mode: MIXED_LINES`.
- No compara payload ni cardinalidad de las líneas. **Reproducido:** cantidad
  1 → 2 con la misma clave devuelve éxito y la venta anterior de cantidad 1.
- No se encontró `idempotencyKey` en los componentes TSX de venta-servicios.

El cierre `95a7e837`/`0f2d3278` no acredita las dos ramas ni el contrato del cliente.

**Salida:** identidad estable en ambas ramas/clientes, hash canónico completo,
conflicto explícito y respuesta idéntica en creación/replay/carrera; tests por rama.

### A2 — Alta: payload de capital y ajuste incompleto

`accounting-operations-mutation-service.ts:468–472, 600–604` compara únicamente
importe, moneda, tipo y cuenta. Omite condiciones de deuda y fecha/FX.

**Reproducido:**

- Deuda externa: misma clave, `tasaInteres: 0 → 10`, devuelve éxito con la deuda
  anterior de interés cero.
- Ajuste: misma clave, `fechaOperacion: 2026-10-01 → 2026-09-01`, devuelve éxito
  con el ajuste de octubre.

En pago parcial, la huella (`accounting-cash-operations-mutation-service.ts:360–366`)
tampoco incluye `tasaCambio` ni observaciones. Esa omisión se constató en código;
no se ejecutó una reproducción FX específica de pago en esta auditoría.

**Salida:** canonicalizar todos los campos que definan la operación antes de
persistir y comparar. No equiparar «mismo monto» a «mismo payload».

### A3 — Media: las tres carreras no resuelven replay concurrente

Lookup fuera de transacción/lock en capital, ajuste y pago parcial:
`accounting-operations-mutation-service.ts:462–489, 594–616`;
`accounting-cash-operations-mutation-service.ts:357–383`.

**Reproducido dos veces:** dos llamadas simultáneas con una clave nueva producen
un éxito y un rechazo `P2002` en cada operación. Persiste una sola fila: **no se
reprodujo doble dinero bajo clave**, pero el perdedor no recibe replay/conflicto
de dominio y el route móvil lo trata como error interno 500.

**Salida:** reconsultar bajo el lock antes de escribir o recuperar la ganadora
después de rollback en una nueva transacción; nunca consultar una tx abortada.

### A4 — Alta: G5 sigue sin cubrir pagos parciales/altas por canal

- `registerCashDebtPayment` (`...cash-operations...:777–789`) sigue sin clave.
- `createCashLoan`/`createCashDebt` no tienen identidad durable de petición.
- `cash-actions-retry-real.test.ts:108–155` solo repite **pagos totales** y espera
  rechazo por estado. Eso no acredita replay de parciales ni altas.
- `components/prestamos-cash/pago-prestamo-modal.tsx:113–121` no envía clave;
  aceptar un campo opcional en la action no protege ese flujo real.
- Mobile payments (`cash-loans/[id]/payments/route.ts:9–20`) no mapea
  `IDEMPOTENCY_CONFLICT` a 409: cae en 400. El comentario del servicio que promete
  409 no basta para establecer el contrato HTTP.

**Salida:** matriz alta/pago parcial/pago final × web/action/mobile, identidad
durable emitida/conservada por el cliente y tests físicos por combinación viva.

### A5 — Alta: nueva acumulación funcional pierde precisión permitida

`accounting-cash-operations-mutation-service.ts:484–489, 899–904` redondea
acumulados nominales/funcionales a dos decimales con `ROUND_HALF_UP`.

**Reproducido en préstamo:** pago CUP `0.0123` aceptado y registrado, pero
`CuentaPorCobrar.montoPagadoFuncional = 0.01`. Contradice exactitud a cuatro
decimales de R0.1 y desalineará el snapshot respecto de la fuente.

La misma instrucción está en deuda cash; no se ejecutó ese probe separado.
**Salida:** conservar los cuatro decimales significativos; rechazar exceso
en vez de cuantizar y comprobar obligación, reconciliación, banco y snapshot.

### A6 — Alta para evidencia: rollback de devengo directo es falso positivo

`service-devengo-directo-real.test.ts:14–20` reemplaza `withAction` por el handler
sin inyectar usuario; invoca la action con solo input (`:117`, `:167`).
`with-period-validation.ts:63` accede a `user.tenantId` con usuario undefined.

**Repetido en proceso aislado:** happy path falla con TypeError y el negativo pasa
porque usa `rejects.toThrow()` genérico. No llega al INSERT del asiento bloqueado.
Además el negativo solo cuenta ventas; no verifica explícitamente CxC/asiento.

**Salida:** conservar wrapper real con getCurrentUser mockeado o pasar actor al
handler raw; exigir el error SQL específico y ausencia de todas las entidades.

### A7 — Media: disposición de orphans (resuelta documentalmente en el corte actual)

- El corte actual de `api/handlers.ts` y `api/exchange-handlers.ts` marca junto a su
  definición los nueve mutadores legacy con `@deprecated R6-ORPHANS`: seis handlers
  (`createInyeccionCapital`, `pagarDeudaCapital`, `createCierre`, `updateCierre`,
  `deleteCierre`, `createAjusteBancario`) y tres de exchange (`createMoneda`,
  `updateMoneda`, `createTasa`). Las lecturas `get*` no se cuentan como mutadores.
- Una búsqueda fresca del árbol `src/` no encuentra callers productivos de esos nueve
  símbolos; la disposición queda alineada en `tasks.md` y no requiere reetiquetar las
  lecturas legacy.

**Salida:** disposición nominativa de los nueve mutadores en código y checklist. Esto
resuelve A7 como coherencia documental; no cierra R6-ROLLBACK, R6-BASELINE ni R0.5.

### A8 — Media: R6-ROLLBACK depende del worktree y reduce aceptación

El período pasa 1/1 contra `actions-periodos.ts` local. `git diff HEAD` confirma
que `cerrarPeriodoAction` en HEAD todavía usa audit best-effort fuera del tx;
`logStrict(tx)` está en el cambio local. Otros cambios locales abarcan
abrir/reabrir/aprobar y formalización: no se certifica el commit con este test.

CxP/CxC strict sí está commiteado. El corte actual añade
`cuentas-audit-rollback-real.test.ts` (**1/1**) contra PostgreSQL, con trigger SQL que
revierte `createCuentaPorPagarAction`, `createCuentaPorCobrarAction`,
`updateCuentaPorCobrarAction` y `anularCuentaPorCobrarAction`; esto fortalece la
evidencia focal, pero no reemplaza el criterio global ni la prueba contra el
commit/entorno de períodos. Baseline por entorno continúa sin evidencia actual completa.

### A9 — Alta para aceptación operativa: shadow REAL no es ventana acreditada

`r73-ventana-real.md` convierte counts de tests en eventos, afirma p95 <500 ms,
cero huecos y conciliación exacta sin adjuntar mediciones durables por tenant.
`merma-formal-real.test.ts:42` fuerza `CONTABILIDAD_FORMAL_MODE = 'enforce'`
independientemente del entorno externo. Su fixture también crea su propio tenant.

Por tanto las tandas de merma **no demuestran tráfico shadow del tenant declarado**.
El runbook/template sí existen; R7.3/R7.4 siguen correctamente `[ ]` en tasks.
La contradicción está en la evidencia que se pretende usar para completarlos.

**Salida:** medir outbox real por tenant/writer/fecha/modo y latencia registrada;
no convertir tests aislados, y menos pruebas enforce, en siete días de operación.

### A10 — Media: snapshots correctos como copia, integración incompleta (hallazgo original; histórico)

`cash-snapshot-service.ts:59–86, 145–150` lee ambas fuentes y cuenta/inserta sin
un snapshot transaccional común. Las estadísticas `creados = despues - antes`
pueden atribuir al caller inserciones de otra captura concurrente.

Solo se encontraron referencias productivas al servicio en su definición; los
callers encontrados son tests. No está conectado al cierre/conciliación.
`fechaCorte` etiqueta estado leído ahora, sin reconstrucción histórica ni filtro
temporal: puede guardar datos actuales con un día pasado/futuro. La prueba usa
un día futuro para representar «corte nuevo», no espera un corte operacional.

**Salida original:** distinguir explícitamente captura actual de reconstrucción histórica,
integrar el caller de cierre y certificar lectura coherente/carreras. No declarar
comparabilidad histórica global con los 4 tests del servicio aislado. La reconstrucción
por fecha describe una capacidad distinta y no constituye un requisito del A10 original.

## Incoherencias documentales y gates

- `tasks.md:2543–2559`: el inventario es 31/31, pero la firma global está reabierta;
  el conteo no certifica ocho dimensiones PASS.
- `tasks.md` (sección R6): R6-ORPHANS queda como disposición documental verificada,
  mientras R6-ROLLBACK/R6-BASELINE siguen pendientes; no se declara R6 completo.
- `matriz-accept-r0.5.md:105–115`: G2 tiene check pero conserva pendientes C3.
- `matriz-accept-r0.5.md:136–147`: promete idempotencia de los seis adaptadores;
  sus pruebas citadas no cubren parciales/altas por petición.
- La matriz aún dice que «no es certificación» y «no cierra R0.5-ACCEPT», mientras
  tasks usa ese documento como evidencia de firma.
- `typecheck:tests` sigue rojo; existen errores dentro del alcance contable.
  El typecheck de aplicación verde no permite declararlo resuelto.

## Orden recomendado de corrección

1. Resolver contrato de venta-servicios, payload completo y precisión funcional.
2. Resolver carreras de clave y completar identidad/UI/status HTTP por canal cash.
3. Reparar el test de devengo directo y certificar rollback específico CxP/CxC.
4. Consolidar la implementación local de períodos y disposición exacta de orphans.
5. Sincronizar los estados de matrices/checklist con evidencia por dimensión.
6. Integrar/certificar snapshots, baseline fresco/heredado y mediciones reales R7.
7. Resolver tipos de tests y limpieza de fixtures antes de una nueva firma global.

El informe del 06-10 queda como evidencia histórica. Este informe actualiza el
dictamen sobre las correcciones posteriores; no convierte los cierres parciales
válidos en inexistentes ni los amplía a escenarios no probados.

## Adenda de correcciones verificadas — 08-10-2026

La revisión del worktree en `feat/contabilidad-capa-formal` añadió evidencia focal,
sin reabrir la firma global:

- **Capital:** fingerprint normalizado por payload y recuperación concurrente acotada;
  integración PostgreSQL **4/4**. OpenAPI documenta el header `Idempotency-Key`, su
  precedencia frente al body y límites; contrato **12/12**.
- **Ajustes y cash:** integración PostgreSQL de ajustes **5/5**; acciones cash **10/10**,
  incluyendo carreras de pagos parciales con clave compartida. Los pagos de `0.0123 CUP`
  persisten en cuatro decimales y modifican una vez el saldo bancario; CxP/CxC real **16/16**.
- **Venta-servicios:** claves nuevas usan un prefijo versionado inequívoco; un advisory
  lock PostgreSQL por tenant y clave original, seguido de relectura dentro de la misma
  transacción, evita que payloads divergentes concurrentes creen dos ventas. Pruebas reales
  en BD desechable **3/3**: payload divergente rechazado, payload igual reproducido por
  ambos requests con una sola venta y fecha histórica divergente rechazada. Acciones y
  allowlist SQL **51/51** combinadas. El replay mixto,
  aceptación legacy del key, conflicto secuencial por payload y conservación del key en
  los dos clientes UI ya estaban corregidos en el corte actual. Sigue pendiente el
  fallback de filas históricas sin fingerprint para anticipos, vencimiento y override;
  esos campos aún no se comparan de forma completa. Tampoco se amplía el claim a payloads
  de todos los writers. En esta continuación se retiraron los catches de P2002 que
  consultaban posibles ganadoras fuera del lock; bajo el contrato actual, un error único
  ajeno ya no puede convertirse en replay exitoso; la regresión exige preservar el código
  `P2002`. Unitarios focales y allowlist **47/47**; pruebas físicas devengo + carrera
  idempotente/devengo **5/5**. Para filas históricas, el comparador ahora consulta estado
  persistido de CxC, anticipos y override; la prueba física cubre fecha de vencimiento, no
  todavía el movimiento/auditoría real. Si un override histórico no dejó evidencia, la
  comparación falla cerrada: esa fila puede no reproducir incluso el mismo payload, porque
  el intento original no puede reconstruirse con certeza.
- **Devengo directo:** el mock autenticado válido ya estaba en `HEAD 5184610f`; el hallazgo
  de `user` undefined era histórico en este corte. La prueba actual exige el error del
  trigger durante el INSERT de asiento, compara snapshots de venta/CxC/asiento y ejecuta
  limpieza visible; PostgreSQL **2/2**. Esto no certifica `AsientoLinea` ni el rollback
  global de writers.
- **Calidad:** `pnpm run typecheck` pasó y `git diff --check` quedó limpio. Una invocación
  amplia accidental de Vitest fue detenida; sus fallos no se consideran evidencia de los
  tests focales y no se declara la suite completa verde.

**Gates que permanecen abiertos:** R0.5-ACCEPT, R6-ROLLBACK global, R6-BASELINE por
entorno heredado, R7.3/R7.4 de operación real por siete días, snapshots históricos y
el fallback legacy de venta-servicios. El conteo de 31 callsites sigue siendo inventario,
no 31/31 en ocho dimensiones.

### Revalidación de A4/G5 — 08-10-2026

La revisión del código actual demuestra que cuatro afirmaciones originales de A4 ya son
obsoletas: los escritores de alta y pago cash ya persisten identidad por petición; los
formularios/modales web propagan una clave por intento; y las rutas móviles de pago leen
la clave del body o `Idempotency-Key` y mapean conflicto a HTTP 409. No se usa esa corrección
de código para afirmar aceptación completa de G5.

- PostgreSQL desechable: acciones cash + deudas cash **26/26** combinadas en dos archivos,
  incluyendo altas y replays/carreras de pagos parciales; precisión `0.0123` queda validada
  en la suite de deuda.
- Ruta móvil de pago de préstamo: prueba focal **3/3**, cubre precedencia body sobre header,
  fallback al header y respuesta 409 por `IDEMPOTENCY_CONFLICT`.
- Sigue faltando evidencia física/HTTP del transporte de clave en todos los adaptadores web
  y móvil, además de la matriz completa operación × canal para altas, pagos parciales y pagos
  finales. Por eso **G5 global permanece abierto**; el 26/26 de acciones no lo certifica.

### Revalidación del fallback histórico de venta-servicios — 08-10-2026

El replay de claves antiguas sin fingerprint ya compara, bajo la misma transacción y tenant,
el núcleo de la venta y los registros relacionados de vencimiento, movimientos `EJECUCION`
de anticipos y evidencia estricta `CREDITO_OVERRIDE`. Unitarios de acciones: **47/47**;
prueba PostgreSQL añadida: conflicto por fecha de vencimiento divergente. La evidencia física
no prueba todavía divergencias de anticipos ni de override. Cuando no existe evidencia que
permita reconstruir un campo no predeterminado, el fallback rechaza el replay para evitar un
falso éxito; eso deja una compatibilidad histórica conservadora y debe tratarse como gate,
no como cierre total del contrato legacy.

### Actualización final de esta pasada — 08-10-2026

Esta actualización reemplaza los recuentos y límites de la revalidación anterior de
venta-servicios; no modifica los gates globales.

- Namespace nuevo `v2`: prefijo de al menos 141 caracteres, superior al máximo de 140
  de una clave histórica válida persistida. Regresión RED/GREEN para `a` frente a
  `v1:YQA:<hash>`; revisión independiente sin bloqueo de namespace.
- Replay histórico simple: contrasta vencimiento, movimientos ejecutados de anticipos
  y evidencia de override. PostgreSQL acredita divergencias de esos campos.
- Replay histórico mixto: ahora contrasta CxC por venta, vencimiento y auditoría de
  override dentro de la transacción. Crédito mixto histórico sin auditoría falla cerrado:
  no puede reconstruirse si el request original pidió un override innecesario.
- Verificación directa: acciones + allowlist **57/57**; PostgreSQL idempotencia + devengo
  **6/6** (4 pruebas de idempotencia y 2 de devengo). La prueba mixta acredita replay
  idéntico con CxC/auditoría persistidos; no certifica todos los adaptadores.
- `typecheck:tests` mantiene 68 diagnósticos en el último corte, sin errores en los tres
  archivos de venta-servicios intervenidos. No se declara suite global verde.
- La última entrega del worker falló por un 403 del servicio de agentes; el código
  existente se verificó directamente. La revisión independiente final del comparador
  mixto queda pendiente; no se amplía el cierre global.

R0.5-ACCEPT, R6-ROLLBACK global, R6-BASELINE, G5 global, R7 operacional y snapshots
históricos siguen abiertos. No se hizo commit ni push.

### Continuación verificada — 08-10-2026

- Revisión independiente del comparador mixto terminada: sin otros hallazgos en CxC,
  vencimiento, origen de auditoría o tenant. Detectó el caso inverso en legacy simple;
  corregido con RED/GREEN: crédito histórico sin evidencia rechaza también intención
  default. Otra revisión confirmó que CONTADO y replay con hash permanecen intactos.
- Corregidos ocho diagnósticos en seis tests contables. `typecheck:tests` baja de 68 a
  **60 diagnósticos restantes**; no quedan errores en esos seis archivos. El chequeo
  global continúa fallando, no se declara resuelto.
- Verificación directa: **68 unitarios aprobados y 2 TODO** en cuatro archivos,
  **30 PostgreSQL aprobados** en seis suites. Los tests UI emiten advertencias de act;
  no se presenta la corrida como libre de advertencias. Typecheck de aplicación PASS.
- La ejecución física encontró que compras FX esperaba un envelope mientras su mock
  devolvía datos crudos. Ahora utiliza `withAction` productivo y contexto autenticado;
  los negativos exigen `INTERNAL_ERROR`, el mensaje exacto del trigger en el error
  registrado y los snapshots originales de rollback. Suite de compras **7/7**.

Estos resultados sustituyen los recuentos anteriores, no cierran R0.5-ACCEPT, G5,
R6-ROLLBACK global, R6-BASELINE, R7 operacional ni snapshots históricos.

### Evidencia focal G5 — ajuste bancario móvil (08-10-2026)

- `POST /bank-adjustments` resuelve replays antes del control de período, conservando
  autenticación, tenant, feature y permiso. El helper usa el mismo advisory lock
  transaccional que el writer; una lectura simple no bastaba para commits pendientes.
- Sin clave, se conserva el control de período; payload keyed inválido devuelve 400.
  Replay idéntico después de cerrar período devuelve la operación previa; payload
  divergente devuelve 409; operaciones nuevas siguen bloqueadas por período cerrado.
- Verificación directa: ruta + servicio **51/51 unitarios**; canales HTTP reales
  **6/6 PostgreSQL**, incluyendo header-only, saldo/filas/asientos sin duplicación y
  espera observable del lock. Revisión fresca final sin bloqueos en este alcance.
- Cuatro suites de contratos de ventas corregidas: **26/26 PostgreSQL**. La suite
  venta-crédito se repitió junto con canales HTTP: **13/13** combinadas.
- Typecheck de aplicación y ESLint focal PASS. `typecheck:tests` conserva **55
  diagnósticos restantes**, cero en los archivos de estas dos correcciones.

Este slice acredita el adaptador móvil de ajustes, no todos los adaptadores G5.
R0.5-ACCEPT, G5 global, R6-ROLLBACK global, R6-BASELINE, R7 operacional y snapshots
históricos permanecen abiertos. No se hizo commit ni push.


### Evidencia focal adicional — 2026-10-08: pagos móviles de deuda cash

- Replay con clave resuelto antes del gate de período bajo el mismo lock del writer;
  mantiene permisos, tenant y deuda indicada por la ruta. Payload divergente: 409;
  nueva operación en período cerrado: rechazada.
- Fecha explícita incluida en huella, conciliación y FX; fechas ISO imposibles
  (por ejemplo 2026-02-30) rechazadas antes de normalización. Retorno de replay
  conserva la fila completa. Revisión fresca final sin bloqueadores focales.
- Verificación directa final: **27/27 unitarios** ruta/servicio y **23/23 PostgreSQL**
  deuda legacy + HTTP móvil. Reparaciones unitarias de compras: **55/55**.
- Snapshot actual de `typecheck:tests`: **44 diagnósticos**; existen cambios
  concurrentes ajenos a este slice, por lo que la reducción no se atribuye toda
  a esta corrección. No equivale a typecheck global aprobado.
- Pendientes: alinear fecha/replay en OpenAPI y SDK de deuda, y resolver el gate
  previo al replay en pagos móviles de préstamos. G5 y cierre global siguen abiertos.
- Sin commit ni push.


### Corte focal previo a regeneración — 2026-10-08: préstamos móviles y contrato pagos cash (histórico)

- Replay móvil de préstamo resuelto antes del gate de período, con reread tras
  rechazo; helper y writer comparten lock de tenant y controles de permisos.
  ID de ruta autoritativo. Fecha explícita participa en hash, conciliación y FX.
- Ambos pagos cash exigen fecha ISO válida; timestamps requieren Z/offset.
  Claves normalizadas de 1–64 caracteres verificadas en rutas y servicio.
- OpenAPI/documentación y 20 archivos SDK de pagos regenerados para ambos
  canales: fechaOperacion, idempotencyKey y header Idempotency-Key.
- Verificación directa final: **56/56 unitarios** (rutas/servicio/contrato/hardening),
  **4/4** regresiones SDK focales y **29/29 PostgreSQL** (préstamos HTTP, deudas
  HTTP y deuda legacy). Revisión fresca sin bloqueadores focales.
- Typecheck aplicación y **typecheck:tests PASS** en snapshot actual. Existen
  reparaciones concurrentes ajenas; no se atribuye todo el cambio a este slice.
- Corte previo a regeneración completa: se observaban cuatro expectativas de 110
  operaciones frente a 125 y artefactos ajenos obsoletos; `git diff --check` registró
  espacios finales en documentación Dart/Swift. La ausencia SDK de 15 operaciones queda
  supersedida por la verificación posterior (125 únicas, 46/46 paridad, 3/3 smoke); no
  presentar ese corte como actual. El whitespace es una observación histórica no revalidada.
- G5 global, R0.5-ACCEPT, R6 global/baseline, R7 operacional y snapshots históricos
  siguen abiertos. Sin commit ni push. (Gates globales vigentes; no incluye el pendiente
  SDK de 15 operaciones, que quedó supersedido por la regeneración posterior.)


### Corte previo a regeneración del alcance SDK — 2026-10-09 (supersedido)

En ese corte previo se observaban 110 operaciones SDK frente a 125 en OpenAPI,
incluidas 15 operaciones Admin ausentes. Este estado queda supersedido por la
regeneración/verificación posterior registrada en la reconciliación vigente: los cuatro
SDKs alinean 125 operaciones únicas, 46/46 paridad y 3/3 smoke. No se afirma compilación
completa de todos los lenguajes ni aceptación global.

Siguiente evidencia R6: creación de préstamo cash con AuditLog real. La suite
existente mockea logStrict y su rollback bloquea asientos; no acredita falla física
del INSERT de AuditLog para ese writer. Nueva prueba física en preparación.


### R6-ROLLBACK focal — 2026-10-09: creación préstamo cash / AuditLog real

- Nueva suite `cash-loan-create-audit-rollback-real.test.ts`: **2/2 PostgreSQL**
  verificados directamente. Sin mock de AuditLogService. Happy path acredita
  banco, préstamo, CxC, conciliación, asiento con líneas y AuditLog durable.
- Trigger físico de AuditLog filtrado por actor único y entidad PRESTAMO_CASH;
  se exige el mensaje exacto del error. Falla de creación con clave única.
- Después de una creación exitosa preexistente, se compara snapshot completo
  normalizado de banco, préstamos, CxC, conciliaciones, asientos/líneas y auditoría
  antes/después del fallo; también se conservan conteos/saldo. Revisión fresca
  confirma rollback real del estado original, no falso positivo anterior al INSERT.
- `typecheck:tests` PASS. Evidencia focal solo para creación de préstamo con clave;
  vínculo de conciliación en creación sin clave se investiga por separado.
- No cierra R6 global ni los gates operacionales; sin commit/push.


### Corrección trazabilidad cash — 2026-10-09

- Creaciones de préstamos/deudas, canónicas y legacy, vinculan ahora siempre
  la conciliación del desembolso al ID de la entidad creada, con o sin clave,
  dentro de la misma transacción. Historial de pagos conserva filtros de tipo.
- RED confirmado: creación sin clave no efectuaba actualización FK. GREEN:
  **22/22 unitarios**, **35/35 PostgreSQL** en cuatro suites (HTTP préstamos/deudas,
  deuda legacy y rollback AuditLog de creación préstamo). `typecheck:tests` PASS.
- Se corrigieron dos contratos legacy que esperaban FK null; las aserciones
  de FX y asientos permanecen. Revisión fresca no halló explotación tenant ni
  regresión: el ID actualizado proviene de una fila tenant-scoped recién creada
  en la misma transacción; no es una referencia de reconciliación del usuario.
- Verificación focal, no cierre global; pendientes SDK global y gates previos
  siguen abiertos. Sin commit/push.


### R6-ROLLBACK cash físico — 2026-10-09

- Nueva suite `cash-writers-audit-rollback-real.test.ts`: **6/6 PostgreSQL**
  para loan payment/debt create/debt payment canónicos y sus tres handlers legacy.
  AuditLogService, Prisma y posting reales; solo autenticación estabilizada en test.
- Happy path acredita AuditLog durable y asiento con líneas. Trigger real de
  AuditLog filtra actor/entidad únicos y error exacto; snapshots completos incluyen
  banco, préstamo/deuda, CxC/CxP, conciliación, asientos/líneas, período/cache y auditoría.
- Verificación directa combinada con préstamo create: **8/8 PostgreSQL**; revisión
  fresca sin bloqueadores. Se corrigió typing del mock y restauración env en finally.
- No afirmar R6 global: faltan dimensiones/writers ajenos al alcance probado.

Pendientes G5 concretos identificados (no solo etiqueta global): los cuatro POST
legacy cash de alta/pago ignoran claves porque sus schemas no las incluyen y
escriben directamente; los dos POST móviles de altas validan período antes de
replay y carecen de prueba HTTP de conflicto. La UI actual usa Server Actions,
pero los endpoints legacy permanecen activos. Siguiente corrección por adaptadores.
Sin commit/push; no cierre 31/31.


### G5 focal — 2026-10-09: cuatro adaptadores HTTP legacy cash

- POST alta/pago de préstamos y deudas ahora aceptan claves body/header de
  1–64 caracteres; body tiene precedencia e ID de ruta permanece autoritativo.
  Replay bajo lock tenant antes del gate de período; nuevas escrituras con
  clave delegan al servicio canónico. Sin clave se conserva la rama compatible.
- Helpers de altas comparten fingerprint completo, controles de acceso, lock y
  búsqueda tenant-scoped de entidad vinculada. La misma fecha interna capturada
  se valida y persiste; no se incluye el reloj generado en la huella idempotente.
- Verificación directa: **77/77 unitarios**, **38/38 PostgreSQL** (legacy préstamo,
  deuda y rollback AuditLog). Header-only, replay de alta/pago parcial/final,
  conflicto y no duplicación; precedencia body/header en pruebas de adaptador.
  Revisión fresca final sin bloqueadores. Typecheck aplicación PASS; se reparó
  un diagnóstico TS7031 nuevo en el test y typecheck:tests PASS.
- Replay histórico de pago mantiene permisos/tenant/clave/ID aunque la entidad
  se haya eliminado lógicamente; no se trata como una mutación nueva.
- Pendiente G5 concreto siguiente: los dos POST móviles de altas siguen gateando
  período antes de replay y usan aliases de fecha que el writer no persiste.
  Deben validar la fecha real de posteo; añadir replay/conflicto HTTP post-cierre.
- Diff focal limpio; diff global sigue con whitespace SDK generado. Sin commit
  ni push; no certifica G5 global ni 31/31.

## Reconciliación documental vigente — 2026-10-09

Esta sección prevalece como resumen de estado sobre afirmaciones globales de cortes
anteriores, que se conservan como evidencia histórica con su fecha y alcance. No invalida
resultados focales reproducibles ni los extiende más allá de lo probado. **Dictamen:
aceptación global no demostrada.** El conteo de 31 callsites permanece como inventario;
no hay `31/31` en ocho dimensiones. R0.5-ACCEPT, R6-ROLLBACK global, R6-BASELINE por
entorno heredado, G5 global y R7.3/R7.4 operacional siguen abiertos; no se certifica
comparabilidad histórica global de snapshots. A10 tiene evidencia focal de captura actual.
No activar `shadow`, `enforce` ni replay por estas correcciones.

| Hallazgo original | Estado documental vigente | Evidencia y límite |
|---|---|---|
| A1 — contrato idempotente de venta-servicios | **Corrección focal verificada; aceptación global abierta.** | PostgreSQL focal de 5 casos: la clave histórica `v1:YQA:<hash>` persiste como `raw:hash` bajo el límite `<140` y reejecuta el ID original; clave cruda `a` crea venta distinta; cantidad 2 divergente da conflicto sin filas extra. Integrado en bundle separado cash+servicios de 17/17 PostgreSQL (cash 12, servicios 5), typecheck/revisión PASS, sin cambio productivo. No acredita todos los adaptadores ni escritores. |
| A2 — identidad/payload de capital y ajustes | **Correcciones focales verificadas; aceptación global abierta.** | Pruebas focales de payload y ajuste no certifican todas las combinaciones writer × canal. |
| A3 — carreras/replay concurrente | **Corregido en los flujos probados; cobertura global abierta.** | Resultados focales PostgreSQL y lock/relectura no implican paridad de todos los adaptadores. |
| A4 — G5, claves por canal cash | **Correcciones focales verificadas; G5 global abierto.** | Mobile create: 14/14 unitarias, 19/19 PostgreSQL, pruebas/typecheck PASS; snapshots ampliados de entidad/líneas y revisión final sin bloqueos funcionales. Recheck legacy tras rechazo de período: RED funcional 5 fallos → GREEN 13/13 unitarios, revisión sin bloqueos; baseline PostgreSQL 32 PASS, no reproduce determinísticamente la carrera. UI/lifecycle: root confirma 7/7, `typecheck:tests` y revisión PASS, suite separada sin cambio productivo. Bundle original: 8 suites unitarias/112 PASS + 14 suites PostgreSQL/89 PASS; claves fixture >64 se corrigieron acortando solo prefijo y conservando UUID. Evidencia PostgreSQL adicional cash/servicios: 12+5=17/17, typecheck/revisión PASS, sin código productivo. Cash valida USD 0.0123×300=3.6900 funcional, débito/crédito 3.69, retry igual mismo ID; FX 301 u observación divergente conflictúan con snapshot completo sin mutaciones. Resta distinguir evidencia focal de aceptación global. El probe temporal de 9 casos no versionado no soporta un claim reproducible 9/9 GREEN. |
| A5 — precisión funcional | **Corrección focal verificada; aceptación global abierta.** | PostgreSQL cash confirma monto original 0.0123 USD, valor funcional 3.6900 CUP a tasa 300, saldo bancario ±3.69 y asiento cuadrado débito/crédito 3.69; retry idéntico no duplica. Esto no prueba toda moneda/escritor/adaptador ni firma R0.5. |
| A6 — rollback de devengo directo | **Corrección focal verificada; R6 global abierto.** | La prueba física de devengo directo acredita solo ese flujo; no sustituye rollback físico global. |
| A7 — writers huérfanos | **Disposición documental verificada.** | Nueve mutadores legacy están marcados como huérfanos; esto no acredita rollback, baseline ni aceptación de writers activos. |
| A8 — períodos/rollback y baseline | **Cobertura física focal ampliada; R6/baseline siguen abiertos.** | Préstamo create 2/2 PG + seis writers cash canónicos/legacy 6/6 PG (8/8); operaciones bancarias `accounting-bank-transfers-real.test.ts` 12/12 PG cubren AuditLog rollback para `createBankAdjustment`, `createCapitalInjection`, `registerCapitalPayment`. Además, cinco suites focales (`formal-shadow-cash-sale.test.ts`, `devolucion-fifo.test.ts`, `reconciliar-servicio-real.test.ts`, `http-real-idempotencia.test.ts`, `anticipos-fx-real.test.ts`) validación independiente **57/57 PostgreSQL** y `typecheck:tests` PASS. Las cuatro pruebas no relacionadas con venta acreditan failpoint físico de AuditLog. En venta, el failpoint `PRICE_OVERRIDE` sucede antes de FIFO; el error separado de asiento COGS sí demuestra rollback después de FIFO, pero no un fallo de AuditLog tardío. Revisión independiente sin bloqueadores. La brecha de evidencia se acota a ese orden de AuditLog de venta más las dimensiones/writers restantes del inventario; no se afirma bug. Baseline por entorno heredado sigue sin acreditar. |
| A9 — ventana R7 real | **Pendiente.** | Hace falta operación observada por siete días; tests, DB desechable y shadow sintético no acreditan tráfico real. |
| A10 — snapshots cash | **Verificado en alcance focal de captura actual.** | Caller de cierre transaccional, lectura coherente y races verificados en PostgreSQL; la captura congela el estado visible al instante. Reconstrucción histórica por fecha y comparabilidad histórica global no se afirman ni son requisito de A10. R0.5-ACCEPT permanece sin firma por sus gates globales. |

### Gates concretos vigentes

- **R0.5-ACCEPT:** sin firma. Las ocho dimensiones deben aceptarse por writer y adaptador
  vivo; no se deriva el cierre del número de filas ni de los checks focales de la matriz.
  Además, se reabrió idem/retry de la solicitud de venta POS (`contra_pago`, MIXTO y crédito):
  `createVentaSchema` no acepta clave de request y cada llamada a `VentaMutationService.create`
  inserta una `Venta` nueva. La unicidad del origen formal para un `ventaId` persistido no
  deduplica un retry que genere otro ID. Evaluar por separado los demás callers del workflow.
- **R6-ROLLBACK:** abierto. Cinco suites focales validadas independientemente **57/57
  PostgreSQL** y `typecheck:tests` PASS, además de las coberturas de préstamo/cash y
  operaciones bancarias ya citadas. Cuatro failpoints nuevos de AuditLog son físicos.
  El de venta falla en `PRICE_OVERRIDE` antes de FIFO; el failpoint separado de asiento
  COGS prueba rollback post-FIFO, pero no AuditLog tardío posterior a esos efectos. Es
  una limitación de alcance de evidencia, no un bug demostrado. R6 global y R6-BASELINE
  siguen abiertos.
- **R6-BASELINE:** abierto por entorno heredado. Baseline local y SQL guards en DB
  desechable no prueban adopción/despliegue en cada entorno.
- **Corte histórico G5 / SDK global:** en este punto se observaban 15 operaciones Admin
  ausentes de los SDK. Esa ausencia quedó supersedida por la regeneración/verificación
  posterior de 125 operaciones únicas (46/46 paridad, 3/3 smoke); G5 global sigue abierto
  por cobertura de adaptadores, no por esa brecha SDK ya resuelta.
- **R7.3/R7.4:** abierta hasta completar siete días de telemetría de operación real.
- **Snapshots:** A10 está verificado para la captura del estado actual; no confundirla
  con reconstrucción histórica por fecha ni con comparabilidad histórica global. La
  reconstrucción no es un requisito del A10 original.

Las dos rutas móviles de alta cash están implementadas; el responsable verificó 14/14 unitarias,
19/19 PostgreSQL, typecheck y pruebas PASS. La revisión final confirma snapshots ampliados de
entidad y líneas y no encuentra bloqueos funcionales en esas rutas. La clave de venta-servicios
`v1:YQA:<hash>` se conserva como `raw:hash` bajo el máximo 140 y replaya el ID original; el
valor crudo `a` crea venta aparte y cantidad 2 divergente se rechaza sin filas extra. El recheck de replay tras
rechazo de período en los cuatro POST legacy cash quedó implementado: RED funcional de 5 fallos,
GREEN 13/13 unitarios y revisión fresca sin bloqueos. La línea base PostgreSQL 32/32 PASS no
reproduce la carrera determinísticamente, así que el cierre de este contrato de carrera tiene
evidencia unitaria, no una prueba física determinista. El bundle global focal original reportó
8 suites unitarias/112 PASS y 14 suites PostgreSQL/89 PASS; dos claves fixture excedían el límite
y se corrigieron únicamente acortando el prefijo, preservando UUID; el rerun 89/89 pasó.

El worker implementó además 7 tests de retención de clave antigua en componentes de préstamo,
deuda, formulario de servicio y carrito; root confirmó **7/7 PASS**, `typecheck:tests` PASS y
revisión fresca final sin falsos positivos. Este slice focal no cambió comportamiento productivo
y es una suite independiente: no sumar esos siete tests al bundle de 112 unitarios/89 PostgreSQL
como si provinieran de la misma corrida. Un probe RED temporal de 9 casos no quedó versionado:
no afirmar 9/9 GREEN. FX física de pagos cash, colisión de observaciones y colisión de namespace
ahora cuentan con los dos archivos PostgreSQL focales (cash 12 tests, servicios 5; 17/17 total),
además de sus pruebas unitarias. En cash, FX independiente 301 u observación divergente generan
conflicto, con snapshots completos de préstamo/deuda, banco, CxC/CxP, reconciliación,
asiento/líneas y auditoría sin cambios. La clave histórica `v1:YQA:<hash>` replaya el mismo ID;
`a` es namespace distinto y cantidad 2 divergente no añade filas. Typecheck y review final
PASS; no hubo cambio productivo. El primer intento se detuvo antes de tests por typo de entorno
y guard de seguridad; cuenta únicamente el rerun corregido 17/17, sin atribuir RED. No se cierra
G5 global ni se alteran R0.5/R6/baseline/R7/snapshots.
La reconciliación de esta pasada fue documental: no se ejecutaron suites.


### Actualización focal 2026-10-09 — receipt de creación de ventas

El backend compartido `VentaMutationService.create` admite una clave opcional de
1–64 caracteres. Reserva un receipt único por tenant/clave antes de validar el catálogo
dentro de la misma transacción y conserva una respuesta original inmutable. Un replay
idéntico devuelve esa respuesta; cambios en el payload normalizado generan conflicto.
Las fechas del resultado se restauran como `Date`; el snapshot sobrevive a la eliminación
de la venta mediante `SetNull`. Esta retención es una decisión del contrato de replay,
no una certificación de políticas de conservación de datos.

Evidencia focal: RED previo por clave descartada y segunda creación; 39/39 pruebas
unitarias/ventas/allowlist y 5/5 PostgreSQL del receipt. Root repitió los 5/5 PostgreSQL
antes del ajuste final de normalización; el implementador repitió 5/5 después.
Typechecks de aplicación y pruebas, ESLint focal y validación Prisma aprobados.
Revisión fresca sin bloqueo de corrección; su observación sobre equivalencia
null/omisión fue corregida y cubierta por regresión.

**Pendiente:** propagar una clave estable por intención desde todos los callers/UI,
contratos HTTP/OpenAPI y SDKs correspondientes. La compatibilidad sin clave no
deduplica solicitudes. La matriz idem/retry sigue abierta, no se firma 31/31.
`migrate deploy` devolvió P3005 en la BD desechable no baselined: solo se aplicó SQL
aditivo del receipt para validar fixtures; no hay prueba de despliegue/historial
de migraciones. La reducción del diff de schema conservó el fingerprint de capital
y las nuevas relaciones/receipt; no se guardó un snapshot completo previo al formateo.

### Rectificación final de evidencia — 2026-10-09

Esta rectificación prevalece sobre los pendientes focales contradictorios de las notas
anteriores; mantiene abiertos los gates globales y conserva el registro histórico.

- **Receipt de venta / canales web:** la limitación previa de falta de receipt y los
  resets del corte anterior están corregidos en el alcance verificado. En la BD
  desechable `tcp_test_sale_receipt_20261009_304c4083` se aplicaron 145 migraciones y
  se comprobaron uniques, nullable `SetNull`/`Cascade`; receipt PostgreSQL 5/5. Los
  cinco callers web llevan clave estable; seis suites de HTTP/web pasaron 26/26, y
  enhanced/pedido RTL 4/4. Body/header, precedencia y 409 quedan cubiertos. El test de
  moneda cubre cancelación/reintento con la clave, no rotación tras éxito; no hay prueba
  de retención tras recarga completa. No se establece un requisito nuevo sobre esos casos.
  **Estado de este corte, supersedido por la actualización focal posterior:** el caller
  nativo `mobile/src/SalesSurface.tsx` se consideraba sin clave. La verificación siguiente
  acreditó ese caller específico; callers/adaptadores restantes no verificados siguen abiertos.
- **SDK y OpenAPI:** la nota previa que afirmaba 110 operaciones en SDK y 15 ausentes
  queda supersedida: la regeneración completa dejó los cuatro SDK con las 125 operaciones
  únicas fuente exacta. El checker compara conjuntos de nombres sin usar `Set` para
  ocultar duplicados. La corrida independiente root de `pnpm run openapi:check` terminó
  exit 0: lint, 46/46 paridad, 3/3 smoke y verificación determinista de generación del
  árbol completo. Se preservó `pnpm-lock.yaml`; se verificó build TypeScript. Dart,
  Gradle y kotlinc no estaban disponibles: no declarar sus compilaciones. Hubo 1.293
  archivos tracked y 281 nuevos dentro del alcance generado; el verificador no ignora
  cambios extra/faltantes salvo el lock auxiliar TypeScript previsto.
- **Cash móvil:** el pendiente previo de replay/fecha en los dos POST móviles de altas
  está corregido en el checkout concurrente: replay antes del gate de período, fecha
  confiable persistida y relectura tras denegación. Es evidencia focal y no cierre de G5.
- **Receipt/backend y pruebas:** el backend tiene 39 pruebas unitarias/ventas/allowlist
  y 5/5 PostgreSQL; la revisión fresca final no encontró bloqueos funcionales tras la
  normalización `null`/omisión y la corrección del campo nullable. No atribuir despliegue
  productivo ni asumir que toda distribución de SDK fue compilada.
- **Rollback:** las cinco suites focales del bundle R6 pasan 57/57 PostgreSQL. El fallo
  `PRICE_OVERRIDE` de venta antecede FIFO; el error SQL de asiento COGS sí prueba rollback
  posterior a FIFO, pero no es un failpoint tardío de AuditLog. No se encontró un
  `AuditLog` tardío productivo que deba inventarse o exigirse; R6 global y baseline por
  entorno continúan abiertos.

R0.5-ACCEPT, G5 global, R6-ROLLBACK global, R6-BASELINE por entorno heredado y R7 de
siete días siguen abiertos. No se afirma 31×8, deploy productivo,
ni activación de `shadow`, `enforce` o replay global.


### Actualización focal 2026-10-09 — historia limpia y canales web

La limitación P3005 indicada en la actualización anterior corresponde al fixture
preexistente, no al resultado de esta verificación nueva: se creó la base desechable
`tcp_test_sale_receipt_20261009_304c4083` en `127.0.0.1:5433` y se aplicaron
**145 migraciones completas**, incluida `20261009110000_venta_create_idempotency`.
Se verificaron uniques tenant/clave y venta, nulabilidad del snapshot y FKs
Cascade/SetNull; la suite de receipt pasó **5/5** sobre esa historia limpia.
Esto acredita historia y comportamiento local, no un despliegue a otro entorno.
El verificador evitó leer `.env` sustituyendo `process.loadEnvFile` únicamente
en el proceso CLI; utilizó URLs explícitas y guard de base desechable.

Canales web actuales: POS y cuatro callers Server Action transportan una clave
por intención; cuerpo prevalece sobre encabezado, clave inválida devuelve 400
y conflicto devuelve 409 en los adaptadores browser/mobile. Root repitió seis
suites focales: **26/26**. La revisión detectó resets silenciosos al cerrar un
borrador, vaciar el carrito o cancelar la confirmación de moneda después de un
resultado incierto; fueron eliminados. El descarte explícito limpia borrador y
clave. Root comprobó los dos componentes renderizados: **4/4** (pedido 3, formulario
con moneda 1). El test de moneda acredita cancelación y reintento con clave retenida;
no prueba rotación después de éxito, aunque el código la realiza antes de navegar.
Las claves permanecen en memoria durante el montaje; no se acredita recuperación
tras recarga completa. **Corte histórico previo a la verificación nativa:** el caller
`mobile/src/SalesSurface.tsx` se consideraba pendiente. Esa frase quedó supersedida
por la actualización focal posterior de 2026-10-09, que verificó el caller nativo
específico; los callers/adaptadores no verificados siguen fuera del alcance.

OpenAPI y el slice sale-create de cuatro SDK exponen cuerpo/encabezado, replay y
409; 9 pruebas focales y lint/build TypeScript aprobados, Kotlin helpers opcionales
compatibles verificados por firmas y generación, no compilación Kotlin. **Corte
histórico previo a la regeneración completa:** se habían observado 110 frente a 125
operaciones SDK. Esa brecha quedó supersedida por la verificación fechada posterior
que reporta los cuatro SDK alineados con las 125 operaciones únicas (46/46 paridad,
3/3 smoke y generación determinista); no se afirma compilación de todos los SDK ni
cierre global.

### Actualización focal vigente — caller nativo POS — 2026-10-09

Las menciones anteriores que dejaban `mobile/src/SalesSurface.tsx` sin clave quedan
supersedidas para el caller verificado en el checkout móvil separado. La superficie usa
clave estable por intención pendiente y el adaptador de `sales-api` la envía en
`Idempotency-Key`, manteniendo intacto el body. Un guard sincrónico cubre taps rápidos;
fallo/conflicto o edición del payload conserva la clave para un reintento fail-closed;
éxito la limpia antes de refrescar la lista. La clave tiene forma de UUID de 36 caracteres,
pero la generación observada usa `Math.random`: identificador opaco, no secreto ni
criptográficamente seguro.

Evidencia directa: **505 PASS y 4 omitidos en 109 archivos** en la corrida root; typecheck
nativo PASS (sesión 14695, exit 0); writer focal **14/14** en cuatro archivos; dos pruebas
RTL cubren retry renderizado y doble tap; revisión fresca final sin bloqueos. Cuatro pruebas
E2E de dispositivo se omitieron: no se afirma verificación en dispositivo. La clave es
memoria por componente montado y no se afirma recuperación tras navegación/remount/recarga.
El test de moneda del canal web citado arriba sigue siendo el límite de su propia cobertura;
no es evidencia nativa ni requisito de persistencia.

El caller nativo deja de ser un gap conocido; la propagación por callers no comprobados y
la aceptación global siguen abiertas. No convierte esto en 31/31 ni firma G5/R0.5, R6,
baseline por entorno, R7 operacional o snapshots históricos, ni autoriza activar modos.

### Reconciliación A10 vigente — captura actual verificada — 2026-10-09

El hallazgo A10 de las líneas originales 308–322 se conserva como corte histórico; su
salida se interpreta como tres condiciones verificables: distinguir captura actual de
reconstrucción histórica, integrar el caller de cierre y probar coherencia/races. La
reconstrucción histórica por fecha no es requisito de A10 y no se usa para dejarlo abierto.

Estado actual: `CashSnapshotService` lee CxC y CxP dentro de `Serializable` y persiste
ambas fuentes en esa misma transacción. El cierre formal entrega su mismo
`Prisma.TransactionClient`, por lo que falla/captura parcial revierte con el cierre. La
prueba de carrera del same-cut arroja conteos exactos **2 creados/0 existentes** y
**0 creados/2 existentes**; la prueba con update concurrente entre lecturas acredita que
los snapshots CxC y CxP no mezclan versiones. Suite física **6/6 PostgreSQL**, suite
unitaria **5/5**, cierre y rollback **8/8**, ambos typechecks y `git diff --check` PASS.
Revisión fresca independiente sin bloqueadores; reejecución independiente confirmó 6/6
PostgreSQL y 5/5 unitarios sobre base PostgreSQL 17.11 aislada.

La transacción standalone del servicio reintenta la operación completa hasta tres intentos
solo ante `P2034`/`40P01`; cuando recibe el tx del caller, propaga el error y no reintenta
la transacción ajena. Resultado: **A10 verificado en alcance focal de captura del estado
actual**, no evidencia de reconstrucción por fecha ni de comparabilidad histórica global.
R0.5-ACCEPT, R6 global, baseline heredado y R7 de siete días siguen abiertos.

### Estado A9 actualizado — 2026-10-11

Ante la alternativa del usuario de descartar o dejar pendiente Shadow, se registra la decisión
conservadora de dejar A9 **pendiente**, no descartado ni eximido. La ventana operativa real
R7.3/R7.4 **no ha iniciado**: las corridas de tests y sus métricas históricas no equivalen a
tráfico legítimo ni comienzan el reloj. El Preview aislado terminó en estado terminal
`ERROR/ENOENT` antes de completar las validaciones planificadas; no hay resultados verificables
de build/tests que permitan aceptar este gate. No se concede waiver del requisito de siete días
ni del gate de release. El scope de despliegue cloud queda suspendido y no se harán nuevos
intentos; los recursos Railway existentes quedan intactos y no hay autorización para apagarlos.

Esto no revoca la evidencia ni el cierre de correcciones focales ya documentadas, pero tampoco
los convierte en aceptación global: R0.5-ACCEPT/31×8, G5 global, R6 global/baseline y R7
permanecen abiertos. No se activa `shadow`, `enforce` ni replay.

### Validación focal A6 — devengo directo de venta de servicio — 2026-10-11

La prueba `src/features/venta-servicios/__integration__/service-devengo-directo-real.test.ts`
se ejecutó únicamente contra la base PostgreSQL local desechable `tcp_test_local`
(rol `arturo`, puerto 5433): **2/2**. El caso positivo persistió la venta, su CxC y
un asiento. El caso de rollback instaló un trigger PostgreSQL real `BEFORE INSERT`
en `asientos`, recibió el error exacto `asiento bloqueado` (SQLSTATE `22012`) y
comparó sin diferencias los snapshots completos de ventas, CxC y asientos antes y
después. `pnpm run typecheck:tests` y `git diff --check` focal terminaron sin errores.
La prueba cubre este writer/camino específico; no demuestra rollback para los 31
callsites ni para cada combinación de dimensión. R6-ROLLBACK global sigue pendiente
del mapeo callsite→transacción/failpoint físico para los 31 writers inventariados y
de la evidencia específica que corresponda a cada uno. No se demostró un bug global,
no se exige un failpoint de AuditLog tardío que no exista y no se infiere aceptación
31×8, R0.5-ACCEPT, R6-BASELINE ni R7.

### Revalidación focal de regresión — 11 archivos PostgreSQL — 2026-10-11

En el worktree compartido vigente (`feat/contabilidad-capa-formal`; sin atestación de
commit), se ejecutó de forma secuencial el batch focal de los hallazgos referenciados.
La identidad local se comprobó en lectura: rol `arturo`, base `tcp_test_local`, host
loopback `127.0.0.1`, puerto `5433`, `pg_is_in_recovery=false`. Antes de iniciar no había
un proceso Vitest activo. Se usó `vitest.integration.config.mjs` directamente, que desactiva
archivos `.env` (`envFile: false`) y serializa workers (`maxWorkers: 1`, `fileParallelism:
false`); no se invocó `pnpm test:integration` ni su preparación de base desechable.

Comando y entorno explícito (sin contraseña):

```bash
ALLOW_DISPOSABLE_TEST_DB=1 \
DATABASE_URL='postgresql://arturo@127.0.0.1:5433/tcp_test_local' \
DATABASE_URL_TEST='postgresql://arturo@127.0.0.1:5433/tcp_test_local' \
DIRECT_URL='postgresql://arturo@127.0.0.1:5433/tcp_test_local' \
pnpm exec vitest run --config vitest.integration.config.mjs \
  src/features/venta-servicios/__integration__/service-idempotency-race-real.test.ts \
  src/features/contabilidad/__integration__/capital-idempotency-real.test.ts \
  src/features/contabilidad/__integration__/ajuste-idempotency-real.test.ts \
  src/features/contabilidad/__integration__/pago-parcial-idempotency-real.test.ts \
  src/features/contabilidad/__integration__/cash-actions-retry-real.test.ts \
  src/features/contabilidad/__integration__/cash-snapshots-real.test.ts \
  src/features/ventas/services/__integration__/facturacion-workflow-venta-credito-real.test.ts \
  src/features/venta-servicios/__integration__/service-devengo-directo-real.test.ts \
  src/features/contabilidad/__integration__/cash-loan-create-audit-rollback-real.test.ts \
  src/features/contabilidad/__integration__/cash-writers-audit-rollback-real.test.ts \
  src/features/contabilidad/__integration__/periodo-rollback-real.test.ts
```

Resultado actual: **11/11 archivos, 59/59 pruebas**. Conteos por archivo: `service-idempotency-race-real`
5; `capital-idempotency-real` 4; `ajuste-idempotency-real` 5; `pago-parcial-idempotency-real`
3; `cash-actions-retry-real` 12; `cash-snapshots-real` 6; `facturacion-workflow-venta-credito-real`
12; `service-devengo-directo-real` 3; `cash-loan-create-audit-rollback-real` 2;
`cash-writers-audit-rollback-real` 6; `periodo-rollback-real` 1. `pnpm run typecheck`,
`pnpm run typecheck:tests` y `git diff --check` terminaron correctamente.

Este batch aporta evidencia vigente de los casos focales de los hallazgos cubiertos por estas
pruebas en el árbol de trabajo actual. No sustituye ni confirma el probe histórico no versionado
de 9 casos, la matriz global 31×8, G5 global, el baseline R6/R0.5, ni R7; tampoco constituye
una auditoría nueva del contrato público de adaptadores o del mock `withAction`. A9 permanece
pendiente según el estado registrado arriba. No se editaron código ni otras documentaciones, no
se recreó la base y no se utilizó cloud.
