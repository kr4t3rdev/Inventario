# Tasks — Permisos granulares por rol

Plan SDD/TDD. Reglas de trabajo (memorias del proyecto): TDD estricto (RED con fallo registrado → GREEN → REFACTOR), tests con rutas explícitas (`pnpm exec vitest run <rutas>`), code review por fase, commit por fase con **stage selectivo** (worktree compartido), migraciones con `prisma migrate dev --create-only` + revisión de SQL, y **coordinación**: los archivos de Contratos/Ofertas/Mermas no se tocan hasta que la ventana "Correcciones Urgentes" commitee F-01/F-02/F-05.

Leyenda: `- [ ]` pendiente · `- [x]` hecho.

---

## PG-01 — Catálogo de permisos y defaults por rol

- [x] **PG01-T1 — Extracción (sin tests aún).** Inventariar los 33 call sites de `requireManagerRole`, 2 de `requireEconomicoRole`, 2 de `requireDependienteRole`, 16 checks `tenantRole ===` y las listas `TENANT_PERMISSIONS`/`requireDependienteAccess`; producir la tabla clave↔guard↔archivo en `openspec/changes/permisos-granulares/impact-map.md`.
- [x] **PG01-T2 — RED registry.** Test del registry: claves únicas, formato `<cat>.<recurso>.<accion>`, categorías válidas, `defaultRoles ⊆ TENANT_ROLES`, labels/descriptions no vacíos, claves `sensitive` marcadas.
  `pnpm exec vitest run src/lib/auth/__tests__/permission-registry.test.ts`
- [x] **PG01-T3 — GREEN registry.** Crear `src/lib/auth/permission-registry.ts` con las ~45-60 claves extraídas y `defaultRoles` que reproduzcan la matriz actual (manager=*, economico=su lista, dependiente=su lista).
- [x] **PG01-T4 — Snapshot de paridad (RED→GREEN).** Test que captura, para cada rol fijo, el conjunto de capacidades actual según las allowlists/guards existentes, y prueba que el resolutor de defaults del registry produce **el mismo conjunto**. Guardar el snapshot como fixture versionado.
- Commit: `feat(auth): catálogo de permisos nombrados con defaults equivalentes (PG-01)`

## PG-02 — Schema: TenantRole + Membership.customRoleId

- [x] **PG02-T1 — Migración.** `prisma migrate dev --create-only --name tenant_custom_roles`: modelo `TenantRole` (`@@unique([tenantId, nombre])`, índice tenant) + `TenantMembership.customRoleId` (nullable, `onDelete: Restrict`) + relación en `Tenant`. Revisar SQL; aplicar en local. Deploy a prod queda para el gate final (Railway aplica en arranque).
  - Nota de ejecución: SQL generado offline con `prisma migrate diff` (misma engine que `migrate dev`, sin tocar la dev DB) y revisado a mano — aditivo, sin DROP. El `deploy` contra la dev DB local falla con P3005 (la dev DB no está baselineada bajo migrate); la cadena completa además **no replay-iza en fresco** desde `20260418000000_add_stock_ubicacion` (CREATE duplicado de StockUbicacion, preexistente a este change).
- [x] **PG02-T2 — Tests de modelo.** Crear rol, unicidad por tenant (mismos nombres en tenants distintos OK), borrado bloqueado con miembros asignados (Restrict), cascada al borrar tenant.
  `pnpm exec vitest run src/lib/auth/__tests__`
  - Nota: contrato estático en unidad `src/lib/auth/__tests__/tenant-role-schema.test.ts` (7/7 ✅) + comportamiento real en `src/lib/auth/__integration__/tenant-role-model.test.ts` (4/4 ✅ contra Postgres 17 desechable; suite de integración completa 11/11).
- Commit: `feat(auth): schema TenantRole y Membership.customRoleId (PG-02)`

## PG-03 — Resolución efectiva y guard único

- [x] **PG03-T1 — RED resolución.** Tests: membresía sin customRole → defaults del rol fijo; con customRole válido → Set del rol; customRole inexistente/isActive=false/de otro tenant → **fallback a defaults** (fail-safe); admin → bypass. Incluir chequeo de que la resolución no añade queries cuando no hay customRoleId (spy sobre prisma).
  `pnpm exec vitest run src/lib/__tests__ src/lib/auth`
- [x] **PG03-T2 — GREEN resolución.** Extender `resolveTenantContext` (auth-middleware) con carga condicional del rol custom; añadir `permissions` a `AuthenticatedUser`. Verificar que rutas existentes siguen verdes sin tocar nada más.
- [x] **PG03-T3 — RED+GREEN guard.** `requirePermission(user, key, action?)` + `hasPermission(user, key)` en `tenant-scope.ts` con tests: sin permiso → FORBIDDEN neutro; con permiso → pasa; sin tenant → error de contexto; admin → pasa; orden con `requireFeature` demostrado en un action de muestra.
- Commit: `feat(auth): resolución de permisos efectivos y guard único requirePermission (PG-03)`

## PG-04 — Motor lógico del dominio + acciones de gestión de roles

- [x] **PG04-T1 — RED acciones CRUD.** Tests tenant-safe para `createTenantRoleAction`, `updateTenantRoleAction`, `deleteTenantRoleAction`, `assignCustomRoleAction` (en `src/features/configuracion/` o feature nueva `src/features/roles/`): validación Zod strict, claves permisos contra registry (rechaza desconocidas), unicidad de nombre por tenant, delete bloqueado con miembros (conteo en mensaje), asignación valida membresía del mismo tenant, **auditoría registrada** (spy de AuditLogService), manager-only (`config.usuarios.gestionar`).
- [x] **PG04-T2 — GREEN acciones.** Implementar con `withAction` + `requirePermission(config.usuarios.gestionar)` + `requireTenant`; transacciones donde aplique.
- [x] **PG04-T3 — Guarda último manager.** Test + implementación: no se puede degradar/eliminar el último manager activo del tenant.
- Commit: `feat(roles): CRUD de roles personalizados con auditoría y guardas (PG-04)`

## PG-05 — Migración de call sites por dominio (el grueso)

Orden sugerido (de menor a mayor acoplamiento); cada dominio = sub-fase con RED (test de comportamiento del endpoint/action antes de tocarlo) → GREEN (sustituir guard) → verde de regresión:

- [x] **PG05-T1 — inventario:** productos (5: crear/editar/eliminar/restock/stock-minimo), listas-precios (1: gestionar), ficha-costo (9) → claves `inventario.*`. Commit `16c5bc7d`.
- [x] **PG05-T2 — ventas/servicios:** servicios (3: operaciones.servicios.*), venta-servicios (2: ventas.servicios.*), compras-servicios (3: compras.servicios.*). Commit `4bd88a98`. (Ofertas/Contratos diferidos: sin merge de Correcciones Urgentes.)
- [x] **PG05-T3 — rrhh:** empleados (19 call sites incl. api handlers), pago-salario (3: rrhh.salarios.*) → `rrhh.*` (incl. `rrhh.nomina.calcular` sensitive). Commit `fd98cd13`.
- [x] **PG05-T4 — financiero/config/lib:** tipos-pago (REST+actions, financiero.tipos-pago.*), tipos-contratos (config.tipos-contrato.*), conversiones (financiero.conversiones.*), upload (config.empresa.logo), reparaciones (produccion.reparaciones.eliminar), auditoría (financiero.auditoria.ver), accounting-policy (config.contabilidad.politica + customRole), admin users/memberships (config.usuarios.gestionar, 5 checks). Commit `c79298cf`.
- [ ] **PG05-T0 (previo)** — lazy fallback en `requirePermission`: si `permissions` no viene resuelto (tests/seeds), deriva defaults del rol fijo. Commit `c79298cf`. Verificado: 0 call sites de `requireManagerRole` en producción (solo comentario en registry).
- [x] **PG05-T5 — rutas REST + mobile.** `route-permissions.ts`: web prefijo→clave (17 rutas incl. ofertas/producción/reparaciones) + `MOBILE_GROUP_KEYS`/`getMobilePermissionKey` (grupos mobile v1+legacy; exentas auth/* y admin/* salvo admin/memberships). auth-middleware: web fail-closed por clave; mobile enforce sin validatePermissions. Commits `2914bf76`, `93050209`, `fee783d3`.
- [x] **PG05-T6 — Retiro de allowlists.** Eliminados `TENANT_PERMISSIONS`, `ROLE_PERMISSIONS`, `requireDependienteAccess`, `checkTenantApiPermission`, `checkApiPermission`, `hasTenantPermission` y `permissions.ts` + sus tests. Fuente única: registry + route-map. Commit `93050209` (web) + `fee783d3` (mobile).
- Commit por dominio: `refactor(auth): migrar <dominio> a permisos nombrados (PG-05.x)` + `refactor(auth): eliminar allowlists legacy, fuente única de permisos (PG-05)`

## PG-06 — UI: matriz de roles y filtrado por permisos

- [x] **PG06-T1 — RED componentes.** Matriz por categoría (role-matrix + tests): agrupación estable, claves/labels/sensitive. Actions de listado `listTenantRolesAction`/`listTenantMembersAction`. Commits `11f34ca4`, `6459a2cc`.
- [x] **PG06-T2 — GREEN UI.** Página `/busy/configuracion/roles` con `RolesManager` (CRUD + matriz + asignación a membresías) y sidebar "Roles" manager-only. Copy neutro + ARIA. Commit `11f34ca4`.
- [x] **PG06-T3 — A11y + copy.** vitest-axe en la matriz (0 violaciones). Commit `6459a2cc`.
- Commit: `feat(roles): UI de matriz de permisos, asignación y menú filtrado (PG-06)`

## PG-07 — Cierre: drift, regresión y evidencia

- [x] **PG07-T1 — Gate de drift estático.** `src/lib/__tests__/permission-drift.test.ts` — escanea src y falla ante clave inexistente o defaultRoles vacío. Commit `a540a680`. (Queda la ruta sensible no mapeada → cubierta por UNMAPPED log de T5.)
- [x] **PG07-T2 — Regresión acotada.** Re-correr todos los paths tocados (los 33+2+2+16 originales y sus features):
  `pnpm exec vitest run src/lib/auth src/lib/services src/features/configuracion src/features/empleados src/features/productos src/features/ficha-costo src/features/pago-salario src/features/contabilidad src/features/venta-servicios src/features/servicios`
- [ ] **PG07-T3 — E2E de permisos (manual/prod-smoke).** Crear rol "Cajero" en demo, asignar, verificar: vender ✅, anular ❌ (403), reportes ❌; restaurar. Documentar en el change.
- [ ] **PG07-T4 — Archivar.** Mover change a `openspec/changes/archive/2026-09-XX-permisos-granulares/`; actualizar memoria `tcp-vs-odoo-multitenant-audit` (gap cerrado).
- Commit: `chore(openspec): archivar permisos-granulares completado (PG-07)`

## Estimación (referencial, líneas cambiadas)

| Fase | Producción | Tests | Schema |
|---|---|---|---|
| PG-01 | ~450 (registry) | ~200 | 0 |
| PG-02 | ~20 | ~120 | ~80 |
| PG-03 | ~120 | ~220 | 0 |
| PG-04 | ~260 | ~300 | 0 |
| PG-05 | ~400 (56 call sites + mapa) | ~500 | 0 |
| PG-06 | ~350 | ~250 | 0 |
| PG-07 | ~40 | ~120 | 0 |

Total aprox.: 1.6k producción + 1.7k tests. Riesgo principal: PG-05 (se mitiga con sub-fases por dominio y paridad snapshot de PG-01-T4 compartiéndose en todos los PRs).
