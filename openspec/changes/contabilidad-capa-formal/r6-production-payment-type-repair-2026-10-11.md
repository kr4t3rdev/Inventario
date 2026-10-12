# R6 — Reparación ensayada de referencias cross-tenant a TipoPago

## Dictamen focal

**Reparación local verificada: 13 referencias corregidas, 2 configuraciones propias
creadas y 15 AuditLog, con replay sin cambios.** Producción sigue en **main/e6c20706**;
el script y las pruebas residen en **feat/contabilidad-capa-formal**. No se ha aplicado
esta reparación en Railway ni convertido el ensayo en una migración de producción.

## Decisión y configuración

Las 13 referencias corresponden a dos pares `(tenant destino, tipo origen)`:
11 reconciliaciones de servicio y 2 de venta. Ambos tipos están activos y no exigen
cuenta. Sus cuentas por defecto pertenecen a otro tenant.

El responsable eligió **«Dejar cuenta vacía»**. Se copian nombre, descripción,
`requiereCuenta` e `isActive`, con nueva identidad determinista por par y tenant
destino. `cuentaDefecto=NULL` en la copia. El tipo original y sus referencias legítimas
en su propio tenant se conservan. No se infiere un nuevo valor por defecto a partir
de la única cuenta observada en las reconciliaciones.

No se usó el backfill legacy `prisma/seed/backfill-tipos-pago-tenant.ts`: su objetivo
son tipos sin tenant, mientras estos tipos ya tienen uno y están compartidos por
referencias de otros tenants. Este ensayo crea configuraciones propias y modifica
solo las referencias cruzadas.

## Script transaccional del ensayo

`scripts/ops/rehearse-payment-type-tenant-repair.sql`:
- Exige nombre esperado exacto, base `tcp_r6_prod_clone_<12hex>_trial<n>`, conexión
  loopback y puerto 5433; no admite producción, la línea base ni `tcp_test_local`.
- Bloquea las tablas de configuración/cuentas/reconciliaciones durante el ensayo.
- Rechaza huérfanos, tenant nulo y cuentas que no pertenecen al tenant de la referencia.
- Rechaza tipos que exigen cuenta o tienen ese atributo nulo; pares homónimos múltiples,
  tipo propio homónimo sin identidad prevista y colisión de identidad/configuración.
- Genera identidad determinista con MD5 de JSON `(tenant, tipo origen)`, usado como
  identificador reproducible, no garantía criptográfica.
- Crea tipos propios, cambia únicamente `tipoPagoId` en las tres tablas de
  reconciliación y escribe AuditLog dentro de la misma transacción.
- Los AuditLog indican actor sintético `r6-local-rehearsal`, `trialOnly=true`, vínculo
  origen/destino, configuración copiada y política CLEAR. No se atribuyen a usuario
  autenticado ni a una reparación operacional aceptada.
- Repetir una operación ya completada produce cero inserciones/actualizaciones/auditorías.

Una reparación de producción requiere su propio diseño operativo, actor y revisión
de alcance; este script está deliberadamente limitado al ensayo local.

## Pruebas PostgreSQL

`src/features/contabilidad/__integration__/payment-type-repair-real.test.ts`:
**10/10 casos** aprobados en una base efímera creada exclusivamente por el test, con
fixtures temporales por sesión y cleanup de esa base. No utiliza datos de producción.

Casos verificados:
1. Referencias venta/servicio/gasto reparadas, finanzas/cuentas/tipo origen conservados.
2. Replay exitoso sin duplicar configuración, referencias o auditoría (mismo caso positivo).
3. Fallo físico `division by zero` en trigger de AuditLog, después de comprobar el nuevo
   tipo y los cambios en las tres tablas: rollback completo y retry posterior exitoso.
4. Identidad de base incorrecta rechazada.
5. Cuenta cruzada rechazada.
6. Cuenta obligatoria rechazada.
7. Atributo de cuenta obligatorio nulo rechazado.
8. Tipo origen huérfano rechazado.
9. Tipo propio homónimo rechazado.
10. Colisión de identidad rechazada.
11. Dos fuentes homónimas para un mismo tenant rechazadas.

El primer caso reúne éxito y replay; la lista describe 11 escenarios dentro de 10
tests, no once tests independientes. ESLint focal y typecheck de pruebas aprobados.
Antes de la ampliación final, la corrida combinada con R5 pasó 21/21 (8 repair + 13 R5);
después de incorporar los dos rechazos adicionales, repair pasó 10/10. No se suman
estas corridas solapadas como cobertura adicional.

## Ensayo sobre la copia heredada

Trial3 derivó de trial2 y verificó la primera versión del script. Tras reforzar el
rechazo de configuración nula, fuentes homónimas y metadatos de conexión ausentes,
trial4 se creó **de nuevo desde trial2**, conservando el estado inicial del problema,
y verificó los bytes finales del script. Los hashes de ambas versiones quedan en sus
artefactos; trial3 no certifica por sí solo la versión final.

Destino final: `tcp_r6_prod_clone_4ae12d4e4c1f_trial4`, `127.0.0.1:5433`.

| Comprobación | Resultado |
|---|---|
| Primera ejecución | 2 TipoPago + 13 referencias + 15 AuditLog |
| Segunda ejecución | 0 tipos + 0 referencias + 0 AuditLog |
| Diferencias tenant cuenta/tipo de pago | 0 en venta, servicio y gasto |
| Guards enumerados | 23/23 ready |
| Historial Prisma | 123 filas originales, sin resolve/inserciones |
| Cuentas y tipos originales | Checksums sin cambios |
| Reconciliaciones, excluyendo únicamente tipoPagoId | Checksums de filas completas sin cambios |
| Asientos y líneas de asiento | Checksums sin cambios |

Checksums MD5 de JSON ordenado usados para detectar cambios, no como firma
criptográfica. Los artefactos emiten solo digests/conteos; el dump con datos queda
privado fuera del repositorio.

Artefactos finales:
- `r6-production-clone-trial4-repair-2026-10-11.json`: hashes del script, resultados,
  digests antes/después y separación main/origen vs formal/destino.
- `r6-production-clone-trial4-invariants-2026-10-11.json`: agregados post-reparación.
- `r6-production-clone-trial4-guards-2026-10-11.json`: guards/historial.

## Pendientes

La inconsistencia de las 13 referencias queda reparada **en el ensayo local**; sigue
presente en producción main mientras no exista un rollout aceptado. R6-BASELINE y
R0.5 global permanecen abiertos por comparación semántica, estrategia/historial Prisma,
regresión heredada y gates operativos. El ensayo no sustituye la ventana A9/R7.

El siguiente bloque es ensayar el flujo real de migración Prisma con historial
reconciliado sobre otra copia aislada, conservando los bytes aplicados y las dos
migraciones adicionales. No se han ejecutado merge, push o deploy.

**Continuación 12-10:** `r6-production-prisma-rehearsal-2026-10-12.md` verifica migrate
deploy real en trial5 y cadena con la reparación en trial6, sobre paquete histórico
reconciliado. El diff semántico contra schema objetivo sigue pendiente; no hay rollout
ni firma global de producción.
