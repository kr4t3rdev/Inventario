# Spec: Eliminación de la sección "Administración Operativa" del panel de Admin

## Purpose

Eliminar completamente del panel de Admin todos los elementos relacionados con la sección
"Administración Operativa", dado que la salud operativa se migra a las features del negocio
(`/busy/<feature>/`).

## Requirements

### Requirement: Las páginas `/admin/operaciones/*` son eliminadas

Todos los directorios bajo `src/app/admin/operaciones/` (maestros, ventas, compras, mermas,
facturacion, ofertas-servicios, gastos, contabilidad) **MUST** ser eliminados.

#### Scenario: Directorio eliminado

- WHEN se aplica este change
- THEN `ls src/app/admin/operaciones/` retorna error "no such file or directory"
- AND `find src/app/admin/operaciones` retorna 0 resultados

#### Scenario: Cero referencias a rutas /admin/operaciones

- WHEN se aplica este change
- THEN `rg "/admin/operaciones" src/` retorna 0 resultados

---

### Requirement: El grupo "Administración Operativa" se elimina del `AdminSidebar`

El bloque `{ title: "Administración Operativa", items: [...] }` en
`src/components/admin-sidebar.tsx` líneas 122-160 **MUST** ser eliminado. La entrada del mapa
`groupToneByTitle` que mapea ese título también.

#### Scenario: Sidebar renderiza sin el grupo

- GIVEN un admin logueado en `/admin`
- WHEN se renderiza el `AdminSidebar`
- THEN no aparece el grupo "Administración Operativa" ni sus 7 items (Datos Maestros, Ventas,
  Compras, Mermas, Facturación, Ofertas y Servicios, Gastos)

#### Scenario: Compilación del sidebar pasa

- WHEN se aplica este change
- THEN `pnpm run typecheck` no falla en `admin-sidebar.tsx`

---

### Requirement: La card "Administración Operativa" se elimina del dashboard de Admin

La card con título "Administración Operativa" en `src/app/admin/page.tsx` (línea ~512) **MUST** ser
eliminada junto con su import relacionado.

#### Scenario: Dashboard renderiza sin la card

- GIVEN un admin logueado en `/admin`
- WHEN se renderiza `src/app/admin/page.tsx`
- THEN no aparece la card con título "Administración Operativa"
- AND no aparece la descripción "Ir a las matrices globales de salud..."

---

### Requirement: Las Server Actions globales se eliminan

El archivo `src/features/admin/server/operaciones.ts` **MUST** ser eliminado en su totalidad, dado
que todas sus acciones son reemplazadas por las nuevas `get<Feature>HealthAction` por-tenant.

Acciones eliminadas:
- `getGlobalMastersHealthAction`
- `getGlobalSalesHealthAction`
- `getGlobalPurchaseHealthAction`
- `getGlobalWastageHealthAction`
- `getGlobalBillingHealthAction`
- `getGlobalOffersServicesHealthAction`
- `getGlobalExpenseHealthAction`
- `getGlobalAccountingHealthAction`
- `getGlobalAccountingConfigHealthAction`
- `getTenantFeatureDataAction`
- helper `requireGlobalAdmin` (si no se reutiliza)
- tipos exportados (`TenantMastersHealth`, `TenantSalesHealth`, `TenantPurchaseHealth`,
  `TenantWastageHealth`, `TenantBillingHealth`, `TenantOffersServicesHealth`,
  `TenantExpenseHealth`, `TenantAccountingHealth`, `TenantAccountingConfigHealth`,
  `MasterFeature`)

#### Scenario: Cero referencias a las actions eliminadas

- WHEN se aplica este change
- THEN `rg "getGlobal.*HealthAction|getTenantFeatureDataAction" src/` retorna 0 resultados
- AND `rg "TenantMastersHealth|TenantSalesHealth|TenantPurchaseHealth|TenantWastageHealth|TenantBillingHealth|TenantOffersServicesHealth|TenantExpenseHealth|TenantAccountingHealth|TenantAccountingConfigHealth|MasterFeature" src/` retorna 0 resultados

#### Scenario: Archivo operaciones.ts eliminado

- WHEN se aplica este change
- THEN `ls src/features/admin/server/operaciones.ts` retorna error "no such file or directory"

#### Scenario: Tests del módulo de admin que dependían de las actions eliminadas

- IF existen tests en `src/features/admin/server/` o `src/app/admin/operaciones/` que importaban
  desde `operaciones.ts`
- THEN esos tests **MUST** ser eliminados como parte de este change
