# SDD Design: Reparar sesión tenant para usuarios plan básico

## Technical Design

### Design 1: Fix A — `approveGlobalUserAction` con creación de tenant

#### Nuevo helper: `createTenantForUser`

Crear función reusable en `src/lib/services/tenant-factory.ts`:

```typescript
// src/lib/services/tenant-factory.ts
import { prisma } from '@/lib/prisma'
import { ActionError } from '@/lib/server-actions'

export interface CreateTenantForUserInput {
  userId: string
  planId?: string
  tenantName?: string
  licenseDurationDays?: number
}

export interface CreateTenantForUserResult {
  tenantId: string
  membershipId: string
  licenseId: string
}

/**
 * @description Crea un Tenant, TenantMembership y TenantLicense para un usuario tipo "company".
 * - Genera slug único del tenantName
 * - Resuelve el plan (default: más barato)
 * - Crea membership con rol manager activa
 * - Crea license vinculada al plan
 */
export async function createTenantForUser(
  input: CreateTenantForUserInput
): Promise<CreateTenantForUserResult> {
  const { userId, planId, tenantName, licenseDurationDays = 365 } = input

  // 1. Validar onboarding status
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, name: true, onboardingStatus: true }
  })
  if (!user) throw new ActionError('Usuario no encontrado', 'NOT_FOUND')
  if (user.onboardingStatus !== 'awaiting_global_approval') {
    throw new ActionError(
      'El usuario no está en estado de aprobación global',
      'INVALID_ONBOARDING_STATUS'
    )
  }

  // 2. Validar que no tenga membership activa ya
  const existingMembership = await prisma.tenantMembership.findFirst({
    where: { userId, isActive: true }
  })
  if (existingMembership) {
    throw new ActionError('El usuario ya tiene una empresa activa', 'ALREADY_MEMBER')
  }

  // 3. Resolver nombre del tenant
  const companyName = tenantName || `Empresa de ${user.name}`

  // 4. Generar slug único
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)

  let slug = baseSlug
  let counter = 1
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`
  }

  // 5. Resolver plan
  let plan
  if (planId) {
    plan = await prisma.plan.findUnique({ where: { planId } })
    if (!plan) throw new ActionError('Plan no encontrado', 'PLAN_NOT_FOUND')
  } else {
    plan = await prisma.plan.findFirst({ orderBy: { precio: 'asc' } })
    if (!plan) throw new ActionError('No hay planes disponibles', 'NO_PLANS')
  }

  // 6. Crear todo en transacción
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        nombre: companyName,
        slug,
      }
    })

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.tenantId,
        userId,
        tenantRole: 'manager',
        isActive: true,
      }
    })

    const license = await tx.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: plan!.planId,
        activa: true,
        inicio: new Date(),
        expiracion: new Date(Date.now() + licenseDurationDays * 86400000),
        maxUsuarios: plan!.maxUsuarios,
        maxAlmacenes: plan!.maxAlmacenes,
        maxProductos: plan!.maxProductos,
      }
    })

    // 7. Actualizar usuario
    await tx.user.update({
      where: { userId },
      data: {
        isActive: true,
        expiresAt: license.expiracion,
        onboardingStatus: null,
      }
    })

    return { tenantId: tenant.tenantId, membershipId: membership.membershipId, licenseId: license.licenseId }
  })

  return result
}
```

#### Modificación de `approveGlobalUserAction`

```typescript
export const approveGlobalUserAction = withAction(
  async (input: {
    userId: string
    planId?: string
    tenantName?: string
    licenseDurationDays?: number
  }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN')

    const targetUser = await prisma.user.findUnique({
      where: { userId: input.userId },
      select: { userId: true, onboardingType: true, onboardingStatus: true }
    })
    if (!targetUser) throw new ActionError('Usuario no encontrado', 'NOT_FOUND')

    // Si es tipo "worker" o ya tiene tenant → comportamiento legacy (solo activar)
    if (targetUser.onboardingType !== 'company' && !targetUser.onboardingStatus?.includes('global_approval')) {
      // Legacy: solo activar usuario
      await prisma.user.update({
        where: { userId: input.userId },
        data: { isActive: true, onboardingStatus: null }
      })
      return { success: true, tenantCreated: false }
    }

    // Tipo "company" → crear tenant completo
    const result = await createTenantForUser(input)
    return { success: true, tenantCreated: true, ...result }
  }
)
```

---

### Design 2: Fix B — refreshSessionAction token

**Change 1**: `src/features/auth/actions.ts` line ~307:
```typescript
// ❌ Antes:
token: newRefreshToken,
// ✅ Después:
token: newToken,
```

**Change 2**: `src/features/auth/api/handlers.ts` line ~797:
```typescript
// ❌ Antes:
token: newRefreshToken,
// ✅ Después:
token: newToken,
```

---

### Design 3: Fix C — Usuario interface

```typescript
export interface Usuario {
  userId: string
  name: string
  email: string
  password: string
  role: string
  tenantRole?: string | null
  tenantId?: string | null   // ← nuevo campo
  // ...resto igual
}
```

---

### Design 4: Fix D — resolveTenantContext logging

```typescript
catch (error) {
  console.error('[Auth] Error resolviendo contexto tenant:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
    userId,
    headerTenantId,
  })
  return null
}
```

---

### Design 5: Fix E — Seed script

```typescript
// prisma/seed-tenant-licenses.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Buscando tenants sin licencia activa...')

  const defaultPlan = await prisma.plan.findFirst({ orderBy: { precio: 'asc' } })
  if (!defaultPlan) {
    console.error('❌ No hay planes en la BD. Creá al menos un plan primero.')
    process.exit(1)
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      licencias: { none: { activa: true } }
    },
    select: { tenantId: true, nombre: true }
  })

  console.log(`📊 Encontrados ${tenants.length} tenants sin licencia activa.`)

  let created = 0
  for (const tenant of tenants) {
    await prisma.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: defaultPlan.planId,
        activa: true,
        inicio: new Date(),
        expiracion: new Date(Date.now() + 365 * 86400000),
        maxUsuarios: defaultPlan.maxUsuarios,
        maxAlmacenes: defaultPlan.maxAlmacenes,
        maxProductos: defaultPlan.maxProductos,
      }
    })
    created++
    console.log(`  ✅ ${tenant.nombre} — licencia creada (plan: ${defaultPlan.nombre})`)
  }

  console.log(`\n✅ ${created} licencias creadas exitosamente.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

### Design 6: Fix F — Sidebar graceful degradation

```typescript
function canSeeSidebarItem(itemTitle: string): boolean {
  // Admin global ve todo
  if (user?.role === 'admin') return true

  // Sin tenantRole: degraded mode — mostrar items públicos
  if (!user?.tenantRole) {
    const TENANTLESS_PUBLIC_ITEMS = new Set([
      'Productos', 'Ventas', 'Clientes', 'Servicios',
      'Reportes', 'Venta Diaria', 'Mi Empresa',
      'Cuadre Financiero', 'Dashboard',
    ])
    return TENANTLESS_PUBLIC_ITEMS.has(itemTitle)
  }

  // Normal: filtrar por permisos de tenantRole
  const allowedRoles = SIDEBAR_TENANT_PERMISSIONS[itemTitle]
  if (!allowedRoles) return user.tenantRole === 'manager'
  return allowedRoles.includes(user.tenantRole as TenantRole)
}
```

---

## Data Model Reference

```
Tenant {
  tenantId    String  @id
  nombre      String
  slug        String? @unique
}

TenantMembership {
  membershipId String  @id
  tenantId     String
  userId       String
  tenantRole   String  (manager | economico | dependiente)
  isActive     Boolean
  @@unique([tenantId, userId])
}

TenantLicense {
  tenantLicenseId String  @id
  tenantId        String
  planId          String?
  activa          Boolean
  inicio          DateTime
  expiracion      DateTime
  maxUsuarios     Int     (default: 1)
  maxAlmacenes    Int     (default: 1)
  maxProductos    Int     (default: 100)
  features        Json?
}

Plan {
  planId         String  @id
  nombre         String
  precio         Decimal
  duracionDias   Int
  maxUsuarios    Int     (default: 1)
  maxAlmacenes   Int     (default: 1)
  maxProductos   Int     (default: 100)
  maxClientes    Int     (default: 200)
  maxPuntosVenta Int     (default: 1)
  features       Json
}
```

## Error Handling Strategy

| Error | Código | HTTP | Acción |
|-------|--------|------|--------|
| Usuario no encontrado | NOT_FOUND | 404 | Mostrar toast error |
| Onboarding status inválido | INVALID_ONBOARDING_STATUS | 400 | Mostrar mensaje claro al admin |
| Ya tiene empresa activa | ALREADY_MEMBER | 409 | Informar que ya pertenece a un tenant |
| Plan no encontrado | PLAN_NOT_FOUND | 404 | Mostrar error al admin |
| Slug duplicado (autofix) | — | — | Auto-incrementar slug |
| Sin plan default | NO_PLANS | 500 | Error de configuración del sistema |

## Testing Strategy

| Fix | Test Type | Coverage |
|-----|-----------|----------|
| A | Unit + Integration | Crear tenant con plan, crear sin plan, usuario ya con membership, onboarding status inválido |
| B | Unit | Verificar que `UserSession.token` = auth token, no refresh token |
| C | Compile-time | TypeScript check, no runtime test needed |
| D | Manual | Verificar logs estructurados |
| E | Integration | Correr seed en DB de test, verificar licencias creadas |
| F | Component | Sidebar renderiza items públicos sin tenantRole |

## Rollback Plan

1. **Fix A**: Restaurar `approveGlobalUserAction` original (solo activar usuario)
2. **Fix B**: Restaurar `token: newRefreshToken`
3. **Fix C**: Revertir cambio en interface
4. **Fix D**: Revertir logging
5. **Fix E**: DELETE las licencias creadas por el seed (guardar IDs en log)
6. **Fix F**: Restaurar `canSeeSidebarItem` original
