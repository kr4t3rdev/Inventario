# Tasks: Plan Básico — Gestión de Empleados sin módulos separados

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220-360 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Alinear features + UI principal de empleados | Single PR | Incluye tests |

## Phase 1: Reglas del plan Básico

- [x] 1.1 Cambiar `prisma/seed/plans-seed.ts` para dejar `empleados: true` y `nomina/asistencia/vacaciones: false` en `PLAN_BASICO_FEATURES`.
- [x] 1.2 Revisar `scripts/sync-plan-features.ts` y `scripts/sync-plan-features-standalone.ts` para mantener la misma matriz de features del Básico.
- [ ] 1.3 Actualizar `PLANES-SUSCRIPCION.md` o doc equivalente si hoy describe RRHH del Básico de forma distinta al nuevo alcance.

## Phase 2: Gestión de Empleados integrada

- [ ] 2.1 Rehacer `src/app/busy/empleados/page.tsx` para cargar empleados + pagos requeridos por la card principal sin depender de un módulo sidebar de Nómina.
- [ ] 2.2 Extender `src/features/empleados/components/empleados-list-content.tsx` para incluir historial de pagos, tabs de nómina y botón de pago dentro de Gestión de Empleados.
- [ ] 2.3 Reutilizar o absorber lógica de `src/features/empleados/components/nomina-empleado-section.tsx` y `historial-pagos.tsx` dentro del flujo principal de `/busy/empleados`.
- [ ] 2.4 Ajustar `src/features/empleados/components/empleado-card.tsx` para que la card del Básico muestre Editar, Eliminar y Pago según el alcance validado.

## Phase 3: Ocultar módulos separados

- [ ] 3.1 Revisar `src/components/app-sidebar2.tsx` y/o registry de features para que Básico no vea entradas separadas de Nómina, Asistencia ni Vacaciones.
- [ ] 3.2 Mantener `src/app/busy/empleados/nomina/page.tsx`, `asistencia/page.tsx` y `vacaciones/page.tsx` bloqueadas o redirigidas para Básico.
- [ ] 3.3 Verificar que el usuario Básico solo entre por `/busy/empleados` y no reciba UI parcial desde rutas premium.

## Phase 4: Actions y permisos

- [x] 4.1 Revisar `src/features/pago-salario/actions` y guards asociados para permitir el flujo embebido en Gestión de Empleados del Básico sin reabrir el módulo premium completo.
- [ ] 4.2 Validar que crear, editar, eliminar empleado y registrar pago respeten `manager/admin` y sigan bloqueando roles sin permiso.

## Phase 5: Tests y verificación

- [ ] 5.1 Actualizar tests de `src/app/busy/empleados/__tests__/page.test.tsx` para cubrir Básico con card completa dentro de Gestión de Empleados.
- [ ] 5.2 Actualizar tests de `src/app/busy/empleados/nomina/__tests__/page.test.tsx` para confirmar que la subruta separada sigue fuera del Básico.
- [ ] 5.3 Extender `src/features/empleados/__tests__/actions.test.ts` y tests de card para cubrir crear/editar/eliminar/pagar desde el flujo integrado.
- [ ] 5.4 Ejecutar `pnpm exec vitest run --config vitest.api.config.mjs src/app/busy/empleados/ src/features/empleados/` y corregir regresiones antes de aplicar.
