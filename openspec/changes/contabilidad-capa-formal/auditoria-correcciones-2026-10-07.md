# Auditoría de correcciones y coherencia de cierre — 2026-10-07

## Dictamen

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
| Probe adicional | 9/9 RED | 8 aserciones de comportamiento y 1 contrato legacy sin soporte de clave |

Comando base de integración: `pnpm exec vitest run --config
vitest.integration.config.mjs <rutas exactas>`. No se repitió toda la suite ni se
afirma que sus resultados históricos sigan vigentes.

Probe conservado fuera de la suite:
`/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/audit-closure-20261007-probe.test.ts`.
Para reproducir, restaurarlo temporalmente bajo
`src/features/contabilidad/__integration__/` y ejecutar la config de integración.
Usa motor `off` únicamente en el proceso de prueba y Prisma real; prueba contratos
de petición/persistencia, no asientos adicionales en `enforce`.
Tras ambas corridas: cero tenants del probe y cero triggers audit/asiento temporales
consultados. Las suites anteriores de capital/ajuste/período aún dejan fixtures.

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

### A10 — Media: snapshots correctos como copia, integración incompleta

`cash-snapshot-service.ts:59–86, 145–150` lee ambas fuentes y cuenta/inserta sin
un snapshot transaccional común. Las estadísticas `creados = despues - antes`
pueden atribuir al caller inserciones de otra captura concurrente.

Solo se encontraron referencias productivas al servicio en su definición; los
callers encontrados son tests. No está conectado al cierre/conciliación.
`fechaCorte` etiqueta estado leído ahora, sin reconstrucción histórica ni filtro
temporal: puede guardar datos actuales con un día pasado/futuro. La prueba usa
un día futuro para representar «corte nuevo», no espera un corte operacional.

**Salida:** distinguir explícitamente captura actual de reconstrucción histórica,
integrar el caller de cierre y certificar lectura coherente/carreras. No declarar
comparabilidad histórica global con los 4 tests del servicio aislado.

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
