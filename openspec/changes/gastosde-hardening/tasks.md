# Tasks: GastosDE Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60-90 (3 archivos, 1 fix de UI pequeño, 1 fix de action, 1 suite de tests ampliada) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | single-pr |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Hardening completo: orden + update + UI + tests | PR 1 | Single PR. Tests incluidos en cada task. |

## Fase 1: Listado — TDD strict

- [ ] 1.1 **RED**: En `src/features/gastosDE/__tests__/actions.test.ts`, escribir test `getGastosDEAction ordena por createdAt desc` que mockea `prisma.gastosDE.findMany` y asserta que el argumento trae `orderBy: { createdAt: 'desc' }`. Correr `pnpm run test:run` y **verificar que falla** (porque el código actual usa `monto: 'desc'`).
- [ ] 1.2 **GREEN**: En `src/features/gastosDE/actions.ts:20`, cambiar `orderBy: { monto: 'desc' }` → `orderBy: { createdAt: 'desc' }`. Correr tests y verificar que el test 1.1 ahora pasa.
- [ ] 1.3 **REFACTOR**: Sin cambios necesarios (una línea). Si el código lo requiere, extraer el `orderBy` a una constante. No over-engineer.

## Fase 2: Update completo — TDD strict

- [ ] 2.1 **RED**: Test `updateGastosDEAction persiste tipo` — mock `findFirst` con existing, `update` con capture, submit con `tipo: 'X'`. Assert que el `data` de la llamada a `update` incluye `tipo: 'X'`. Correr y **verificar que falla**.
- [ ] 2.2 **RED**: Test `updateGastosDEAction persiste conceptoId` — análogo. Verificar que falla.
- [ ] 2.3 **RED**: Test `updateGastosDEAction persiste elementoId` — análogo. Verificar que falla.
- [ ] 2.4 **RED**: Test `updateGastosDEAction persiste periodo` — análogo. Verificar que falla.
- [ ] 2.5 **GREEN**: En `actions.ts:55`, ampliar la whitelist del `data` para incluir `tipo`, `conceptoId`, `elementoId`, `periodo`. Correr los tests 2.1-2.4 y verificar que pasan.
- [ ] 2.6 **REFACTOR**: La construcción del `data` queda como un objeto largo. Si pasa de ~10 líneas, extraer a `buildUpdateData(data)`. Si no, dejar inline.

## Fase 3: Validación concepto↔elemento en update — TDD strict

- [ ] 3.1 **RED**: Test `updateGastosDEAction rechaza concepto+elemento no relacionado` — mock `gastoElemento.findFirst` → null. Submit con `conceptoId` y `elementoId` inválidos. Assert `success === false`, `error.code === 'VALIDATION_ERROR'`, y que `prisma.gastosDE.update` NO se llamó. Verificar que falla.
- [ ] 3.2 **GREEN**: En `actions.ts:49-58`, agregar bloque de validación análogo al de `createGastosDEAction` (líneas 33-36). Correr test 3.1 y verificar que pasa. Verificar que el test de `create` no se rompió.
- [ ] 3.3 **REFACTOR**: Si el bloque de validación es idéntico al de `create`, considerar extraer a helper. Solo si se repite 2+ veces.

## Fase 4: Tenant scope en update y delete — TDD strict

- [ ] 4.1 **RED**: Test `updateGastosDEAction cross-tenant retorna NOT_FOUND` — mock `findFirst` (con where tenantId) → null. Submit con `gastosDEId` ajeno. Assert `success === false`, `error.code === 'NOT_FOUND'`, y que `prisma.gastosDE.update` NO se llamó. Verificar que falla (puede que ya pase si el código actual tiene la validación, pero **hay que verlo fallar primero** o documentar que ya pasa y por qué — si ya pasa, el test es regresión y se marca como "GREEN inicial").
- [ ] 4.2 **RED**: Test `deleteGastosDEAction cross-tenant retorna NOT_FOUND` — análogo. Verificar que falla o documentar.
- [ ] 4.3 **GREEN**: Si 4.1 o 4.2 fallaron, el código actual ya tiene la validación — el test solo documenta el invariante. No hacer cambios en `actions.ts` salvo que el test haya fallado por código faltante.
- [ ] 4.4 **REFACTOR**: Sin cambios.

## Fase 5: Update parcial preserva otros campos — TDD strict

- [ ] 5.1 **RED**: Test `updateGastosDEAction con solo monto no toca otros campos` — submit solo `{ gastosDEId, monto: 2000 }`. Mock `update` con capture. Assert que `data` solo trae `{ monto: 2000 }` (no `proveedor`, no `descripcion`, no `numeroFactura` en undefined). Verificar que falla o documentar si ya pasa.
- [ ] 5.2 **GREEN**: Ajustar la lógica de la whitelist si es necesario. Si el código actual ya excluye campos undefined, no tocar.
- [ ] 5.3 **REFACTOR**: Sin cambios.

## Fase 6: UI del resumen visual — manual pero verificable

- [ ] 6.1 Modificar `src/features/gastosDE/components/GastoDEForm.tsx:175` cambiando la condición a `watchedValues.monto && (watchedValues.tipo || watchedValues.conceptoId || watchedValues.elementoId)`. No requiere test automatizado (UI), pero requiere verificación manual: el form debe renderizar el resumen cuando hay `concepto+elemento` sin `tipo`.
- [ ] 6.2 Eliminar el literal `CCZXXZ` en `GastoDEForm.tsx:115`. Verificar con `grep -n 'CCZXXZ' src/features/gastosDE/components/GastoDEForm.tsx` que retorna 0 matches.

## Fase 7: Verificación final

- [ ] 7.1 Correr `pnpm run test:run src/features/gastosDE/__tests__/actions.test.ts` — **mínimo 10 tests pasan** (los 3 originales + 7-8 nuevos).
- [ ] 7.2 Correr `pnpm run lint` sobre los archivos modificados — sin warnings nuevos.
- [ ] 7.3 Correr `pnpm run typecheck` (o `tsc --noEmit` puntual) — sin errores en los archivos del slice.
- [ ] 7.4 `grep -n 'CCZXXZ' src/features/gastosDE/components/GastoDEForm.tsx` — 0 matches.
- [ ] 7.5 Commit único con mensaje: `fix(gastosDE): persist update fields, fix list order, add coverage, remove CCZXXZ`.
- [ ] 7.6 Push a `codex/upgrade-next-16` y esperar redeploy de Railway. Confirmar que el deploy pasa con el mismo flujo de la sesión anterior.

## Notas de TDD strict

- **Ningún task de Fase 1, 2, 3, 4, 5 se considera completo sin ver el test FALLAR antes de escribir el código de producción**.
- Si un test pasa al primer intento (sin cambios), documentar en el commit por qué se considera un test de regresión / documentación de invariante.
- No se acepta código que no tenga un test correspondiente que haya fallado primero.
- Si una fix "obvia" se descubre mientras se implementa (ej: una validación extra), se agrega como task adicional con su propio RED → GREEN. No se acumula "de paso".
