# SDD Spec: Reparar sesión tenant para usuarios plan básico

## 1. Fix A: `approveGlobalUserAction` — Create Tenant, Membership, License

### File: `src/features/admin/actions.ts` (line ~284)

**Current behavior**:
```typescript
await prisma.user.update({
  where: { userId: input.userId },
  data: { isActive: true, expiresAt: ... },
});
return { success: true };
```

**Required behavior**:
Cuando el usuario tiene `onboardingType === "company"` (o no se especifica), crear `Tenant`, `TenantMembership` y `TenantLicense`.

**Input** (extender):
- `userId` (string, required)
- `planId` (string, optional — default: plan básico más barato)
- `tenantName` (string, optional — default: `"Empresa de {user.name}"`)
- `licenseDurationDays` (number, optional — default: 365)

**Steps** (en orden):

1. Validar que el usuario existe y no tiene membership activa
2. Resolver `tenantName`:
   - Si `input.tenantName` → usarlo
   - Si no → `"Empresa de {user.name}"`
3. Validar que no exista tenant con ese nombre (slug conflict)
4. Crear `Tenant` con slug generado de `tenantName`
5. Si `planId`:
   - Buscar `Plan.planId`
   - Si no → buscar primer plan ordenado por precio ASC
6. Crear `TenantMembership` con `tenantRole: "manager"`, `isActive: true`
7. Crear `TenantLicense` con:
   - `planId`: del plan resuelto
   - `activa: true`
   - `inicio: now()`
   - `expiracion: now() + licenseDurationDays`
   - `maxUsuarios`, `maxAlmacenes`, `maxProductos`: del plan
8. Actualizar usuario:
   - `isActive: true`
   - `expiresAt: license.expiracion`
   - `onboardingStatus: null` ← **CRÍTICO: limpiar estado mid-onboarding**

**Validation**:
- Si el usuario ya tiene `onboardingStatus !== "awaiting_global_approval"` → error `INVALID_ONBOARDING_STATUS`
- Si ya existe `TenantMembership` para este usuario → error `ALREADY_MEMBER`
- Si `tenantName` genera slug existente → auto-generar slug con sufijo numérico

### Acceptance

```typescript
// Prisma asserts after approveGlobalUserAction
const tenant = await prisma.tenant.findFirst({ where: { memberships: { some: { userId } } } })
expect(tenant).not.toBeNull()

const membership = await prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId: tenant.tenantId, userId } } })
expect(membership.isActive).toBe(true)
expect(membership.tenantRole).toBe("manager")

const license = await prisma.tenantLicense.findFirst({ where: { tenantId: tenant.tenantId, activa: true } })
expect(license).not.toBeNull()
expect(license.expiracion).toBeGreaterThan(new Date())

const user = await prisma.user.findUnique({ where: { userId } })
expect(user.onboardingStatus).toBeNull()
```

---

## 2. Fix B: `refreshSessionAction` — Store auth token in UserSession

### File: `src/features/auth/actions.ts` (line ~307)

**Current bug**:
```typescript
await prisma.userSession.create({
  data: {
    userId,
    token: newRefreshToken,  // ❌ stores refresh token
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
});
```

**Fix**:
```typescript
await prisma.userSession.create({
  data: {
    userId,
    token: newToken,  // ✅ stores auth token (matches what getCurrentUser looks up)
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
});
```

### Same bug in `src/features/auth/api/handlers.ts` (line ~797):
The `refreshToken` handler has the same issue:
```typescript
token: newRefreshToken,  // ❌
```
Fix to:
```typescript
token: newToken,  // ✅
```

---

## 3. Fix C: `Usuario` interface — Add `tenantId`

### File: `src/app/models/ventas.ts` (line ~237)

**Add field**:
```typescript
export interface Usuario {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: string;
  tenantRole?: string | null;
  tenantId?: string | null;   // ← ADD THIS
  // ...existing fields
}
```

### Impact analysis:
- `auth-context.tsx` stores `meAction` result as `Usuario`
- `meAction` returns `{ user: { ...dbUser, tenantId, tenantRole } }`
- The sidebar accesses `user?.tenantRole` via `useAuth()`
- With `tenantId` typed, we can also show/hide tenant-specific UI
- No runtime change — just type safety

---

## 4. Fix D: `resolveTenantContext` — Better error logging

### File: `src/lib/auth-middleware.ts` (line ~30)

**Current**:
```typescript
catch (error) {
  console.error('[Auth] Error resolviendo contexto tenant:', error);
  return null;
}
```

**Fix**:
```typescript
catch (error) {
  console.error('[Auth] Error resolviendo contexto tenant:', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
    userId,
    headerTenantId,
  });
  return null;
}
```

---

## 5. Fix E: Seed `TenantLicense` for existing tenants

### New file: `prisma/seed-tenant-licenses.ts`

Script one-shot para crear `TenantLicense` para todos los `Tenant` que no tengan una.

**Logic**:
1. Buscar primer `Plan` ordenado por `precio ASC` (plan más barato = plan básico por defecto)
2. Para cada `Tenant` sin `TenantLicense` activa:
   - Crear `TenantLicense` con el plan encontrado
   - `maxUsuarios`, `maxAlmacenes`, `maxProductos` del plan
   - `expiracion: now() + 365 días`
3. Reportar cuántas licencias se crearon

**Add to `prisma/package.json` scripts**:
```json
"seed:licenses": "npx tsx prisma/seed-tenant-licenses.ts"
```

---

## 6. Fix F: Sidebar graceful degradation when `planLimits` is undefined

### File: `src/components/app-sidebar2.tsx`

El sidebar usa `user.tenantRole` para filtrar items vía `canSeeSidebarItem()`. Si `tenantRole` es undefined, el usuario no ve nada.

**Fix mínimo**: En `canSeeSidebarItem`, cuando `!user?.tenantRole`:
- Si el usuario es admin global → mostrar todo
- Si no → verificar si hay `planLimits` → si hay planLimits pero no tenantRole, mostrar items básicos (solo los públicos/dashboard)

```typescript
function canSeeSidebarItem(itemTitle: string): boolean {
  if (user?.role === "admin") return true;
  if (!user?.tenantRole) {
    // Modo degraded: usuario autenticado pero sin rol de tenant
    const publicItems = ["Productos", "Ventas", "Clientes", "Dashboard",
      "Reportes", "Venta Diaria", "Mi Empresa"];
    return publicItems.includes(itemTitle);
  }
  const allowedRoles = SIDEBAR_TENANT_PERMISSIONS[itemTitle];
  if (!allowedRoles) return user.tenantRole === "manager";
  return allowedRoles.includes(user.tenantRole as TenantRole);
}
```

---

## Dependency Graph

```
Fix A ──┬── Fix C (type safety)
        ├── Fix F (depends on user having tenant)
        └── Fix E (pre-condition: tenants need licenses for data consistency)

Fix B ── standalone (refresh token bug)

Fix D ── standalone (debuggability)

Fix E ── standalone (can run before or after A)

Fix F ── depends on A working (graceful degradation when A partially works)
```

## Order of Implementation

| Order | Fix | Risk | Why |
|-------|-----|------|-----|
| 1 | B (refreshSessionAction) | Low | Mínimo cambio, bug crítico que afecta a todos |
| 2 | C (Usuario interface) | Low | Solo type, no runtime |
| 3 | A (approveGlobalUserAction) | High | Cambio de comportamiento, requiere test |
| 4 | D (logging) | Low | Solo debug |
| 5 | E (seed) | Medium | Script one-shot, requiere revisión |
| 6 | F (sidebar degradation) | Low | Fallback visual |
