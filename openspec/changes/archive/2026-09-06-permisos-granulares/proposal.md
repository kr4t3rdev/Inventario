# Propuesta — Permisos granulares por rol (authorization layer)

## Decisión ejecutiva

Reemplazar el modelo actual de autorización operativa — **3 roles fijos de tenant (`manager`/`economico`/`dependiente`) + allowlists de rutas hardcodeadas** — por un sistema de **permisos nombrados asignables a roles personalizados por tenant**, sin tocar el eje comercial (features de plan). El objetivo: que un manager pueda decir "mi cajera vende pero no anula; mi contador ve reportes pero no cierra períodos" sin cambiar código, al estilo de los grupos/ACL de Odoo, pero adaptado a la arquitectura real del repo (server actions + REST legacy + API mobile).

## Problema

La auditoría multi-tenant (2026-09-05, ver memoria `tcp-vs-odoo-audit` y `tcp-vs-odoo-multitenant-audit`) confirmó que la autorización de TCP se sostiene sobre tres mecanismos rígidos:

1. **Roles fijos hardcodeados.** `TENANT_ROLES = ["manager", "economico", "dependiente"]` en `src/lib/auth/roles.ts`. No se puede crear un rol "cajero senior" o "supervisor de almacén" sin desplegar código.
2. **Guards binarios en código.** `requireManagerRole` está disperso en **33 archivos**, `requireEconomicoRole` en 2, `requireDependienteRole` en 2, y además hay **16 archivos con checks sueltos** tipo `tenantRole === "manager"` inline. Cambiar una política de acceso = editar N archivos.
3. **Allowlists de rutas obsoletas.** `TENANT_PERMISSIONS` en `src/lib/permissions.ts` lista paths de API (varios legacy o inexistentes); `requireDependienteAccess` en `auth-middleware.ts` tiene su propia lista duplicada ("solo ventas, servicios y reportes"). Dos fuentes de verdad que ya divergen.

Consecuencias reales hoy: cualquier dependiente con acceso a una server action sin guard ejecuta operaciones sensibles (la auditoría de módulos encontró precisamente eso en mermas, transferencias y gastos: "cualquier usuario del tenant puede…"); el `economico` no tiene identidad propia diferenciada (casi nadie usa `requireEconomicoRole`); y el panel de gestión de usuarios del manager solo puede asignar los 3 roles fijos.

## Qué NO cambia (boundary explícita)

| Eje | Sistema actual | Interacción con este change |
|---|---|---|
| **Comercial** (qué paga el tenant) | `Plan.features` (68 features) + `featureOverrides` + `requireFeature` en 112 archivos | **No se toca.** Sigue siendo la primera barrera. |
| **Plataforma** | `User.role` = `admin`/`regularUser`/`salesAgent`; bypass del admin | **No se toca.** El admin global mantiene bypass. |
| **Membresías** | `TenantMembership` user×tenant, flujo de aprobación, switch de tenant | Se **extiende** (nuevo campo), no se reemplaza. |
| **Autenticación** | JWT + `UserSession` revocable | No se toca. 2FA es otro change. |

**Regla de composición:** para ejecutar una operación se requieren AMBOS: (a) el plan del tenant incluye el feature, y (b) el usuario tiene el permiso. Feature sin permiso → 403; permiso sin feature → `FEATURE_NOT_AVAILABLE`.

## Solución propuesta

### 1. Catálogo de permisos nombrados (code-defined)

`src/lib/auth/permission-registry.ts` — registro tipado, mismo patrón que `feature-registry.ts`:

```ts
// Clave: "<dominio>.<recurso>.<accion>"
{ key: "ventas.venta.anular",       label: "Anular ventas",            category: "ventas" }
{ key: "inventario.productos.crear", label: "Crear/editar productos",   category: "inventario" }
{ key: "inventario.mermas.registrar", label: "Registrar mermas",        category: "inventario" }
{ key: "contabilidad.periodos.cerrar", label: "Cerrar períodos contables", category: "financiero" }
{ key: "rrhh.nomina.calcular",      label: "Calcular nómina",           category: "rrhh" }
{ key: "config.usuarios.gestionar", label: "Gestionar usuarios y roles", category: "config" }
```

Cada entrada define además `defaultRoles: TenantRole[]` — qué roles **fijos actuales** la tienen por defecto. Esto es la clave de la migración sin ruptura: **el día 1, el comportamiento del sistema es idéntico**, porque el default del registry reproduce la matriz actual (manager=todo, economico=su lista, dependiente=su lista).

Catálogo inicial estimado: ~45-60 claves mapeando los puntos de guardia existentes (33 archivos con guards + allowlists + checks sueltos).

### 2. Roles personalizados por tenant (schema)

```prisma
model TenantRole {
  roleId      String   @id @default(cuid())
  tenantId    String
  nombre      String                    // "Cajero", "Supervisor de almacén"…
  descripcion String?
  permissions Json                      // string[] de claves del registry
  isActive    Boolean  @default(true)
  createdAt / updatedAt
  tenant      Tenant   @relation(...)
  memberships TenantMembership[]
  @@unique([tenantId, nombre])
  @@index([tenantId])
}

// Extensión de la membresía (aditiva, nullable):
model TenantMembership {
  // ...campos actuales intactos...
  customRoleId String?     // null = comportamiento legacy (defaults del rol fijo)
  customRole   TenantRole? @relation(...)
}
```

- `customRoleId = null` → el usuario opera con los defaults de su `tenantRole` fijo. **Migración = cero cambios de comportamiento.**
- `customRoleId` set → los permisos efectivos son **exactamente** los del rol custom (el tenantRole fijo queda como metadata/compatibilidad).

### 3. Resolución de permisos efectivos (en autenticación)

En `resolveTenantContext` (`src/lib/auth-middleware.ts`), tras resolver la membresía:

```
si membership.customRoleId → cargar TenantRole → effectivePermissions = Set(role.permissions)
si no                      → effectivePermissions = defaults del registry para tenantRole
admin global               → bypass total (sin cambios)
```

El `AuthenticatedUser` gana `permissions: ReadonlySet<string>` (o array; decidir en GREEN por ergonomía de tests). Costo: 1 query extra solo cuando hay customRoleId.

### 4. Guard único server-side

`src/lib/services/tenant-scope.ts` gana la primitiva:

```ts
requirePermission(user, "ventas.venta.anular", "anular ventas")
```

- Lanza `ActionError` `FORBIDDEN` con mensaje neutro idéntico al patrón actual.
- `requireManagerRole` etc. **se mantienen como wrappers** delegando al permiso correspondiente de mayor privilegio durante la migración (ningún call site rompe), y se van reemplazando fase a fase.

### 5. Migración de call sites (el verdadero alcance)

| Capa actual | Archivos | Destino |
|---|---|---|
| `requireManagerRole` | 33 (ficha-costo 9, empleados 6, app 5, productos 3, lib 3, pago-salario 2, venta-servicios 1, servicios 1, listas-precios 1, contabilidad 1, compras-servicios 1… ) | Cada llamada se mapea a su permiso de dominio; las que son genuinamente "admin del tenant" conservan `config.*` |
| `requireEconomicoRole` / `requireDependienteRole` | 2 + 2 | Permisos `contabilidad.*` / `ventas.*` según corresponda |
| Checks sueltos `tenantRole ===` | 16 | Idem, caso por caso |
| Allowlists `TENANT_PERMISSIONS` + `requireDependienteAccess` | 5 (permissions.ts, auth-middleware, …) | Las rutas REST legacy pasan a un mapa `path → permission key` único; las dos listas divergentes desaparecen |
| API mobile (14 grupos de rutas) | `src/app/api/mobile/*` | Mismo mapa path→permiso, compartido con REST web |
| UI (menús, botones) | sidebar + acciones visibles | Filtrado cosmético por `permissions` del usuario (NUNCA sustituye al server) |

Total estimado de call sites a migrar: **~56** (33+2+2+16) + ~5 de transporte. Sin contar tests.

### 6. UI de gestión (manager del tenant)

Página `config` del tenant: CRUD de roles custom con **matriz de permisos por categoría** (misma agrupación que el registry), asignación de rol a membresías, y guardas de producto:

- No se puede editar/eliminar los 3 roles "sistema" (son defaults del registry, no filas).
- No se puede borrar un rol custom con membresías asignadas (bloqueo tipado con conteo; alternativa: reasignar).
- No se puede quitar al último `manager` del tenant (guarda de auto-bloqueo).
- Todo cambio de rol/asignación pasa por `AuditLogService` (patrón ya existente).

### 7. Tests de aislamiento

- Tenant-negativos: rol de tenant B no aplicable en tenant A (aunque se pegue el `customRoleId` en el request).
- Inventory drift: test estático que falla si un guard del código referencia una clave inexistente en el registry (contrato registry↔call-sites).
- Defaults = paridad: snapshot del conjunto de permisos efectivos por rol fijo antes/después (garantiza día-1 sin cambios).

## Métricas de éxito

1. Un manager crea el rol "Cajero" (ventas + POS + turnos, sin anular ni reportes), lo asigna, y el usuario queda efectivamente limitado **en servidor** (tests de actions + REST + mobile).
2. Cero regresión de comportamiento para memberships sin customRole (snapshot de paridad).
3. Cero referencias a claves inexistentes (test de drift).
4. Las dos allowlists divergentes se eliminan; queda una fuente de verdad.
5. Todo el copy en español neutro; errores tipados sin fuga de información cross-tenant.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Migración de 56 call sites introduce regresión | Guards viejos quedan como wrappers durante la transición; migración por dominio con commit por fase; snapshots de paridad por rol |
| JSON de permisos se desincroniza del registry | Test de drift + validación en escritura del rol (solo claves conocidas) |
| Un manager se queda sin acceso por error de UX | Guarda "último manager" + rol manager siempre incluye todo |
| Performance: permisos en cada request | Resolución 1 sola vez en autenticación; Set en memoria en el contexto |

## No-goals

- No se implementa 2FA, invitaciones por email, ni aislamiento sistémico (RLS/Prisma extension) — son cambios hermanos, pendientes de priorización.
- No se toca el panel de admin de plataforma (sigue gestionando usuarios globales).
- No se hacen permisos por registro/fila (record rules estilo Odoo, ej. "solo mis ventas") — alcance deliberadamente por **acción/módulo**, no por fila.
- No se migra la relación empleado↔usuario (sin login de empleados).
