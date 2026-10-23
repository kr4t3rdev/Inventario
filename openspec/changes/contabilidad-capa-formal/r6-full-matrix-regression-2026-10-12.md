# R6 — regresión heredada y cruce de las 31 filas

## Corte verificable

- Snapshot privado fijo: `3e7801ae8db9fbb4ce3f0b3b68607c15e433fd31`.
- Resultado conjunto: **299/299 casos, 40 suites, sin fallos**.
- V8 confirma ejecución de **31/31 callsites `postEvento` en 19 archivos**.
- Comparación de columnas originales y multiconjunto de filas completas:
  **1.353 filas / 142 tablas preservadas; cero filas modificadas o ausentes**.
- Este snapshot deriva de `5f60f6f6` con cambios seleccionados en dos suites.
  Incluye código compartido no publicado y la migración de idempotencia de venta;
  no representa el paquete publicado `a05bffb4`.
- Durante el trabajo cambió el checkout compartido: desapareció de su árbol la
  migración `20261009110000_venta_create_idempotency`. No se restauró ni modificó
  ese trabajo. Se conservó el árbol congelado para la ejecución final coherente.

Pruebas: `r6-full-matrix-candidate4-{snapshot,run,preservation,callsite-coverage}-2026-10-12.json`.
Los logs privados y los exports conservan el resultado completo sin publicar datos heredados.

Ledger estructurado: `r6-full-matrix-ledger-2026-10-12.json`: 248 celdas,
220 con evidencia focal, 27 pendientes de aceptación específica y una de
recuperación shadow. Estas cifras son clasificación de evidencia, no aprobaciones.

### Continuación candidate5

Se añadieron ocho rechazos nominados de permiso/cuenta ajena para ajuste, capital,
deuda externa y pago de deuda de capital. Sus 21 casos focales llegaron a pasar,
pero el proceso terminó con `ERR_MODULE_NOT_FOUND` para `vitest/dist/worker.js`
después de cambios en las dependencias compartidas. **Exit 1: no es PASS aceptable**.
El snapshot `e592311702476d56be14272ed282090c2793e9d5` conserva esta ampliación
sobre candidate4. Requiere instalación de dependencias independiente, generación
de Prisma y repetición conjunta antes de actualizar las celdas de la matriz.
La instalación aislada inicial falló por timeout/`ECONNRESET` al descargar paquetes;
la variante offline confirmó que faltan tarballs en el store local.

## Correcciones y ampliaciones

1. Anticipos: la tasa de fixture fechada en enero era anterior a tasas heredadas;
   la vigencia actual hace que el escenario pruebe su tasa sintética.
2. Merma/restock: `asiento_lineas` no tiene `tenantId`. Los triggers antiguos
   fallaban al consultar una columna inexistente. Ahora resuelven el tenant por
   `asientos`, comprueban progreso documental/inventario y alcanzan el failpoint
   explícito `22012`. Una secuencia temporal, cuyo avance sobrevive al rollback,
   demuestra que se alcanzó esa etapa. Se compara el snapshot completo antes/después.
3. Cuatro casos nuevos de permiso y pertenencia real en merma/restock.
4. Tres fixtures dejan de actualizar USD global; incluso una actualización sin
   cambio semántico alteraba `Moneda.updatedAt`. Candidate2 conserva esa discrepancia;
   candidate3 y candidate4 preservan todas las columnas originales.
5. Compras de productos ejecuta inventario, kardex, stock por ubicación e historial
   de costos reales. Se eliminaron esos mocks, se comprueba el movimiento y stock
   persistidos y se amplió el snapshot de rollback. Los fixtures y su kardex
   apendicular se conservan en la DB desechable, sin desactivar guards.
6. Tres casos nuevos en compras: permiso vacío, producto ajeno y proveedor ajeno;
   comparación de filas completas de ambos tenants.
7. Cuatro casos nuevos en servicios: permiso y pertenencia para rama legacy y
   rama mixta. El tenant ajeno dispone de período/política válidos para alcanzar
   el rechazo de referencias y no confundirlo con `PERIODO_NO_EXISTE`.

## Matriz de ocho dimensiones

Numeración idéntica al inventario de 31 callsites de `matriz-writers-r0.5.md`.
**F**: evidencia focal ejecutada en este corte. **P**: requiere completar el cruce
por rama/adapter o una comprobación específica; no significa fallo demostrado.
**R**: recuperación shadow diseñada, con outbox durable; no rollback total.
La tabla contiene las 248 celdas, pero **F no es firma global ni certificación de
todas las variantes del writer**. Los nombres y resultados individuales están
en el JSON de ejecución; la cobertura V8 no sustituye las aserciones.

| # | Writer / rama | Actor/permiso | Tenant | Origen | FX | Tx | Retry | Posting/auditoría | Rollback SQL |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Pago deuda web | F | F | F | F | F | F | F | F |
| 2 | Alta deuda web | F | F | F | F | F | F | F | F |
| 3 | Pago préstamo web | F | F | F | F | F | F | F | F |
| 4 | Alta préstamo web | F | F | F | F | F | F | F | F |
| 5 | Reconciliación venta web | F | F | F | F | F | F | F | F |
| 6 | Completar producción | F | P | F | F | F | F | F | F |
| 7 | Compra producto crédito | F | F | F | F | F | F | F | F |
| 8 | Compra servicio crédito | P | P | F | F | F | F | F | F |
| 9 | Alta préstamo core | F | F | F | F | F | F | F | F |
| 10 | Pago préstamo core | F | F | F | F | F | F | F | F |
| 11 | Alta deuda core | F | F | F | F | F | F | F | F |
| 12 | Pago deuda core | F | F | F | F | F | F | F | F |
| 13 | Transferencia banco | F | F | F | F | F | F | F | F |
| 14 | Ajuste banco | F | P | F | F | F | F | F | F |
| 15 | Capital / deuda externa | F | P | F | F | F | F | F | F |
| 16 | Pago deuda capital | F | P | F | F | F | F | F | F |
| 17 | Reconciliar venta core | F | F | F | F | F | F | F | F |
| 18 | Reconciliar servicio core | F | F | F | F | F | F | F | F |
| 19 | Merma | F | F | F | F | F | F | F | F |
| 20 | Restock | F | F | F | F | F | F | F | F |
| 21 | Venta servicio mixta | F | F | F | P | F | F | F | F |
| 22 | Venta servicio legacy | F | F | F | F | F | F | F | F |
| 23 | Devolución / FIFO | P | P | F | F | F | F | F | F |
| 24 | Facturación contra pago | P | P | F | P | F | P | F | F |
| 25 | Facturación contado mixto | P | P | F | P | F | P | F | F |
| 26 | Facturación crédito | P | F | F | F | F | F | F | F |
| 27 | COGS valorado | F | P | F | F | F | F | F | F |
| 28 | COGS shadow no valorado | F | P | F | F | F | P | F | R |
| 29 | Crear anticipo | F | P | F | F | F | F | F | F |
| 30 | Aplicar anticipo | P | P | F | F | F | F | F | F |
| 31 | Egresos / CxP / nómina | P | P | F | P | F | F | F | F |

## Pendientes concretos

- Negativos de pertenencia nominados para producción, ajuste, capital y su pago,
  devolución, COGS y anticipo; evitar atribuir a todos los métodos una prueba de
  pertenencia ejecutada únicamente en transferencia o en otro writer compartido.
- Compra de servicio: negativos de autorización/pertenencia con política/período
  válidos y sin efectos; su retry actual precrea una compra y prueba el rechazo
  duplicado, no una carrera completa del writer en enforce.
- Servicio mixto: variante extranjera con valoración y rollback propios.
- Facturación contado y mixto: FX, retry y caller autorizado por cada rama;
  la carrera de crédito y el receipt de POS no certifican todos sus callers.
- Egresos: el bundle nomina 24 variantes/adapters en CUP y período abierto;
  completar negativos/FX y las combinaciones no nominadas antes de firmar esa fila.
- Devolución y aplicación de anticipo: conservar frontera propia de autorización,
  sin trasladar automáticamente los checks de creación al segundo writer.
- R6-BASELINE por entorno, A9/R7, artifact de aplicación y release publicado
  conservan sus gates independientes. No se modifica la firma global R0.5/R6.
