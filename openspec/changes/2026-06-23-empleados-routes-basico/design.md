# SDD Design: Empleados — desbloquear rutas en plan Básico

> Documento de diseño técnico. Companion de `proposal.md` y `spec.md`.

## Arquitectura actual (as-is)

```
┌────────────────────────────────────────────────────────────┐
│ Sidebar (app-sidebar2.tsx)                                │
│   canSeeSidebarItem("Gestión de Empleados")                │
│   ├─ admin global → true                                  │
│   ├─ planFeatures.empleados === false → false (oculta)    │
│   └─ resto → true (muestra)                               │
│                                                            │
│ ⚠️ Si planFeatures es undefined (tenant sin licencia):    │
│   undefined === false → false → MUESTRA el item           │
└────────────────────────────────────────────────────────────┘
                          ↓ click
┌────────────────────────────────────────────────────────────┐
│ /busy/empleados (Server Component, page.tsx)              │
│   await Promise.all([                                     │
│     getEmpleadosAction()    // ✅ requiere empleados       │
│     getPagoSalariosAction() // ❌ requiere nomina          │
│   ])                                                       │
│   ↓                                                        │
│   render <EmpleadosNominaContent                          │
│     initialEmpleados=... initialPagos=... />              │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ EmpleadosNominaContent (Client Component, ~620 líneas)    │
│   ├─ Lista de empleados (cards)                           │
│   ├─ Botón "Realizar Pago" → createPagoSalarioAction      │
│   ├─ Sección "Historial de Pagos" (Tabs)                  │
│   │   ├─ Historial Detallado                              │
│   │   └─ Resumen por Período                              │
│   └─ AlertDialog de Eliminar                              │
└────────────────────────────────────────────────────────────┘
```

## Arquitectura objetivo (to-be)

```
┌────────────────────────────────────────────────────────────┐
│ Sidebar (sin cambios)                                     │
│   • Gestión de Empleados → visible en Básico ✅            │
│   • Asistencia, Vacaciones, Nómina → ocultas en Básico    │
│     (Siguen ocultas — fix independiente)                   │
└────────────────────────────────────────────────────────────┘
                          ↓ click
┌────────────────────────────────────────────────────────────┐
│ /busy/empleados (Server Component, page.tsx)              │
│   await getEmpleadosAction()                              │
│   render <EmpleadosListContent initialEmpleados=... />    │
│                                                            │
│   ✅ NO llama getPagoSalariosAction                        │
│   ✅ Agnóstico al feature `nomina`                         │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ EmpleadosListContent (Client Component, ~250 líneas)      │
│   ├─ Lista de empleados (cards)                           │
│   ├─ Botón "Editar" → /busy/empleados/update/[id]        │
│   ├─ Botón "Eliminar" → AlertDialog → deleteEmpleado     │
│   ├─ Botón "Nuevo Empleado" → /busy/empleados/new         │
│   └─ Link condicional "Ver historial de pagos →"          │
│      (visible sólo si planFeatures.nomina === true)        │
└────────────────────────────────────────────────────────────┘
                          ↓ (si tiene nomina)
┌────────────────────────────────────────────────────────────┐
│ /busy/empleados/nomina (Server Component, page.tsx)       │
│   if (user.planFeatures.nomina !== true)                  │
│     redirect("/busy/empleados")                            │
│   else                                                     │
│     await Promise.all([getEmpleadosAction,                │
│                       getPagoSalariosAction])              │
│     render <NominaEmpleadoSection ... />                  │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ NominaEmpleadoSection (Client Component, ~350 líneas)     │
│   ├─ Lista de empleados (cards, reusando sub-componente)  │
│   ├─ Botón "Realizar Pago" en cada card                   │
│   ├─ Tabs Historial Detallado / Resumen                   │
│   └─ AlertDialog de Eliminar                              │
└────────────────────────────────────────────────────────────┘
```

## Diseño de datos

### Tabla involucrada: `TenantLicense`

No se cambia el schema. El backfill usa el modelo existente:

```prisma
model TenantLicense {
  tenantLicenseId String   @id @default(cuid())
  tenantId        String
  planId          String?
  activa          Boolean  @default(true)
  inicio          DateTime @default(now())
  expiracion      DateTime
  maxUsuarios     Int
  maxAlmacenes    Int
  maxProductos    Int
  features        Json?     // ← poblado con plan.features
  plan            Plan?    @relation(...)
  tenant          Tenant   @relation(...)
}
```

### Backfill script (`scripts/backfill-empleados-licenses.ts`)

```typescript
import { PrismaClient } from '../src/generated/prisma'
const prisma = new PrismaClient()

async function main() {
  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { precio: 'asc' }
  })
  if (!defaultPlan) {
    throw new Error('No hay planes en la BD. Corré primero el seed.')
  }
  console.log(`📋 Plan default: ${defaultPlan.nombre} ($${defaultPlan.precio})`)

  const tenantsSinLicencia = await prisma.tenant.findMany({
    where: { licencias: { none: { activa: true } } },
    include: { memberships: { where: { isActive: true } } },
  })

  let created = 0
  let skipped = 0

  for (const tenant of tenantsSinLicencia) {
    if (tenant.memberships.length === 0) {
      console.log(`⏭️  ${tenant.nombre} — sin memberships activas, omitido`)
      skipped++
      continue
    }
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
        features: defaultPlan.features as any,
      },
    })
    created++
    console.log(`✅ ${tenant.nombre} — licencia creada (plan ${defaultPlan.nombre})`)
  }

  console.log(`\n🎉 ${created} licencias creadas, ${skipped} omitidas.`)
}

main().finally(() => prisma.$disconnect())
```

### Por qué NO un backfill dentro del código de la app

- El backfill es **operación one-shot**, no lógica de runtime.
- Si lo metemos en `resolveTenantContext`, cada request pagaría el
  costo de un `findFirst` + `create` condicional.
- Un script separado se puede correr, auditar, rollbackear.

## Validación cliente/servidor split

| Capa | Quién valida | Cómo |
|------|--------------|------|
| Sidebar | Cliente (canSeeSidebarItem) | `planFeatures?.[key] === false` |
| Page render | Server (getCurrentUser → planFeatures) | redirect o render |
| Action mutation | Server (requireFeature) | throws ActionError FEATURE_NOT_AVAILABLE |
| Component UI | Cliente (useAuth → user.planFeatures) | conditional render |

## Toast y UX

- **Básico navega a `/busy/empleados/nomina`**: redirect silencioso
  a `/busy/empleados` (no toast, comportamiento existente).
- **Básico hace click en "Realizar Pago" en `/busy/empleados`**: no
  aparece el botón en absoluto (se removió del componente).
- **Empresarial todo funciona igual que antes**: misma UI, mismos
  toasts.

## Compatibilidad hacia atrás

- `EmpleadosNominaContent` se puede mantener 1 release como wrapper
  deprecado que re-exporta `NominaEmpleadoSection` con los props
  legacy. Esto evita romper imports externos.
- Si nadie lo importa fuera de `src/features/empleados`, eliminarlo
  sin más.
- El componente NO se exporta del `index.ts` del feature, así que el
  blast radius es chico.

## Impacto en tests

| Test existente | Cambio |
|----------------|--------|
| `actions.test.ts` (10 tests) | Sin cambios. Pasa. |
| `tenant-scope.test.ts` (16 tests) | Sin cambios. Pasa. |
| `with-action.test.ts` (13 tests) | Sin cambios. Pasa. |
| `get-current-user.test.ts` (6 tests) | Sin cambios. Pasa. |

Tests nuevos:
- `actions.test.ts` → 2 tests adicionales (Básico pasa / Básico falla nomina)
- `page.test.tsx` → 1 test que verifica que el page NO llama a getPagoSalariosAction

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Backfill duplica licencias | Query con `licencias: { none: { activa: true } }` |
| Backfill asigna plan incorrecto | `orderBy: { precio: 'asc' }` siempre cae en Básico (es el más barato) |
| Refactor rompe Profesional | Los tests cubren los flujos; Profesional es superconjunto de Básico |
| Componente nuevo tiene regresión visual | Diff lado a lado con EmpleadosNominaContent antes de mergear |
| Sidebar muestra items que no funcionan | Después del backfill, todos los tenants con empleados:true van a tener `planFeatures.empleados === true`, no undefined. El sidebar sigue funcionando igual. |

## Out of scope (explícito)

- No se cambia `prisma/seed/plans-seed.ts` ni `feature-registry.ts`.
- No se cambia la sidebar (los items Asistencia/Vacaciones/Nómina
  siguen ocultos en Básico).
- No se cambian los precios.
- No se cambia `requireFeature` ni el helper de planes.
- No se hace multi-tenant implícito: la licencia se asigna al plan
  por defecto (Básico), no se pregunta al admin qué plan asignar.
