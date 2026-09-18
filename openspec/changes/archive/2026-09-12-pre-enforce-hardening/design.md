# Diseño técnico — Pre-enforce hardening

## Regla de diseño (una sola)

> Las operaciones sobre identidad y membresías que ocurren **antes de que exista un contexto tenant** (onboarding con token propio) o **entre tenants** (cambio de empresa, aprobación por plataforma) son operaciones de **plataforma** y usan `prismaPlatform`. El cliente scoped es para operaciones de negocio dentro de un tenant ya resuelto.

Esto no debilita el aislamiento: el modelo `TenantMembership` sigue siendo `SCOPED` para el código de negocio; solo los cinco puntos del ciclo de vida de la membresía pasan por la vía de plataforma, que es exactamente para lo que existe la allowlist. La allowlist de imports (`AS-03`) se amplía a `src/features/auth/services/auth-service.ts` y se mantiene el test de imports.

## Cambios por punto

### 1–4. Handlers de onboarding (`src/features/auth/api/handlers.ts`)

El archivo importa el scoped client (`import { prisma } from "@/lib/prisma"`). Cambio quirúrgico, no de archivo entero:

- **register**: solo la rama con `referralCode` toca `affiliateProfile` (SCOPED). Sustituir esa consulta por `prismaPlatform.affiliateProfile.findUnique` (y la paralela `salesAgentProfile` por simetría, aunque sea GLOBAL). `user.create` puede quedar en el cliente actual (User es GLOBAL), pero se prefiere consistencia: el bloque entero del registro usa platform para que lecturas futuras dentro de este handler no dependan del recuerdo.
- **onboardingType**: `tenantMembership.count` y el `deleteMany` dentro de la transacción salesAgent pasan a platform. Atención: la transacción es interactiva (`$transaction(async tx => …)`); debe ser `prismaPlatform.$transaction` para que el `tx` sea el de plataforma y todas las operaciones internas compartan la transacción. `moneda.findUnique` es GLOBAL (puede quedar igual o alinearse por consistencia).
- **onboardingTenant**: `tenantMembership.upsert` y `tenantMembership.count` a platform. `notification.create` es GLOBAL — sin cambio funcional.
- **onboardingMe**: `tenantMembership.count` a platform.

Criterio deliberado: **no** envolver estos handlers con un contexto artificial (`runWithTenantContext(tenantIdDelBody, …)`): el tenant del body no está validado contra el usuario todavía (es justo lo que se está estableciendo), y fabricar contexto desde input no validado sería un agujero del ancho de la puerta que estamos cerrando. Platform + validación explícita en código (como ya hacen) es lo correcto.

### 5. `switchTenant` (`src/features/auth/services/auth-service.ts`)

Actual: `prisma.tenantMembership.findUnique({ where: { tenantId_userId } })` — con ALS del tenant origen, el scoped client añade `tenantId: origen` al where y la membresía del destino no aparece.

- Sustituir el lookup por `prismaPlatform.tenantMembership.findUnique` (la membresía es hecho de plataforma; se valida `isActive` igual que hoy).
- `resolveTenantContext(userId, tenantId)` ya usa platform internamente (auth-middleware) — se mantiene como segunda verificación.
- `userSession.deleteMany/create` es GLOBAL — sin cambio.
- Ampliar la allowlist de imports con `src/features/auth/services/auth-service.ts`.

### Residuos

- **`approveAdminMembership`** (`admin-global-queries.ts`): `validRoles` pasa a `["manager", "economico", "dependiente"]`; quien mande `"admin"` recibe el error de rol inválido existente. Mantener `cargoMap` con las 3 entradas (la clave `admin` se elimina). Al existir datos históricos con `tenantRole="admin"`, **no** se migra nada: `normalizeTenantRole` ya los lee como manager.
- **Copy neutro:** "No tenés acceso a esta empresa" → "No tienes acceso a esta empresa"; "Revisá tu correo…" → "Revisa tu correo…"; "Creal al menos un plan primero" → "Crea al menos un plan primero"; "Intentalo de nuevo" → "Inténtalo de nuevo"; y el resto de cadenas con voseo detectadas en los mismos archivos. Revisar también los componentes de onboarding que las muestren (el test existente de copy de landing es la referencia; este change añade cobertura equivalente para auth si el patrón lo permite — como mínimo, pruebas de los handlers que devuelven estos mensajes).

## Estrategia de tests

Convención del proyecto: unitarios con prisma mockeado (contrato vigente) para lógica; **DB real solo en `__integration__`** (`DATABASE_URL_TEST`, `pnpm test:integration`).

- **RED por punto (unitario, modo enforce):** test que fija `process.env.TENANT_ISOLATION_MODE='enforce'`, mockea el cliente y afirma que el handler no toca el scoped client para los modelos afectados (assert sobre el mock: `affiliateProfile` scoped no llamado; `platformClient.tenantMembership.upsert` sí). Nivel de esfuerzo bajo y detecta regresiones de "alguien reintrodujo el import equivocado".
- **Integración (la prueba que importa):** `src/features/auth/__integration__/onboarding-enforce.test.ts` con DB real y `TENANT_ISOLATION_MODE=enforce`:
  1. register CON referralCode válido (aislado: se crea afiliado/gestor de fixture) → 200.
  2. worker: register → verify (token firmado) → type=worker → onboardingTenant → membresía creada inactiva → aprobación (action) → login OK.
  3. company: register → type=company (moneda CUP del catálogo) → aprobación admin → `createTenantForUser` → login → membresía manager resoluble.
  4. switch: usuario con membresías activas en dos tenants de fixture → `switchTenant` hacia el otro tenant → tokens nuevos con el tenant destino; y el caso inverso (sin membresía) → FORBIDDEN.
- **Limpieza:** cada fixture borra sus filas (tenant de prueba incluido) al finalizar; los tests son reejecutables.
- **Shadow:** comprobación de que, ejecutados en modo shadow, estos flujos no emiten violaciones (contador del reporter a cero en el ámbito del test).

## Cómo encaja con el plan de aislamiento

Este change es el **prerequisito operativo de AS-06**. Al archivarlo:
- Se actualiza `openspec/changes/aislamiento-sistemico-tenant/tasks.md`: nueva nota "AS-06 desbloqueado por pre-enforce-hardening (fecha)" y se marca la dependencia cumplida.
- La activación de `enforce` en producción la decide el usuario como gate P-1, con la evidencia de este change + el período shadow.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Pasar a platform "de más" (filtrar tenant en handlers pre-auth) | El cambio se limita a los 5 puntos listados + allowlist; cada query omitida queda validada explícitamente en el mismo handler (como hoy) |
| Transacción salesAgent con dos clientes (scoped+platform) | Se migra la **transacción entera** a platform para no partirla |
| Romper `off` (modo actual) | Las rutas no cambian semántica en `off`/platform es el mismo motor; la suite actual debe seguir verde sin retoques |
| Datos históricos `tenantRole="admin"` | No se migran; `normalizeTenantRole` ya los cubre; solo se cierra la escritura nueva |
