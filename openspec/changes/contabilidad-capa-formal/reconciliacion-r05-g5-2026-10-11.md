# Reconciliación y dictamen de firma R0.5/G5 — 2026-10-11

## Dictamen y procedencia

**G5 firmado para identidad/reintento de las 18 combinaciones cash; firma global
R0.5-ACCEPT retenida.** La continuación cerró las cuatro condiciones nominativas y
reprodujo/corrigió el bloqueo de replay post-cierre en las cuatro actions. Esta firma
certifica el alcance detallado abajo; no es un acta `31 × 8 PASS`.

- Verificador: agente OpenCode, sesión `ses_ed5d804d0ffe0YPOrinAXLfcKy`.
- Checkout: `feat/contabilidad-capa-formal`, HEAD
  `54d0c801a0d34a32d31a37b6cd043eb39dbe4a86`, con cambios locales compartidos.
- La evidencia certifica los archivos presentes durante las corridas, no exclusivamente
  HEAD ni un artefacto desplegado. No hay atestación de un commit limpio.
- G5 materializado en commit `dd0d30c4` durante la continuación solicitada por el usuario.
  Los resultados pertenecen al checkout compartido; el commit no convierte el entorno
  en limpio ni valida cambios ajenos que siguen pendientes.
- Criterios: sección R0.5 de `tasks.md`, `matriz-accept-r0.5.md` y requisitos modificados
  del spec de generación de asientos, idempotencia, valoración y gobernanza de períodos.
- A9/R7, baseline por entorno y R6 global conservan sus gates vigentes.

## Evidencia ejecutada

Identidad SQL comprobada en la revisión precedente de esta misma sesión: `tcp_test_local`,
rol `arturo`, `127.0.0.1:5433`, sin recovery. Las integraciones usan
`vitest.integration.config.mjs`, `envFile: false`, un worker y archivos secuenciales.
No se ejecutó preparación/reset de base, migraciones ni despliegue cloud.

| Corrida | Resultado | Alcance |
|---|---|---|
| Revalidación precedente, 12 suites PostgreSQL | 70/70 PASS | Idempotencia, carreras, precisión, snapshots, anticipos, facturación y rollback focal; incluye 12 casos cash actions. |
| Nueva corrida G5, siete suites PostgreSQL | 66/66 PASS | Actions/core cash, rutas legacy/móviles y sesión Bearer real. |
| Nueva corrida UI/móvil, cinco archivos | 42/42 PASS | Lifecycle de clave de pagos/servicios y cuatro adaptadores móviles con dependencias mockeadas. |
| Nueva corrida del adaptador legacy, un archivo | 13/13 PASS | Body/header, límites, replay antes del período y relectura tras rechazo. |
| Typechecks aplicación/tests, revisión precedente | Ambos exit 0 | `--noEmit --incremental false`, heap 8192 MB. |
| Inventario de writers, revisión precedente | 1/1 PASS | 31 invocaciones en 19 archivos; comprobación estructural. |
| Continuación G5, ocho suites PostgreSQL | 78/78 PASS | Siete suites anteriores más `cash-g5-acceptance-real.test.ts` (12 casos). |
| Suite G5 final, tras ampliar parcial/final móvil y denegaciones | 12/12 PASS | Actions reales, JWT/sesión HTTP reales, snapshots de efectos y carreras legacy deterministas. |
| Helper replay y guard, dos archivos unitarios | 16 PASS, 2 TODO | 9 casos helper y 7 casos guard; los TODO preexistentes no cuentan como PASS. |
| Cobertura focal del helper (9 casos) | 100% líneas/statements/funciones; 92,85% ramas | Solo `cash-action-replay.ts`; no cobertura global del módulo. |
| Typechecks aplicación/tests y ESLint focal, continuación | Exit 0 | Heap 8192 MB; lint de los cinco archivos de código modificados/añadidos. |

Son corridas separadas con tests compartidos: no sumar sus resultados como pruebas
independientes ni como una suite global. Los logs esperados de casos negativos no son
fallos de suite. El primer typecheck sin heap explícito agotó memoria; la repetición con
8192 MB terminó correctamente.

Desglose PostgreSQL de la nueva corrida: ACT 12; LW 15; DW 17; LM 9; DM 10;
`prestamos-cash-pago-auth-http-real.test.ts` 2;
`deudas-cash-auth-http-real.test.ts` 1. Total: siete archivos / 66 casos.

### Comandos de esta pasada

Desde el checkout de contabilidad, configurar `ALLOW_DISPOSABLE_TEST_DB=1` y las tres
URLs (`DATABASE_URL`, `DATABASE_URL_TEST`, `DIRECT_URL`) con la identidad local indicada.
No se usan archivos `.env`.

```bash
pnpm exec vitest run --config vitest.integration.config.mjs \
  src/features/contabilidad/__integration__/cash-g5-acceptance-real.test.ts \
  src/features/contabilidad/__integration__/cash-actions-retry-real.test.ts \
  src/features/contabilidad/__integration__/prestamos-cash-pagar-real.test.ts \
  src/features/contabilidad/__integration__/deudas-cash-real.test.ts \
  src/features/contabilidad/__integration__/cash-loans-http-real.test.ts \
  src/features/contabilidad/__integration__/cash-debts-http-real.test.ts \
  src/features/contabilidad/__integration__/prestamos-cash-pago-auth-http-real.test.ts \
  src/features/contabilidad/__integration__/deudas-cash-auth-http-real.test.ts

pnpm exec vitest run --maxWorkers=1 --no-file-parallelism \
  src/features/contabilidad/components/__tests__/ui-idempotency-lifecycle.test.tsx \
  src/app/api/mobile/v1/accounting/cash-loans/__tests__/route.test.ts \
  src/app/api/mobile/v1/accounting/cash-debts/__tests__/route.test.ts \
  'src/app/api/mobile/v1/accounting/cash-loans/[id]/payments/__tests__/route.test.ts' \
  'src/app/api/mobile/v1/accounting/cash-debts/[id]/payments/__tests__/route.test.ts'

pnpm exec vitest run --maxWorkers=1 --no-file-parallelism \
  src/app/api/contabilidad/__tests__/legacy-cash-idempotency.test.ts
```

La primera selección unitaria incluía también el nombre inexistente
`cash-idempotency-routes.test.ts`: se ejecutaron solo cinco archivos (42 casos).
El sexto archivo real, `legacy-cash-idempotency.test.ts`, se localizó y ejecutó aparte
(13 casos). No se declara una corrida de seis archivos.

## G5: matriz nominativa de identidad/reintento

**V** = comportamiento indicado verificado; **P** = evidencia parcial o de otro nivel;
**N** = no hay prueba identificada de esa combinación. `V` no significa las ocho
dimensiones ni todos los payloads/monedas posibles.

Suites en `src/features/contabilidad/__integration__/`:
**ACT** `cash-actions-retry-real.test.ts`; **LW** `prestamos-cash-pagar-real.test.ts`;
**DW** `deudas-cash-real.test.ts`; **LM** `cash-loans-http-real.test.ts`;
**DM** `cash-debts-http-real.test.ts`; **G5** `cash-g5-acceptance-real.test.ts`.

| Entidad | Operación | Adaptador | Estado de identidad/reintento y evidencia |
|---|---|---|---|
| Préstamo | Alta | Action `createPrestamoCashAction` | **V**: G5 invoca schema/wrapper reales; misma clave concurrente, mismo ID, replay post-cierre, conflicto y clave nueva rechazada; snapshot de efectos idéntico. |
| Deuda | Alta | Action `createDeudaCashAction` | **V**: G5, mismo alcance; sin comprobante adjunto. No certifica almacenamiento externo de archivos. |
| Préstamo | Pago parcial | Action `registrarPagoPrestamoAction` | **V**, período abierto: ACT prueba replay, carrera con misma clave y conflictos FX/observaciones sin cambios persistidos. |
| Deuda | Pago parcial | Action `registrarPagoDeudaAction` | **V**, período abierto: ACT prueba replay, carrera y conflictos FX/observaciones. |
| Préstamo | Pago final | Action `registrarPagoPrestamoAction` | **V**: G5, pago parcial 5/final 15; respuesta keyed idéntica post-cierre, conflicto y clave nueva rechazada sin efectos. |
| Deuda | Pago final | Action `registrarPagoDeudaAction` | **V**: G5, mismo alcance. |
| Préstamo | Alta | POST legacy `/prestamos-cash` | **V**: LW, header-only, mismo ID en replay y 409 por monto divergente. Auth real en suite separada. |
| Deuda | Alta | POST legacy `/deudas-cash` | **V**: DW invoca el POST con clave y prueba replay/conflicto. Auth real en suite separada. |
| Préstamo | Pago parcial | POST legacy `/prestamos-cash/[id]/pagar` | **V**: LW, replay con mismo ID/saldo y 409 por payload divergente. |
| Deuda | Pago parcial | POST legacy `/deudas-cash/[id]/pagar` | **V**: DW, replay/conflicto de la ruta. |
| Préstamo | Pago final | POST legacy `/prestamos-cash/[id]/pagar` | **V**: LW, replay con mismo ID tras completar y sin reconciliación adicional. |
| Deuda | Pago final | POST legacy `/deudas-cash/[id]/pagar` | **V**: DW, replay del pago final keyed, sin duplicación. |
| Préstamo | Alta | POST móvil `/cash-loans` | **V**: LM, replay post-cierre y 409 divergente con snapshots sin cambios. |
| Deuda | Alta | POST móvil `/cash-debts` | **V**: DM, replay post-cierre/conflicto, sin entidad ni efectos adicionales. |
| Préstamo | Pago parcial | POST móvil `/cash-loans/[id]/payments` | **V**: LM replay/clave nueva; G5 confirma respuesta idéntica y 409 divergente físicos post-cierre. |
| Deuda | Pago parcial | POST móvil `/cash-debts/[id]/payments` | **V**: DM prueba replay post-cierre, payload divergente y nueva clave bloqueada. |
| Préstamo | Pago final | POST móvil `/cash-loans/[id]/payments` | **V**: G5, respuesta final keyed idéntica post-cierre y 409 divergente; snapshot sin efectos nuevos. |
| Deuda | Pago final | POST móvil `/cash-debts/[id]/payments` | **V**: G5, mismo alcance. |

Resumen vigente: **18 combinaciones V**, con los límites explícitos de cada celda.
G5 amplía también los pagos parciales action con replay/conflicto post-cierre.
Auth HTTP real se prueba invocando handlers con `NextRequest` y sesión persistida, no
mediante un servidor Next y transporte de red end-to-end.

### Condiciones de firma G5

- [x] **G5-SA-ALTA:** altas/replay/conflicto/carrera por `createPrestamoCashAction` y
  `createDeudaCashAction`, con schemas/wrappers reales y autenticación controlada. Comparar
  ID, banco, obligación, reconciliación, asiento/líneas y auditoría; el core no sustituye
  las dos celdas de action.
- [x] **G5-FINAL-KEY:** replay keyed/conflicto de pago final por las dos actions y las
  dos rutas móviles, sin efectos adicionales.
- [x] **G5-SA-PERIODO:** contrato de replay tras cerrar período en las cuatro actions.
  RED inicial: cuatro fallos `PERIODO_CERRADO`, dos casos móviles PASS. GREEN:
  `runCashActionWithReplay` resuelve replay autorizado antes del guard y conserva
  schema/feature/permiso/tenant; usa la misma fecha en validación y writer. Relee ante
  rechazo de período protegido; no encubre fallos de infraestructura/posting.
- [x] **G5-ADAPTER-CIERRE:** prueba física de las carreras legacy de replay/rechazo de
  período que tienen prueba unitaria, y conflicto físico del pago móvil de préstamo.
  G5 interpone un commit PostgreSQL real entre lookup inicial y guard real que observa
  el cierre, para altas y pagos de ambas entidades. Es intercalado determinista mediante
  spy del helper, no carrera de red ni simulación del resultado del guard. Snapshots
  incluyen banco, entidades, obligaciones, reconciliaciones, asientos/líneas, AuditLog y
  outbox; no incluyen sesión ni caché/estado del período, que cambian deliberadamente.

La UI probada conserva claves de pagos durante retry. Los siete casos lifecycle incluyen
servicios y no certifican por sí solos los formularios de alta cash.

## R0.5: cruce con el inventario vigente

El mapa de **31 callsites** ya existe en `matriz-writers-r0.5.md`, sección R6. No es
necesario recrearlo. Estos números son los del mapa vigente, no los de filas históricas
o tombstones de la matriz larga.

| Dimensión / grupos | Estado reconciliado |
|---|---|
| Actor/permiso, tenant | Cash HTTP tiene evidencia de sesión/denegación; actions usan actor controlado. Esta pasada no revalida todos los checks históricos de otros grupos. |
| Origen y transacción | Inventario 31/19 y pruebas físicas focales; contar llamadas no demuestra cada frontera/adapter. |
| Moneda/FX | Cash y la revalidación precedente verifican sus valores persistidos; no equivalen a aceptación universal por moneda/canal. |
| Idem/retry | El claim cash global se sustituye por las 18 combinaciones y condiciones anteriores. POS/backend/web/nativo conservan sus evidencias fechadas, sin extender a callers no comprobados. |
| Posting/auditoría, rollback | #8 compra-servicios inicial, #21 servicio mixto y #24/#25/#26 facturación tienen evidencia física nueva verificada. R6 global permanece parcial por rama/adapter. |

### Continuación R6 tras el commit G5

| Corrida PostgreSQL | Resultado | Evidencia nueva |
|---|---|---|
| `cash-g5-acceptance-real.test.ts` + `accounting-bank-transfers-real.test.ts` | 29/29 PASS (16 + 13) | Altas legacy préstamo/deuda con y sin clave, JWT/sesión reales y AuditLog SQL después del asiento; alta DEUDA_EXTERNA diferenciada de capital con rollback tardío. |
| `http-real-idempotencia.test.ts` | 4/4 PASS | Reconciliación legacy de venta con CxC, JWT/sesión reales, fallo AuditLog 22012 después de observar su asiento y snapshot completo sin cambios. |

Los failpoints exigen que el asiento ya sea visible dentro de la transacción; si el orden
cambiara, lanzarían `22023` y la prueba fallaría. Auth real significa invocación de handlers,
no transporte de red. G5 tenía 12 casos en la firma; la suite ampliada añade cuatro casos
R6 y ahora tiene 16. Esta continuación no constituye aceptación global de R6.

Rectificaciones y límites concretos:

- **#5 reconciliación legacy de ventas:** la evidencia CxC del core/ruta sigue separada;
  la continuación aporta ahora el failpoint de auditoría tardía en el POST exacto con
  sesión real. Variante focal con CxC USD→CUP; no aceptación de todos los canales.
- **#4 alta legacy de préstamo:** ahora el POST exacto con sesión real y ambas ramas
  keyed/no-key tiene rollback de auditoría después de posteo. La misma prueba cubre
  alta de deuda (#2). No sustituye cada failpoint posible del adapter.
- **#15 capital/deuda externa:** ahora ambas ramas de alta tienen prueba explícita
  de AuditLog después del asiento; el pago posterior conserva evidencia distinta.
- **#31 pago-gastos:** evidencia física histórica del workflow; no extender a nómina,
  compras y todos sus callers sin identificar los casos que prueban cada variante.
- **#28 shadow sin valoración:** conservar negocio y causa durable es el resultado
  diseñado, no rollback total ni posteo enforce.

## Firma y salida

**Firma técnica G5 emitida por OpenCode — 2026-10-11**, sesión indicada en procedencia:
identidad/reintento de las 18 combinaciones cash aceptados y cuatro condiciones cerradas.
Actions: autenticación controlada con wrappers/schemas reales; HTTP: handlers con JWT y
sesión persistida. Moneda focal CUP en la suite nueva; FX conserva evidencia separada.
Los archivos locales verificados no son un commit limpio ni un artefacto desplegado.

**R0.5-ACCEPT: PARCIAL / FIRMA GLOBAL RETENIDA.** La firma G5 no certifica todas las
dimensiones, ramas ni adaptadores de los 31 callsites. Los trabajos históricos aprobados
conservan su alcance.

R0.5 mantiene las dependencias declaradas de A8/R6, baseline por entorno y A9/R7.
A10 captura actual sigue verificada y no requiere reconstrucción histórica. Este
dictamen no autoriza modos operativos, replay, release ni un nuevo intento cloud.
