# Tasks — Migración del backend a Go (serie GO)

Plan por fases. PRE-GO/0 y PRE-GO/1 siguen TDD estricto y no autorizan commits automáticos, migraciones, cambios de UI ni trabajo GO. Antes de cada lote revisar estado y diff para no pisar trabajo concurrente; stage selectivo solo si otra instrucción solicita commit. En Go (fases futuras): tests con `go test ./...` por dominio; DB real con testcontainers o `DATABASE_URL_TEST`.

Rama sugerida para cambios TCP: `feat/backend-go` desde `main` solo tras revisar el worktree compartido; `services/api-go/` es una ubicación propuesta, no decidida. El bootstrap `../FINANCEMDM-API/` ya existe fuera de Git: registrar ADR de ubicación/propiedad antes de mover o duplicar.

**Prerrequisitos fuera de esta serie** (auditoría de rendimiento 2026-09-21):
- R-0 fuga tenant → ✅ hecho (306509d6).
- R-1 índices (`VentaItem` sin ninguno, FKs calientes) → recomendado antes de GO-2; Go no arregla full-scans.
- R-4 servicio canónico de costo/valoración → **bloquea GO-3 y GO-5** (12 cálculos divergentes; sin regla única no hay golden test posible).

## PRE-GO/0 — Preparación documentada y gates (bloquea PRE-GO/1)

Fuente de requisitos: [specs/pre-go/spec.md](./specs/pre-go/spec.md), §13 de [design.md](./design.md) y [pre-go-extraccion-nucleo.md](./pre-go-extraccion-nucleo.md). /0 **no crea `src/dominio`, no mueve lógica y no cambia runtime**. Cada tarea se ejecuta únicamente con autorización de su fase y tras revisar `git status`/diff del lote; preservar cambios concurrentes. Evidencia de comandos/resultados se obtiene durante Apply, no se presume aquí.

- [x] 0.1 Revisar `git status`/diff, `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, configuración de Vitest y workflow CI vigente; registrar rutas reales y ownership en `openspec/changes/migracion-backend-go/pre-go-inventario.md`, sin editar código ni archivos ajenos.
- [x] 0.2 Crear `openspec/changes/migracion-backend-go/pre-go-inventario.md` con filas versionadas operación → entrada → consumidor web/móvil → firma/inputs/filtros reales → respuesta/error (envelope action **sin** status vs status/body HTTP móvil) → auth/tenant/permisos → tablas/efectos → tests → candidato → estado/reversa; enlazar explícitamente `src/features/productos/actions-crud.ts`, `src/app/api/mobile/v1/products/route.ts`, `src/features/productos/services/producto-service.ts` y sus consumidores; marcar incógnitas `PENDIENTE` con responsable, nunca inferir autorización para extracción.
- [x] 0.3 Crear `openspec/changes/migracion-backend-go/adr-pre-go-frontera.md`: decisión única `src/dominio` (`domain` determinista, `application` con casos de uso/puertos por capacidad); auth/actor validado y errores/serialización/status en adaptadores Next, Prisma/tenant scope y composition root fuera; /0 solo preparación, /1 lectura, Go no importa TS, escritura sin seleccionar.
- [x] 0.4 Actualizar **solo** `openspec/changes/migracion-backend-go/pre-go-extraccion-nucleo.md`: reemplazar la alternativa vigente `packages/domain`/verificación para elegir paquete por la decisión `src/dominio`; enlazar ADR, distinguir tests de caracterización (baseline) de RED nuevo para frontera y posponer piloto de escritura a decisión posterior. Comprobar que proposal/spec/design/preplan/tasks no ofrecen otra ubicación aprobada.
- [x] 0.5 RED de gate: agregar pruebas para `scripts/check-dominio-imports.*` (ubicación de tests según tooling confirmado en 0.1) que fallen por ausencia de regla o diagnóstico; cubrir imports directos y transitivos por relativos, alias `@/`, reexports, imports de tipo y módulos con efectos, así como ausencia transitoria de `src/dominio`; registrar caso/causa/resultado en `openspec/changes/migracion-backend-go/pre-go-baseline.md`.
- [x] 0.6 GREEN de gate: implementar `scripts/check-dominio-imports.*` y comando en `package.json` que detecten rutas hasta `next/*`, Prisma, `src/app`, adaptadores, globals request y efectos de entrada; si falta `src/dominio`, validar configuración y reportar `PENDIENTE`, **no** proclamar aislamiento verificado; conectar el comando al workflow CI existente identificado en 0.1 sin crear núcleo funcional.
- [x] 0.7 REFACTOR de gate: simplificar resolución/reglas de `scripts/check-dominio-imports.*` sin perder pruebas negativas/positivas; registrar en `pre-go-baseline.md` comandos, diagnósticos con cadena de imports y cómo retirar solo el gate ante falso positivo conservando ADR/inventario.
- [x] 0.8 Baseline de caracterización: añadir/ajustar tests junto a `src/features/productos/actions-crud.ts`, `src/app/api/mobile/v1/products/route.ts` y `src/features/productos/services/producto-service.ts` (rutas `*.test.ts` existentes o nuevas según 0.1) **sin cambiar producción**: firma void de action y filtros realmente expuestos, `ProductoService.list` filtros internos, `PRODUCTO_SELECT`, orden `createdAt desc`, stock batch (`stock`/`stockTotal`, cero), vacío, errores, auth/permisos, tenant ausente/ajeno y payload serializado de precios `Int`/Date por superficie (no exigir Decimal Prisma real en este listado). Unit mockea `@/lib/prisma` o servicio; no conexión real.
- [x] 0.9 Registrar `openspec/changes/migracion-backend-go/pre-go-baseline.md`: fixtures reproducibles tenants A/B, productos con/sin stock y filtros admitidos; comandos/resultados de caracterización action, HTTP móvil y servicio, fallos preexistentes clasificados, snapshots por superficie, consumidores y semántica exacta observada. Tests verdes de caracterización o fallos de infraestructura **no son RED**.
- [x] 0.10 Puerta /0: ejecutar durante Apply tests focalizados de 0.5/0.8, comando transitorio de import-lint, lint/typecheck de archivos tocados y build si el gate CI lo requiere; documentar resultados en `pre-go-baseline.md`, revisar diff y constatar ausencia de cambios de runtime y `src/dominio`. Si falla caracterización, clasificar y bloquear /1 hasta resolver baseline; no declarar frontera validada estando ausente.

## PRE-GO/1 — Lectura de productos tenant compartida (solo después de 0.10)

Piloto **único**: `getProductosAction()` y `GET /api/mobile/v1/products`, actualmente sin filtros expuestos, comparten un caso de uso real de orquestación (no un wrapper sobre `ProductoService.list`). Baseline 0.9 define shapes finales; no ampliar firmas ni filtros HTTP por conveniencia. Conservar `ProductoService.list` para reversa, sin cambiar schema, pantallas ni tráfico Go. Cada par RED→GREEN exige guardar comando, fallo esperado y resultado GREEN en `pre-go-baseline.md`; ejecutar REFACTOR y regresión antes del siguiente par.

- [ ] 1.1 RED frontera: crear `src/dominio/application/productos/list-productos.test.ts` con fake ports y actor verificado, casos de lista/orden/stock cero, vacío, tenant ausente y permiso pertinente inválido; demostrar fallo nuevo por caso de uso/puerto ausente (no por DB, test de caracterización ni infraestructura) y guardar evidencia.
- [ ] 1.2 GREEN frontera: crear `src/dominio/application/productos/ports.ts` (tipos/puerto mínimo `findByTenant` y `stockTotals`, tenant en ambas capacidades) y `src/dominio/application/productos/list-productos.ts` (validación actor, orquestación consulta+stock batch, shape sin tipos Next/Prisma ni coerción monetaria/fechas). `src/dominio/domain/` solo si surge regla determinista demostrada; hacer pasar 1.1 sin aflojar aserciones.
- [ ] 1.3 REFACTOR frontera: refinar tipos/duplicación en `src/dominio/application/productos/{ports,list-productos}.ts` y repetir test 1.1; test de importación aislada del caso de uso sin mocks de Next ni credenciales DB (si unit importa servicios con Prisma, mockearlos conforme barrera MM-B).
- [ ] 1.4 RED persistencia: crear `src/features/productos/adapters/list-productos-prisma.test.ts` con Prisma mockeado, fixtures A/B, filtros admitidos y stock por IDs; fallar por falta del adaptador/scope; verificar que no se acepte tenant de filtros/headers, que `findMany` imponga tenant y orden/selección del baseline y que stock no consulte IDs de tenant ajeno.
- [ ] 1.5 GREEN persistencia: crear `src/features/productos/adapters/list-productos-prisma.ts` con selección/mapeo equivalentes a `ProductoService.list` y consulta stock batch tenant-scoped; imponer `tenantId` verificado después de normalizar filtros, sin spread que lo sobrescriba; preservar `stock`, `stockTotal`, default 0, fechas/Decimal y orden. Hacer pasar 1.4; mantener servicio legacy intacto para rollback.
- [ ] 1.6 REFACTOR persistencia: aislar conversión de filas en `src/features/productos/adapters/list-productos-prisma.ts`, revisar queries para vínculo producto→tenant en stock y repetir 1.4 y tests legacy; no modificar `producto-service.ts` salvo paridad demostrada y revisión de consumidores.
- [ ] 1.7 RED integración aislada: crear `src/features/productos/__integration__/list-productos-prisma.test.ts` con DB de prueba `DATABASE_URL_TEST` dedicada y fixtures A/B, productos con/sin stock y filtros; comprobar que lectura y batch stock no filtren datos B a A y que no muten DB. No incluir en corrida unit Vitest; registrar RED por comportamiento nuevo faltante y resultado GREEN tras corregir adaptador (si ya está verde, no presentarlo como RED; usar un caso nuevo específico reproducible antes del fix).
- [ ] 1.8 RED wiring/contratos: extender tests de `src/features/productos/actions-crud.ts` y `src/app/api/mobile/v1/products/route.ts` para exigir delegación al mismo caso de uso y conservar firmas y snapshots baseline; cubrir auth/actor desde membresía verificada, tenant ausente/ajeno, permiso/contexto inválido, vacío, falla Prisma sin detalles internos, envelope/código action vs HTTP status/body móvil. Registrar fallo nuevo de delegación antes de cambiar entradas.
- [ ] 1.9 GREEN wiring: crear `src/features/productos/adapters/list-productos-composition.ts` y actualizar **solo lectura** en `src/features/productos/actions-crud.ts` y `src/app/api/mobile/v1/products/route.ts`; construir actor desde `withAction`/`requireTenant` y `authenticateUser`/tenant validado respectivamente, delegar al caso común, mantener traducción de errores, `successResponse({ items })`, `TENANT_REQUIRED` e `INTERNAL_ERROR` según baseline; no agregar filtros públicos ni revalidación de caché a lectura.
- [ ] 1.10 REFACTOR wiring: simplificar composition/adaptadores Next sin ciclo `dominio → features`; repetir tests de 1.8 y comparar firma, orden, JSON/Decimal/Date, stock, vacío y errores con snapshots separados de 0.9. Actualizar filas del piloto en `pre-go-inventario.md` con caso de uso, puertos, consumidor y reversa.
- [ ] 1.11 Gate final y evidencia: ejecutar durante Apply unit fake-port y contratos web/móvil con Prisma mockeado, integración 1.7 **solo** mediante `DATABASE_URL_TEST` aislada, E2E crítico del listado (ruta existente identificada en 0.1 o test nuevo junto al E2E de productos), `scripts/check-dominio-imports.*` (directo/transitivo con cadena), importabilidad sin Next/DB, lint, typecheck y `pnpm run build`; registrar comandos/resultados, RED→GREEN→REFACTOR y fallos preexistentes en `pre-go-baseline.md`. Cualquier gate rojo bloquea salida.
- [ ] 1.12 Ensayo de reversa: temporalmente reconectar **ambas** entradas en `src/features/productos/actions-crud.ts` y `src/app/api/mobile/v1/products/route.ts` a `ProductoService.list` sin tocar esquema/datos, ejecutar contratos y negativos tenant, documentar resultado en `pre-go-baseline.md`, restaurar wiring nuevo y repetir contratos/tenant; conservar `src/features/productos/services/producto-service.ts` hasta cerrar ventana de rollback. Revisar diff para preservar trabajo concurrente.

**Puerta de salida /1:** /0 cerrado, tests y paridad por superficie verdes, import-lint sin dependencias prohibidas, integración aislada/E2E/build verdes y reversa ensayada; inventario y riesgos actualizados. No elegir ni ejecutar PRE-GO/2 (escritura) en este checklist: requiere nuevo inventario de transacciones/efectos y selección posterior explícita. GO-0 y cortes Go siguen fuera de esta fase.

## GO-0 — Fundaciones del servicio

- [ ] **T0 — ADR y adopción.** Auditar `../FINANCEMDM-API/` (bootstrap sin raíz Git, `net/http`, `/health`, `APP_PORT`/`APP_DATABASEURL`); decidir monorepo vs repo separado, Gin vs net/http, convenciones env y pruebas de no regresión. Integrar trabajo existente sin duplicarlo.
- [ ] **T1 — Módulo y andamiaje.** Ubicación acordada para `api-go` con `go.mod` (Gin, pgx/v5, sqlc, zerolog, shopspring/decimal), `cmd/api/main.go` con config por env (`DATABASE_URL`, `JWT_SECRET`, `PORT`), estructura `internal/platform` + `internal/domain` vacía.
- [ ] **T2 — Infra de proceso.** Pool pgx (max_conns ~20, statement_timeout 15s, slow-query log >200ms), graceful shutdown, `/healthz` + `/readyz` (ping DB), middleware request-id + recovery + logging JSON.
- [ ] **T3 — Dockerfile + Railway.** Multi-stage a distroless; servicio `api-go` en Railway con `DATABASE_URL`/`JWT_SECRET` referenciadas al proyecto actual; deploy verde con healthcheck en `/readyz`; **sin tráfico de usuario todavía**.
- [ ] **T4 — CI.** Job en `ci.yml` (o workflow propio): `go vet`, `staticcheck`, `go test ./...`, `sqlc generate` + diff limpio, build del binario. Falla = PR bloqueado.
- [ ] **T5 — sqlc conectado al schema real.** `sqlc.yaml` apuntando a la DB actual (o `pg schema` dumpado de Prisma); primera query de prueba (`SELECT 1`-like sobre `Producto` por tenant) compilando.
- Commit: `feat(go): andamiaje servicio api-go (GO-0)`

## GO-1 — Cross-cutting (auth, tenant, envelope, contrato)

- [ ] **T1 — Middleware auth (RED: tests de sesión).** Tests: bearer/cookie según consumidor, token válido → contexto; expirado → 401; firma inválida → 401; sesión inactiva/inexistente → 401; usuario inactivo, `lastActive`, tenant solicitado `x-tenant-id`, membresías/roles custom, licencia/features/permisos por ruta y mobile fail-closed; token sin tenant → `TENANT_REQUIRED`. Luego GREEN: verificación HS256 con `JWT_SECRET` + lookup `UserSession` (misma tabla, mismos campos).
- [ ] **T2 — Tenant + permisos.** `tenant.FromContext`; comprobar consultas `scoped` por predicado, `child` por join al parent scoped, `global` por allowlist/autorización. Gate AST SQL + integración multi-tenant y queries de escritura, no grep textual. Fuente: `src/lib/db/model-classification.ts` versionada para Go.
- [ ] **T3 — Envelope y errores.** Matriz distinta para resultado de Server Action (`withAction` no tiene HTTP status propio), routes web/mobile (HTTP status+body) y Go; conservar códigos, mensajes observables y semántica por consumidor. Tests de cada clase de error.
- [ ] **T4 — Money.** Overrides sqlc Decimal→shopspring/decimal; regla CI: `grep -R float64 internal/domain` sobre campos money → fallo.
- [ ] **T5 — Arnés de golden tests.** Fixture idéntica en DB/schemas aislados o restore verificable antes de cada ejecución: action TS y endpoint Go con el mismo payload; comparar respuesta normalizada y estado DB (snapshots de tablas afectadas, side effects, tenant). Nunca compartir el estado mutado por la primera escritura. Suite oro reside en `services/api-go/golden/`.
- [ ] **T6 — OpenAPI + tipos frontend.** swaggo configurado; CI gate `git diff --exit-code openapi/`; tests de contrato kin-openapi por handler; `openapi-typescript` genera `src/lib/api-go/types.ts`.
- [ ] **T7 — Proxy/rewrite seguro + tracer bullet.** `next.config` con `rewrites()` por prefijo solo si el contrato no requiere transformar credenciales; para cookie→Bearer y secreto de servicio usar BFF explícito con header allowlist, CSRF apropiado, red privada preferida o token interno rotativo fail-closed, rate limiting y tests de acceso directo. Añadir propagación `traceparent` y request-id. Tracer bullet por prefijo (`/api/v1/productos` → api-go). **Endpoint piloto: `GET /api/v1/productos` read-only paginado** recorriendo proxy→auth→tenant→sqlc→envelope; verificado en Railway con curl autenticado y desde el navegador.
- Commit: `feat(go): auth, tenant, envelope y contrato OpenAPI + productos lectura (GO-1)`

## GO-2 — Ventas lectura (corrige A-1 de la auditoría)

- [ ] **T1 — RED listado.** Tests: paginación real en DB (page/pageSize), filtros (fecha, cliente, estado, PDV), orden, totales; el shape coincide con lo que consumen `useVentas`, `/busy/sales`, invoice y API móvil.
- [ ] **T2 — GREEN listado.** `GET /api/v1/ventas` en sqlc con joins a items/allocations/devoluciones; paginación en DB; MV de conteos si el total lo justifica.
- [ ] **T3 — Detalle y resúmenes.** `GET /api/v1/ventas/:id`, resumen diario y endpoints de consulta del POS que hoy cargan todo el histórico.
- [ ] **T4 — Golden tests ventas-lectura** contra las actions actuales (mismos fixtures); paridad de respuesta.
- [ ] **T5 — Corte.** Frontend ventas/lectura pasa a `/api/v1/*` con tipos generados; rewrite activo; actions TS de lectura de ventas **retenidas durante la ventana de reversa**; `pnpm run test:smoke:prod` verde en entorno controlado. Tarea posterior elimina legacy tras evidencia y cierre del rollback.
- Commit: `feat(go): ventas lectura con paginación real (GO-2)`

## GO-3 — Ventas escritura (requiere R-4 merged)

- [ ] **T1 — Modelado de reglas.** Inventario del flujo `createVenta` actual como spec ejecutable: serie documental y claim, LP-0 (resolver + `PRICE_MISMATCH` + override con permiso auditado), inventario/stock por ubicación, FIFO, kardex, factura, CxC, reconciliaciones, asientos CTA si existen, devoluciones y anulaciones (Serializable + FOR UPDATE). Cada regla ≥1 test de dominio puro.
- [ ] **T2 — Servicio de dominio puro.** `ventas.Service.Create(...)` sin HTTP; transacción pgx con mismo nivel de aislamiento y orden de locks que la versión TS (anti deadlocks); reintento `40001`.
- [ ] **T3 — Handlers + validación.** Bind/validate Gin; envelope con códigos exactos (`PRICE_MISMATCH`, `INSUFFICIENT_STOCK`, serie agotada, período cerrado…).
- [ ] **T4 — Golden tests escritura.** Paridad de **estado DB completo** (venta, items, allocations FIFO, kardex, stock, CxC, reconciliaciones, asientos) para: venta contado/crédito, con descuento, con override de precio, con devolución posterior, anulación. Fixtures multi-moneda incluyendo evidencia FX.
- [ ] **T5 — Corte + observación.** Rewrite de escrituras de venta; 1 día de observación comparando métricas/logs; smoke controlado verde; reversa comprobada; actions/routes TS retenidas hasta entrega posterior de retiro.
- Commit: `feat(go): ciclo de venta completo en api-go (GO-3)`

## GO-4 — Núcleo operativo

- [ ] **T1 — Productos**: CRUD, catálogo POS (`/api/v1/pos/:id/productos` con precios LP-0 por lista), stock, listas de precios.
- [ ] **T2 — Clientes y proveedores**: CRUD, CxC del cliente, cache de POS.
- [ ] **T3 — Almacenes e inventario**: ubicaciones, movimientos/kardex (paginado real), ajustes, mermas, transferencias, conteos.
- [ ] **T4 — Compras**: compras directas, OC, recepciones, historial de costos (escritura de `precioCosto` igual a la regla canónica R-4).
- [ ] **T5 — Turnos / cuadre diario / arqueos**: ciclo POS completo; cuadre con agregaciones SQL (no arrays al cliente).
- [ ] **T6 — Cortes por sub-dominio** con golden tests, reversa probada y observación; borrado TS solo en PR posterior al cierre de ventana.
- Commit por sub-dominio: `feat(go): núcleo operativo <sub> (GO-4/Tn)`

## GO-5 — Contabilidad y reportes en SQL (requiere R-4; absorbe R-3)

- [ ] **T1 — Reconciliaciones y cuentas**: CxC/CxP, anticipos, préstamos/deudas, transferencias, ajustes, inyecciones — endpoints con agregación SQL (los 6-8 aggregates del cuadre pasan a `GROUP BY`).
- [ ] **T2 — Cuadres de período**: `obtenerCuadrePeriodo` completo (balance, ventas vs reconciliado, resumen diario, operaciones) con paginación real en DB — corrige A-4/A-5.
- [ ] **T3 — Reportes financieros** (dashboard, venta diaria, movimientos, valoración FIFO, rentabilidad, balance, P&L, anticipos, transfers): cada uno nace como query SQL con rango obligatorio — corrige A-1..A-11 de raíz. Golden tests de totales contra la implementación TS con dataset fijo.
- [ ] **T4 — Cierres y períodos**: guard de períodos, `INTENTO_BYPASS`, lock por tenant — mismas garantías transaccionales.
- [ ] **T5 — Capa formal (si CTA merged)**: posting engine y libros migran a Go aquí; si CTA sigue en rama, se coordina el merge (CTA en Prisma convive sin fricción hasta este punto).
- [ ] **T6 — Corte y observación** de cada bloque; retirar `src/features/contabilidad*`/`reportes-financieros` (lado servidor) en entrega posterior, solo tras cerrar rollback y proteger trabajo CTA concurrente.
- Commit por bloque: `feat(go): contabilidad y reportes SQL <bloque> (GO-5/Tn)`

## GO-6 — Cola de dominios y retiro del backend Next

- [ ] **T1 — Cola de dominios** (orden por tráfico): empleados/nómina, reparaciones, producción/recetas, turnos-residuales, contratos, CRM/ofertas, venta-servicios, unidades, vendors, series de facturación, mi-empresa/configuración, roles/planes.
- [ ] **T2 — Auth emisión**: login/logout/refresh/cambio de contraseña migran a Go (último consumidor del secreto); Next deja de importar `jsonwebtoken`.
- [ ] **T3 — Admin/backoffice**: decisión por endpoint (migrar o morir); lo no migrado queda feature-flag off.
- [ ] **T4 — Retiro**: eliminación de `src/app/api/**` legacy (263 routes), de `withAction` si ya no tiene consumidores, y de Prisma del runtime web si ya nadie lo usa; `src/lib/prisma` auditado a cero imports.
- [ ] **T5 — Propiedad del schema (decisión)**: golang-migrate asume DDL (Prisma a generador de tipos histórico) **o** Prisma queda como herramienta de migraciones del repo. Registrar decisión.
- [ ] **T6 — Next como frontend puro**: build sin rutas API, bundle auditado; documentación final (`docs/` + AGENTS.md actualizado).
- Commit: `feat(go): backend completo en api-go; retiro del backend Next (GO-6)`

## Verificación transversal (cada fase)

- `go test ./...` verde (dominio puro + handlers + contrato).
- Golden tests del dominio verdes (respuesta + estado DB).
- CI: sqlc diff limpio, openapi diff limpio, tipos frontend regenerados.
- `pnpm run test:smoke:prod` contra entorno controlado con los cortes activos, evitando mutaciones destructivas en producción.
- Un día de observación post-corte, comparación de métricas, ensayo de reversa y entrega posterior separada para retirar TS antes de tachar la migración del slice.
