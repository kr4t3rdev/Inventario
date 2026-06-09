# SDD Tasks: Reparar sesión tenant para usuarios plan básico

> **Mode**: Auto (phases back-to-back)  
> **Risk gate**: Preguntar solo si hay riesgo de breaking change o conflicto de datos  
> **Engram**: Guardar cada fase completada

---

## PREREQUISITES

- [x] Read `src/features/admin/actions.ts` — entender `approveGlobalUserAction`
- [x] Read `src/features/auth/actions.ts` — entender `refreshSessionAction`
- [x] Read `src/lib/auth-middleware.ts` — entender `resolveTenantContext`
- [x] Read `src/app/models/ventas.ts` — entender `Usuario` interface
- [x] Read `prisma/schema.prisma` — entender modelos Tenant, TenantMembership, TenantLicense, Plan
- [x] Read `src/features/auth/api/handlers.ts` — entender `refreshToken` handler
- [x] Read `src/components/app-sidebar2.tsx` — entender `canSeeSidebarItem`

---

## TASK 1: Fix B — refreshSessionAction (token incorrecto) 🟢 Low Risk

**Files**: 
- `src/features/auth/actions.ts` (~line 307)
- `src/features/auth/api/handlers.ts` (~line 797)

**Changes**:
1. En `actions.ts`: cambiar `token: newRefreshToken` a `token: newToken`
2. En `handlers.ts`: cambiar `token: newRefreshToken` a `token: newToken`

**Evidence**:
- [ ] Cambio aplicado en `actions.ts`
- [ ] Cambio aplicado en `handlers.ts`
- [ ] `pnpm run build` pasa sin errores

---

## TASK 2: Fix C — Usuario interface (agregar tenantId) 🟢 Low Risk

**File**: `src/app/models/ventas.ts` (~line 237)

**Changes**:
1. Agregar `tenantId?: string | null` a la interface `Usuario`

**Evidence**:
- [ ] Cambio aplicado
- [ ] `pnpm run build` pasa sin errores

---

## TASK 3: Fix D — resolveTenantContext logging 🟢 Low Risk

**File**: `src/lib/auth-middleware.ts` (~line 67)

**Changes**:
1. Mejorar el catch de `resolveTenantContext` para loguear error, userId, headerTenantId con stack trunco

**Evidence**:
- [ ] Cambio aplicado
- [ ] `pnpm run build` pasa sin errores

---

## TASK 4: Fix A — createTenantForUser factory 🟡 Medium Risk

**Files**:
- `src/lib/services/tenant-factory.ts` (nuevo)
- `src/features/admin/actions.ts` (modificar `approveGlobalUserAction`)

**Changes**:
1. Crear `src/lib/services/tenant-factory.ts` con `createTenantForUser()`
2. Modificar `approveGlobalUserAction` para:
   - Si `onboardingType === "company"` → llamar `createTenantForUser`
   - Si no → legacy (solo activar usuario + limpiar onboardingStatus)
3. Validar: usuario existe, onboardingStatus correcto, no tiene membership activa
4. Resolver tenantName y generar slug único
5. Resolver plan (por ID o default plan más barato)
6. Transacción: crear Tenant + TenantMembership(manager, activa) + TenantLicense + actualizar User
7. Limpiar `onboardingStatus` a null

**Risk**: ⚠️ PRIMERA VEZ que se crea Tenant desde UI de admin. Verificar:
- ¿El admin page tiene selector de plan? → `admin-users-page-client.tsx` línea 293 muestra diálogo de aprobación. Revisar qué campos tiene.
- ¿Existen `Plan` en BD? → Si no hay plan, `findFirst({ orderBy: { precio: 'asc' } })` fallaría

**[RISK GATE]** → Antes de implementar, preguntar al usuario:
- ¿Hay planes creados en BD? Si no, crear plan "Plan Básico" primero
- ¿Cómo se llama el tenant por defecto? "Empresa de {nombre}"?
- ¿Conviene agregar selector de plan al diálogo de aprobación?

**Evidence**:
- [ ] `tenant-factory.ts` creado con función exportada
- [ ] `approveGlobalUserAction` modificado
- [ ] Test: approve user tipo company → verify Tenant, Membership, License creados
- [ ] Test: approve user tipo worker → legacy behavior preserved
- [ ] Test: approve sin plan → usa default plan más barato
- [ ] Test: approve con tenantName duplicado → slug auto-incrementado
- [ ] Test: approve usuario sin permisos → FORBIDDEN
- [ ] `pnpm run build` pasa

---

## TASK 5: Fix F — Sidebar graceful degradation 🟢 Low Risk

**File**: `src/components/app-sidebar2.tsx`

**Changes**:
1. En `canSeeSidebarItem`: cuando `!user?.tenantRole`, permitir items públicos
2. Definir set de items públicos: `Productos`, `Ventas`, `Clientes`, `Servicios`, `Reportes`, `Venta Diaria`, `Mi Empresa`, `Dashboard`, `Cuadre Financiero`

**Evidence**:
- [ ] Cambio aplicado
- [ ] Sidebar muestra items mínimos para usuario sin tenantRole
- [ ] Sidebar normal sin cambios para usuarios con tenantRole

---

## TASK 6: Fix E — Seed TenantLicense 🟡 Medium Risk

**Files**:
- `prisma/seed-tenant-licenses.ts` (nuevo)

**Changes**:
1. Crear script one-shot que busca tenants sin licencia activa
2. Para cada uno, crear `TenantLicense` con el plan default (más barato)
3. Reportar resumen

**Risk**: ⚠️ Si hay tenants del sistema (admin, migraciones, etc.) que no deberían tener licencia. Verificar que solo afecte tenants con memberships activas.

**[RISK GATE]** → Antes de ejecutar seed, preguntar al usuario:
- ¿Todos los tenants existentes deben tener licencia?
- ¿Hay tenants especiales (admin, test) que deban excluirse?

**Evidence**:
- [ ] Script creado
- [ ] Prueba local: correr contra DB de test
- [ ] Reporte de cuántas licencias se crearían en prod
- [ ] `pnpm run build` pasa

---

## SUMMARY

| Task | File(s) | Lines changed | Risk | Depends on |
|------|---------|--------------|------|------------|
| 1 — Fix B | `actions.ts`, `handlers.ts` | 2 | 🟢 | — |
| 2 — Fix C | `ventas.ts` | 1 | 🟢 | — |
| 3 — Fix D | `auth-middleware.ts` | 4 | 🟢 | — |
| 4 — Fix A | `tenant-factory.ts` (new), `actions.ts` | ~100 | 🟡 | 2 (Usuario interface) |
| 5 — Fix F | `app-sidebar2.tsx` | 10 | 🟢 | 2, 4 (para test real) |
| 6 — Fix E | `prisma/seed-tenant-licenses.ts` (new) | ~50 | 🟡 | — |

**Total estimated changed lines**: ~167  
**Total new files**: 2  
**Total modified files**: 5  

## APPROVAL CHECKPOINTS

1. **Before Task 4** → Preguntar sobre planes y nombre de tenant (riesgo de datos)
2. **Before Task 6** → Preguntar sobre alcance del seed (riesgo de datos)
3. **After all tasks** → Pedir confirmación para ejecutar seed contra BD real
