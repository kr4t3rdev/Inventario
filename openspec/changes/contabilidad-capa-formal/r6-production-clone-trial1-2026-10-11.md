# R6 — Primer ensayo sobre copia de producción main

## Separación de versiones

- **Origen operativo:** Railway FinanceMDM production, rama `main`, commit desplegado
  `e6c20706e8658766187fb648fe6950c2f25dd249`, deployment
  `46cd7a49-4711-4507-9d7c-13eb3e246c38`, `SUCCESS`.
- **Destino de trabajo:** `feat/contabilidad-capa-formal`, HEAD
  `076baf3f04064af9f90b9bcca08aabea77a16003`, checkout compartido con cambios no
  confirmados. El HEAD no representa por sí solo el contenido ensayado.
- Se congelaron los bytes de las 29 migraciones pendientes del checkout y sus SHA-256
  en el manifiesto del ensayo. No se usó el `main` local como si fuera el release.

La rama contable no está desplegada en producción. Los fallos del ensayo corresponden
al salto desde ese estado heredado hacia los SQL congelados de la rama contable.

## Copia y aislamiento

Se obtuvo un dump consistente mediante `pg_dump --format=custom --no-owner --no-acl`
con `default_transaction_read_only=on` en la conexión Railway. Archivo privado fuera
del repositorio, en directorio con permisos 0700 y archivos creados con umask 077.
El dump contiene datos de producción y no forma parte de los artefactos versionables.

- Dump: 605803 bytes; SHA-256
  `8db01500f7107efa533ab995cfee90a4f40988b7503284f20a8c3263019be999`.
- Base local inicial: `tcp_r6_prod_clone_4ae12d4e4c1f`, restaurada atómicamente.
- Base derivada del ensayo: `tcp_r6_prod_clone_4ae12d4e4c1f_trial1`.
- Ambas en `127.0.0.1:5433`, PostgreSQL 17.11, usuario local `arturo`.
- `tcp_test_local` y su piloto no se modificaron ni se usaron como destino de restore.

Los nombres locales y la ruta privada están en
`r6-production-clone-manifest-2026-10-11.json`. La línea base se conserva intacta;
solo la base derivada recibió DDL del ensayo. No se inició una aplicación ni se
dispararon workers, sesiones, integraciones o eventos de negocio sobre la copia.

## Ejecución y primer fallo

Cada archivo SQL se ejecutó con `psql -X -w -q -1 -v ON_ERROR_STOP=1`, sobre destino
local comprobado por `current_database()` y puerto. Se detuvo en el primer exit no
cero. Es un **ensayo SQL directo**, no una corrida Prisma `migrate deploy`; no inserta
entradas de historial ni certifica la estrategia final de Prisma/baseline.

**8/29 archivos ejecutados satisfactoriamente**, en orden:

1. `20260924000000_contabilidad_shadow_outbox`
2. `20260926000000_ajuste_bancario_fx_evidence`
3. `20260926000001_transferencia_bancaria_fx_evidence`
4. `20260926000002_capital_cash_fx_evidence`
5. `20260926000003_compra_documento_fx_evidence`
6. `20260927000000_cxc_fx_valuation`
7. `20260927120000_contabilidad_formal_core`
8. `20260928000000_contabilidad_formal_remediacion`

El noveno, `20260929000000_r5_formal_schema_dependencies`, aborta con exit 3:

```text
Cannot safely backfill CompraProducto.
source_missing=0, tenant_unverifiable=1, tenant_mismatch=0
```

Confirma físicamente el bloqueo previsto: la única compra heredada tiene tenant
definido, coherente con producto/proveedor, pero `gastoCompraId` nulo. El guard exige
la fuente GastoCompra incluso cuando no hay tenant por completar. No se continuó con
los 20 archivos posteriores a R5 ni se marcó R5 aplicada por presencia de nombres.

## Conservación y verificación tras reinicio

El dump y los 29 SQL congelados conservaron sus hashes. Los agregados focales de
nómina/compras/CxP/reconciliaciones/restock son iguales entre la línea base y trial1.
El historial de trial1 conserva **123 filas**. `asientos` existe por las primeras
migraciones exitosas, mientras `hashVersion` no existe: no se ejecutó el archivo
posterior `20260929120000_asiento_tenant_hash_sequence`.

Esto acredita conservación de los agregados enumerados y uso de la transacción por
archivo; no se afirma comparación bit a bit de todos los datos ni objetos del fallo.

Artefactos:
- `r6-production-clone-manifest-2026-10-11.json`: procedencia del dump/destinos.
- `r6-production-clone-invariants-2026-10-11.json`: agregados de la línea base.
- `r6-production-clone-trial1-2026-10-11.json`: SQL congelados/resultados por archivo.
- `r6-production-clone-trial1-verification-2026-10-11.json`: verificación tras reinicio.

## Decisión pendiente de procedencia R5

Propuesta para la **rama contable**, antes de un nuevo ensayo: conservar el tenant
existente de una compra sin GastoCompra únicamente cuando producto y proveedor
confirmen ese mismo tenant; mantener bloqueo para tenant nulo sin fuente, referencias
ausentes o evidencia inconsistente. Alternativa: conservar GastoCompra como única
fuente y exigir reconstrucción legítima de esa procedencia antes de avanzar.

La consulta al responsable sobre esta decisión se canceló por reinicio del servidor;
no existe respuesta registrada ni modificación del guard. Las 13 referencias cruzadas
a TipoPago siguen pendientes de reparación y ensayo independientes.

**Continuación posterior al reinicio:** el responsable eligió «Validar tenant
existente». La implementación, TDD y ensayo completado están documentados en
`r6-production-clone-trial2-2026-10-11.md`; este archivo conserva el resultado
fallido original de trial1, no el dictamen vigente de la corrección.

R6-BASELINE/R0.5 global permanecen abiertos. No se hizo merge, push, despliegue ni
escritura en producción main; la aceptación del release contable sigue pendiente.
