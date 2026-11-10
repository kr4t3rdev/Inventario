# Preparación para firmar R6, R7, R7.4 y R0.5-ACCEPT

**Fecha:** 2026-11-10
**Alcance:** preparación documental y de procedimiento en el checkout local.
**Estado:** no se consultó ni modificó ningún entorno real, flag, licencia ni
tenant. Este documento no firma nada: define qué falta, quién lo produce, con
qué artefacto y con qué criterio se acepta.
**Documento canónico de cobertura:** `docs/ct1-r0-5-matriz-canonica.md`.

## 0. Regla de oro

Ningún gate se firma con:

- los defaults del código ni el estado de este checkout;
- pruebas locales o de base desechable;
- configuración remota inferida (flags, licencias, modo por tenant);
- el mismo actor ejecutando y aprobando;
- una ventana de observación incompleta o con incidencias sin explicar.

Cada firma exige **evidencia fechada, reproducible y atribuible**: entorno,
tenant, versión/commit, ejecutor, aprobador, hora y artefacto adjunto.

**Los artefactos de evidencia pueden contener IDs de tenant, saldos y
nombres.** Guardarlos fuera del repositorio, por ejemplo en
`../ct1-evidencias/<entorno>/<fecha>/`, y no commitearlos. Los comandos de este
documento usan esa convención.

## 1. Insumos que bloquean el arranque

Estos datos solo los puede aportar el dueño de cada entorno. Sin ellos se puede
preparar el resto, pero no ejecutar ni firmar.

| # | Insumo | Gate | Quién lo aporta | Formato |
|---|---|---|---|---|
| 1 | Entornos objetivo: nombre, URL, base de datos, proveedor y responsables titular/suplente | R6 | Dueño de plataforma/SRE | Tabla de la plantilla A |
| 2 | Autorización escrita de observación de solo lectura y de ventana de cambio | R6/R7 | Dueño de plataforma + Finanzas | Correo o acta con alcance y fechas |
| 3 | Ventana R7 de siete días (inicio, fin, zona horaria) | R7 | Operación + Finanzas | Rango ISO 8601 |
| 4 | Tenants piloto R7.4: ID, owner, aprobador de Finanzas, volumen y moneda funcional | R7.4 | Operador de rollout + owner del tenant | Plantilla D |
| 5 | Umbrales y condiciones de reversión | R7/R7.4 | Controller/Finanzas | Valores medibles, no inferidos |
| 6 | Referencia inmutable de backup y prueba de restauración | R6 | SRE/DBA | ID de snapshot + log de restore |
| 7 | Nombres de firmantes: técnico, SRE/DBA, Controller, producto/operación | Todos | Dirección | Plantilla A |
| 8 | Acceso a outbox/métricas shadow y a reportes del entorno | R7 | SRE + Finanzas | Usuario con `financiero.auditoria.ver` |

**Decisión pendiente de Finanzas/operaciones:** umbrales de reversión y
responsables nominales. El repositorio no los define y este documento no los
inventa.

## 2. Fase 0 — Nominación y autorización (1-2 días)

1. Completar la **plantilla A** (responsables, entornos, suplentes).
2. Verificar separación de funciones: ejecutor y aprobador distintos en cada
   fila.
3. Registrar commit y versión desplegada por entorno.
4. Adjuntar la autorización escrita al paquete de evidencias.

**Salida:** acta de nominación firmada. Sin ella, las fases 2-6 no se ejecutan.

## 3. Fase 1 — R6 local/CI (reproducible hoy, sin entorno real)

**Entorno local de preparación ya creado (2026-11-10):** PostgreSQL 17 en
`127.0.0.1:5433`, base desechable limpia `tcp_test_ct1_gates_ready_20261110`, migraciones
179/179 aplicadas. Se sembraron dos tenants sintéticos (`ct1-gates-pilot`,
`ct1-gates-control`), nueve usuarios `@test.invalid`, seis roles personalizados
y dos licencias demo sin overrides. El seed no afirma ni modifica el modo global
efectivo; solo deja vacíos los overrides por tenant. No representa nombres de
firmantes reales ni acredita aceptación operativa.
Las licencias demo tienen `features: {}` y no hay política contable ni período
abierto sembrado; la DB solo prepara identidades/roles y no permite inferir ni
probar el modo efectivo de un rollout.

El helper `scripts/ops/seed-ct1-gate-test-actors.ts` crea esos actores solo si
la base, validada con el guard de disposable DB, está vacía. Las credenciales
aleatorias se guardaron fuera del repositorio en
`/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/ct1-gates-ready-credentials.json`
(permisos 0600). No copiar ese archivo al repo ni usar esas identidades fuera
de esta DB.

El helper es específico de `tcp_test_ct1_gates_ready_20261110`, no un generador para
cualquier base: antes de usarlo en una recreación de esa fixture, la base debe
estar vacía y las variables `DATABASE_URL` y `DATABASE_URL_TEST` deben ser
idénticas, `DIRECT_URL` igual si se usa y `ALLOW_DISPOSABLE_TEST_DB=1`. Rechaza
bases no vacías, no loopback o con nombre distinto.

Verificación inicial de solo lectura ejecutada: el verificador forense terminó
con código 0, **0 asientos y 0 hallazgos** en ambos tenants (cadena
`SIN_ASIENTOS`); el censo de posteos también dio cero operaciones. Es un estado
vacío sintético para preparar herramientas, no una baseline contable válida
para firmar R6. El artefacto JSON está en
`../ct1-evidencias/r6-local-forense-clean-20261110.json`, fuera del
repositorio.

**Sandbox de integración:** `tcp_test_ct1_gates_20261110` también recibió las
179 migraciones y ejecutó la suite PostgreSQL completa: 50 archivos, 267/267
tests verdes. Algunas suites dejan fixtures sintéticos; después de la corrida
quedaron 20 tenants y 31 usuarios. Se conserva como sandbox de integración; no
usar sus datos para una baseline ni para identificar los actores de firma.

**Estado de calidad local (2026-11-10, R6 local/CI VERDE):** los cuatro fallos
focales que bloqueaban esta fase se corrigieron con cambios mínimos y el
checkout vuelve a estar íntegramente verde:

| Comprobación | Comando | Resultado |
|---|---|---|
| Matriz de writers | `pnpm exec vitest run src/features/contabilidad-formal/__tests__/writers-matrix.test.ts` | 3/3 |
| Unitarias completas | `pnpm run test:run` | 906 archivos verdes, 1 omitido; 6.088 pruebas verdes, 1 omitida, 2 todo; 0 fallos |
| Integración PostgreSQL | `pnpm run test:integration` (`CONTABILIDAD_FORMAL_MODE=enforce`) | 50 archivos, 267/267 |
| Typecheck | `pnpm run typecheck` | Limpio |
| ESLint | `pnpm run lint` | 0 errores, 679 warnings no bloqueantes |
| Build de producción | `pnpm run build` | Exit 0; 10 warnings de Turbopack y avisos `DYNAMIC_SERVER_USAGE` no bloqueantes |
| Contratos de CI | `pnpm run test:ci:contracts` | 31/31 |
| Node | `pnpm run test:node` | 6/6 |
| Diff focal | `git diff --check -- <7 archivos focales>` | Limpio |

Correcciones aplicadas:

- `PurchaseReceiptInvoiceAllocation` clasificado como `scoped` y con política de
  backup `tenant-direct`, con la evidencia FIFO/FX marcada como protegida y una
  rama propia en el manifiesto de negocio.
- Consulta de aislamiento de `formal-financial-report-service.ts`
  inventariada en la allowlist SQL.
- Fixture de `tenant-factory` completada con `referralDiscountUsd: 5`.
- Scripts de afiliados actualizados para pasar el descuento persistido del plan
  a `resolveLicensePricing`.

Dos revisiones independientes de código sobre el diff focal dieron 0 BLOCKER y
0 MAJOR; los 4 MINOR y 4 NIT de trazabilidad quedaron resueltos (rama específica
del manifiesto, marca de evidencia protegida, ternarios anidados convertidos en
tablas de lookup, líneas partidas a 100 caracteres y test de
`PurchaseReceiptInvoiceAllocation` reforzado).

**Conjunto commiteado.** El checkout tenía trabajo **sin trackear** que era
dependencia directa del diff, y CI prepara la base con
`pnpm exec prisma migrate deploy`. Un commit parcial rompe la integración
aunque las pruebas locales pasen. El commit
`feat(contabilidad): cierra el R6 local/CI con la evidencia de los gates CT-1`
(base `4b7c4b7c6c9ad3d6c773de603bd8e45fc6433e1b`) incluye:

- `scripts/ops/seed-ct1-gate-test-actors.ts`, referenciado por
  `src/lib/db/raw-sql-allowlist.ts`. El allowlist es un inventario cerrado: sin
  ese script, CI falla con *"Entradas raw SQL obsoletas"*.
- Cuatro migraciones: `20261103000000_update_plan_prices` (crea
  `Plan.referralDiscountUsd`, que usa el diff),
  `20261109100000_fifo_invoice_receipt_provenance` (crea la tabla del modelo
  clasificado), `20261109120000_add_production_posting_date` y
  `20261117000000_accounting_source_evidence`. `prisma/schema.prisma` es
  coherente con las cuatro.
- `src/features/contabilidad-formal/__tests__/writers-matrix.test.ts`, que
  produce la evidencia 3/3 de la matriz de writers, junto con los módulos que
  el working tree ya importaba (`replay-source-manifest.ts`,
  `snapshot-coverage-integrity.ts`, `cash-payment-allocation-fingerprint.ts`).
- La documentación CT-1 (`docs/ct1-preparacion-firmas-gates.md`,
  `docs/ct1-plantillas-firmas-gates.md`, `docs/ct1-r0-5-matriz-canonica.md`,
  `odd/tasks/cobertura-familias-contables.md`).

El SHA final está en `../ct1-evidencias/manifest-r6-local-20261110.md` §1 y el
conjunto en §6.2.

**Reproducibilidad.** La integración PostgreSQL debe ejecutarse **aislada**.
Una corrida lanzada en paralelo con las unitarias dio 267/267 pruebas verdes
pero 1 archivo fallido en el `afterAll` por timeout de la transacción
interactiva de Prisma (5.921 ms consumidos contra el límite de 5.000 ms) con el
host saturado (load average 88 en 8 cores). Reejecutada aislada, ese archivo
pasó 3/3 en 1,96 s. Se conservan ambos logs.

**Límite de esta fase:** el verde es local/CI. No acredita ningún entorno real,
no sustituye el baseline por entorno ni implica firma de R6. Los logs completos
y el manifiesto están en `../ct1-evidencias/` (fuera del repositorio); el
manifiesto de esta corrida es
`../ct1-evidencias/manifest-r6-local-20261110.md`.

```bash
# Matriz canónica y drift de writers (debe dar 3/3)
pnpm exec vitest run src/features/contabilidad-formal/__tests__/writers-matrix.test.ts

# Suites unitarias completas
pnpm test:run

# Integración solo contra base local desechable tcp_test_* en 127.0.0.1:5433
ALLOW_DISPOSABLE_TEST_DB=1 \
DATABASE_URL_TEST=<url-local-desechable> \
DATABASE_URL=<misma-url> \
CONTABILIDAD_FORMAL_MODE=enforce \
pnpm test:integration

# Verificador forense (solo lectura) sobre la base sintética
pnpm exec tsx scripts/accounting/verificador-forense-report.ts \
  --all-tenants --out ../ct1-evidencias/r6-local-<fecha>.json
```

Criterios de aceptación local:

- matriz 3/3 y suites sin fallos;
- integración con `enforce` sin fallos, incluidos los rollback físicos por
  familia que ya existen en el repo;
- verificador forense con código 0, o hallazgos listados y explicados;
- artefacto JSON adjunto con la fecha y el commit.

**Límite:** esta fase no acredita ningún entorno. No sustituye el baseline.

## 4. Fase 2 — R6-BASELINE por entorno

Precondiciones: autorización escrita, ventana acordada y backup verificado.

1. **Backup y restauración.** Tomar backup, restaurarlo en una instancia
   aislada y registrar la referencia inmutable y el log de restore. Sin restore
   probado no hay baseline.
2. **Configuración efectiva redactada.** Adjuntar el valor observado de
   `CONTABILIDAD_FORMAL_MODE`, `CONTABILIDAD_FORMAL_NO_CASH_MODE` y
   `CONTABILIDAD_FORMAL_MODO_TENANT`, más las claves de override de las
   licencias. Sin secretos ni cadenas de conexión.
3. **Inventario de saldos por tenant y moneda** antes del corte, derivado del
   informe forense (`saldosPorCuenta` con la moneda funcional del tenant y los
   `cruces` contra la base operativa), no de cálculos manuales ni de defaults.
4. **Conciliación forense** del libro contra la base operativa:

```bash
DATABASE_URL=<url-del-entorno> \
pnpm exec tsx scripts/accounting/verificador-forense-report.ts \
  --all-tenants --out ../ct1-evidencias/r6-<entorno>-antes-<fecha>.json

DATABASE_URL=<url-del-entorno> \
pnpm exec tsx scripts/ops/verify-formal-postings-production.ts \
  > ../ct1-evidencias/r6-<entorno>-cobertura-<fecha>.txt
```

5. **Corte y repetición.** Repetir ambos comandos después del corte y generar
   el diff antes/después por tenant y moneda.
6. **Fuentes y omisiones.** Contar candidatos de replay evaluados, ya posteados
   y omitidos, con su causa. Los omitidos deben estar explicados.
7. **Cierre de diffs.** Finanzas revisa y cierra cada diferencia; las no
   explicadas bloquean el gate.

**Salida:** paquete R6 del entorno (plantilla B) firmado por quien produce y
por un Controller que no haya ejecutado.

## 5. Fase 3 — R6-ROLLBACK

1. Ensayar la reversión en staging o clon desechable: activar `enforce`, forzar
   un fallo de posteo y verificar que la escritura operativa se revierte y que
   no quedan asientos huérfanos.
2. Para producción, preparar **plan y ventana** de reversión; no ensayar en
   caliente sin aprobación explícita.
3. Adjuntar: prueba de integración por familia ya existente, log del ensayo,
   resultado y referencia del backup.

**Criterio de salida:** reversión ensayada, aislada y reproducible; plan de
reversión por entorno aprobado por SRE y Finanzas.

## 6. Fase 4 — R7 operacional (siete días)

Solo con autorización explícita y después del baseline del entorno.

1. **Preflight de política contable** (no muta datos de negocio):

```bash
pnpm exec tsx scripts/ops/accounting-policy-rollout.ts preflight \
  --tenants <id1,id2> --executor <usuario-autenticable>
```

2. **Manifiesto y dry-run vinculante** (escribe solo el registro de rollout):

```bash
pnpm exec tsx scripts/ops/accounting-policy-rollout.ts dry-run \
  --manifest <manifiesto.json> --executor <usuario-autenticable>
```

3. **Activar `shadow`** con autorización, registrando actor y hora. El modo por
   tenant requiere además el override de licencia (fase 5).
4. **Observar la outbox:** `getMetricasShadowAction` (permiso
   `financiero.auditoria.ver`, nunca acepta tenant por parámetro) resume
   `SIMULADO` / `ERROR_SHADOW`, conteo y latencia p95.
5. **Monitor de reportes** durante la ventana:

```bash
REPORT_MONITOR_BASE_URL=https://<entorno> \
REPORT_MONITOR_AUTH_COOKIE=<cookie-de-servicio> \
REPORT_MONITOR_ACCOUNT_ID=<cuenta> \
REPORT_MONITOR_RUN_UNTIL=<fin-iso-8601> \
pnpm ops:monitor:accounting-reports
```

6. **Bitácora diaria** (plantilla C): fecha, tenants, eventos simulados,
   errores por causa, latencia, incidencias y decisión del día.
7. **Cierre:** siete días completos, conciliaciones y alertas adjuntas,
   revisión de Finanzas. Una ventana incompleta no se firma.

**Nota:** el modo `enforce` exige asiento; si el motor rechaza (período cerrado,
rol sin mapear, plantilla ausente, FX incompleta), la escritura falla cerrada.
Eso debe estar previsto en los umbrales de reversión.

## 7. Fase 5 — R7.4 por tenant

Precondiciones: R6 del entorno cerrado, R7 cerrado, tenant elegido y aprobador
distinto del ejecutor.

Activación:

1. Habilitar el mecanismo por tenant: `CONTABILIDAD_FORMAL_MODO_TENANT=1`. Por
   sí solo no cambia el modo de nadie.
2. Aprobar el modo en la licencia del tenant, en `featureOverrides`:
   `contabilidad-formal-shadow: true` o `contabilidad-formal-enforce: true`.
3. Registrar en la bitácora: tenant, modo anterior, modo solicitado, aprobación,
   actor, hora y ventana de observación.
4. Verificar que el modo efectivo del tenant es el aprobado y que el resto de
   los tenants conserva el suyo.

Reversión:

- quitar el override del tenant → vuelve al modo global;
- quitar `CONTABILIDAD_FORMAL_MODO_TENANT` → toda la flota vuelve al global;
- el gate no Cash (`CONTABILIDAD_FORMAL_NO_CASH_MODE`) manda por familia y no se
  ve afectado por el override del tenant.

**Prueba obligatoria:** revertir solo ese tenant y demostrar que otro tenant no
cambia de modo (comparación antes/después).

## 8. Fase 6 — R0.5-ACCEPT

El acta (plantilla E) debe contener:

- alcance explícito: tenants, entornos y versiones/commits que cubre;
- matriz canónica adjunta, con las excepciones aceptadas y su justificación;
- R6 por cada entorno objetivo, R7 y R7.4 firmados;
- navegación/UX revisada en el deployment (no solo en local);
- riesgos aceptados y decisión sobre las brechas abiertas;
- firmas del Controller global y del propietario de producto/operación.

## 9. Condiciones para no firmar

- Falta cualquier insumo de la sección 1 o cualquier evidencia de la tabla de
  la sección 10.
- El ejecutor y el aprobador son la misma persona.
- El baseline no tiene backup restaurado o el diff no está cerrado.
- La ventana R7 tiene menos de siete días o incidencias sin explicar.
- El tenant no tiene umbrales de reversión medibles.
- La configuración remota se infiere por defaults.
- Alguna brecha de la sección 11 queda sin decisión registrada.

## 10. Matriz de evidencia y aceptación

| Gate | Evidencia mínima | Produce | Acepta |
|---|---|---|---|
| R6 local/CI | Matriz 3/3, suites, integración desechable, verificador sintético, commit | Dueño técnico + QA | Contabilidad/Finanzas |
| R6-BASELINE | Backup restaurado, flags redactados, saldos por tenant/moneda antes y después, diff cerrado, fuentes/omisiones | SRE/DBA + dueño técnico | Controller del entorno |
| R6-ROLLBACK | Ensayo de reversión, log, plan y ventana, prueba por familia | SRE/DBA | Controller + release approver |
| R7 | Siete días de bitácora, métricas shadow, monitor de reportes, conciliaciones y alertas | Operador de rollout + QA | Controller |
| R7.4 | Tenant, modo anterior/solicitado, aprobación, actor/hora, umbrales, reversión aislada | Operador de rollout | Finanzas del tenant |
| R0.5-ACCEPT | Todo lo anterior + matriz + excepciones + navegación + versiones | Dueño técnico recopila | Controller global + producto |

## 11. Brechas y riesgos que deben constar en el acta

- `src/app/api/contabilidad/prestamos-cash/route.ts` crea préstamo y
  `reconciliacionVenta` sin emisor formal, y no filtra `cuentaBancaria` ni
  `clienteId` por tenant (riesgo de cruce entre tenants; requiere autorización
  para corregirlo). Detalle en `docs/ct1-r0-5-matriz-canonica.md` §6.1.
- `src/app/api/produccion/ordenes/[id]/completar/route.ts` completa la orden sin
  `PRODUCCION_SALIDA` ni `fechaContabilizacion`.
- `TRANSFERENCIA_BANCARIA` y `PAGO_DEUDA_CAPITAL` no tienen writer vivo.
- Ocho tipos son solo plantilla: no representan cobertura de negocio.

Ninguna de estas brechas se resuelve con configuración: requieren decisión
(delegar, retirar o aceptar) y, si se corrige código, autorización explícita.

## 12. Referencias

- `docs/ct1-cierre-integracion-capa-formal.md` §6 (gates y criterios de salida)
- `docs/ct1-r0-5-matriz-canonica.md` (matriz vigente y brechas §6.1)
- `content/docs/modules/contabilidad/capa-formal-emisor-no-cash.md` (modos y
  aprobación por tenant)
- `scripts/accounting/verificador-forense-report.ts` (solo lectura)
- `scripts/ops/verify-formal-postings-production.ts` (solo lectura)
- `scripts/ops/accounting-policy-rollout.ts` (preflight, dry-run, apply con gates)
- `scripts/ops/accounting-reports-monitor.ts` (`pnpm ops:monitor:accounting-reports`)
- `docs/ct1-plantillas-firmas-gates.md` (plantillas A-E)
