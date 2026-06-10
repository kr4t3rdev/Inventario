# Proposal: GastosDE Hardening — update, orden, cobertura y limpieza

## Intent

El slice `gastosDE` tiene **3 bugs funcionales activos** y **cobertura de tests casi nula** sobre los caminos críticos. Los tests existentes (3) solo validan el happy path superficial y no detectan:

1. La lista no cumple la spec (orden por `monto desc` en vez de por fecha desc, rompiendo el contrato documentado en `openspec/specs/contabilidad/gastosDE/spec.md:65`).
2. La edición de un gasto es parcialmente silenciosa: el form manda `tipo`, `conceptoId`, `elementoId`, `periodo`, pero `updateGastosDEAction` solo persiste `proveedor`, `monto`, `descripcion`, `numeroFactura`. El usuario "edita" y los datos no se guardan.
3. La UI del resumen visual (`GastoDEForm.tsx:175`) solo aparece si `tipo` está presente, pero un caso válido del modelo es usar `conceptoId`/`elementoId` sin `tipo`. El resumen desaparece sin justificación de negocio.

Además, hay una literal de basura accidental `CCZXXZ` en `GastoDEForm.tsx:115` y un test superficial que da falsa sensación de seguridad.

## Scope

### In Scope

1. **Fix bug de orden del listado** — `getGastosDEAction` debe ordenar por `createdAt: 'desc'` (o `periodo` + `createdAt`) para cumplir la spec.
2. **Fix bug de update incompleto** — `updateGastosDEAction` debe persistir `tipo`, `conceptoId`, `elementoId`, `periodo` cuando el form los envía. Validar relación `conceptoId` ↔ `elementoId` también en update (mismo invariante que en create).
3. **Fix UI del resumen visual** — `GastoDEForm` debe mostrar el resumen cuando haya `monto` Y (algún identificador visible: `tipo` o `conceptoId` o `elementoId`). La regla actual es una confusión entre capa de presentación y capa de negocio.
4. **Remover basura accidental** — `CCZXXZ` huérfano en `GastoDEForm.tsx:115`.
5. **Cobertura de tests significativa** — Ampliar `src/features/gastosDE/__tests__/actions.test.ts` con:
   - Orden del listado (createdAt desc, no monto desc)
   - Tenant scoping en update y delete (rechazo cross-tenant)
   - Persistencia de TODOS los campos en update (incluyendo periodo, conceptoId, elementoId, tipo)
   - Validación de relación conceptoId ↔ elementoId en update
6. **TDD strict** — Toda implementación va precedida de un test rojo. No se acepta código sin test que primero falló.

### Out of Scope (defer)

- **Schema `monto` Int → Decimal**: El form usa `step="0.01"` pero el modelo es `Int`. La UI hace `.toFixed(2)` lo que enmascara la pérdida. La decisión sobre el tipo correcto y la migración se evalúa en un cambio aparte para no acoplar la deuda funcional con la deuda de modelo.
- **Backfill de datos existentes**: No modificamos registros ya afectados por el bug. Asumimos impacto bajo o nulo (bug reciente o no explotado).
- **Tests de componente o e2e**: Solo unit tests de actions en este cambio. La UI ya está cubierta manualmente.
- **Migración de styled-components / Sidebar cleanup**: No relacionado.
- **Refactor de `CCZXXZ` → mejor patrón de loading**: solo se elimina la basura, no se rediseña el loader.
- **Mejoras de UX del form (mejor feedback, mejor accesibilidad)**: no se tocan labels, copy, ni a11y.

## Approach

1. Crear carpeta de change en `openspec/changes/gastosde-hardening/` con `proposal.md`, `specs/gastosde/spec.md` (delta), `design.md` y `tasks.md`.
2. Implementación TDD strict con el patrón RED → GREEN → REFACTOR por cada comportamiento.
3. Mocks del repositorio Prisma para mantener los tests rápidos y aislados (mismo patrón que el test actual).
4. Aplicación atómica al final (un solo PR).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/gastosDE/actions.ts` | Modified | `getGastosDEAction` cambia `orderBy`. `updateGastosDEAction` persiste todos los campos. |
| `src/features/gastosDE/components/GastoDEForm.tsx` | Modified | Eliminar `CCZXXZ`. Cambiar condición del resumen visual. |
| `src/features/gastosDE/__tests__/actions.test.ts` | Modified | Ampliar cobertura: orden, tenant scoping, update completo, validación concepto↔elemento. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Que el cambio de `orderBy` rompa expectativas de UI (tabla que dependía del orden por monto) | Low | La spec ya pide fecha desc; cualquier consumer que dependa del orden por monto estaba acoplado a un bug. La spec es la fuente de verdad. |
| Que el update de `conceptoId`/`elementoId` deje FKs inválidas en registros viejos | Low | Validamos la relación en runtime con el mismo check que create. |
| Que el cambio del resumen visual haga aparecer el card en más casos de los deseados | Low | La nueva condición es razonable: si hay monto + algo que identificar (tipo/concepto/elemento) → hay resumen. Es estrictamente más inclusivo que la versión rota. |
| Cobertura insuficiente en TDD si alguien agrega "una fix más" sin test | Med | Política explícita en tasks: cada task = RED primero. El task se considera incompleto si no se vió fallar. |
| Regresión en `getGastoDEByIdAction` si cambiamos include | Low | No tocamos esa función. |

## Rollback Plan

```bash
# Si algo rompe en producción, revertir el commit
git revert <commit-sha>
git push origin codex/upgrade-next-16
```

Alternativamente, si el PR aún no se mergeó:
```bash
git reset --hard origin/codex/upgrade-next-16
```

Los cambios son aditivos respecto al estado roto, no destructivos — el rollback devuelve el comportamiento roto conocido (que es preferible a un estado parcial con datos a medio persistir).

## Dependencies

- Ninguna dependencia externa nueva.
- No requiere migración de Prisma.
- No requiere nuevas variables de entorno.

## Success Criteria

- [ ] `pnpm run test:run src/features/gastosDE/__tests__/actions.test.ts` pasa con **mínimo 10 tests** (vs los 3 actuales).
- [ ] El test de orden falla con `orderBy: { monto: 'desc' }` y pasa con `orderBy: { createdAt: 'desc' }` (RED → GREEN documentado).
- [ ] El test de update persiste `tipo`, `conceptoId`, `elementoId`, `periodo` falla con la implementación actual y pasa con la nueva.
- [ ] `grep -n "CCZXXZ" src/features/gastosDE/components/GastoDEForm.tsx` retorna 0 resultados.
- [ ] `pnpm run lint` sin nuevos warnings en los archivos tocados.
- [ ] `pnpm run typecheck` pasa.
- [ ] Cada task de implementación tiene su commit precedido por un test rojo.
