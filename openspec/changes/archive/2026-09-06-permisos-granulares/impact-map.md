# Impact map — Permisos granulares (PG01-T1)

Extracción del estado real de autorización a fecha 2026-09-05. Cada fila documenta dónde se decide hoy el acceso y a qué clave del `permission-registry` migrará.

## Correcciones al inventario estimado en la propuesta

| Estimado en proposal | Realidad medida |
|---|---|
| `requireManagerRole` en 33 archivos | **24 archivos, 58 call sites** (conteo por llamada, excl. imports) |
| `requireEconomicoRole` en 2 archivos | **0 call sites en producción** (solo definición + tests en `tenant-scope.test.ts`) |
| `requireDependienteRole` en 2 archivos | **0 call sites en producción** (ídem) |
| 16 checks sueltos `tenantRole ===` | **8 server-side** + 4 page guards + ~10 cosméticos de UI |
| `requireDependienteAccess` activa | **Código muerto** (definida en `auth-middleware.ts:392`, nunca llamada). Su lista divergente de `TENANT_PERMISSIONS` confirma la motivación del change |
| Allowlist REST sobre todo el API | Solo **17 rutas** usan `withAuth` (el único path que evalúa `TENANT_PERMISSIONS`); el resto de la API usa `withAuthGet/Post` (sin allowlist) o guards internos |
| `TENANT_PERMISSIONS.economico` da alcance REST | **Superficie efectiva cero**: ninguna de las 17 rutas `withAuth` coincide con las entradas de economico (`/api/reportes-financieros`, `/api/gastos-de-explotacion/*`, `/api/restaurante/*` ni siquiera existen como rutas). La identidad económica solo existe en sidebar + `accounting-audit-logs-service` |
| API mobile con control de rol | **121 rutas mobile sin control de rol**: llaman `authenticateUser` sin `validatePermissions`; cualquier miembro autenticado del tenant accede |

## A. `requireManagerRole` — 24 archivos, 58 call sites

### A.1 Rutas REST (`src/app/api`) — 5 archivos, 6 sitios

| Archivo | Línea | Acción | Clave destino |
|---|---|---|---|
| `api/contabilidad/balance-financiero/conversiones/route.ts` | 32 | registrar conversiones históricas | `financiero.conversiones.registrar` |
| `api/contabilidad/tipos-pago/route.ts` | 124 | crear tipos de pago | `financiero.tipos-pago.crear` |
| `api/contabilidad/tipos-pago/[id]/route.ts` | 111 | actualizar tipos de pago | `financiero.tipos-pago.editar` |
| `api/contabilidad/tipos-pago/[id]/route.ts` | 370 | eliminar tipos de pago | `financiero.tipos-pago.eliminar` (sensitive) |
| `api/tipos-contratos/route.ts` | 71 | crear tipos de contrato | `config.tipos-contrato.crear` |
| `api/tipos-contratos/[id]/route.ts` | 17 | eliminar tipos de contrato | `config.tipos-contrato.eliminar` (sensitive) |

### A.2 Features — 18 archivos, 51 sitios

| Archivo | Líneas | Acciones | Clave(s) destino |
|---|---|---|---|
| `productos/actions-crud.ts` | 105, 411, 586 | crear / editar / eliminar productos | `inventario.productos.crear` / `.editar` / `.eliminar` (sensitive) |
| `productos/actions-restock.ts` | 63 | restock de productos | `inventario.productos.restock` |
| `productos/actions-stock.ts` | 64 | modificar stock mínimo | `inventario.stock.editar` |
| `listas-precios/actions.ts` | 31 | gestionar listas de precios | `inventario.listas-precios.gestionar` |
| `ficha-costo/actions-producto.ts` | 123 | editar precio de costo | `inventario.ficha-costo.editar-costo` |
| `ficha-costo/actions-plantilla.ts` | 255, 335, 439, 482 | crear/editar/activar/eliminar plantillas | `inventario.ficha-costo.plantillas` |
| `ficha-costo/actions-plantilla.ts` | 519 | aplicar precio sugerido | `inventario.ficha-costo.aplicar-precios` |
| `ficha-costo/actions-sugerencias.ts` | 113 | aplicar precios sugeridos | `inventario.ficha-costo.aplicar-precios` |
| `ficha-costo/actions-bulk.ts` | 79, 212 | ajuste masivo / aplicar plantilla masiva | `inventario.ficha-costo.bulk` (sensitive) |
| `servicios/actions.ts` | 62, 79, 101 | crear/editar/eliminar servicios (catálogo) | `operaciones.servicios.crear` / `.editar` / `.eliminar` (sensitive) |
| `venta-servicios/actions.ts` | 267, 302 | editar/eliminar ventas de servicios | `ventas.servicios.editar` / `ventas.servicios.eliminar` (sensitive) |
| `compras-servicios/actions.ts` | 51, 210, 257 | registrar/editar/eliminar servicios recibidos | `compras.servicios.crear` / `.editar` / `.eliminar` (sensitive) |
| `contabilidad/actions-tipos-pago.ts` | 81, 115, 192 | crear/actualizar/eliminar tipos de pago | `financiero.tipos-pago.*` (mismas claves que REST) |
| `empleados/actions.ts` | 55, 83, 120 | crear/editar/eliminar empleados | `rrhh.empleados.crear` / `.editar` / `.eliminar` (sensitive) |
| `empleados/actions.ts` | 233, 318 + `empleados/api/asistencia.ts` 185, 369, 440 | registrar/editar/eliminar asistencia | `rrhh.asistencia.registrar` / `.editar` / `.eliminar` |
| `empleados/actions.ts` | 440 + `empleados/api/vacaciones.ts` 74 | crear solicitudes de vacaciones | `rrhh.vacaciones.solicitar` |
| `empleados/api/vacaciones.ts` | 269 / 349 / 442, 579 | aprobar-rechazar / eliminar / calcular acumulación | `rrhh.vacaciones.aprobar` (sensitive) / `rrhh.vacaciones.eliminar` / `rrhh.vacaciones.calcular-acumulacion` |
| `empleados/actions.ts` | 566 + `empleados/api/nomina.ts` 79, 339, 395 | calcular/editar/eliminar nómina | `rrhh.nomina.calcular` (sensitive) / `rrhh.nomina.editar` / `rrhh.nomina.eliminar` (sensitive) |
| `empleados/actions.ts` | 783, 830 + `empleados/api/work-schedules.ts` 70, 156 | guardar/eliminar horarios | `rrhh.horarios.gestionar` / `rrhh.horarios.eliminar` |
| `pago-salario/actions.ts` | 49, 83, 123 | crear/editar/eliminar pagos de salario | `rrhh.salarios.crear` / `.editar` / `.eliminar` (sensitive) |

### A.3 `src/lib` — 1 archivo, 1 sitio

| Archivo | Línea | Acción | Clave destino |
|---|---|---|---|
| `lib/upload/upload-policy.ts` | 128 | actualizar logo de la empresa | `config.empresa.logo` |

## B. Checks sueltos `tenantRole ===` server-side — 8 puntos

| Archivo | Línea | Qué decide | Clave destino |
|---|---|---|---|
| `app/api/admin/memberships/[id]/route.ts` | 75 | aprobar/rechazar membresía del propio tenant | `config.usuarios.gestionar` (sensitive) |
| `features/admin/actions.ts` | 1071 | `updateTenantUserAction` (rol/activación) | `config.usuarios.gestionar` (sensitive) |
| `features/admin/server/admin-global-queries.ts` | 220 | `getAdminUsers` | `config.usuarios.gestionar` |
| `features/admin/server/admin-global-queries.ts` | 614 | `getPendingMemberships` | `config.usuarios.gestionar` |
| `features/admin/server/admin-global-queries.ts` | 679 | `approveMembership` | `config.usuarios.gestionar` |
| `features/admin/server/admin-global-queries.ts` | 754 | `rejectMembership` | `config.usuarios.gestionar` |
| `features/contabilidad/services/accounting-audit-logs-service.ts` | 22, 29 | ver logs de auditoría contable (manager‖economico + `hasTenantPermission`) | `financiero.auditoria.ver` — defaultRoles `[manager, economico]` |
| `lib/api/reparaciones/ordenes.ts` | 587 | eliminar orden de reparación | `produccion.reparaciones.eliminar` (sensitive) |
| `lib/auth/accounting-policy-capabilities.ts` | 24 | `canManageAccountingPolicy` | `config.contabilidad.politica` (sensitive) |

> Las guardas complementarias de negocio (mismo tenant, no auto-modificación en `updateTenantUserAction`) se conservan; son ortogonales al permiso.

## C. Page guards (Next.js) — 4 páginas

Todas rebotan al usuario no-manager en navegación; el server action sigue siendo la barrera real.

| Página | Guard actual | Nota PG-06 |
|---|---|---|
| `app/busy/products/new/page.tsx` | `tenantRole !== 'manager'` redirect | filtrar por `inventario.productos.crear` |
| `app/busy/servicios/new/page.tsx` | `!== admin && !== manager` | `operaciones.servicios.crear` |
| `app/busy/servicios/recibidos/page.tsx` | idem | `compras.servicios.crear` |
| `app/busy/servicios/update/[id]/page.tsx` | idem | `operaciones.servicios.editar` |

## D. UI cosmética (filtrado, nunca seguridad) — ~10 archivos

`empleados` ×5 componentes (`empleados-list-content`, `empleados-nomina-content`, `enhanced-asistencia-form`, `nomina-empleado-section`, `vacaciones-form`), `mi-empresa-form`, `productos-content`, `servicios-content`, `nav-user` (etiquetas de rol), `sidebar/build-visible-groups.ts` (fallback manager-línea 67) y el mapa `SIDEBAR_TENANT_PERMISSIONS` (56 entradas rol×ítem). Todo migra a lectura de `permissions` en PG-06.

## E. Transporte REST allowlist — única vía viva: `withAuth` (17 rutas)

`authenticateUser` solo evalúa `TENANT_PERMISSIONS` cuando el handler usa `withAuth` (con `validatePermissions{path,method}`). Rutas hoy bajo allowlist: empleados/asistencia, nomina, vacaciones, work-schedules; facturas (`[id]`, excel, pdf); ofertas `[id]`; produccion recetas/ingredientes y vales; reparaciones (ordenes, equipos, piezas, defectaciones, catalogo/config).

Matriz efectiva viva hoy (fuente del snapshot de paridad). Las 17 rutas `withAuth` pasan `{path, method}` con el pathname real (ej. `/api/facturas/abc123`), por lo que sí evalúan la allowlist — pero el matcher tiene un bug de orden:

> **Bug de matcher (documentado):** en `hasTenantPermission` la rama wildcard (`permission.includes('/*')` → `path.startsWith(basePath)`) corre ANTES que la rama `MÉTODO ruta`, así que la entrada `'GET /api/facturas/*'` compara `path.startsWith('GET /api/facturas')` → siempre falso. El dependiente recibe 403 real en `GET /api/facturas/[id]` (usado por `/busy/invoice` para imprimir/descargar). La política declarada lo autorizaría; `getFacturaByIdAction` (server action sin guard) es el backdoor abierto para cualquier miembro. El fixture de paridad conserva la política declarada (`ventas.facturas.consultar` → `[manager, dependiente]`); PG-05 repara el matcher al migrar al route-map.

| Ruta patrón | manager | economico | dependiente |
|---|---|---|---|
| `GET /api/facturas/*` (única entrada dependiente que apuntaba a rutas reales; **matcher roto**) | ✅ (`*`) | ❌ | ⚠️ declarada ✅ / efectiva ❌ |
| Todo lo demás bajo `withAuth` (empleados, ofertas, produccion, reparaciones) | ✅ | ❌ | ❌ |
| Rutas API con `withAuthGet/Post` (sin allowlist) u otro mecanismo | cualquier miembro del tenant que pase los guards internos | | |
| `src/app/api/mobile/**` (121 rutas, `authenticateUser` sin validatePermissions) | cualquier miembro autenticado | | |

**Regla de paridad derivada (día-1):** una clave en `defaultRoles` lleva los roles que HOY pueden ejecutar la operación en servidor por cualquier canal (guards, allowlist *funcionando*, o ausencia de guard). Objetivo: nadie pierde acceso en la migración (fail-closed solo donde ya lo está). Concretamente:

- Acciones con `requireManagerRole` → `defaultRoles: ['manager']`.
- `ventas.facturas.consultar` → `[manager, dependiente]` (política declarada; matcher roto hoy, reparado en PG-05).
- Acciones sin guard server-side (bucket F + `ventas.venta.registrar`) → los tres roles.
- `financiero.auditoria.ver` → `[manager, economico]` (único gate real donde economico cuenta).

## F. Mutaciones SIN guard de rol hoy (superficie a endurecer en PG-05)

Server-side, cualquier miembro del tenant puede ejecutarlas (solo `requireTenant`):

| Feature | Acciones sin guard | Claves a introducir con guard nuevo |
|---|---|---|
| `mermas/actions.ts` | crear/editar/eliminar mermas | `inventario.mermas.registrar`, `.editar`, `.eliminar` |
| `transferencias/actions.ts` | operaciones de transferencia | `inventario.transferencias.gestionar` |
| `categorias/actions.ts` | CRUD categorías/específicos | `inventario.categorias.gestionar` |
| `almacenes/actions.ts` | CRUD almacenes | `inventario.almacenes.gestionar` |

**Decisión de paridad:** añadir guard cambia el comportamiento día-1 de estas acciones. El registry las define con `defaultRoles: [manager, economico, dependiente]` (paridad estricta con el servidor actual) y el sidebar ya las oculta a no-managers; la restricción real llega cuando el manager configure roles custom. Registrar la decisión en el commit de PG-05 del dominio correspondiente.

## G. Lo que NO se toca

- `requireFeature` (112 archivos, eje comercial) — composición: feature primero, permiso después.
- `requireTenant`, `scopedWhere`, `assertTenantAccess`, `validateTenantLimit` — contexto, no autorización.
- `ROLE_PERMISSIONS`/`checkApiPermission` de plataforma (rama sin tenant de `authenticateUser`).
- Bypass de admin global.
- Deadline de coordinación: archivos de Contratos/Ofertas/Mermas pendientes hasta que "Correcciones Urgentes" commitee F-01/F-02/F-05 (mapa de rutas PG-05 se apoya en CU-01).

## Resumen del catálogo final (59 claves — lo que PG-01 implementa)

Regla de oro de `defaultRoles` (paridad servidor): contienen exactamente los roles que **hoy** ejecutan la acción en servidor — `['manager']` si hay `requireManagerRole`; `[manager, economico]` si el gate real incluye economico (auditoría contable y capacidades derivadas del sidebar económico sin enforcement aún); los tres roles si no hay guard de rol server-side.

- **inventario (16):** productos.{crear,editar,eliminar※,restock}, stock.editar, listas-precios.gestionar, ficha-costo.{editar-costo,plantillas,aplicar-precios,bulk※}, mermas.{registrar,editar,eliminar※}₁, transferencias.gestionar₁, categorias.gestionar₁, almacenes.gestionar₁
- **rrhh (18):** empleados.{crear,editar,eliminar※}, asistencia.{registrar,editar,eliminar※}, vacaciones.{solicitar,aprobar※,eliminar※,calcular-acumulacion}, nomina.{calcular※,editar,eliminar※}, horarios.{gestionar,eliminar※}, salarios.{crear,editar,eliminar※}
- **operaciones (3):** servicios.{crear,editar,eliminar※} (catálogo)
- **ventas (4):** servicios.{editar,eliminar※} (ventas de servicios), venta.registrar₁, facturas.consultar (defaults `[manager, dependiente]`, único caso real de allowlist dependiente viva)
- **compras (3):** servicios.{crear,editar,eliminar※} (servicios recibidos)
- **financiero (9):** conversiones.registrar, tipos-pago.{crear,editar,eliminar※}, auditoria.ver₂, reportes.ver₂, stats.ver₂, contabilidad.acceder₂, gastos.acceder₂
- **config (5):** usuarios.gestionar※, tipos-contrato.{crear,eliminar※}, empresa.logo, contabilidad.politica※
- **produccion (1):** reparaciones.eliminar※

※ = `sensitive: true` (18 claves). ₁ = sin guard hoy → defaults los 3 roles; el guard se introduce en PG-05 documentando el endurecimiento. ₂ = `[manager, economico]`; hoy solo sidebar/servicio-auditoría las respaldan; PG-05 las cablea a sus rutas.

Claves descartadas de la estimación inicial por apuntar a rutas inexistentes: `operaciones.restaurante.usar`, `inventario.productos.consultar` (REST `/api/productos` no existe), `ventas.venta.consultar` (API de ventas actual es `/api/ventas/punto-venta/*` sin allowlist).
