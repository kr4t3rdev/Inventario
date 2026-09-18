# SDD Proposal: Empleados — desbloquear rutas en plan Básico

## Business Problem

El item **"Empleados" → "Gestión de Empleados"** aparece en el sidebar de
usuarios del plan Básico, pero las rutas / acciones devuelven
`FEATURE_NOT_AVAILABLE` cuando el usuario intenta usarlas. El usuario ve la
puerta pero no puede pasar.

Dos causas raíz distintas, una sola sensación ("ruta bloqueada"):

1. **23 de 26 tenants no tienen `TenantLicense` activa** en producción.
   Esos tenants se crearon antes de la migración de licencias. El
   middleware (`resolveTenantContext`) devuelve `planFeatures: undefined`,
   por lo que:
   - El sidebar NO oculta los items (`planFeatures?.[key] === false` da
     `false` cuando es `undefined`).
   - Las acciones SÍ fallan (`planFeatures?.[key] !== true` da `true`
     cuando es `undefined`).
   Resultado: aparece el item en el sidebar pero la acción crashea.

2. **La página principal `/busy/empleados` acopla dos features distintos**:
   el CRUD de empleados (`empleados`) y el historial de pagos
   (`nomina`). El Server Component llama `getPagoSalariosAction` que
   requiere `nomina: true` (sólo Empresarial). En plan Básico, la
   respuesta es `FEATURE_NOT_AVAILABLE` y el bloque "Historial de Pagos"
   queda visualmente roto + el botón "Realizar Pago" falla con toast.

## Current State (verificado contra BD real)

```
📋 PLANES (features en BD)
   Básico ($30)    → empleados:✅ nomina:❌ asistencia:❌ vacaciones:❌
   Profesional ($70) → empleados:✅ nomina:❌ asistencia:❌ vacaciones:❌
   Empresarial ($100) → empleados:✅ nomina:✅ asistencia:✅ vacaciones:✅

📜 LICENCIAS ACTIVAS: 3/26 tenants
   - Found (Básico)
   - Tecnología y Electrodomésticos (Básico)
   - Kr4t3rdev (Básico)

🏢 TENANTS SIN LICENCIA: 23
   Todos con nombre "Tenant EAN13 <numero>"
   Ninguno con memberships activas
   4 tienen 1 producto de prueba, 19 vacíos
   → Datos de testing del feature EAN-13 que nunca se limpiaron
   → planFeatures = undefined para todos sus usuarios
   → sidebar muestra "Empleados" pero las acciones fallan
```

## Target Users

- Dueños de PYME en plan Básico (suscripción de $30/mes) que esperan
  poder gestionar a sus empleados desde el día 1.
- Managers y dependientes del mismo tenant.
- No aplica a planes Profesional / Empresarial (esos ya tienen más
  features).

## Scope: lo que SÍ entra

- **Fix A** — Refactor del Server Component `/busy/empleados/page.tsx`
  para que NO dependa de `nomina`. Sólo llama `getEmpleadosAction`.
- **Fix B** — Mover toda la sección "Historial de Pagos" + botón
  "Realizar Pago" a una subruta dedicada `/busy/empleados/nomina` (que
  ya existe y tiene su propio redirect si falta el feature).
- **Fix C** — Refactor de `EmpleadosNominaContent` para que reciba
  sólo empleados (sin pagos), y creación de un componente cliente
  ligero `NominaEmpleadoSection` para `/busy/empleados/nomina`.
- **Fix D** — Limpiar los 23 tenants basura de testing EAN-13 (no
  licenciarlos — no tienen usuarios reales). Script idempotente
  `cleanup-ean13-test-tenants.ts` con dry-run y función PL/pgSQL
  para borrar filas de las 65 tablas que referencian tenant.
- **Fix E** — Tests que cubren: plan básico carga /busy/empleados sin
  FEATURE_NOT_AVAILABLE, redirect a /busy/empleados para Asistencia /
  Vacaciones / Nómina sigue funcionando.

## Out of Scope: lo que NO entra

- No se cambia la definición de features en `prisma/seed/plans-seed.ts`
  (sigue igual: nomina/asistencia/vacaciones son Empresarial).
- No se cambian los precios ni se agregan features al plan Básico.
- No se tocan las páginas de Asistencia / Vacaciones / Nómina (ya
  tienen redirect correcto al main si falta el feature).
- No se cambia el sidebar (los items Asistencia/Vacaciones/Nómina
  siguen ocultos en Básico — eso es por diseño, no es bug).
- No se modifica `getPagoSalariosAction`, `createPagoSalarioAction` ni
  los handlers de la API: ya hacen `requireFeature('nomina', ...)` y
  ese es el comportamiento correcto.

## Solution Sketch

**Antes** (acoplamiento roto):
```
EmpleadosPage (Server Component)
  ├── getEmpleadosAction()   → requireFeature('empleados')  ✅ en Básico
  └── getPagoSalariosAction() → requireFeature('nomina')    ❌ en Básico
                                                          (roto en UI)

EmpleadosNominaContent (Client Component)
  ├── Lista empleados
  ├── Botón "Realizar Pago" → createPagoSalarioAction ❌
  └── Sección "Historial de Pagos" → siempre renderiza (vacía)
```

**Después** (separación limpia):
```
/busy/empleados (Server Component)
  └── getEmpleadosAction()   → requireFeature('empleados')  ✅ en Básico
  └── EmpleadosListContent (Client)
        ├── Lista empleados
        ├── Botón "Editar" / "Eliminar"
        └── Link "Ver historial de pagos →" (si plan tiene nomina)

/busy/empleados/nomina (Server Component)
  ├── redirect si planFeatures.nomina !== true
  └── NominaEmpleadoSection (Client)
        ├── getPagoSalariosAction()   → requireFeature('nomina')  ✅
        ├── getEmpleadosAction()      → requireFeature('empleados') ✅
        ├── Tabs Historial / Resumen
        └── Botón "Realizar Pago" → createPagoSalarioAction ✅
```

**Backfill de licencias** (idempotente, corre una vez):
```typescript
// scripts/backfill-empleados-licenses.ts
for each tenant WITHOUT active license:
  create TenantLicense with default plan (Básico)
  set features = plan.features
```

## Risk Assessment

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Backfill crea licencias duplicadas | Bajo | Filtro `licencias: { none: { activa: true } }` antes de crear |
| Backfill asigna plan incorrecto | Bajo | Default = plan más barato (`orderBy: { precio: 'asc' }`) |
| Refactor de EmpleadosNominaContent rompe la vista actual | Medio | Tests E2E del flujo "abrir empleados / ver lista" antes y después |
| Mover pagos a subruta rompe links existentes | Bajo | El sidebar ya oculta "Nómina" en Básico, así que no hay links públicos |
| Fix A introduce regresión en Profesional / Empresarial | Bajo | Mismo flujo, sólo cambia la composición de la página |

## Acceptance Criteria

- [ ] Un usuario del plan Básico puede navegar a `/busy/empleados` y
      ver la lista de empleados sin errores en consola ni toasts rojos.
- [ ] Un usuario del plan Básico NO ve la sección "Historial de Pagos"
      ni el botón "Realizar Pago" en `/busy/empleados` (esos viven
      ahora en `/busy/empleados/nomina`, gated por el feature `nomina`).
- [ ] Un usuario del plan Básico que navega manualmente a
      `/busy/empleados/nomina` es redirigido a `/busy/empleados` con
      el redirect existente (sin cambio de comportamiento).
- [ ] Un usuario del plan Empresarial ve la sección de pagos
      integrada (o en la subruta, según el resultado del refactor) y
      puede registrar pagos normalmente.
- [ ] Después de correr el backfill, los 23 tenants sin licencia
      tienen una `TenantLicense` activa con `features` poblado.
- [ ] El sidebar sigue ocultando "Asistencia", "Vacaciones" y
      "Nómina" en plan Básico (no se agrega ni se quita ningún item).
- [ ] Tests Vitest del feature `empleados` siguen pasando + se agregan
      tests para el redirect de `/busy/empleados/nomina` en Básico.
