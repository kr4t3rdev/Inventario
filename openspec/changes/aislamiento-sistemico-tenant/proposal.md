# Propuesta — Enforcement sistémico del aislamiento multi-tenant

## Decisión ejecutiva

Mover el aislamiento entre tenants de la **disciplina manual** (cada query recuerda poner `tenantId` — 443 archivos con llamadas Prisma) a un **enforcement sistémico en la capa de acceso a datos**: un cliente Prisma extendido (`$extends`, soportado en Prisma 6.19 que ya usa el proyecto) que inyecta y valida `tenantId` en toda operación sobre modelos tenant-scoped, con modo *shadow* (registrar violaciones sin romper) antes de *enforce* (rechazar). Es la contrapartida estructural de los `ir.rule` de Odoo a nivel ORM: convierte la clase de bug "IDOR por query sin filtro" (contratos, ofertas, numeraciones globales — todos encontrados en la auditoría del 2026-09-05) en **imposible por construcción**, no en "corregida caso por caso".

## Problema

Hoy el aislamiento depende de tres helpers aplicativos (`requireTenant`, `scopedWhere`, `assertTenantAccess`) que el programador debe recordar usar en cada uno de los **443 archivos** que tocan Prisma. La evidencia de que esto falla:

1. **Contratos:** rutas REST sin filtro tenant (IDOR completo: leer/editar/firmar contratos ajenos) — en corrección vía `correcciones-urgentes` F-01.
2. **Ofertas:** exports PDF/Excel sin auth ni tenant — F-02.
3. **Numeraciones globales:** contratos (sin `tenantId` en el cálculo del consecutivo) y transferencias (conteo anual sin tenant) — mezclan y filtran datos entre empresas.
4. **Catálogos/config globales accidentales:** `TipoContratoCustom` y `ConfiguracionSistema.diasAvisoVencimientoContrato` son filas globales compartidas entre todos los tenants.

Además, la auditoría de schema reveló un hecho cuantificable: **39 de los 128 modelos no tienen columna `tenantId`**. No todos son problemas, pero la falta de clasificación formal es el problema: nadie puede hoy responder "¿qué tablas son seguras de consultar sin tenant?" sin auditar a mano. Y dentro de esos 39 hay modelos de negocio tenant-scoped *de hecho* pero sin la columna (p. ej. `TransaccionMoneda` — el espejo contable multimoneda —, `AlertHistory`, `ReportHistory`, `ScheduledReport`, `ScenarioSimulation`, `InyeccionCapital`, `PagoDeuda`, `SaldoSnapshot`).

## Qué cambia

| Hoy | Objetivo |
|---|---|
| El aislamiento es responsabilidad del autor de cada query | El aislamiento es responsabilidad del cliente de datos; el código de negocio **no puede** salirse del tenant |
| 39 modelos sin `tenantId` sin clasificar | Cada modelo clasificado: `scoped` (tiene tenantId), `global` (plataforma, lista blanca cerrada) o `child` (hereda del padre); test de contrato en CI que falla si un modelo nuevo aparece sin clasificar |
| Un único cliente global `prisma` para todo | Dos puntos de entrada explícitos: `prisma` (scoped-enforced, default) y `prismaPlatform` (escape hatch auditado, solo admin/auth/seeds/cron) |
| Bugs de aislamiento se descubren en auditoría | En modo *enforce*, son errores tipados en desarrollo/tests; en *shadow*, telemetría de violaciones |

## No-goals

- No se introduce RLS de Postgres en esta fase (ver diseño: decisión y criterios para fase futura).
- No se re-factorizan las 443 llamadas a mano: el enforcement es por debajo; solo se corrigen las violaciones que el modo shadow evidencie.
- No se tocan los fixes puntuales de `correcciones-urgentes` (van primero; este change los vuelve estructurales).
- No se persigue 100% de cobertura en raw SQL: `$queryRaw`/`$executeRaw` quedan bajo lista blanca auditada, porque el cliente extendido no puede interceptarlos semánticamente.

## Solución propuesta (resumen; detalle en design.md)

1. **Clasificación formal de modelos** (`src/lib/db/model-classification.ts` + test de contrato): cada uno de los 128 modelos queda en `scoped` / `global` / `child` con su clave de resolución; CI falla ante modelos no clasificados.
2. **Cliente extendido** (`src/lib/db/scoped-prisma.ts`): `prisma.$extends({ query })` que, para modelos `scoped`:
   - `findMany/findFirst/count/aggregate/groupBy`: inyecta `tenantId` en el `where` (merge con AND).
   - `findUnique/update/delete` (y variantes OrThrow): usa `extendedWhereUnique` (GA desde Prisma 5; compatible con nuestra 6.19) para añadir `tenantId` al `where` único.
   - `create/createMany/updateMany/deleteMany/upsert`: inyecta/valida `tenantId` en data y where; rechaza payload con tenant distinto al del contexto.
   - Sin contexto tenant en operación sobre modelo `scoped` → **fail-closed**: en `enforce` lanza `TenantContextRequired`; en `shadow` registra y deja pasar.
3. **Contexto tenant de request**: `AsyncLocalStorage` poblado por `authenticateUser`/`withAction` (que ya resuelven la membresía); las rutas existentes no cambian nada más.
4. **`prismaPlatform`**: export separado con logging estructurado de cada uso; consumo restringido a auth, admin de plataforma, seeds, cron y afiliados, verificado por test estático de imports.
5. **Modelos `child`**: fase de denormalización — añadir `tenantId` (nullable → backfill desde el padre con script dry-run → not-null) a los modelos de negocio que hoy heredan tenant indirectamente, en olas priorizadas por riesgo (empezando por `TransaccionMoneda` y los de reportes/alertas). Los puramente técnicos/intra-transacción documentan su vía de control (siempre a través del padre ya scoped).
6. **Modos operativos**: `TENANT_ISOLATION_MODE=off|shadow|enforce` por entorno; roll-out shadow en producción con métricas antes de enforce.
7. **RLS (referencia futura):** se documentan los criterios para pasar a Postgres RLS como segunda línea (defensa en profundidad), fuera de alcance aquí.

## Impacto sobre el sistema actual (medido, no estimado)

| Elemento | Magnitud real | Afectación |
|---|---|---|
| Archivos con llamadas Prisma | **443** | Ninguno requiere cambio inmediato; el enforcement es transversal. Los que violen el scope aparecerán en el reporte shadow |
| Modelos totales / con tenantId / sin | **128 / 89 / 39** | Los 39 deben clasificarse (PG-A1); ~8 necesitan columna `tenantId` nueva + backfill (olas PG-C) |
| Punto de instanciación del cliente | `src/lib/prisma.ts` (1 archivo) | Se convierte en la fábrica con extensión; compat hacia atrás mantenida |
| Resolución de contexto | `authenticateUser` + `withAction` | Se añade ~10 líneas para poblar AsyncLocalStorage |
| Raw SQL | presente (mermas stats, contabilidad, snapshots…) | Inventario + allowlist; cada uno queda registrado con justificación |
| Usos legítimos cross-tenant | auth, admin panel, afiliados, demos, seeds, cron de backups/demos | Migran a `prismaPlatform` con test de imports que impide su uso en `src/features/**` |
| API mobile | 14 grupos de rutas | Mismo contexto ALS; cero cambios específicos |
| Tests existentes (prisma mockeado) | suite completa | El mock de `@/lib/prisma` mockea también los nuevos exports (mismo módulo); contrato `test-isolation-contract` se extiende al nuevo módulo |

## Criterios de aceptación

1. Existe test de contrato: **todo** modelo del schema está clasificado; añadir un modelo sin clasificar rompe CI.
2. En `enforce`, un test de integración real (convención `__integration__`) demuestra: tenant A no puede leer/crear/modificar/borrar datos del tenant B vía ningún patrón de operación Prisma sobre modelos scoped — aunque el handler "olvide" el filtro.
3. `create` con `tenantId` distinto al del contexto es rechazado; idem sub-writes anidados.
4. Los usos de `prismaPlatform` fuera de la lista blanca (auth/admin/seeds/cron/afiliados) rompen CI.
5. Las numeraciones y catálogos globales accidentales conocidos quedan o bien migrados a por-tenant o formalizados en la clasificación `global` con justificación escrita.
6. Rollout: shadow en producción sin violaciones inesperadas durante N días antes de enforce (gate P); rollback = `TENANT_ISOLATION_MODE=shadow`, sin migración destructiva.
7. Paridad funcional: suite acotada de features críticas (ventas, contabilidad, productos, contratos, ofertas) verde con `enforce` activo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Falsos positivos rompen flujos legítimos al activar enforce | Modo shadow con métricas primero; lista de excepciones revisable; rollout por entorno |
| Rendimiento (inyección de where / doble query) | `extendedWhereUnique` evita pre-queries; medir en staging; la extensión no intercepta cuando no hay modelo scoped |
| AsyncLocalStorage pierde contexto en jobs/background | Esos paths usan `prismaPlatform` explícito; test estático lo vigila |
| Denormalizar `tenantId` a modelos hijo (backfill) toca datos | Scripts dry-run con conteo, backfill solo de coincidencias únicas desde el padre, migraciones aditivas con gate de revisión SQL (patrón ya usado en fx-evidence) |
| Raw SQL sin interceptar | Allowlist + revisión obligatoria; el contrato estático impide raw SQL nuevo fuera de ella |
