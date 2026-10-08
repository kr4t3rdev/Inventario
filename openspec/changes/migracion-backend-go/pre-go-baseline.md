# Evidencia PRE-GO/0 (2026-09-23)

Estado actual: **PRE-GO/0 cerrado; /1 listo para comenzar por RED**. No se creó
`src/dominio` ni cambió runtime. Las notas de bloqueo más abajo son históricas;
la sección final registra la repetición que cerró los gates.
La caracterización A/B posterior sí usó una base local descartable (ver sección final).

## Gate: RED → GREEN → REFACTOR

- RED `pnpm exec vitest run scripts/check-dominio-imports.test.ts`: 9/9 fallaron, `Cannot find module scripts/check-dominio-imports.mjs` (capacidad nueva ausente; no es error de DB).
- GREEN mismo comando: 9/9 pasan. Fixture temporal fuera del repo; cubre directo Next, Prisma type-only, `src/app`, adapters, globals request, efecto top-level, relativos, alias, reexports, cadena transitiva y módulos puros.
- Segundo RED: test para `import()`/`require()`/inicializador con `globalThis.fetch`, 1/10 falló (0 cuando se esperaba no-cero). GREEN: 10/10 pasan tras rechazar cargas dinámicas no verificables y globals. REFACTOR: resolución centralizada, `Set` de visitados por raíz y error con ruta de cada arista; regresión 10/10.
- `pnpm run check:dominio-imports`: exit 0, `PENDIENTE: src/dominio no existe; reglas cargadas, aislamiento sin verificar.` **No constituye prueba de aislamiento**. En CI se ejecuta en job lint, antes de lint.
- Ejemplo de diagnóstico reproducible con fixture: `src/dominio/index.ts → src/dominio/application/list.ts → src/lib/bridge.ts → src/features/productos/adapters/db.ts: dependencia prohibida`.
- Reversa por falso positivo: retirar solo el paso `Check domain imports` de `.github/workflows/ci.yml` y el comando `check:dominio-imports`/script; conservar este baseline, ADR e inventario.

## Caracterización (NO RED)

Fixtures unitarios: actor tenant `tenant-1` (A); header `x-tenant-id: B` no altera lectura móvil; servicio usa A con dos productos `a`, `b`, stock por ubicación `[3,4]` y `[]`, precios 12.5 y 2, fecha UTC 2025-01-01. Entradas web y móvil **no aceptan filtros**; filtros internos de servicio: `categoryId: cat`, `subcategoryId: sub`, `search: '  harina  '` (trim, OR insensitive). Sin acceso real a Prisma: mocks de `@/lib/prisma` en servicio/action y mock del servicio en HTTP.

| Superficie | Snapshot/semántica cubierta | Estado |
|---|---|---|
| Action `getProductosAction()` | Firma void, `{success:true,data:[...]}` sin HTTP status; vacío `data:[]`, auth ausente `AUTH_REQUIRED`. | Tests previos verdes; **faltan** tenant ausente/ajeno, fallo DB, serialización Decimal/Date y permiso efectivo. |
| HTTP `GET /api/mobile/v1/products` | 200 `{items:[]}` y `{items:[{id:'a',stock:0,stockTotal:0,precioCosto:12.5,createdAt:'2025-01-01T00:00:00.000Z'}]}`; 403 `{error:'Tenant no identificado',code:'TENANT_REQUIRED'}`; 500 `{error:'Error interno del servidor',code:'INTERNAL_ERROR'}`; 401 mock de auth. Header B y query filters ignorados. | Verde; Decimal real, permiso y membresía verificadas pendientes. `console.error` del caso 500 esperado. |
| `ProductoService.list` | `PRODUCTO_SELECT`, `createdAt desc`, where tenant A + filtros internos, batch solo IDs `[a,b]`; `stock/stockTotal` 7 o 0; vacío `[]`; excepción DB propagada. | Verde; aislamiento DB A/B real y Decimal Prisma pendiente. |

Consumidores y tablas: ver `pre-go-inventario.md`; estas fixtures no prueban membresía real ni stock de producto ajeno en DB.

Comando `pnpm exec vitest run scripts/check-dominio-imports.test.ts src/features/productos/services/__tests__/producto-service.test.ts src/app/api/mobile/v1/products/__tests__/route.test.ts src/features/productos/__tests__/actions.test.ts`: **43/43 verdes** al repetir. Primera ejecución: 42/43, test legacy `getById` falló por mock `mockResolvedValueOnce([])` sobrante tras lista vacía (helper no consulta stock con IDs vacíos); corregido solo en test, no producción. Falla de caracterización, **no RED**.

`pnpm exec eslint scripts/check-dominio-imports.mjs scripts/check-dominio-imports.test.ts src/features/productos/services/__tests__/producto-service.test.ts src/app/api/mobile/v1/products/__tests__/route.test.ts`: exit 0. `pnpm run typecheck`: exit 1, errores fuera de archivos tocados (p.ej. `posting-engine.ts`, `cierre-formal-service.ts`, `src/app/busy/contabilidad/libros/page.tsx`); clasificación provisional como baseline ajeno al slice. Build requerido por CI: pendiente. /0 no se considera cerrado.
`git diff --check`: exit 0 (archivos rastreados). `git status --short` confirma que el change continúa untracked y no hay `src/dominio`. `pnpm run build`: compiló y generó 134/134 páginas; tres warnings Turbopack ajenos (Prisma generado, backups y next.config), dos errores de server action por cookies en páginas sales-agent; proceso terminado por timeout 120 s (exit 143) al finalizar optimización, por tanto **build no verificado como verde**. No leer ni modificar `.env` aunque Next reportó cargar su configuración por defecto.

## Continuación 0.8–0.10 (2026-09-23; caracterización, NO RED)

- Worktree: change completo sigue **untracked** (incluidos ADR, design, spec, baseline y tasks); cambios concurrentes en CI, package.json, tests móvil/servicio y contabilidad preservados. Solo se editó el test de action y este documento. `src/dominio` no existe.
- Fixture action: actor `tenant-test`, producto `prod-1` con stock almacenado 50 y sin ubicaciones (resultado `stock=stockTotal=0`), fecha UTC 2025-01-01 y precioCosto entero 1250. `Producto.precioCosto`/`precioVenta` y `PrecioProducto.precio` son `Int` en este listado: el anterior objeto artificial `toJSON() => '12.5'` NO representaba el modelo real y fue reemplazado. Producto de B no se materializa en mock: se comprueba `where: { tenantId: 'tenant-test' }`, no aislamiento en DB.
- Nuevo test action: serialización vía `JSON.stringify` da `data:[{id:'prod-1',precioCosto:1250,createdAt:'2025-01-01T00:00:00.000Z',stock:0,stockTotal:0}]`; no HTTP status. Sin tenant, no llama Prisma; **observado `INTERNAL_ERROR`, NO `TENANT_REQUIRED`**. Con excepción de lectura, envelope de error sin detalles privados. Test de caracterización inicialmente esperaba `TENANT_REQUIRED`: falló 1/26 por diferencia contractual; se ajustó a lo observado sin editar producción. **No es RED de capacidad nueva.** El permiso de lectura explícito no se exige en `getProductosAction` (solo `requireTenant`); autorización real de membresía sigue pendiente de integración aislada.
- `pnpm exec vitest run scripts/check-dominio-imports.test.ts src/features/productos/services/__tests__/producto-service.test.ts src/app/api/mobile/v1/products/__tests__/route.test.ts src/features/productos/__tests__/actions.test.ts`: exit 0, **45/45** en 4 archivos. Los stderr de fallo DB simulado y tenant ausente son esperados. Servicio y HTTP conservan fixtures/snapshots descritos arriba; móvil retorna 403 `TENANT_REQUIRED` mientras action retorna `INTERNAL_ERROR` para tenant ausente.
- `pnpm run check:dominio-imports`: exit 0, **PENDIENTE**, no acredita aislamiento. `pnpm exec eslint src/features/productos/__tests__/actions.test.ts`: exit 0; `git diff --check`: exit 0.
- `pnpm run typecheck`: exit 1, errores en contabilidad formal (incluido `PostingTx`/`CierreTx`), JSX en libros, flujos ventas/compras/producción; ninguno apunta al test action modificado. Son errores de worktree ajenos al slice; no se modificaron. `pnpm run build` con timeout 180 s: exit 0, compilación 75 s y 134/134 páginas; warnings Turbopack en Prisma generado, backups y next.config, stderr `DYNAMIC_SERVER_USAGE` para sales-agent/perfil y referidos ya visto antes. Build omite validación de tipos: **no sustituye typecheck**. Next indicó carga de configuración de entorno por defecto; no se leyó `.env` ni se usó DB.
- Decisión explícita: conservar en extracción la divergencia action sin tenant `INTERNAL_ERROR` vs HTTP móvil 403 `TENANT_REQUIRED`; no exigir `Decimal` Prisma real para esta lectura (precios `Int`). `ProductoService.list` pide stock por IDs devueltos de la lectura tenant-scoped, pero su consulta batch `StockUbicacion` **no contiene predicado tenant**: un registro de B con `productoId` de A podría sumarse al stock de A si existen datos inconsistentes. Esto no demuestra fuga de productos B en el listado; comprobar con fixture A/B sobre DB descartable y decidir defensa en profundidad en /1, sin modificar runtime aquí.
- Bloqueos para cerrar 0.8–0.10: cobertura negativa de membresía verificable, fixtures A/B con aislamiento real de stock (integración solo con guardrails de `DATABASE_URL_TEST`), y typecheck global rojo. El usuario autorizó integración solo si DB local descartable y barreras satisfechas; sin credenciales verificadas no se ejecutó ni se configuró conexión. No declarar la puerta /1 abierta.

## Revisión de decisiones confirmadas (2026-09-23)

`pnpm exec vitest run scripts/check-dominio-imports.test.ts src/features/productos/services/__tests__/producto-service.test.ts src/app/api/mobile/v1/products/__tests__/route.test.ts src/features/productos/__tests__/actions.test.ts`: 45/45 verdes tras sustituir pseudo-Decimal por entero, stderr de escenarios negativos esperado. Caracterización verde, **no RED**. Los resultados previos de build y typecheck permanecen tal como se registraron: build exit 0, typecheck global exit 1 ajeno al slice. Integración A/B pendiente, no se accedió a DB.

## Intento de preparación local descartable (2026-09-23)

- Revisados `git status --short`, `git diff --stat` y `git diff --cached --stat` antes de actuar: hay trabajo concurrente en CI, producto, contabilidad, `package.json` y graphify; este intento no lo modificó.
- `psql`, `createdb` y `pg_isready` están disponibles; Docker no. `pg_isready -h 127.0.0.1 -p 5432 -q` informó servidor listo; puerto 5433 no disponible. Presencia de variables en el proceso (sin mostrar valores): `DATABASE_URL_TEST`, `DATABASE_URL`, `DIRECT_URL`, `ALLOW_DISPOSABLE_TEST_DB`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGPASSFILE`, `PGSERVICE`: ausentes.
- Prueba de autenticación de solo lectura, con destino fijado explícitamente a loopback: `PGCONNECT_TIMEOUT=3 psql -X -q -t -A -h 127.0.0.1 -p 5432 -d postgres -c 'SELECT 1'` (salida y errores suprimidos): **no conectó** con la autenticación disponible. No se leyeron archivos de entorno ni credenciales; no se creó ni alteró ninguna DB, no se ejecutaron migraciones ni tests de integración. Las tareas 0.8–0.10 y la puerta /1 siguen pendientes.
- Para reintentar se requiere un rol local de PostgreSQL autorizado a crear una base nueva y conexión autenticada a loopback, sin revelar secretos. Crear exclusivamente una DB nueva `tcp_test_*` tras confirmar que no existe, y ejecutar migraciones/tests solo con `ALLOW_DISPOSABLE_TEST_DB=1`, `DATABASE_URL_TEST=DATABASE_URL` y `DIRECT_URL=DATABASE_URL` si está definida, conforme a `scripts/ci/disposable-database.mjs` y `vitest.integration.config.mjs`. No usar ni borrar bases existentes.

## Continuación con destino exclusivo (2026-09-23)

- Se revisaron `git status --short`, `git diff --stat` y nombres de archivos modificados antes de actuar; se preservó el trabajo concurrente. El usuario fijó exclusivamente `tcp_test_124568` (nombre literal sin corchetes), descartable; `tcp_test_local` no se tocó.
- Prueba de solo lectura con Prisma generado: entorno aislado sin cargar archivos de configuración, URL sin contraseña ni parámetros hacia loopback y base exacta, `DATABASE_URL_TEST=DATABASE_URL`, `ALLOW_DISPOSABLE_TEST_DB=1`, `DIRECT_URL` ausente. `assertDisposableDatabase` aceptó el destino; `PrismaClient` se inicializó pero `$connect()` falló con `PrismaClientInitializationError` (sin código Prisma disponible). Se ocultaron detalles del error para no exponer credenciales ni URL. No se pudo verificar identidad desde Prisma ni afirmar autenticación mediante `.pgpass`.
- **BLOQUEADO antes de cualquier escritura:** no se ejecutaron migraciones, `db push`, fixtures ni tests A/B de integración; no se abrió PRE-GO/1. Para continuar, configurar fuera del chat una credencial local segura para el rol autorizado (p. ej. variable de entorno suministrada mediante gestor de secretos, sin imprimirla), repetir consulta de identidad READ-ONLY con Prisma y guard, y solo después inspeccionar esquema/estado del destino antes de considerar migraciones o fixtures. No reutilizar destinos distintos.
# Integración A/B — base descartable (evidencia aportada por usuario)

- Destino verificado por el usuario mediante Prisma y guard: `tcp_test_124568`; se aplicaron
  migraciones antes de la corrida. No se registran credenciales ni URL.
- `src/features/productos/__integration__/stock-tenant-baseline.test.ts` pasó (1/1):
  al existir stock A=4 y una fila inconsistente con tenant B/producto A=9, el batch
  devolvió **13**. Es una caracterización de aislamiento insuficiente en la consulta,
  no una prueba de que la inconsistencia exista en producción ni un RED de TDD.
- El comando usado `pnpm test:integration -- src/features/productos/__integration__/stock-tenant-baseline.test.ts`
  ejecutó toda la suite (el `--` se transmitió a Vitest). Resultado global: 68 pruebas
  pasaron, 14 omitidas y una suite falló durante setup en contabilidad formal porque
  `public.plantillas_asiento` no existe. El fallo es ajeno al test A/B; la corrida
  global **no** está verde. Para focalizar: `pnpm exec vitest run --config
  vitest.integration.config.mjs src/features/productos/__integration__/stock-tenant-baseline.test.ts`.
- La prueba usa una transacción que revierte sus fixtures al terminar. PRE-GO/1 debe
  impedir la suma cruzada en su adaptador tenant-scoped y demostrar el resultado 4
  con una prueba RED nueva antes del cambio (sin cambiar el baseline legacy).
- Repetición focalizada aportada por el usuario: `pnpm exec vitest run --config
  vitest.integration.config.mjs src/features/productos/__integration__/stock-tenant-baseline.test.ts`:
  **1 archivo, 1 prueba aprobada**, duración 769 ms. No se atribuye a esta prueba
  el fallo de contabilidad formal de la corrida global anterior.

## Verificación local del agente (sin credenciales DB en este proceso)

- `pnpm exec vitest run scripts/check-dominio-imports.test.ts
  src/features/productos/services/__tests__/producto-service.test.ts
  src/app/api/mobile/v1/products/__tests__/route.test.ts
  src/features/productos/__tests__/actions.test.ts`: **45/45 verdes** (4 archivos).
- ESLint de los seis archivos de gate y tests de productos tocados: exit 0.
  `git diff --check`: exit 0.
- `pnpm run check:dominio-imports`: `PENDIENTE`, porque `src/dominio` aún no existe.
- El proceso del agente no dispone de `DATABASE_URL_TEST`, `DATABASE_URL`, `DIRECT_URL`
  ni `ALLOW_DISPOSABLE_TEST_DB`; no puede volver a correr por sí mismo la integración
  sin recibir una conexión protegida. La evidencia DB focalizada anterior fue
  ejecutada por el usuario en su terminal y se identifica como tal.
- Caracterización de autenticación real del middleware (Prisma mockeado, sin DB):
  `src/lib/__tests__/auth-middleware.test.ts` comprueba que un header de tenant B
  sin membresía recibe 403 sin consultar licencia y que una membresía activa con
  rol custom sin `inventario.productos.consultar` recibe 403 en la ruta móvil.
  Corrida focal **17/17 verdes**; ESLint y `git diff --check` verdes.
  Son tests de comportamiento vigente, **no RED** de un cambio de producción.

## Puerta PRE-GO/0 — repetición tras caracterización

- `pnpm exec vitest run scripts/check-dominio-imports.test.ts
  src/lib/__tests__/auth-middleware.test.ts
  src/features/productos/services/__tests__/producto-service.test.ts
  src/app/api/mobile/v1/products/__tests__/route.test.ts
  src/features/productos/__tests__/actions.test.ts`: **62/62 aprobadas** en cinco archivos.
- `pnpm run typecheck`: **exit 0** al repetir. El fallo de tipos anterior pertenecía
  a un estado previo del worktree concurrente; no se modificó código de contabilidad.
- `pnpm run build`: **exit 0**, compilación y generación 134/134 páginas. Persisten
  advertencias Turbopack y stderr de cookies dinámicas ajenas al piloto.
- `pnpm run check:dominio-imports`: exit 0 con estado **PENDIENTE** (sin núcleo
  todavía). ESLint de los tests y gate, y `git diff --check`: exit 0.
- Riesgo aceptado como deuda de /1: la integración A/B del batch legacy suma 13
  cuando la fila B referencia producto A. El nuevo adaptador deberá probar el
  resultado tenant-scoped 4 antes de cambiar el wiring. /0 no cambió runtime.
