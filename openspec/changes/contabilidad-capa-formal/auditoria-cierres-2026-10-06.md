# Auditoría de cierres R0.5/R6 — 2026-10-06

## Dictamen

R6-LOGS está implementado y su prueba física vuelve a pasar. El cierre global de R6
y los cierres generales de idempotencia G2/G5 no quedan acreditados con el alcance
original: hay duplicaciones reproducidas y criterios cuya evidencia fue reducida.

Revisión sobre HEAD `33ed3ec9`, más el worktree compartido. Se distinguen los cambios
commiteados de los cambios locales: las pruebas actuales NO certifican por sí solas
el contenido de HEAD. No se modificó código productivo ni el checklist compartido.

## Verificación ejecutada

- `pnpm test:integration`: inicialmente 55 archivos aprobados/5 fallidos;
  305 tests aprobados/22 fallidos. Causa común: la DB reutilizada carecía de
  `AjusteBancario.idempotencyKey`.
- Se confirmó la ausencia mediante `information_schema.columns` y se aplicó SOLO
  `prisma/migrations/20261006000000_ajuste_idempotency_key/migration.sql` a
  `tcp_test_g3_20261005`, PostgreSQL local 5432, tras validar el target desechable.
  No se ejecutó SQL en TCPBD ni en otro entorno.
- Segunda corrida completa: **60/60 archivos, 327/327 tests** aprobados.
- Unitarios focales (cuentas, tipos de pago, exchange, integracion-guard, rutas
  tipos de pago y writers-matrix): **7 archivos, 78 aprobados y 2 todo**.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --incremental false`:
  aprobado.
- `pnpm run typecheck:tests`: la ejecución inicial no terminó normalmente;
  repetido como `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc -p
  tsconfig.test.json --noEmit` produjo errores TS2339, TS2345, TS2554 y otros.
  El gate de tipos de tests sigue pendiente; Vitest no comprueba esos contratos.
- Probe adicional contra PostgreSQL: **3/3 escenarios RED** por defectos de
  idempotencia descritos abajo. Primera ejecución: dos defectos confirmados y un
  error de fixture; tras corregir el nombre del tipo de pago a `Transferencia`,
  los tres fallos fueron aserciones de comportamiento, no errores de preparación.
- Probe temporal conservado fuera de la suite en
  `/var/folders/n_/2tnvb4k17q7bvzg4kk6lb14h0000gn/T/opencode/audit-recheck-probe.test.ts`.
  Para repetirlo, colocarlo temporalmente bajo
  `src/features/contabilidad/__integration__/` y usar la config de integración.
  El probe usó modo `off` solo en el proceso de prueba: demuestra duplicación de
  saldo/reconciliación independientemente del motor de posting. No acredita
  comportamiento adicional de asientos en `enforce`.
- Limpieza del probe: cero tenants `audit-recheck-%`; cero triggers de fallo
  `cfg_audit_%` o `cta_audit_fail_%` al terminar.

## Hallazgos funcionales

### F1 — Alta: el reintento de capital duplica dinero

`accounting-operations-mutation-service.ts:567–660`, `createCapitalInjection`,
no tiene identidad durable de petición. Dos invocaciones idénticas de un aporte
de 100 confirman dos aportes y dos incrementos: saldo inicial 5000, primera
respuesta 5100, reintento 5200.

Esto contradice el alcance de G2-resto que incluye capital. Un origen contable
único por ID generado no identifica un reintento del mismo pedido.

**Pendiente:** contrato idempotente por petición, validación de payload y pruebas
de reintento secuencial/concurrente a través de los adaptadores vivos.

### F2 — Alta: pagos parciales cash no tienen deduplicación de petición

`accounting-cash-operations-mutation-service.ts:303–474`,
`registerCashLoanPayment`, recibe `id`, `monto`, cuenta y tipo de pago, pero ninguna
clave idempotente. Repetir el mismo cobro parcial de 100 sobre un préstamo de 500
crea otra reconciliación: el conteo pasa de 1 a 2. Ambas llamadas tienen éxito.

Los tests G5 actuales verifican reintentos después de un PAGO TOTAL: el rechazo
proviene del estado `PAGADO`, no de reconocer la petición. Ese caso no certifica
pagos parciales ni altas. El pago de deuda tiene una estructura análoga, pero no
se ejecutó un probe específico de deuda en esta auditoría.

**Pendiente:** identidad idempotente por pago y aceptación secuencial/concurrente
por canal. Conservar el rechazo por estado, pero no confundirlo con deduplicación.

### F3 — Media: ajuste con misma clave y payload distinto devuelve éxito

`accounting-operations-mutation-service.ts:458–473` devuelve el ajuste anterior
al encontrar la clave, sin comparar importe, cuenta, moneda o tipo.

Reproducción: crear ingreso de 100 con clave K; enviar 200 con K devuelve éxito
y el ajuste de 100. No duplica dinero, pero acepta silenciosamente una petición
distinta. Además la búsqueda ocurre antes del lock/transacción: falta certificar
la carrera de dos requests con la misma clave, no solo replay secuencial.

**Pendiente:** hash/canonicalización del payload, conflicto explícito por cambio
y resolución idempotente bajo lock para solicitudes concurrentes.

## Hallazgos de cierre y evidencia

### F4 — R6-ORPHANS no documentó el inventario original

El criterio original eran nueve llamadas best-effort: seis mutaciones de
`api/handlers.ts` y tres de `api/exchange-handlers.ts`.

El commit `33ed3ec9` marca nueve exports diferentes, incluyendo varias lecturas.
De las mutaciones originales solo `pagarDeudaCapital` y `createTasa` tienen la
marca. Quedan sin disposición específica:

- `createInyeccionCapital`, `createCierre`, `updateCierre`, `deleteCierre`,
  `createAjusteBancario` en `api/handlers.ts`.
- `createMoneda`, `updateMoneda` en `api/exchange-handlers.ts`.

Las nueve llamadas best-effort siguen en código. No se encontraron referencias
exactas de estas mutaciones en rutas `src/app/`; el grafo también devuelve cero
callers para `createMoneda`. Son deuda legacy, no rutas vivas demostradas aquí.

**Pendiente:** retirar o documentar explícitamente LAS mutaciones inventariadas
con su razón/policy; contar exports arbitrarios no resuelve el inventario de logs.

### F5 — R6-ROLLBACK redujo el criterio y depende del worktree

`tasks.md:2647–2648` convierte CxP y CxC-anulación en mejora futura no bloqueante.
El criterio original exigía pruebas específicas de gasto/CxP, anticipo, períodos
y CxC create/update/anulación. Compartir `logStrict(tx)` no es evidencia física
de rollback de todas las entidades y sus efectos.

`periodo-rollback-real.test.ts` pasó 1/1, pero `actions-periodos.ts` tiene cambios
sin commit: HEAD todavía audita `cerrarPeriodoAction` con `log` fuera del tx;
el worktree usa `logStrict` dentro. También siguen sin commit cambios estrictos
y FX de `accounting-cash-operations-mutation-service.ts`. Por tanto el test
commiteado no acredita el código de HEAD por sí solo.

**Pendiente:** certificar/commitear coherentemente la implementación que soporta
los tests y completar los casos específicos de CxP/CxC (o aprobar formalmente
un cambio de aceptación antes de cerrar el criterio).

### F6 — R6-BASELINE no acredita entornos heredados

`tasks.md:2649–2659` cierra baseline por guards en DB desechable y un plan, pero
reconoce que cada entorno heredado necesita su propia corrida.

No hay en este cierre comparación aprobada de DDL/backfills/checks/triggers ni
ejecución documentada por cada entorno soportado. Aplicar guards ad hoc a una
DB preparada con schema no verifica `migrate deploy` limpio ni paridad histórica.

**Pendiente:** evidencia de despliegue fresco mediante migraciones y matriz de
baseline/guards por entorno heredado. El plan documentado es avance, no ejecución.

### F7 — C3-extra tiene evidencia parcial y fixtures sin limpiar

- `service-devengo-directo-real.test.ts:135–138` solo exige uno o más asientos;
  no comprueba evento exacto, unicidad, balance ni rollback por fallo de audit,
  y no prueba reintento. Certifica el camino feliz, no todo G2-resto.
- `ajuste-idempotency-real.test.ts` comprueba saldo y conteo de ajustes, pero no
  unicidad del asiento, conflicto de payload o concurrencia.
- `periodo-rollback-real.test.ts` y `ajuste-idempotency-real.test.ts` no borran sus
  fixtures. Tras dos corridas quedaron dos tenants de cada prefijo; no es residuo
  del probe, cuyo tenant sí se eliminó. El devengo directo limpia solo venta/CxC.
- La suite verde registró un error real no fatal de notificaciones de merma:
  `notificaciones-utils.ts:22` consulta `User.tenantId`, inexistente en Prisma.
  No se reprodujo como test fallido porque ese error se captura.

## Lo confirmado

- R6-LOGS: los 15 callsites seleccionados están migrados a `logStrict(tx)` y los
  cinco writers de su matriz vuelven a pasar persistencia/rollback SQL (2/2).
  Esto es cobertura representativa de cinco operaciones, no 15 pruebas físicas.
- G1: prueba de gasto con fallo de auditoría aprobada en la suite completa.
- G3: sesión HTTP real de producción aprobada, incluyendo expiración y actor.
- G4 y conteo: `writers-matrix` aprobado, inventario 31 callsites/19 archivos.
- Mermas/restock/producción y transferencias con comprobante explícito tienen
  evidencia específica de retry; no extrapolarla a operaciones sin clave.
- Cierre de período: rollback aprobado en el worktree actual.

## Pendientes consolidados y orden propuesto

1. Resolver F1/F2/F3: idempotencia de capital, pagos parciales y conflicto de ajuste.
2. Completar G2/G5 por adaptador y operación, sin equiparar pago total a replay.
3. Alinear código commiteado y tests (períodos/cash y dependencias), luego certificar
   rollback específico CxP/CxC y disposición del inventario original de orphans.
4. Verificar migraciones frescas y baseline/guards por entorno heredado.
5. Completar snapshots funcionales CxC/CxP cash y aceptación FX por canal ya abierta.
6. Corregir `typecheck:tests`, limpieza de fixtures y error de notificaciones de merma.
7. Sincronizar `matriz-accept-r0.5.md`: las tablas todavía muestran G1/G2/G3 en
   GAP/PARCIAL aunque sus secciones inferiores los cierran. Una cabecera `[x]`
   no debe sustituir evidencia writer × adaptador × dimensión.
8. Después de esos puntos, quedan los gates operacionales existentes: shadow
   observado durante al menos siete días, conciliación y aprobación por tenant.

No se recomienda dar R0.5/R6 global por terminado con el checklist actual.
