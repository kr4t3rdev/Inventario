# Preparación para integrar `feat/contabilidad-capa-formal` — 2026-10-13

## Decisión y alcance

La rama queda **documentada para una futura integración**, no declarada lista para merge.
Se difiere la validación operativa pendiente hasta contar con cuentas/tenant de prueba
designados y autorización para usarlos. Esta nota no ejecuta merge, rebase, push, despliegue,
migraciones ni pruebas contra producción. Tampoco habilita `shadow`, `enforce` ni replay.

La evidencia focal anterior y los resultados actuales del worktree son cosas distintas:
los **59/59 y 201/201 focales** y la corrida local de **148 migraciones, 14/14 PostgreSQL,
FX 1/1, preflight 6/6 unitario y 1/1 contra DB desechable** se conservan como resultados
históricos acotados. No se volvieron a ejecutar aquí; no certifican el HEAD actual ni la
integración completa. Tampoco equivalen a aceptación R0.5 (31 writers × 8 dimensiones),
R6 global, G5 global, baseline por entorno, comparabilidad de snapshots o ventana R7 de
siete días. Los reportes de auditoría y `tasks.md` mantienen esos gates abiertos.

## Referencias y estado Git comprobado

| Referencia | SHA | Evidencia |
|---|---|---|
| `feat/contabilidad-capa-formal` (HEAD local) | `d1d06c4ba14b6d2d98c9f60eb39ecefb24ab2a47` | `git rev-parse HEAD` |
| `main` local | `ee1eeed2a9bef1087e7663e8da635a493b4aeac4` | `git rev-parse main` |
| `origin/main` | `ee1eeed2a9bef1087e7663e8da635a493b4aeac4` | `git ls-remote`, consulta read-only informada por el coordinador |
| `origin/feat/contabilidad-capa-formal` | `d1d06c4ba14b6d2d98c9f60eb39ecefb24ab2a47` | `git ls-remote`, consulta read-only informada por el coordinador |

El merge-base local es `876b0d86a03cbf8a41f351d6a4810fafa4520367`; la divergencia
`main...HEAD` es **50 commits solo en main y 70 solo en la rama**. No se actualizó ninguna
referencia. `git merge-tree --name-only main HEAD` predice conflictos (sin tocar el
worktree):

- `docs/openapi/mobile-v1.json` — conflicto de contenido.
- `src/app/api/mobile/v1/accounting/capital-injections/__tests__/route.test.ts` — contenido.
- `src/features/admin/schemas.ts` y `src/features/admin/server/admin-global-queries.ts` — contenido.
- `src/lib/openapi/mobile-v1-contract.test.ts` — contenido.
- `graphify-out/2026-10-08/*` y entradas de `graphify-out/cache/ast/...` — conflictos add/add.

Esos conflictos impiden afirmar que la integración está limpia. No deben resolverse por
aceptación global de un lado: en particular, OpenAPI/Admin tienen trabajo compartido reciente
en `main` y en la rama que merece conciliación funcional aparte. Graphify es artefacto derivado
y ajeno a este alcance contable; no incorporarlo como parte del paquete contable salvo evidencia
concreta de que afecta al producto. No se hizo resolución ni se modificaron esos archivos.

## Paquete contable y propiedad del worktree

Los cambios contables relevantes para una futura integración deben identificarse desde la
matriz y el historial de la rama, incluyendo, sujeto a revisión y pruebas del paquete final:

- endurecimiento de tenant/capa formal y sus pruebas de contrato;
- migración candidata `prisma/migrations/20261012100000_accounting_tenant_id_hardening/`;
- preflight de clasificación histórica `scripts/ops/preflight-accounting-tenant-hardening.mjs`
  y sus pruebas/fixtures.

Al corte de esta nota, la migración candidata y los archivos de preflight aparecen **sin
seguimiento** en el worktree compartido, al igual que `scripts/ops/__tests__/preflight-accounting-tenant-hardening.test.ts`
y `src/features/contabilidad/__integration__/preflight-accounting-tenant-hardening-real.test.ts`.
Por tanto, no están incluidos en el commit HEAD citado; su autoría, integridad, dependencias,
inclusión deliberada y aprobación deben confirmarse en un inventario de paquete antes de
stage/commit. No se les atribuye certificación actual. No apropiarse ni descartar cambios
concurrentes.

Excluir de este paquete, salvo una relación demostrada y revisada expresamente: generación
OpenAPI/SDK compartida, cambios globales de Admin/licencias, nuevos flujos ajenos de ventas,
artefactos históricos de Graphify, y cualquier otro trabajo concurrente que no sea requisito
contable. `git diff main...HEAD` refleja un alcance significativamente más amplio que la capa
contable; se necesita una selección explícita de commits/paths y review de esa selección, no
un merge automático de toda la divergencia.

## Gates de CI / integración

`.github/workflows/ci.yml` declara como checks necesarios: Lint, Typecheck, cuatro shards de
unit tests, cobertura combinada, integración PostgreSQL, Build, required checks y smoke
post-deploy bajo su condición de ejecución. `.github/workflows/integration.yml` crea una
base PostgreSQL desechable, aplica migraciones y ejecuta `test:integration`. Esta inspección
confirma qué exige el workflow, **no** que haya corrido o esté verde para los SHAs candidatos.
No hay aquí evidencia de checks CI obligatorios completos para la integración resultante;
hay que ejecutarlos/consultarlos en la futura revisión después de resolver conflictos y
seleccionar el paquete. La corrida focal local no sustituye esos checks y no se afirma 31/31
ni “merge ready”.

## Pruebas operativas diferidas: tenant de prueba aislado

Cuando existan cuentas de prueba designadas y autorización operativa, usar únicamente un
tenant marcado/reservado para QA, con datos sintéticos y actores de prueba. Antes del smoke:
registrar entorno, versión desplegada, tenant no productivo/aislado, período permitido,
cuentas y permisos aprobados; confirmar que no se impactan balances ni operaciones de clientes
reales. No usar datos de negocio reales ni inferir que un tenant productivo vacío es seguro.

1. **Preflight y backfill:** revisión independiente del informe aggregate-only y de cada
   clasificación de titularidad. Toda fila histórica ambigua queda bloqueada para decisión
   humana; no inventar tenant propietario ni ejecutar backfill por inferencia. En entorno
   aislado, guardar conteos antes/después, huérfanos y discrepancias sin copiar valores de filas.
2. **Despliegue de esquema:** revisar SQL generado, orden/dependencias e idempotencia de la
   migración contra el baseline autorizado del entorno. Aplicar primero en una base de ensayo
   descartable; validar esquema, restricciones, FKs, precisión y reversibilidad/plan de
   recuperación. La aprobación de despliegue productivo es un gate separado.
3. **Flujos de aplicación con cuentas QA:** con un actor autorizado, validar lectura/escritura
   contable tenant-scoped, conversión FX pertinente, creación y reintento idempotente, permisos,
   registro de auditoría y rechazo esperado en período cerrado. Usar montos/datos sintéticos,
   capturas redacted y límites aprobados. Para probar separación, el segundo tenant/actor debe
   estar igualmente aislado y preaprobado; demostrar que no puede leer ni modificar el primero.
4. **Aprobación independiente:** las operaciones que requieren separación de funciones deben
   ser aprobadas por otro actor QA autorizado, distinto del creador. Verificar que sin permiso,
   tenant o aprobación correctos se rechaza y no quedan efectos parciales. Nunca crear A9 ni
   presentar como real evidencia comercial que no exista.
5. **Conciliación y evidencia:** comparar saldos/ledger antes y después, moneda, movimientos,
   asientos, AuditLog y totales de control; explicar toda diferencia. Adjuntar SHA desplegado,
   entorno, timestamps, IDs sintéticos/redacted, actor/rol, resultado por paso, consultas de
   solo lectura o reportes exportados con agregados y aprobador/reviewer. Repetir sólo tras
   entender y autorizar cualquier discrepancia.
6. **Criterio de salida:** cero lecturas/escrituras cruzadas, saldo y ledger conciliados,
   doble aprobación evidenciada cuando aplica, idempotencia/rechazo sin duplicados ni efectos
   parciales, migración y preflight reconciliados, y registro de evidencia revisado por un
   segundo responsable. Si cualquiera falla, detener rollout y preservar el estado; no cambiar
   flags para “hacer pasar” el smoke.

**Prohibido en producción compartida:** SQL failpoints/triggers para forzar fallos, suites
destructivas o de rollback, tests de integración que limpien tablas/esquemas, fixtures que
mutan datos de clientes, y cualquier runner de preflight/backfill no aprobado. Los failpoints
físicos pertenecen a PostgreSQL desechable/aislado. Shadow de siete días sigue pendiente y no
se sustituye por una pasada de smoke ni se declara cerrado por este diferimiento.

## Criterios para retomar la integración

- Confirmar branch/ref actuales y revalidar el diff (las referencias pueden avanzar).
- Definir el paquete contable acotado y quién es dueño de cada cambio no seguido; excluir o
  conciliar por separado OpenAPI/Admin/ventas/Graphify según impacto probado.
- Resolver y revisar de forma funcional cada conflicto indicado; no continuar sobre una
  resolución silenciosa o aceptar conflictos como equivalentes a tests.
- Ejecutar checks CI requeridos y suites focales para el SHA exacto del candidato integrado;
  revisar migración/preflight con aislamiento. No usar el resultado histórico como green actual.
- Mantener abiertos R0.5-ACCEPT, R6 global, G5 global, R6-BASELINE por entorno, R7 de siete
  días y comparabilidad histórica hasta evidencia/aceptación independiente de cada gate.
- Obtener aprobación explícita separada antes de cualquier push, merge, despliegue, aplicación
  de migración en producción o activación de `shadow`, `enforce` o replay.

## Archivos de seguimiento

- `tasks.md` — conserva las tareas/globales no verificadas; esta nota agrega únicamente el
  estado de preparación de integración.
- `matriz-accept-r0.5.md` — mantiene la aceptación global sin marcar; esta nota enlaza la
  evaluación de refs, conflictos y diferimiento operativo.
- `auditoria-correcciones-2026-10-07.md`, `r6-baseline-*`, `r6-cloud-deployment-check-*` y
  los reportes `r6-*` fechados — evidencia histórica acotada para consultar junto a esta
  nota, no certificación del HEAD actual.
