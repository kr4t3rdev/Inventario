# Tasks: Production Canonical Unit Normalization

## Phase 1: Domain Rules & Conversion

- [x] 1.1 Modificar `src/lib/validators/production-units.ts` para distinguir compatibilidad, error bloqueante y normalización requerida.
- [x] 1.2 Modificar `src/lib/utils/unit-converter.ts` con helper origen -> base -> unidad canónica.
- [x] 1.3 Definir en `src/app/models/model.ts` los tipos `UnitNormalization` y `UnitError`.

## Phase 2: Backend Recipe Persistence

- [x] 2.1 Actualizar `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` para cargar la unidad canónica del producto y rechazar categorías incompatibles.
- [x] 2.2 Normalizar cantidad y `unidadSimbolo` antes de `createMany`, persistiendo siempre en unidad canónica.
- [x] 2.3 Reemplazar `unitWarnings` por contrato explícito: éxito con `unitNormalizations`, error 400 con `unitErrors`.
- [x] 2.4 Mantener la transacción atómica: si un ingrediente falla, no se persiste ninguno ni se recalcula costo.

## Phase 3: Frontend Consistency

- [x] 3.1 Extraer en `src/app/busy/produccion/page.tsx` una función compartida de preview para create/edit.
- [x] 3.2 Bloquear crear y editar cuando exista `incompatible_category`, `missing_unit` o `unknown_unit`.
- [x] 3.3 Mostrar feedback informativo cuando un ingrediente compatible será normalizado a la unidad canónica.
- [x] 3.4 Ajustar handlers para consumir `unitNormalizations` y `unitErrors` sin depender de `unitWarnings`.

## Phase 4: Tests First-Class

- [x] 4.1 Actualizar `src/lib/validators/production-units.test.ts` con casos `kg -> g`, `L -> ml`, `null + kg`, `null + unidad`, `kg + L`.
- [x] 4.2 Agregar/actualizar tests de integración para `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` cubriendo normalización y rollback.
- [x] 4.3 Actualizar `src/app/busy/produccion/__tests__/unit-validation-e2e.test.ts` para create/edit con bloqueo consistente y preview de normalización.

## Phase 5: Verification

- [x] 5.1 Verificar que el costo de receta se calcula con cantidades ya normalizadas a la unidad canónica.
- [x] 5.2 Verificar que editar una receta vieja incompatible no guarda cambios parciales.
- [x] 5.3 Revisar contratos RTK Query en `src/lib/redux/services/produccionApi.ts` y eliminar referencias residuales a `unitWarnings`.
