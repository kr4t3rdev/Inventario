# CT-1 S0: decisiones e inventario inicial

**Corte histórico:** 2026-10-27. **Estado:** inventario completo de rutas; revisión semántica parcial.

**Actualización:** S1 se integró en `origin/main` mediante PR #48, merge `2c86bde1`.
Las comparaciones históricas de este documento conservan su destino original `c860c867`;
las decisiones de los próximos slices deben contrastarse también con el `origin/main` vigente.

## Referencias fijadas

- Destino: `origin/main` `c860c8679895797f67d33d2a0388336dbb7857f2`.
- Fuente formal: `feat/contabilidad-capa-formal` `d1d06c4ba14b6d2d98c9f60eb39ecefb24ab2a47`.
- Fuente complementaria: `wip/codex-mobile-2026-10-12` `dd302bf7186c28400b8d55cb14e60a6764f73326`.
- Auditoría y plan anteriores: commits locales `0c1d8a99` y `16bbb6a2`; no son ancestros de esta rama y requieren integración explícita por separado.

## Decisiones del usuario

1. Conservar el split moratorio de main: aplicar pagos a mora, interés ordinario y principal, en ese orden.
2. Incluir las rutas móviles contables en CT-1.
3. Excluir los artefactos Graphify del merge y regenerarlos al finalizar.
4. Integrar por slices sobre ramas nuevas basadas en `origin/main` actualizado.

## Inventario por entrega

| Slice | Fuentes a contrastar | Evidencia y dependencias pendientes |
|---|---|---|
| S1: núcleo | `src/features/contabilidad-formal/{lib,services,__tests__}` en destino y fuente formal | Comparar las dos implementaciones; preservar asignación moratoria de main y mapear sus roles contables. Revisar motor, hash, shadow y replay con sus pruebas. |
| S2: esquema | `prisma/schema.prisma`, migraciones y scripts de ambas fuentes | Comparar historial de migraciones y bases existentes; revisar tenant, precisión y compatibilidad con unidades. No renombrar migraciones aplicadas. |
| S3: caja | `src/features/contabilidad/services/accounting-cash-operations-mutation-service.ts`, acciones y rutas de préstamos/deudas | Preservar los tres puntos de posteo y la valoración e idempotencia actuales; contrastar con fuentes formal y móvil. |
| S4: escritores | Matriz `openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md` de la fuente formal; ventas, compras, gastos, anticipos, mermas y producción | Inventariar cada llamada y ruta actual; asociar evento, pruebas, fuente y transacción. La matriz histórica no acredita cobertura actual. |
| S5–S7: libros y ciclo | Servicios de libros, conciliación cruzada, cierre, apertura, reversa y replay de la fuente formal | Determinar dependencias de modelos, permisos, acciones y pruebas antes de seleccionar archivos. |
| S8: móvil | `src/app/api/mobile/v1/accounting/`, contrato OpenAPI y pruebas en destino y fuente complementaria | Comparar contratos y comportamiento contra main actual; incluir rutas móviles seleccionadas y sus pruebas. |
| S9–S10: infraestructura y cierre | Permisos, clasificación tenant, SQL, CI, documentación y Graphify | Incorporar dependencias cuando las necesite cada slice; ejecutar CI sobre el candidato resultante y regenerar Graphify. |

## Piezas de hardening identificadas

Los siguientes archivos existen en el commit complementario `dd302bf7`; su inclusión, contenido y compatibilidad requieren revisión, y su autoría no ha sido confirmada:

- `prisma/migrations/20261012100000_accounting_tenant_id_hardening/migration.sql`.
- `scripts/ops/preflight-accounting-tenant-hardening.mjs`.
- `scripts/ops/__tests__/preflight-accounting-tenant-hardening.test.ts`.
- `src/features/contabilidad/__integration__/preflight-accounting-tenant-hardening-real.test.ts`.

Comprobación de presencia por ruta en los árboles destino / formal / complementario:

| Ruta | Destino | Formal | Complementario |
|---|---|---|---|
| `20261012090000_align_formal_schema_baseline/migration.sql` | No | Sí | Sí |
| `20261012100000_accounting_tenant_id_hardening/migration.sql` | No | No | Sí |
| `scripts/ops/preflight-accounting-tenant-hardening.mjs` | Sí | No | Sí |

La presencia no demuestra equivalencia de contenido ni que alguna migración haya sido aplicada en un entorno.

### Procedencia de las piezas complementarias

El commit `dd302bf7186c28400b8d55cb14e60a6764f73326`, autor Git `kr4t3rdev`, incorpora los cuatro archivos anteriores en un snapshot conjunto. El usuario autorizó utilizar ese commit como fuente para revisar e incorporar selectivamente la migración y la prueba de integración en S2; esa autorización no acredita la propiedad del worktree sucio. El preflight y su prueba unitaria ya existen en el destino y son idénticos a los del complemento. La migración y el test de integración real no existen en el destino fijado. Revisar contenido y dependencias antes de incluirlos en S2.

## Comparación de las 99 rutas históricas

Se compararon los identificadores de blob Git de cada ruta en `c860c867`, `d1d06c4` y `dd302bf7`, respectivamente. Resultado: **79 blobs iguales entre formal y complementaria, distintos del destino; 20 con tres blobs distintos**. Ninguna de las 99 tiene el mismo blob en los tres commits. La igualdad de blobs compara bytes, no certifica equivalencia funcional, propiedad ni pertinencia al paquete contable.

Las 20 rutas con tres versiones distintas son:

| Ruta | Tratamiento propuesto |
|---|---|
| `src/app/api/mobile/v1/accounting/bank-adjustments/route.ts` | S8: conciliar contrato y servicio actual. |
| `src/app/api/mobile/v1/accounting/capital-injections/route.ts` | S8: conciliar contrato y servicio actual. |
| `src/app/api/mobile/v1/accounting/capital-injections/__tests__/route.test.ts` | S8: preservar pruebas del contrato vigente y casos contables pertinentes. |
| `src/app/api/produccion/recetas/__tests__/ingredientes.test.ts` | Fuera de S1; revisar solo si una dependencia lo requiere. |
| `src/app/busy/produccion/__tests__/receta-creation-flow.test.ts` | Fuera de S1; revisar solo si una dependencia lo requiere. |
| `src/features/contabilidad/components/deudas-cash/deuda-cash-form.tsx` | S3: preservar funcionalidad actual y revisar cambios de formulario. |
| `src/features/contabilidad/components/prestamos-cash/prestamo-cash-form.tsx` | S3: preservar funcionalidad actual y revisar cambios de formulario. |
| `src/features/contabilidad/services/accounting-operations-mutation-service.ts` | S3: conciliar las operaciones y transacciones actuales. |
| `src/features/contabilidad/services/__tests__/accounting-operations-mutation-service.test.ts` | S3: conservar regresiones vigentes y cubrir cambios seleccionados. |
| `src/features/ofertas/__tests__/facturar-erronea.test.ts` | S4: revisar junto al writer de facturación. |
| `src/features/puntos-venta/__tests__/actions.test.ts` | S4: revisar únicamente si el writer correspondiente lo requiere. |
| `src/features/turnos-pos/__tests__/actions.test.ts` | Fuera de S1; revisar dependencias en S4. |
| `src/features/turnos-pos/__tests__/tenant-scope.test.ts` | Fuera de S1; revisar dependencias en S4. |
| `src/features/unidades/__tests__/actions.test.ts` | Fuera de S1; preservar el comportamiento vigente de unidades. |
| `src/features/vendors/__tests__/actions.test.ts` | Fuera de S1; revisar si existe dependencia concreta. |
| `src/features/venta-servicios/__tests__/actions.test.ts` | S4: revisar con el writer de servicios. |
| `src/features/ventas/__tests__/venta-credito-limite.test.ts` | S4: preservar las validaciones de crédito vigentes. |
| `src/features/ventas/__tests__/venta-lifecycle.test.ts` | S4: preservar el ciclo de vida vigente. |
| `src/features/ventas/services/venta-mutation-service.ts` | S4: integrar el writer sobre el servicio vigente. |
| `src/lib/openapi/mobile-v1-contract.test.ts` | S8: conciliar con el contrato móvil vigente. |

Las otras 79 rutas son exactamente el complemento de esta tabla en `docs/ct1-s0-99-rutas.txt`: formal y complementaria comparten el blob, y destino tiene otro. Incluyen los cinco archivos de núcleo identificados abajo, rutas de caja y móvil, y numerosos tests de otros módulos. No se autoriza su copia masiva. La lista se contrastó con `.tmp/merge-pending.json`: 99 entradas, mismo orden y contenido. El JSON sigue siendo un artefacto local no rastreado.

### Revisión semántica adicional de S3

En `accounting-cash-operations-mutation-service.ts`, el diff entre `origin/main`
`2c86bde1` y la fuente formal `d1d06c4` muestra que la versión formal no conserva
el cálculo de asignación de intereses ordinarios y moratorios, los estados de
devengo ni la escritura de `cashPaymentInterestAllocation` presentes en main.
La fuente propone a la vez comprobaciones adicionales de cuenta activa, saldo y
tenant. **Decisión:** no sustituir el servicio completo; evaluar esas guardas
puntualmente sobre el servicio vigente, con pruebas de mora, idempotencia, FX y
aislamiento. El diff también afecta numerosas rutas y pruebas no incluidas en las
99; esa lista histórica no es un inventario exhaustivo de los cambios de la rama.

### Revisión semántica parcial de S8

En las rutas móviles de ajustes bancarios y aportes de capital, la fuente formal
elimina la búsqueda de una operación idempotente existente antes de validar el
período y la comprobación posterior cuando el período está cerrado. También
elimina el tratamiento explícito de errores Zod en ajustes bancarios. No copiar
esas rutas completas: preservar el contrato de reintentos y errores vigente y
contrastar los tests y servicios relacionados. Quedan pendientes las demás rutas
móviles y la comparación con el complemento `dd302bf7`.

## Lista mínima S1 acordada

**Base canónica:** el núcleo de `c860c867`, no una sustitución por archivos completos de la rama formal. S1 mantiene el modo por defecto `off` y no modifica registro de planes ni habilita replay.

1. `src/features/contabilidad-formal/lib/plan-default.ts`: conservar roles, regla y líneas de mora del destino. Añadir o mapear las cuentas de los dos roles moratorios, con códigos y naturaleza compatibles con el plan; comprobar que todas las líneas con importe positivo encuentren una cuenta activa que acepte movimiento.
2. `src/features/contabilidad-formal/services/seed-plan-contable.ts`: verificar si la definición existente siembra los nuevos roles y cuentas de forma idempotente; modificar solo si la solución elegida lo requiere. Revisar el efecto de `update: { cuentaId }` sobre asignaciones ya existentes antes de cualquier ejecución real.
3. `src/features/contabilidad-formal/__tests__/seed-plan.test.ts` y `__tests__/posting-engine.test.ts`: cubrir siembra idempotente y cobro/pago con principal, interés ordinario y mora, con plan default real y cuadre exacto. Incluir mora cero y roles faltantes. La prueba actual de posteo agrega manualmente un rol moratorio, por lo que no demuestra cobertura del seed default.
4. `src/features/contabilidad-formal/services/posting-engine.ts`: conservar `interesesMoratorios`, la resta de ambos intereses y la conexión de cuenta acotada por tenant. Incorporar solo cambios de la fuente que se identifiquen como necesarios mediante diff y pruebas; el diff revisado elimina estas protecciones en vez de añadir funcionalidad requerida.
5. `src/features/contabilidad-formal/services/shadow-outbox.ts`: conservar el `tenantId` obligatorio del destino; la fuente complementaria permite consumo global y no debe sustituirlo sin una necesidad y diseño explícitos.
6. `src/features/contabilidad-formal/services/replay-posting-capability.ts`: el diff observado es únicamente una línea en blanco; no requiere traslado en S1.
7. Revisar `cash-payment-event-builder.ts`, asignación y pruebas existentes como dependencias de lectura; cambiarlos solo si el test del flujo con plan default demuestra que es necesario. Ejecutar las pruebas focales de seed, motor, shadow y asignación; añadir integración PostgreSQL aislada para verificar persistencia, cuadre y aislamiento si el cambio incluye el camino de posteo.

**Cierre de S1:** los dos tipos de pago con mora se contabilizan balanceados con el plan default en una base desechable, sin borrar ni remapear cuentas ya configuradas inadvertidamente; pruebas focales verdes, tenant aislado y sin activar modos. Los nombres/códigos de cuentas y cualquier ajuste al seed se verifican durante la implementación; el plan no presupone migraciones o datos productivos.

Verificar también `20261012090000_align_formal_schema_baseline` y el historial real de cada entorno antes de decidir si corresponde una migración nueva. La fecha del nombre por sí sola no justifica modificar migraciones ya aplicadas.

## Criterios de seguimiento

- El inventario local `.tmp/merge-pending.json` contiene 99 rutas, no unas 130 como se indicó anteriormente. Las 99 existen en los tres árboles fijados; no se comparó todavía su contenido. Es un insumo histórico no rastreado, no una lista autorizada ni un estado actual de conflictos.
- Registrar por archivo su estado en destino, fuente, slice, dependencia y decisión de inclusión; no copiar cambios ajenos automáticamente.
- Validar cada slice con sus pruebas y el CI exigido para su SHA. Los resultados históricos no certifican el candidato.
- La aceptación se mide sobre el resultado integrado y su matriz de cobertura; un merge-tree limpio contra la rama histórica no es requisito de una integración selectiva.
- La integración no activa shadow, enforce ni replay. R0.5, R6 y R7 conservan sus propios criterios y evidencias.

## Pendientes para terminar S0

1. Versionar el inventario completo de las 99 rutas y completar la revisión semántica por slice; la comparación de blobs y la revisión parcial de S1/S3 ya están realizadas.
2. Revisar y seleccionar las piezas autorizadas de la línea complementaria. No se observaron cambios locales para los cuatro archivos de hardening examinados; esto no acredita la propiedad del resto del worktree.
3. Revisar dependencias de migraciones y el esquema del destino actual; definir una estrategia compatible con bases existentes.
4. Preparar la lista mínima de S1 y sus pruebas, conservando la semántica moratoria aprobada.
