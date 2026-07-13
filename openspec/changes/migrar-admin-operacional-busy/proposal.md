# Proposal: Migrar Administración Operativa del panel de Admin a las features del negocio (`/busy/`)

## Intent

La sección "Administración Operativa" del panel de Admin (`/admin/operaciones/*`) muestra **matrices de
salud multi-tenant**: una fila por cada negocio (con su plan, KPIs y estado). Esta vista vive dentro del
super-admin, oculta al negocio.

El usuario decide **sacarla del sidebar de Admin** y exponer la **salud del propio tenant dentro de cada
feature del negocio** (`/busy/<feature>/`), **visible únicamente para el rol `admin`** (los roles
`manager`, `dependiente`, `economico` NO la verán).

En criollo: cada feature (Productos, Ventas, Compras, Mermas, Facturación, Ofertas/Servicios, Gastos,
Contabilidad) tendrá una "[Salud operativa]" card mostrando los KPIs propios del tenant logueado. La
sección centralizada en Admin se elimina (rutas + sidebar + actions globales).

## Scope

### In Scope

**8 features objetivo**, una por cada página existente en `/admin/operaciones/*`:

| # | Página adminiedad | Feature /busy | Página /busy | Action nueva |
|---|---|---|---|---|
| 1 | `/admin/operaciones/maestros` | `productos`, `categorias`, `unidades`, `vendors`, `puntos-venta`, `listas-precios` | `/busy/products` | `getMastersHealthAction` |
| 2 | `/admin/operaciones/ventas` | `ventas` | `/busy/sales` | `getSalesHealthAction` |
| 3 | `/admin/operaciones/compras` | `compras-productos` | `/busy/compras-productos` | `getPurchaseHealthAction` |
| 4 | `/admin/operaciones/mermas` | `mermas` | `/busy/mermas` | `getWastageHealthAction` |
| 5 | `/admin/operaciones/facturacion` | `facturas` | `/busy/facturas` | `getBillingHealthAction` |
| 6 | `/admin/operaciones/ofertas-servicios` | `ofertas` + `servicios` | `/busy/ofertas` | `getOffersServicesHealthAction` |
| 7 | `/admin/operaciones/gastos` | `gastosDE` | `/busy/gastosDE` | `getExpenseHealthAction` |
| 8 | `/admin/operaciones/contabilidad` | `contabilidad` | `/busy/contabilidad` | `getAccountingHealthAction` |

**Acciones comunes:**

- Crear 8 Server Actions **por-tenant** (en `src/features/<feature>/actions.ts` o `actions-health.ts`)
  que usen `requireTenant(user)` y `user.role === 'admin'` para gatear el acceso.
- Crear 8 componentes `<FeatureHealthCard />` (sin Sheet drill-down; el detail está en la propia
  feature) que se rendericen **solo si `user.role === 'admin'`** dentro de cada página `/busy/<feature>/`.
- **Eliminar** las 8 páginas bajo `src/app/admin/operaciones/` (maestros, ventas, compras, mermas,
  facturacion, ofertas-servicios, gastos, contabilidad).
- **Eliminar** el grupo "Administración Operativa" del `AdminSidebar`
  (`src/components/admin-sidebar.tsx` líneas 122-160).
- **Eliminar** la card "Administración Operativa" del dashboard de admin
  (`src/app/admin/page.tsx`).
- **Eliminar** las 8 Server Actions globales de `src/features/admin/server/operaciones.ts`
  (`getGlobalMastersHealthAction`, `getGlobalSalesHealthAction`, `getGlobalPurchaseHealthAction`,
  `getGlobalWastageHealthAction`, `getGlobalBillingHealthAction`,
  `getGlobalOffersServicesHealthAction`, `getGlobalExpenseHealthAction`,
  `getGlobalAccountingHealthAction`, `getGlobalAccountingConfigHealthAction` y
  `getTenantFeatureDataAction`).
- Eliminar el archivo `src/features/admin/server/operaciones.ts` si queda vacío.
- Mantener `requireGlobalAdmin` si lo reutiliza otra action; sino, eliminar.

### Out of Scope

- Migrar `getGlobalAccountingConfigHealthAction` (no tiene página equivalente en admin ni负有 feature
  destino en /busy). Se elimina junto al resto.
- Modificar lógica de negocio de las features existentes.
- Agregar nuevos KPIs que no existían en admin/operaciones (mantener paridad de info).
- Validación con auditoría (`AuditLogService.log`) — la lectura de salud no se audita.
- Cambios en el selector de feature drill-down de maestros (era multi-tenant, se elimina).
- Cambios en plan-feature gating: la salud es solo para rol `admin`, independiente del plan.
- Tests E2E (Playwright) — fuera de este change; solo unit + integration con Testing Library.

## Approach

### Fase 1 — Actions por-tenant (TDD: red first)

Para cada feature crear una action `get<Feature>HealthAction` que:
- Use `requireTenant(user)` para obtener `tenantId`.
- Verifique `user.role === 'admin'`; si no, lance `ActionError('Solo admin', 'FORBIDDEN')`.
- Retorne el mismo shape de métricas que la acción global actual, pero sin `tenantId`, `nombre`,
  `slug`, `planName` (no tiene sentido para el propio tenant).
- Reutilice las mismas consultas Prisma ya escritas (filtrando por `tenantId` actual).

### Fase 2 — Componentes HealthCard (TDD: render test)

Para cada feature crear `<FeatureHealthCard />` (cliente) que:
- Llame a la action nueva vía `useEffect`.
- Renderice KPIs + estado (Crítico / Bajo / Saludable) replicando el `getHealthStatus` actual.
- Renderice un `Loader2` y un estado "sin datos" equivalente al actual.
- **NO** renderice Sheet drill-down (era admin-only multi-tenant).
- Reciba `userRole` por prop (RSC decide si renderizarlo); si role !== 'admin', return `null`.

### Fase 3 — Integrar en pages `/busy/<feature>/`

En cada `page.tsx` (Server Component):
- Resolver `user` con `getCurrentUser()`.
- Pasar `userRole={user.role}` al componente client `<FeatureHealthCard />`.
- Renderizar la card **encima** de la lista principal de cada feature (zona superior).

### Fase 4 — Eliminar panel admin

- Borrar directorio `src/app/admin/operaciones/`.
- Borrar grupo del sidebar (`admin-sidebar.tsx` líneas 122-160 + tono asociado del mapa).
- Borrar card "Administración Operativa" en `src/app/admin/page.tsx`.
- Borrar actions globales de `operaciones.ts`.

### Fase 5 — Verificación

- `pnpm run typecheck` — 0 errores nuevos.
- `pnpm run lint` — 0 errores nuevos en archivos tocados.
- `pnpm run test:run` — todos los tests nuevos pasan; no romper tests existentes.

## Affected Areas

| Área | Acción | Archivos |
|---|---|---|
| Sidebar de admin | Modify (eliminar grupo) | `src/components/admin-sidebar.tsx` |
| Dashboard de admin | Modify (eliminar card) | `src/app/admin/page.tsx` |
| Páginas admin operaciones | Remove | `src/app/admin/operaciones/**` (8 pages) |
| Server actions admin globales | Remove | `src/features/admin/server/operaciones.ts` |
| Feature productos | Add actions + component + test | `src/features/productos/actions-health.ts`, `components/feature-health-card.tsx`, `__tests__/` |
| Feature ventas | Add | `src/features/ventas/actions-health.ts`, … |
| Feature compras-productos | Add | `src/features/compras-productos/actions-health.ts`, … |
| Feature mermas | Add | `src/features/mermas/actions-health.ts`, … |
| Feature facturas | Add | `src/features/facturas/actions-health.ts`, … |
| Feature ofertas + servicios | Add (1 acción combinada) | `src/features/ofertas/actions-health.ts` y component |
| Feature gastosDE | Add | `src/features/gastosDE/actions-health.ts`, … |
| Feature contabilidad | Add | `src/features/contabilidad/actions-health.ts`, … |
| Páginas /busy/<feature> | Modify (insertar card) | 8 pages |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Romper tests existentes en `src/features/admin/` que importaban `operaciones.ts` | Medium | `grep` de usos antes de eliminar; mantener archivo vacío si hace falta en transición |
| `AccountingConfigHealth` era consumido por otra página fuera de operaciones | Low | `grep getGlobalAccountingConfigHealthAction src/` antes de borrar |
| Conflicto de nombre `getMastersHealthAction` con otra action existente en `productos` | Low | PrefijarTodas las actions nuevas con `Health` para evitar choque |
| El guard `requireGlobalAdmin` se use en otra Server Action no listada | Low | `grep requireGlobalAdmin src/` antes de borrar función |
| Pages `/busy/<feature>/` ya recogen `user` internamente con distinto patrón | Medium | Relevar 8 pages para reusar el flujo existente, no duplicar `getCurrentUser()` |
| `AppSidebar2` no filtra la card — un `manager` podría verla si el parent la renderiza | Medium | El gate ocurre en `page.tsx` (RSC decide renderizar o no); componente también retorna null si role no es admin |

## Rollback Plan

1. Revertir el commit de migración.
2. Restaurar `src/app/admin/operaciones/` desde git history.
3. Restaurar el grupo del sidebar y la card del dashboard.
4. Restaurar `src/features/admin/server/operaciones.ts`.
5. Eliminar los 8 archivos `actions-health.ts`, 8 componentes y 8 tests nuevos.
6. Revertir las 8 pages `/busy/<feature>/page.tsx`.

## Dependencies

- `withAction` de `@/lib/server-actions` (existe) — wrapper con manejo de error.
- `requireTenant` de `@/lib/services/tenant-scope` (existe).
- `getCurrentUser` de `@/lib/server-actions` (existe) — usado por cada page `/busy/`.
- `ActionError` tipo exportado desde `@/lib/server-actions`.
- Tipos UI ya disponibles: `Card`, `Table`, `Badge`, `Loader2` etc. de shadcn/ui y lucide-react.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom` ya en `devDependencies`.

## Success Criteria

- [ ] 0 references a `/admin/operaciones/` en `src/` (salvo archivos eliminados).
- [ ] 0 references a `getGlobal*HealthAction` o `getTenantFeatureDataAction` en `src/`.
- [ ] Grupo "Administración Operativa" eliminado del `AdminSidebar`.
- [ ] Card "Administración Operativa" eliminada del dashboard de admin.
- [ ] 8 nuevas Server Actions `get<Feature>HealthAction` creadas, cada una retorna `{ metrics }`.
- [ ] Cada action valida `user.role === 'admin'`; lanza `ActionError('FORBIDDEN')` si no.
- [ ] 8 componentes `<FeatureHealthCard />` renderizan null si `userRole !== 'admin'`.
- [ ] Cada page `/busy/<feature>/` renderiza la card encima de su contenido actual.
- [ ] Cobertura **100% líneas** en las 8 actions nuevas (medida por archivo).
- [ ] Cobertura **≥80% líneas** en los 8 componentes nuevos.
- [ ] `pnpm run typecheck` — 0 errores nuevos.
- [ ] `pnpm run test:run` — todos los tests nuevos pasan; suites existentes no empeoran.
- [ ] Toasts de error replican copia existente: "Error cargando datos de ventas", etc.
