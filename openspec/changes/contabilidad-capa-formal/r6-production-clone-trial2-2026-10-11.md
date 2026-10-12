# R6 — R5 corregido y ensayo SQL completado en copia local

## Procedencia y alcance

Origen: producción Railway **main**, commit desplegado `e6c20706`, capturado en el
dump del primer ensayo. Destino de implementación: **feat/contabilidad-capa-formal**,
HEAD `076baf3f` más cambios compartidos, incluida la corrección nominada de R5.

Trial2 se deriva localmente de trial1, que conserva las ocho migraciones iniciales
exitosas. Base: `tcp_r6_prod_clone_4ae12d4e4c1f_trial2`, `127.0.0.1:5433`. El dump,
la línea base y trial1 se conservaron. Los 29 SQL de trial2 quedaron congelados con
SHA-256; respecto del primer ensayo solo cambia el archivo R5 autorizado.

**No es producción actualizada, no es migrate deploy, no es una rama desplegada.**

## Decisión aplicada

El responsable respondió **«Validar tenant existente»**: aceptar una compra sin
GastoCompra cuando producto y proveedor confirmen el tenant ya existente.

La modificación de
`prisma/migrations/20260929000000_r5_formal_schema_dependencies/migration.sql`:
- Conserva el backfill de tenant nulo exclusivamente desde GastoCompra válido.
- Sin enlace a GastoCompra, acepta únicamente tenant existente no nulo y producto y
  proveedor existentes, ambos del mismo tenant.
- Sigue rechazando referencia GastoCompra ausente, fuente con tenant nulo, discrepancia
  de tenant y padres ausentes/de otro tenant/con tenant nulo.
- No inventa fuentes ni escribe un tenant a partir de producto/proveedor.

R5 no consta aplicado en el historial capturado de producción main. No se modificaron
sus checksums registrados: el ensayo conserva el historial original. El tratamiento
de un entorno distinto que sí tenga R5 registrado requiere su propio diagnóstico.

## TDD y comprobaciones

`src/features/contabilidad/__integration__/r5-purchase-tenant-provenance-real.test.ts`
ejecuta el bloque SQL real de CompraProducto contra tablas temporales por sesión,
con datos sintéticos, sin modificar fixtures existentes ni la copia de producción.

- **RED:** 12/13 pasan; el caso autorizado sin GastoCompra falla con el guard original.
- **GREEN:** 13/13 pasan tras la corrección.
- ESLint focal: aprobado.
- Typecheck de pruebas (`tsconfig.test.json`, noEmit, incremental false): aprobado.

Casos: conservación sin fuente con padres coherentes; backfill desde fuente; tenant
coherente con fuente; rechazo de tenant nulo sin fuente, fuente ausente/nula/cruzada,
producto/proveedor cruzado, ausente o con tenant nulo. Son pruebas focales del bloque,
no cobertura exhaustiva del resto de R5 o del rollout.

## Ensayo trial2

Se ejecutaron las **21 migraciones restantes**, desde R5, en la base derivada.
Todas terminaron con exit 0, bajo `psql -1 -v ON_ERROR_STOP=1` por archivo.
Con las ocho heredadas de trial1, se completó el ensayo directo de **29/29 SQL**.
No se repitieron las ocho ni se alteró `_prisma_migrations` para simular aceptación.

Reverificación posterior, consultas de solo lectura sobre trial2:
- **23/23 guards enumerados ready**: 11 triggers, 11 CHECKs y un índice.
- Agregados focales de negocio idénticos a la línea base capturada.
- Historial de migraciones: **123 filas originales**, sin inserciones por el ensayo.
- Permanecen **13 referencias a TipoPago de otro tenant**. R5 corregido no las repara.

Artefactos:
- `r6-production-clone-trial2-2026-10-11.json`: resultados y hashes de los SQL.
- `r6-production-clone-trial2-guards-2026-10-11.json`: guards e historial.
- `r6-production-clone-trial2-invariants-2026-10-11.json`: conteos de negocio.
- `r6-production-clone-trial2-catalog-2026-10-11.json`: catálogo resultante.

El agregado histórico `tenant_unverifiable_by_r5_source=1` sigue describiendo la falta
de enlace GastoCompra, según el diagnóstico de fuente estricta. No implica fallo del
guard corregido: la compra tiene tenant existente confirmado por sus dos padres.

## Pendientes y dictamen

El salto SQL estructural fue ensayado con éxito sobre la copia heredada. Permanecen:
1. Reparación trazable y ensayo de las 13 referencias cross-tenant a TipoPago.
2. Comparación semántica completa con el schema objetivo e invariantes restantes/FX.
3. Estrategia de historial compatible con Prisma y sus 13 checksums discrepantes y dos
   entradas adicionales; ejecutar el flujo de migración real en una copia dedicada.
4. Regresión de negocio/adaptadores sobre estado heredado y gates operativos.

R6-BASELINE/R0.5 global siguen abiertos. Producción main permanece sin modificaciones,
sin merge/push/despliegue de la rama contable. Este trabajo y sus actas están pendientes
de commit/revisión; no se atribuye a un artefacto limpio o release aceptado.

**Continuación:** `r6-production-payment-type-repair-2026-10-11.md` verifica reparación
de las 13 referencias en trial4 derivado, con dos tipos propios, defaults vacíos,
auditoría transaccional y replay sin cambios. Este resultado es local; no acredita
reparación en producción ni aceptación del historial Prisma.
