# Propuesta — Migración del backend a servicio API en Go (serie GO)

## Decisión ejecutiva

Antes de portar lógica a Go, extraer progresivamente los casos de uso TypeScript a un núcleo desacoplado de Next.js, conservando las actions y rutas existentes como adaptadores. Después, extraer el backend de TCP (hoy ~157 server actions `withAction` + 263 API routes legacy sobre Next.js/Prisma, 53 dominios funcionales) a un **servicio API independiente en Go con Gin**, desplegado como segundo servicio en Railway, **conviviendo con el monolito sobre la misma base PostgreSQL** y con corte de tráfico **dominio por dominio** vía `rewrites` de Next.js. El frontend Next.js 15 se mantiene y termina como capa de presentación pura. La migración es incremental y reversible mientras convivan los adaptadores legacy: cada dominio se porta, se verifica con **tests de paridad (golden tests)** contra la implementación TS, y solo entonces se corta el tráfico. Prisma/sus migraciones siguen siendo dueños del schema durante toda la transición.

## Why

1. **Decisión tomada por el usuario (2026-09-22):** el backend se migra a Go con Gin. La comparativa de frameworks Node (Fastify/Hono/Nest/tRPC/Elysia) y no-Node (Go/Rust/FastAPI/C#) quedó documentada en sesión previa.
2. **El cuello de botella medido es PostgreSQL, no Node** ([docs/auditoria-rendimiento-2026-09-21.md](/docs/auditoria-rendimiento-2026-09-21.md)): `VentaItem` sin índices, 113/289 FKs sin índice, tx de venta con ~15+6·N queries, reportes que agregan históricos completos en JS. La migración a Go **no excusa** ese trabajo: se ejecuta en paralelo (serie R) y la serie GO **subsume** R-3 al escribir los reportes directamente en SQL.
3. **El monolito ya pagó su costo de complejidad**: tres mecanismos de entrada (server actions, API routes legacy, API móvil), la lógica de negocio dispersa en 172 archivos de actions, y Next.js acoplado a decisiones de datos (revalidatePath, RSC) impiden razonar sobre el backend como sistema.
4. **La deuda estructural viaja si no se corrige antes**: existen **12 implementaciones divergentes** de costo/valoración/rentabilidad (auditoría §Frente 5). Portarlas tal cual es portar los bugs; R-4 (servicio canónico) es prerrequisito de las fases de escritura.

## What Changes

| Hoy | Objetivo |
|---|---|
| Backend = server actions + API routes dentro de Next.js | Servicio `api-go` (Gin + sqlc + pgx) independiente; Next.js consume por HTTP |
| Lógica en 172 archivos de actions bajo `src/features/` | Primero casos de uso TS por slice en `src/dominio` (decisión explícita del usuario; NO `packages/domain`), sin Next/Prisma; después dominios Go espejo (`internal/domain/ventas`, `contabilidad`, ...) |
| Validación Zod en cada action | Binding + validación de Gin (`go-playground/validator`) + schemas reutilizados por request |
| Respuestas `{ success, data?, error? }` de `withAction` | **Mismo envelope** en Go: el frontend no cambia su manejo de errores ni códigos (`PRICE_MISMATCH`, etc.) |
| Auth: JWT HS256 + lookup de `UserSession` en cada request | Go verifica el **mismo JWT con el mismo secreto** y consulta la **misma tabla `UserSession`** — invalación idéntica, cero cambios de sesión |
| Reportes = findMany gigantes + reduce en JS | Reportes nacen en **SQL via sqlc** (GROUP BY/fechas obligatorias): la serie R-3 queda absorbida |
| Prisma dueño del schema | Prisma **sigue** dueño del schema durante toda la transición; sqlc regenera queries en CI a cada cambio de schema |

## No-goals

- **No se reescribe el frontend**: solo cambia el origen de los datos, no las pantallas ni los flujos de UI.
- **No se cambia la base de datos**: misma PostgreSQL, mismos datos, sin doble escritura ni sincronización.
- **No se tocan** la serie CTA (contabilidad formal) ni la serie R (rendimiento): GO las consume (CTA vive en Prisma hasta su GO-5/GTP; R-0/R-1/R-4 son prerrequisitos).
- **No se migra auth de emisión** (login/logout/refresh) hasta GO-6: Next sigue emitiendo sesiones durante toda la transición.
- **No se portan endpoints admin/backoffice de bajo valor** (backups, seed demos, métricas de plataforma) en esta serie: quedan en Next hasta decisión posterior.
- **No hay big-bang**: ningún corte de dominio sin golden tests verdes, flag de reversa probado y ventana de convivencia. La extracción TS no es código compartido con Go: es una especificación ejecutable y puente de transición; Go reimplementa bajo contratos y pruebas equivalentes.

## Solución propuesta (resumen; detalle en design.md)

La fase previa **PRE-GO** prepara inventario y fronteras en /0 y extrae por slices desde /1, preservando los adaptadores Next; GO-0 solo comienza tras sus criterios de salida. Serie **GO** en 7 fases:

1. **GO-0 — Fundaciones del servicio.** Reconciliar primero el bootstrap ya existente en `../FINANCEMDM-API/` con la ubicación definitiva (monorepo `services/api-go/` o repositorio separado), stack HTTP y configuración; no duplicar código. Módulo Go en la ubicación aprobada (Gin, pgx/v5, sqlc, zerolog, config por env), Dockerfile multi-stage, healthchecks, CI (build+lint+test), servicio Railway apuntando a la **misma** `DATABASE_URL`, despliegue en verde. Tracer bullet: `GET /api/v1/productos` de solo lectura recorriendo todo el andamiaje (proxy → auth → tenant → sqlc → respuesta envelope).
2. **GO-1 — Cross-cutting completo.** Middleware de auth (JWT HS256 + `UserSession`), middleware de tenant, envelope de errores compatible, estrategia de money (Decimal → `shopspring/decimal`, nunca float64), helper transaccional, OpenAPI via swaggo con **CI gate anti-drift** + generación de tipos TS (`openapi-typescript`) para el frontend, rewrites en Next configurables por dominio.
3. **GO-2 — Ventas lectura.** Listados/detalle/resúmenes del ciclo de venta (incluye paginación real — corrige A-1 de la auditoría). Golden tests TS↔Go, corte por rewrite, `pnpm run test:smoke:prod` en verde.
4. **GO-3 — Ventas escritura (la bestia).** `createVenta` completa (serie documental, LP-0 con `PRICE_MISMATCH`, inventario, FIFO, kardex, factura, CxC, reconciliaciones) + anular/devolver/entregar. **Prerrequisito: R-4** (servicio canónico de costo) para no portar divergencias. Transacción Go equivalente en atomicidad y orden.
5. **GO-4 — Núcleo operativo.** Productos (incl. carga al POS), clientes, almacenes, inventario (mermas, transferencias, ajustes, conteos), compras (incl. OC/recepciones), cuadre de turno/diario.
6. **GO-5 — Contabilidad y reportes.** Reconciliaciones, CxC/CxP, anticipos, préstamos/deudas, cuadres de período, balance/P&L y **todos los reportes de la auditoría (A-1..A-11) escritos directamente en SQL**. Absorbe la capa formal CTA cuando exista en producción.
7. **GO-6 — Cola y retiro.** Dominios de menor tráfico (empleados/nómina, reparaciones, producción/recetas, contratos, CRM, planes/roles, mi-empresa), migración de login a Go, apagado de las 263 API routes legacy y de las actions sustituidas, decisión final de propiedad del schema (golang-migrate vs Prisma), Next queda como frontend puro.

## Impact

| Elemento | Magnitud real (medida 2026-09-21/22) | Afectación |
|---|---|---|
| Entradas backend | ~157 `withAction` + 263 routes + 172 archivos de actions | Todas migran o mueren; ninguna se porta sin golden test |
| Dominios | 53 features | Orden: ventas → núcleo → contabilidad → cola (criterio tráfico × riesgo × dependencia R-4) |
| Schema | 148 modelos, 116 campos Decimal | sqlc se regenera en CI por cambio de schema; Decimal → shopspring |
| Frontend | 53 features consumiendo actions | Primero adapters Next finos sobre casos de uso TS; después fetch a `/api/v1/*`, preservando contratos observables |
| Infra | 1 servicio Railway | +1 servicio (`api-go`), mismo PostgreSQL; health-gated |
| Datos críticos | FIFO, series documentales, cierres con lock | Golden tests de paridad DB-estado + corte reversible por dominio |

## Riesgos principales y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Divergencia de reglas TS↔Go durante la convivencia | Golden tests por dominio (mismo payload → mismo estado DB y misma respuesta); corte solo con paridad verde |
| Drift OpenAPI (swaggo) — elegido Gin sobre Huma; el contrato vive en comentarios | CI gate: spec regenerado debe ser idéntico al commiteado + tests de contrato que validan respuestas reales contra el spec |
| 12 cálculos de costo divergentes portados con bugs | R-4 bloquea GO-3 y GO-5: una sola regla canónica, test oro compartido TS↔Go |
| Sesiones: comportamiento distinto de invalidación | Go replica exactamente el lookup `UserSession`; tests de sesión (expirada, revocada, tenant cambiado) |
| `PRISMA_MIGRATION_MODE=db-push` cambia el schema sin avisar a Go | CI: `sqlc generate` diff limpio obligatorio; si un modelo nuevo rompe queries, CI lo detecta antes del deploy |
| Costo de doble mantenimiento prolongado | Ventana de observación acotada por dominio con métricas y fecha de retiro; código TS legacy se borra en una entrega posterior al cierre de rollback |

## Prerrequisito PRE-GO — extracción del núcleo TS

Plan ejecutable: [pre-go-extraccion-nucleo.md](./pre-go-extraccion-nucleo.md). Los puntos siguientes son su resumen, no una segunda fuente de tareas.

- **Intent y alcance:** reducir acoplamiento a Next/Prisma y disponer de una referencia ejecutable para Go sin cambiar contratos públicos. La frontera aprobada es `src/dominio` (NO `packages/domain`); `domain` aloja reglas deterministas, `application` casos de uso con puertos mínimos por capacidad, y los adaptadores Prisma/Next quedan fuera de `src/dominio`. La ubicación no obliga a extraer solo funciones puras: el objetivo incluye el caso de uso de aplicación completo.
- **PRE-GO/0, exclusivamente preparación:** inventario versionado operación → action/route → consumidor web/mobile → firma, respuesta/error → auth/tenant/permisos → tablas/efectos → tests; ADR de frontera `src/dominio` y ownership de adaptadores; import-lint automatizado de dependencias directas y transitivas prohibidas (Next, Prisma, request globals, adaptadores), más baseline por slice y evidencia de resultados. No mover lógica, no alterar runtime ni crear el núcleo funcional en esta etapa.
- **PRE-GO/1, posterior y separado:** piloto de lectura compartida `getProductosAction()` (`src/features/productos/actions-crud.ts`) y `GET /api/mobile/v1/products` (`src/app/api/mobile/v1/products/route.ts`), hoy basados en `ProductoService.list(tenantId, filters?)` (`src/features/productos/services/producto-service.ts`). Extraer la orquestación a un caso de uso en `src/dominio` con puertos mínimos e implementar adaptadores Prisma fuera de él; mantener resolución de stock derivado, firmas, forma de respuesta, errores y scope tenant en ambas superficies. No reemplazar este caso de uso por una extracción exclusivamente pura.
- **TDD estricto por slice:** primero baseline y tests de caracterización del comportamiento actual; para la nueva frontera registrar RED reproducible (test nuevo que falla por ausencia del caso de uso/puerto o contrato) antes de escribir GREEN, seguido de refactor y pruebas de regresión. Conservar evidencia de comando, caso fallido, causa esperada y resultado GREEN; un test verde de caracterización no cuenta como RED. Unit con fake ports, integración Prisma en DB aislada, contratos web/mobile y tenant negativo, import-lint y build son gates para PRE-GO/1, no actividades ejecutadas en esta propuesta.
- La escritura sigue sin piloto seleccionado: decidir recién tras inventario de transacciones/efectos; no mezclar PRE-GO/0, PRE-GO/1 y PRE-GO/2 ni extraer los 172 archivos de una vez.
- Inyectar `ActorContext` validado (usuario, tenant, permisos/features relevantes) desde el adaptador; nunca construirlo desde input no autenticado. El use case revalida invariantes y autorización sensible; persistencia exige tenant scope en la transacción. `revalidatePath`, `cookies()`, headers Next, status HTTP y serialización son del adaptador.
- Preservar atomicidad, lock order, errores, idempotencia y precisión monetaria. Fijar snapshots/contratos observables antes de cada refactor. El paquete TS sirve como baseline para Go y se retira cuando ya no tenga consumidores, no se consume directamente desde Go.
- Criterio de salida PRE-GO: ≥1 slice completo tras pruebas unitarias, de integración aislada, contrato y E2E crítico; grafo/import-lint sin Next ni Prisma en el núcleo; paridad del adaptador; mapa de migración actualizado y plan de reversa probado. La cobertura es por código tocado, no un porcentaje global inventado. El plan PRE-GO enlazado aún menciona `packages/domain` como posibilidad: alinearlo con esta decisión antes de aprobar Spec, sin editarlo durante Propose.

### Áreas afectadas y límites de validación PRE-GO

| Área | Impacto previsto | Límite |
|---|---|---|
| `openspec/changes/migracion-backend-go/` | Propuesta ahora; ADR, inventario y evidencia en PRE-GO/0 | Documentación versionada, sin cambios de runtime en /0 |
| Configuración de lint/CI y tests del slice (ruta por definir en Spec) | Gate import-lint y baseline en /0 | Import graph directo/transitivo y pruebas aisladas |
| `src/dominio/` | Nuevo solo en PRE-GO/1 | Application use case + puertos; sin Next/Prisma |
| `src/features/productos/actions-crud.ts`, `src/app/api/mobile/v1/products/route.ts` | Adaptadores a modificar solo en /1 | Auth y tenant verificados; firma y respuesta intactas |
| `src/features/productos/services/producto-service.ts` | Fuente del comportamiento actual; refactor solo en /1 si corresponde | Prisma, filtros y stock derivado bajo pruebas de paridad |

### Tradeoffs y riesgos PRE-GO

| Riesgo / tradeoff | Probabilidad | Mitigación |
|---|---|---|
| `src/dominio` facilita integración con alias actual pero no impone aislamiento por paquete | Media | ADR + import-lint transitivo en CI y test de importabilidad sin Next/DB |
| Diferencia entre resultado de Server Action y status/body móvil, o cambio de stock derivado | Alta | Matriz contractual por superficie y tests de paridad de filtros, stock y serialización |
| Filtración entre tenants por contexto o consulta Prisma sin scope | Alta | Actor verificado en entrada, consultas tenant-scoped, tests negativos entre tenants |
| Cambios concurrentes en archivos no relacionados | Alta | Revisar Git antes de cada fase; tocar únicamente artifacts autorizados, no pisar trabajo ajeno |

**Rollback PRE-GO:** /0 revierte únicamente sus artifacts documentales y gates de CI si bloquean por falso positivo, conservando el inventario para diagnóstico; /1 restituye el wiring de action/route a `ProductoService.list` sin migraciones ni cambios de datos, con pruebas de contratos y tenant repetidas. No cortar tráfico Go ni borrar el servicio previo mientras la reversa no esté ensayada.

**Gates para Spec:** describir escenarios Given/When/Then para contratos separados de action y API móvil (filtros, stock derivado, errores, tenant ausente/ajeno), enumerar el inventario/versionado y ADR exigidos en /0, definir chequeo transitorio de import-lint antes de existir `src/dominio`, fijar baseline por slice y evidencia RED→GREEN para /1, y establecer paridad y rollback verificables. Ninguna prueba se declara ejecutada aquí.

## Decisiones pendientes antes de GO-0

- Ubicación/propiedad Git de `../FINANCEMDM-API/` frente a `TCP/services/api-go/`; stack actual `net/http` frente a Gin, y contrato de env/health. Resolver con ADR antes de trasladar o duplicar código.
- Matriz contractual diferenciada para Server Actions (resultado sin status HTTP), API web/móvil (HTTP status/body) y API Go. Inventario máquina-legible action/route → consumidor → caso de uso → contrato → corte/rollback.
- Acceso directo a Go si su URL es pública: preferir red privada; si no existe, autenticar obligatoriamente tráfico proxy con secreto rotativo sin reemplazar auth de usuario, limitar tasa y probar rechazo directo.
- Golden tests de escritura sobre estados DB iniciales idénticos e independientes (clones/schemas/restore), no ejecuciones secuenciales sobre una DB mutada.
