# Diseño técnico — Permisos granulares por rol

## Modelo conceptual: dos ejes ortogonales

```
┌──────────────────────┬─────────────────────────────────────────┐
│ Eje comercial        │ Eje de autorización (este change)       │
│ Plan → features      │ Rol → permisos nombrados                │
│ requireFeature()     │ requirePermission()                     │
│ 112 archivos         │ reemplaza 56 call sites de guards fijos │
└──────────────────────┴─────────────────────────────────────────┘
Regla: operación permitida ⟺ feature en plan ∧ permiso en rol
(orden de chequeo: primero feature — FEATURE_NOT_AVAILABLE —, después permiso — FORBIDDEN;
así el diagnóstico distingue "tu plan no lo incluye" de "tu rol no lo permite")
```

## Catálogo de permisos (`src/lib/auth/permission-registry.ts`)

Formato de clave: `<categoria>.<recurso>.<accion>`. Categorías alineadas con el `feature-registry` (`inventario`, `ventas`, `compras`, `financiero`, `produccion`, `rrhh`, `config`, `operaciones`). Cada entrada:

```ts
interface PermissionDef {
  key: string;               // p.ej. "ventas.venta.anular"
  label: string;             // español neutro, para la matriz de UI
  description: string;
  category: PermissionCategory;
  defaultRoles: TenantRole[]; // roles fijos que la poseen por defecto (paridad día-1)
  sensitive?: boolean;        // marca operaciones de riesgo (anular, borrar, cerrar) para UI/auditoría
}
```

**Matriz inicial (fuente de verdad):** se construye por extracción — cada `requireManagerRole`/`requireEconomicoRole`/`requireDependienteRole`/check suelto existente se traduce a una clave y se anota en `defaultRoles` con el rol que hoy pasa el guard. Los 3 roles fijos quedan definidos **derivados del registry**, no en listas aparte:

- `manager` → todas las claves (convención `*` materializada en resolución).
- `economico` → claves con `defaultRoles` incl. `economico` (extraídas de `TENANT_PERMISSIONS.economico`: reportes financieros, stats, contabilidad, gastos).
- `dependiente` → idem desde `TENANT_PERMISSIONS.dependiente` + `requireDependienteAccess` (ventas GET/POST, servicios, reportes básicos, POS).

## Schema (una migración aditiva)

```prisma
model TenantRole {
  roleId      String            @id @default(cuid())
  tenantId    String
  nombre      String
  descripcion String?
  permissions Json              // string[] validadas contra el registry al escribir
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  tenant      Tenant            @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  memberships TenantMembership[]
  @@unique([tenantId, nombre])
  @@index([tenantId])
}

model TenantMembership {
  // …campos actuales intactos…
  customRoleId String?
  customRole   TenantRole? @relation(fields: [customRoleId], references: [roleId], onDelete: Restrict)
}
```

Decisiones:
- `onDelete: Restrict` en `customRoleId`: no se borra un rol con miembros asignados (error tipado con conteo; reasignación explícita). Evita degradación silenciosa de permisos.
- `permissions` como JSON (patrón consistente con `Plan.features`), validado contra el registry en la action de escritura: **claves desconocidas se rechazan** (la escritura es el firewall; la lectura tolera).
- Nada de seed: sin filas, el sistema opera 100% por defaults del registry.

## Resolución de permisos efectivos

En `resolveTenantContext` (`src/lib/auth-middleware.ts`), después de resolver la membresía:

```ts
if (membership.customRoleId) {
  const role = await prisma.tenantRole.findFirst({
    where: { roleId: membership.customRoleId, tenantId: membership.tenantId, isActive: true },
  });
  permissions = role ? new Set(role.permissions) : defaultSetFor(membership.tenantRole);
  // rol inválido/ajeno/inactivo → fallback a defaults del rol fijo (fail-safe, nunca fail-open)
} else {
  permissions = defaultSetFor(membership.tenantRole);
}
```

- `AuthenticatedUser.permissions: ReadonlySet<string>` (o `string[]`; se decide en GREEN — criterio: ergonomía en tests y tamaño en JWT… **no** se mete en el JWT: se resuelve por request desde BD, como hoy los planFeatures).
- Admin global (`user.role === 'admin'`): bypass intacto antes de cualquier chequeo tenant.

## Guard único

```ts
// src/lib/services/tenant-scope.ts
export function requirePermission(user: AuthenticatedUser, key: string, action?: string): void {
  if (user.role === 'admin') return;
  requireTenant(user);
  if (!user.permissions?.has(key)) {
    throw new ActionError(`No tienes permisos para ${action ?? 'realizar esta acción'}.`, 'FORBIDDEN');
  }
}
export function hasPermission(user: AuthenticatedUser, key: string): boolean { /* para UI/condicionales */ }
```

**Estrategia de convivencia:** los guards actuales (`requireManagerRole` etc.) **no se modifican** — permanecen hasta que cada call site se migre a su clave. No hay "wrapper mágico": la migración es explícita, archivo por archivo, con test de comportamiento antes/después. Esto evita cambios de semántica en masa.

## Transporte: REST legacy + mobile

- Nuevo módulo `src/lib/auth/route-permissions.ts`: mapa `path → permission key` único, compartido por `checkTenantApiPermission` (web) y las rutas de `src/app/api/mobile/`.
- Rutas no mapeadas durante la transición: comportamiento legacy + log estructurado `UNMAPPED_ROUTE` (visible, no silencioso). Gate de cierre del change: listado de no-mapeadas = 0 o lista blanca explícita firmada.
- Las listas `TENANT_PERMISSIONS`/`ROLE_PERMISSIONS`/`requireDependienteAccess` se eliminan al final (única fuente de verdad = registry + mapa).

## UI

- Página `config` del tenant: **matriz rol × permiso** agrupada por categoría; CRUD de roles custom; asignación en la gestión de usuarios del manager (extender `updateTenantUserAction` con `customRoleId` validado).
- Menú/sidebar: filtrado por `permissions` (cosmético; el servidor siempre re-valida).
- Guardas de producto: no editar/borrar roles sistema (no existen como filas, emergen del registry); no borrar rol con miembros; no dejar al tenant sin `manager`.
- Auditoría: `AuditLogService.log` en create/update/delete de roles y en asignación/cambio de rol a miembro.

## Testing strategy

| Test | Qué prueba |
|---|---|
| Registro | claves únicas, formato, `defaultRoles` válidos, `label/description` no vacíos |
| Resolución | customRole válido/inválido/inactivo/ajeno → Set correcto o fallback; admin bypass |
| Guard | con/sin permiso, admin, sin tenant, mensaje neutro |
| **Paridad (corazón del change)** | snapshot: conjunto efectivo por rol fijo antes = después de introducir el sistema |
| Drift | rastreo estático: ningún `requirePermission(...)` del código usa clave inexistente; ninguna clave `sensitive` sin test de denegación |
| Tenant-negativo | rol del tenant B no aplicable a membresía del tenant A; error idéntico a "no existe" |
| Migración de call sites | por dominio: el action migado deniega/permite igual que antes para los roles fijos, y respeta el permiso fino para roles custom |
| Route map | toda ruta REST/mobile sensible tiene clave o está en la lista blanca firmada |

Mocks: tests unitarios con prisma mockeado (contrato vigente: prisma estático, `$executeRaw`/fxEvidence/tenantAccountingPolicy donde aplique); tests de integración reales solo en `__integration__`.

## Interacción con `correcciones-urgentes`

Dependencia de orden: **Correcciones Urgentes va primero** (ya en ejecución en su ventana). Esta change asume que:
1. Los handlers REST de contratos ya filtran por tenant (CU-01) — el mapa de rutas a permisos se monta sobre esa base saneada.
2. `Merma.creadoPorId` (CU-07) existe — el permiso `inventario.mermas.registrar` se diseña contra el modelo corregido.

Si ambas avanzan en paralelo: prohibido tocar en esta change los archivos de F-01/F-02/F-05 hasta que sus fases commiteen (riesgo de conflicto directo en `contratos/api/handlers.ts`, `ofertas/api/handlers.ts`, `mermas/actions.ts`).

## Rollback

- Schema aditivo: rollback aplicativo = ignorar `customRoleId` (flag `CUSTOM_ROLES_ENABLED=false`) y quedan los defaults — sin tocar datos.
- Ninguna migración destructiva; `TenantRole` puede permanecer desplegada pero inerte.
- La eliminación de las allowlists legacy es la **última** tarea, tras el gate de cero rutas no mapeadas.
