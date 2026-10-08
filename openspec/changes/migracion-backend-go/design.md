# Design — Servicio API en Go (serie GO)

## 1. Arquitectura y estructura del repo

Ubicación objetivo ilustrativa, pendiente de reconciliar con el bootstrap real `../FINANCEMDM-API/` (que no es raíz Git). No mover ni duplicar antes de ADR de propiedad y despliegue:

```
TCP/
├── src/                      # Next.js (frontend + backend legacy, se vacía con GO-6)
├── prisma/                   # SIGUE siendo dueño del schema durante toda la transición
└── services/api-go/
    ├── cmd/api/main.go       # bootstrap: config, pool pgx, router, middlewares
    ├── internal/
    │   ├── platform/         # http (server, envelope, errores), auth, tenant, db (tx helper), logging, metrics
    │   ├── domain/
    │   │   ├── ventas/       # service.go (puro), http.go (handlers), sql (queries sqlc)
    │   │   ├── productos/
    │   │   ├── contabilidad/
    │   │   └── ...           # espejo de src/features/
    │   └── gen/sqlc/         # código generado (no se edita)
    ├── sqlc.yaml             # queries → internal/gen; queries escritas a mano en internal/domain/*/queries.sql
    ├── openapi/              # spec generada por swaggo (commiteada, CI compara)
    ├── Dockerfile            # multi-stage: golang:1.x-alpine → distroless (~20MB)
    └── go.mod
```

Reglas de diseño:
- **Los casos de uso Go son independientes del transporte**: reciben structs/contexto verificado y puertos, devuelven resultados de aplicación; no reciben `*gin.Context` ni dependen de pgx directamente. Los handlers hacen bind/validate y llaman al servicio. Así el 100% de la lógica se testea sin HTTP.
- **Un dominio = un router group** montado en `/api/v1/<dominio>`. El corte de tráfico se hace por prefijo.
- Nada de ORM: **sqlc + pgx/v5**. El SQL vive en `queries.sql` por dominio — las agregaciones complejas de la auditoría (R-3) nacen directamente como SQL.

## 2. Flujo de request y corte de tráfico

```
Cliente → Next.js (kr4t3rdev.xyz)            Railway
         │                                    ┌─────────────────┐
         ├─ /api/v1/ventas/* ── rewrite ────► │ api-go (Gin)    │──► PostgreSQL (misma DB)
         │                                    └─────────────────┘         ▲
         └─ /api/* legacy / server actions ───► runtime Next ────────────┘
```

- `next.config` `rewrites()` mapea prefijos de dominio cortados a `API_GO_URL` cuando el contrato lo permite. Un rewrite simple no adjunta por sí mismo `Authorization` ni un secreto por request: para cookie→Bearer y autenticación de servicio se necesita proxy/BFF explícito con política de forwarding de headers/cookies y pruebas de seguridad; preferir red privada. Evitar reenviar cookies o secretos a destinos no autorizados.
- El corte es por dominio o sub-slice tras pruebas de contrato. La reversa conmuta el routing al adaptador TS aún operativo; probarla en staging. La convivencia tiene plazo y owner; retirar TS solo en una entrega posterior a la ventana de observación y aprobación de métricas.
- Server Actions no son rutas HTTP y no pasan por `rewrites`: su consumidor debe continuar invocando el caso de uso TS durante la convivencia o migrarse explícitamente a un adaptador/fetcher Go tipado. Ningún rewrite se considera migración de una action por sí solo.

## 3. Auth: paridad exacta con el sistema actual

Hoy (`src/lib/auth-middleware.ts`) el flujo incluye JWT, `UserSession`, usuario activo, selección de tenant, membresía/rol, permisos, licencia/features y actualización de actividad. La extracción PRE-GO preserva este contrato y lo convierte en matriz de paridad; no reducirlo al JWT.

Middleware Go equivalente:
1. Aceptar Bearer y/o cookie según el contrato de cada endpoint, o usar un BFF explícito que valide la cookie y emita credenciales internas; verificar paridad y CSRF donde correspondan. No asumir que un rewrite convierte cookie en Bearer.
2. Verificar firma HS256 con el **mismo `JWT_SECRET`** (env compartida en Railway via variable referenciada).
3. Lookup de `UserSession` y usuario con semántica de revocación, expiración, desactivación y actualización `lastActive`; verificar exactamente columnas y reglas del schema vigente antes de fijar SQL.
4. Claims en `context.Context` (`auth.User` con UserID/Email/TenantID).

Tests obligatorios: token expirado, firma inválida, sesión revocada/inexistente, usuario inactivo, `lastActive`, tenant solicitado por `x-tenant-id`, membresía/rol custom, permisos por ruta y mobile fail-closed, licencia/features y usuario sin tenant.

**Login/logout/refresh quedan en Next hasta GO-6**: Go solo verifica, nunca emite. La invalidación (logout, cambio de contraseña) funciona sin coordinación porque ambos consultan la misma tabla.

## 4. Tenant scope

- `requireTenant` actual → middleware/función `tenant.FromContext(ctx)` que retorna error `TENANT_REQUIRED` (mismo código P-code actual) si falta.
- **Convención dura**: `scoped` exige predicado tenant en lectura y escritura; `child` exige JOIN/EXISTS hasta parent scoped; `global` exige allowlist y autorización contextual. Fuente de clasificación: `src/lib/db/model-classification.ts`. Gate AST SQL con casos positivos/negativos y tests de integración multi-tenant; un grep de `tenant_id` no demuestra aislamiento. La transacción y sus queries reciben tenant verificado, nunca tenant del body.
- El lookup de rol/permisos (`requirePermission`) se porta igual: lectura de la misma tabla de membresía/roles.

## 5. Envelope y errores (contrato con el frontend)

Respuesta idéntica a `withAction`:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "code": "PRICE_MISMATCH" } }
```

- Errores de dominio: tipo `DomainError{Code, Message, HTTPStatus}`; los P-codes existentes (`PRICE_MISMATCH`, `NOT_FOUND`, `DUPLICATE`, `INSUFFICIENT_STOCK`, período cerrado, etc.) se preservan tal cual — el frontend reacciona por código y no debe notar el cambio.
- Matriz separada: las Server Actions `withAction` devuelven resultado/envelope y error funcional, **no** un status HTTP equivalente; routes web/mobile exponen status HTTP+body; Go debe conservar los códigos y shapes observables por consumidor. Status y error mapping se especifican y prueban por operación.
- Listas paginadas: `{ success, data: { items, total, page, pageSize } }` — paginación **obligatoria** en Go (corrige el hallazgo A-1: 59/69 findMany legacy sin `take`).

## 6. Money y precisión

Schema real: 116 campos `Decimal` + muchos `Int` de centavos (`VentaItem.precioUnitario Int`).
- `Decimal` → `github.com/shopspring/decimal` (sqlc override por tipo/columna).
- `Int` de dinero → `int64` explícito (documentado: son centavos/unidades mínimas del modelo actual).
- **Prohibido `float64` para dinero** — lint rule + revisión; toda conversión pasa por `decimal` o enteros.
- Totales FX (`montoConvertido`, `fxEvidence*`): los structs de evidencia se modelan como tipos Go idénticos al `fxEvidenceJson` actual (la capa formal CTA los hereda).

## 7. Datos: convivencia Prisma ↔ sqlc

- **Prisma es el dueño del schema durante toda la transición** (incluye `db-push` en producción): Go jamás ejecuta DDL.
- CI del servicio Go: `sqlc generate` → `git diff --exit-code internal/gen` → si un cambio de schema rompe queries, CI lo caza el mismo día.
- Pool pgx: `max_conns` conservador (Railway: ~20), `statement_timeout` 15s por defecto, interceptor de slow queries (>200ms → log warn con request-id).
- Transacciones: helper `db.WithTx(ctx, func(tx) error)` con reintento de serialización (`40001`) — la tx de venta actual es `Serializable` en los flujos de anulación/devolución; Go replica el mismo nivel.

## 8. Golden tests de paridad (el mecanismo central de seguridad)

Para cada dominio antes del corte:

1. **Fixture**: seed versionado sobre DB de prueba aislada, sin credenciales de producción; dos estados iniciales idénticos (DB clonadas/schemas separados o restore verificado).
2. **Ejecución dual**: mismo payload contra (a) la action TS actual y (b) el endpoint Go, en estados independientes para escrituras; jamás consecutivamente sobre datos contaminados.
3. **Comparación**: respuesta normalizada (orden de claves, redondeos) + **estado de DB** resultante (snapshots de tablas afectadas vía `pg_dump --table` filtrado o queries de verificación por dominio).
4. Corte solo con paridad verde en CI. En producción se deja **un día de observación** por dominio (métricas + logs comparados) antes de marcar la tarea cerrada.

Costo honesto: 1-2 días de arnés inicial (GO-1/T5) y ~30-60 min por endpoint después. Es lo que hace seguro todo lo demás.

## 9. OpenAPI como contrato con el frontend

Decisión registrada: **Gin** (el usuario eligió sobre mi recomendación Huma). Eso implica contrato por anotaciones:
- `swaggo/swag` genera `openapi/` desde comentarios; **CI gate**: regenerar y exigir `git diff --exit-code openapi/` (spec olvidada = CI rojo).
- Tests de contrato en Go: cada handler valida su respuesta contra el spec (kin-openapi) — esto neutraliza el drift que los comentarios no ven.
- Frontend: `openapi-typescript` genera `src/lib/api-go/types.ts` en CI/release; los fetchers del frontend pasan a tiparse desde el spec (eliminando el acoplamiento a tipos Prisma en el cliente).

## 10. Observabilidad y operación

- Logs estructurados JSON con `request-id` generado/validado en el proxy/BFF y correlación `traceparent` Next→Go→PostgreSQL (sin datos sensibles); fijar sampling y propagación explícita, no suponer que rewrite añade headers.
- Métricas: latency/error-rate por ruta (middleware Gin), expuestas `/metrics` (Prometheus) o al menos dashboard Railway nativo.
- `/healthz` (proceso vivo) y `/readyz` (ping DB) — el healthcheck de Railway apunta a `/readyz`.
- Panic recovery middleware con stack a logs (equivalente al error boundary de withAction).

## 11. Dependencias entre series (gobernanza)

| Serie | Relación con GO |
|---|---|
| **R-0** seguridad (fuga tenant) | ✅ Hecha (main, 306509d6) — los 3 endpoints entran a la lista de paridad |
| **R-1** índices | Recomendado antes de GO-2: Go no arregla full-scans |
| **R-3** reportes a SQL | **Subsumido**: los reportes nacen en SQL dentro de GO-5, no se portan las versiones JS |
| **R-4** cálculo canónico de costos | **Bloquea GO-3 y GO-5**: sin regla única no hay paridad posible |
| **CTA** capa formal (Prisma, en rama) | Coexiste: GO-3 porta la venta con sus hooks de asientos si CTA está merged; si no, se añade el hook Go en GO-5 |

## 12. Definición de "dominio migrado"

1. Endpoints Go con validación + envelope + tenant + permisos equivalentes.
2. Golden tests verdes (respuesta + estado DB).
3. Rewrite activo en staging y 1 día de observación.
4. `pnpm run test:smoke:prod` verde contra un entorno controlado con el dominio cortado; no ejecutar escrituras destructivas en producción.
5. Reversa a TS ensayada, código TS retenido hasta terminar ventana de observación y retirado posteriormente; conservar pruebas de reglas y contrato al eliminarlo.
6. Spec OpenAPI y tipos frontend regenerados; CI verde.

## 13. PRE-GO — núcleo TypeScript desacoplado antes del port

Secuencia, puertas y criterios de prueba: [pre-go-extraccion-nucleo.md](./pre-go-extraccion-nucleo.md).

### Alcance y arquitectura de PRE-GO/0 y PRE-GO/1

La única ubicación aprobada para el núcleo TS es **`src/dominio`** (decisión del usuario; nunca `packages/domain`). Esta sección diseña solo PRE-GO/0 y /1; la arquitectura Go anterior describe fases futuras y no habilita implementación, corte de tráfico ni piloto de escritura. El plan enlazado conserva referencias históricas a `packages/domain`: reconciliarlas en /0 mediante ADR y edición acotada del plan antes de aprobar /1.

```text
web: getProductosAction() ── withAction/requireTenant ─┐
                                                      ├─ composition root (fuera de src/dominio)
mobile: GET /api/mobile/v1/products ─ authenticateUser ┘        │
                                                         listProductos (application)
                                                               │
                                              puerto lectura tenant-scoped (application)
                                                               ▲
                                               adaptador Prisma (fuera de src/dominio)
                                                               │
                                            Producto + StockUbicacion (PostgreSQL)
```

**Decisión: separar preparación y extracción.** /0 entrega inventario versionado por operación (entrada, consumidores web/móvil, firma, filtros, salida/error y status HTTP cuando aplique, auth/tenant/permisos, tablas/efectos, pruebas, candidato, estado y rollback), ADR, gate de imports y baseline reproducible; **no crea `src/dominio`, mueve lógica ni altera runtime**. Operaciones incompletas quedan marcadas pendientes, no se aprueban por inferencia. /1 comienza solo después del cierre de /0 y ejecuta un único caso de uso de lectura. Alternativa descartada: extraer los 172 archivos de actions o montar un workspace package; incrementan riesgo sin evidencia de paridad y contradicen la frontera decidida.

**Decisión: un caso de uso compartido, no un wrapper de `ProductoService.list`.** En /1, `src/dominio/application/productos/list-productos.ts` orquesta consulta y stock derivado con puerto mínimo definido junto al caso de uso; `src/dominio/domain/` se reserva para reglas deterministas cuando sean necesarias. El adaptador Prisma en `src/features/productos/adapters/` implementa lectura de productos y totales de stock en batch; conserva selección/relaciones, `createdAt desc`, semántica actual de filtros y stock (`stock` sobrescrito por total y `stockTotal`, default 0). Ningún tipo Prisma, `ActionError`, Next, `src/app` ni módulo transitivamente acoplado ingresa al núcleo. Alternativa descartada: extraer solo `withDerivedStock` y dejar la orquestación en el servicio; no cumple la frontera de aplicación exigida.

**Decisión: autoridad en borde y defensa en profundidad.** Action y ruta construyen `ActorContext` desde identidad y membresía verificadas, no desde query, headers no confiables o body. El caso de uso rechaza tenant ausente y permisos pertinentes inválidos; el adaptador fuerza `where: { tenantId: actor.tenantId, ...filtrosPermitidos }` (no permite override mediante spread) y mantiene el alcance de la consulta de stock según el baseline. Validación de input de transporte y serialización pertenecen a cada entrada; permisos adicionales no se inventan sin caracterización del comportamiento vigente. `revalidatePath` no participa en una lectura. Alternativa descartada: asumir que un tenant string entregado por cliente es actor válido.

**Contratos observados que deben fijarse en /0.** `getProductosAction` actualmente recibe `void`, usa `withAction`, `requireTenant(user)` y retorna directamente `ProductoService.list(tenantId)` dentro del envelope de action. La ruta móvil autentica bearer con `authenticateUser`, rechaza tenant ausente con `errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED')`, responde `successResponse({ items })` y en fallo interno responde 500 `INTERNAL_ERROR`. Ambas invocan `list` **sin filtros** hoy, aunque `ProductoService.list` admite `categoryId`, `subcategoryId`, `search`; no ampliar firmas ni exponer filtros HTTP en /1 sin evidencia del inventario. La lista usa `PRODUCTO_SELECT`, orden descendente por creación y `getStockTotalProductosBatch`. Fijar snapshots de payload serializado (incluidos Decimal/Date), lista vacía, filtros realmente accesibles y errores por superficie antes de decidir DTO exacto. No equiparar status HTTP con resultado de action.

**Data flow / interfaces propuestas (orientativas; shapes definitivos tras baseline):**

```ts
interface ActorContext {
  userId: string;
  tenantId: string;
  permissions: readonly string[];
}
interface ListProductosPort {
  findByTenant(tenantId: string, filters: ProductFilters): Promise<ProductoRead[]>;
  stockTotals(tenantId: string, productIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
// listProductos({ actor, filters }, { productos: port }) => Promise<ProductoConStock[]>
```

`ProductoRead`, `ProductFilters` y el contrato de permiso deben cerrarse contra las firmas y snapshots existentes; representar precios/fechas sin conversiones implícitas ni `any`. En este listado `Producto.precioCosto`/`precioVenta` y `PrecioProducto.precio` son `Int`: caracterizar enteros y fechas JSON, sin exigir un Decimal Prisma artificial. El puerto recibe tenant verificado en **ambas** capacidades; el helper actual de stock consulta IDs sin predicado tenant: verificar con DB descartable el vínculo producto/tenant (incluido stock B apuntando a producto A), e imponer defensa en el futuro adaptador de /1 sin alterar /0. El composition root `src/features/productos/adapters/list-productos-composition.ts` instancia el caso de uso sin introducir ciclo `dominio → features`.

### Archivos por etapa (plan, no modificaciones ejecutadas)

| Etapa | Archivo | Acción prevista |
|---|---|---|
| /0 | `openspec/changes/migracion-backend-go/pre-go-inventario.md` | Crear mapa versionado y pendientes por operación; vincular web/móvil y contratos diferenciados. |
| /0 | `openspec/changes/migracion-backend-go/adr-pre-go-frontera.md` | Crear ADR de ubicación, ownership de auth/errores/transporte/persistencia y separación /0-/1. |
| /0 | `openspec/changes/migracion-backend-go/pre-go-extraccion-nucleo.md` | Reconciliar referencias a `packages/domain`, sin tocar otra lógica. |
| /0 | `scripts/check-dominio-imports.*`, `package.json`, configuración CI correspondiente | Gate transitorio: reglas configuradas, ausencia de `src/dominio` reportada como pendiente, nunca como aislamiento validado. Ruta/extensión de script y CI se confirman tras inspección. |
| /0 | `openspec/changes/migracion-backend-go/pre-go-baseline.md` | Registrar comandos, fixtures, resultados de caracterización web/móvil y fallas preexistentes. |
| /1 | `src/dominio/application/productos/list-productos.ts`, `src/dominio/application/productos/ports.ts` | Crear caso de uso, tipos y puertos mínimos, sin imports de framework. |
| /1 | `src/features/productos/adapters/list-productos-prisma.ts`, `src/features/productos/adapters/list-productos-composition.ts` | Crear adaptador tenant-scoped y wiring Prisma/stock fuera del núcleo. |
| /1 | `src/features/productos/actions-crud.ts`, `src/app/api/mobile/v1/products/route.ts` | Delegar lectura preservando firma, auth, envelope/status/body y errores de cada superficie. |
| /1 | `src/features/productos/services/producto-service.ts` | Conservar fuente de comportamiento/rollback; refactorizar `list` solo si paridad y consumidores lo justifican. |

### Gates, TDD y reversa (solo diseño)

En /0 capturar baseline por superficie con fixtures tenant A/B, productos con/sin stock, filtros existentes, orden, vacío, errores y serialización; caracterización verde o falla preexistente **no** es RED. En /1 primero registrar un test nuevo que falle por ausencia del caso de uso/puerto/contrato con comando, aserción y causa esperada; después GREEN sin relajar aserciones y refactor. Unit con fake ports (importación sin Next ni DB), integración Prisma solo en `src/**/__integration__/` con `DATABASE_URL_TEST` aislada, contratos action/mobile, negativos tenant, E2E crítico, import-lint directo/transitivo y build. Unit debe mockear `@/lib/prisma`; no ejecutar DB real ni tests en este diseño.

El import-lint de /0 valida reglas y marca núcleo inexistente como pendiente; en /1 resuelve imports relativos, alias `@/`, reexports y dependencias transitivas, falla mostrando cadena hasta Next/Prisma/adaptadores/request globals o módulos con efectos. El gate no reemplaza test de importabilidad sin runtime. Reversa /1: reconectar ambas entradas a `ProductoService.list`, repetir contratos y tenant negativos; sin migraciones de DB ni cambio de UI. /0 permite retirar solo un gate con falso positivo, conservando inventario/ADR/evidencia. No tocar archivos concurrentes fuera del slice.

### Dirección visual y UX

**No aplica:** se conserva exactamente la UI existente: paleta, tipografía, layout y animaciones sin cambios. La validación cliente y los toasts existentes tampoco cambian; la validación de autoridad queda en servidor y los adaptadores preservan los errores observables para que el cliente mantenga su comportamiento. Añadir una estética nueva o modificar copy violaría el alcance de extracción backend.

### Riesgos y preguntas de cierre

- El helper de stock recibe IDs sin tenant explícito: verificar alcance al extraer para impedir fuga por IDs ajenos, sin introducir diferencias de stock.
- La action no acepta filtros aunque el servicio sí: confirmar consumidores y contrato real antes de modelar filtros compartidos; no cambiar firma pública por conveniencia.
- Tipos Prisma/Int/Date y serialización `withAction` versus JSON móvil podrían divergir al crear DTOs: fijar baseline y comparación por superficie; mantener la diferencia observada sin tenant (action `INTERNAL_ERROR`, móvil HTTP 403 `TENANT_REQUIRED`).
- El gate transitivo requiere resolver alias/reexports y distinguir imports de tipo y efectos: comprobar capacidad del tooling antes de seleccionar script definitivo.
- No se considera completado /1 hasta tener paridad, aislamiento, evidencia RED→GREEN y reversa ensayada; ninguna de estas verificaciones se ha ejecutado en este trabajo de diseño.

## 14. Inventario y control de corte

Mantener un mapa versionado por operación: action/route, consumidor web/mobile, input/output y errores, permiso/tenant, caso de uso TS, endpoint Go, golden fixture, dependencia, flag, owner, rollback y fecha de retiro. Canonicalizar OpenAPI para HTTP con checks de consumidor/proveedor; las actions tienen un contrato de función distinto. Si Go expone URL pública, exigir autenticación de servicio **además de** usuario/tenant, secreto rotativo y rate limiting; rechazar por defecto cuando falte configuración, cubrir llamadas directas con tests.

GO-0 debe reconciliar el servicio de `../FINANCEMDM-API/` (actualmente `net/http`, `GET /health`, `APP_PORT`/`APP_DATABASEURL`, pgx y tests), no clonar un servicio paralelo a ciegas. ADR previo para ubicación Git, Gin versus mantener `net/http`, compatibilidad env y healthchecks.
