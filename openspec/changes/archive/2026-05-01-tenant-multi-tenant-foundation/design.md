# Design: Tenant Multi-Tenant Foundation

## Technical Approach

La estrategia es migrar a `shared DB + tenantId` manteniendo `User` como identidad global y moviendo pertenencia, rol operativo y límites al contexto tenant. El cambio se implementa por capas: modelo de datos, backfill, auth con tenant activo, RBAC tenant, scoping Prisma y refactor de módulos globales (`MiEmpresa`, administración, licencias). Esto sigue el diagnóstico verificado del código actual: `MiEmpresa` singleton, auth sin tenant y permisos globales.

## Architecture Decisions

### Decision: `TenantMembership` en vez de `tenantId` directo en `User`

**Choice**: modelar `Tenant`, `TenantMembership`, `TenantLicense` y mantener `User` como identidad global.

**Alternatives considered**: poner `tenantId` directo en `User`; separar bases por tenant.

**Rationale**: membership soporta múltiples empresas por usuario, consultores y futuros casos cross-tenant sin refactor destructivo; además desacopla identidad de autorización operativa.

### Decision: Scoping centralizado en capa Prisma/auth

**Choice**: introducir helpers como `assertTenantAccess`, `scopedWhere` y/o repositorios tenant-aware en vez de repetir `tenantId` manualmente.

**Alternatives considered**: filtros ad hoc en cada route; middleware pasivo sin enforcement en servicios.

**Rationale**: el mayor riesgo es un `findMany()` sin filtro. La centralización reduce superficie de error y facilita auditoría.

### Decision: Migración incremental con tenant default

**Choice**: agregar `tenantId` nullable, backfill, validar y recién después endurecer FK/NOT NULL/uniques compuestos.

**Alternatives considered**: migración big-bang con constraints finales desde el día uno.

**Rationale**: evita cortar producción y permite rollback antes de fijar restricciones irreversibles.

## Data Flow

```text
Request
  -> auth-middleware
     -> valida JWT + sesión
     -> resuelve membership activa
     -> adjunta { userId, tenantId, tenantRole, planLimits }
  -> permission layer
     -> valida tenantRole / platformRole
  -> tenant-scoped service
     -> aplica scopedWhere(tenantId, ...)
  -> Prisma
     -> lee/escribe solo recursos del tenant
```

Flujo de migración:

```text
schema nuevo -> tenant default -> backfill datos -> validar integridad
-> activar scoping lectura -> activar scoping escritura -> endurecer constraints
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Agregar `Tenant`, `TenantMembership`, `TenantLicense`, relación 1:1 entre tenant y `MiEmpresa`, y `tenantId` en entidades de negocio. |
| `src/lib/auth-middleware.ts` | Modify | Resolver tenant activo, membresía, licencias y exponer contexto autenticado expandido. |
| `src/lib/auth/roles.ts` | Modify | Normalizar roles de plataforma y roles tenant separados. |
| `src/lib/permissions.ts` | Modify | Agregar helpers `hasTenantPermission(...)` y reglas de acceso tenant-scoped. |
| `src/app/api/admin/users/route.ts` | Modify | Limitar listados/altas al tenant actual y validar cupos del plan. |
| `src/app/api/mi-empresa/route.ts` | Modify | Operar sobre el perfil del tenant actual, no sobre `id = 1`. |
| `src/lib/services/**` | Modify | Incorporar patrones de acceso scopiado reutilizables. |
| `src/app/api/**` | Modify | Migrar endpoints críticos a filtro obligatorio por `tenantId`. |

## Interfaces / Contracts

```ts
interface AuthenticatedTenantContext {
  userId: string;
  email: string;
  platformRole?: 'platformAdmin' | 'support' | null;
  tenantId: string;
  tenantRole: 'director' | 'admin' | 'economico' | 'dependiente';
  planLimits: {
    maxUsuarios: number;
    maxAlmacenes: number;
    maxProductos: number;
  };
}

interface TenantScope {
  tenantId: string;
}

function scopedWhere<T extends object>(tenantId: string, where?: T): T & TenantScope;
function assertTenantAccess(resourceTenantId: string, actorTenantId: string): void;
```

Modelo objetivo de datos:

```prisma
model Tenant {
  tenantId   String  @id @default(cuid())
  nombre     String
  memberships TenantMembership[]
  empresa    MiEmpresa?
  licencias  TenantLicense[]
}

model TenantMembership {
  membershipId String @id @default(cuid())
  tenantId     String
  userId       String
  tenantRole   String
  isActive     Boolean @default(true)
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `scopedWhere`, `assertTenantAccess`, mapeo de roles tenant | Vitest con casos happy-path y edge cases de aislamiento. |
| Integration | `auth-middleware`, `/api/admin/users`, `/api/mi-empresa`, endpoints críticos con tenant A/B | Requests autenticados con fixtures multi-tenant y verificación 403/404. |
| E2E | Cambio de tenant activo, admin tenant, límites de plan | Playwright sobre flujos de usuario y visibilidad de datos por empresa. |

## Migration / Rollout

1. Crear modelos tenant y columnas `tenantId` nullable.
2. Crear tenant default y backfill de datos globales.
3. Migrar `MiEmpresa`, membresías y licencias al nuevo modelo.
4. Activar auth con tenant y scoping en lectura.
5. Activar scoping en escritura y administración de usuarios.
6. Reemplazar uniques globales por compuestos donde aplique.
7. Endurecer `NOT NULL`, FK y validaciones finales.

Rollback: revertir consumo del contexto tenant en auth/routes, mantener tenant default y no aplicar constraints finales hasta que validación y tests de aislamiento estén verdes.

## Open Questions

- [ ] Definir qué identificadores siguen siendo globales (`User.email`) y cuáles pasan a unique compuesto por tenant.
- [ ] Definir si el tenant activo viajará en JWT, header explícito o resolución por membresía única en la primera etapa.
- [ ] Priorizar el orden de migración de dominios de negocio más riesgosos (`Producto`, `Venta`, `Almacen`, `PuntoDeVenta`).
