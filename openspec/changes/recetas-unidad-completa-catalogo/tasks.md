# Tasks: recetas-unidad-completa-catalogo

> Spec: `openspec/changes/recetas-unidad-completa-catalogo/specs/produccion/spec.md`

## Phase 1 — Regla de clasificación de unidades

- [ ] **1.1** Separar en `src/lib/validators/production-units.ts` la clasificación de unidad ingresada por el usuario y la clasificación de unidad canónica del producto en catálogo.
- [ ] **1.2** Implementar la regla de catálogo: toda unidad no convertible soportada debe tratarse como `unit` para el producto de inventario, salvo las unidades explícitamente convertibles de masa y volumen.
- [ ] **1.3** Mantener la validación estricta para la unidad ingresada por el usuario, de forma que una unidad no soportada en la receta siga produciendo `unknown_unit`.

Validación del bloque:

- [ ] Ejecutar pruebas unitarias focalizadas del validador para confirmar la nueva clasificación.

## Phase 2 — Normalización y errores de backend

- [ ] **2.1** Ajustar `validateAndNormalizeIngredientUnit` para que un producto de catálogo tratado como `unit` permita `unidadSimbolo = null` como consumo de unidad completa.
- [ ] **2.2** Confirmar que la API de `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` preserve `missing_unit` solo para productos realmente medibles (`mass` o `volume`).
- [ ] **2.3** Verificar que el cálculo de costo y el almacenamiento de ingredientes mantengan comportamiento 1:1 cuando el producto se consume por unidad completa.

Validación del bloque:

- [ ] Ejecutar tests focalizados del flujo API/normalización de ingredientes.

## Phase 3 — Preview y bloqueo del formulario de recetas

- [ ] **3.1** Ajustar `buildRecipeUnitPreview` en `src/app/busy/produccion/page.tsx` para que ingredientes de catálogo tratados como `unit` no generen bloqueo por unidad desconocida.
- [ ] **3.2** Revisar mensajes de preview y de error para que distingan entre “unidad del catálogo interpretada como unidad completa” y “unidad ingresada no reconocida”.
- [ ] **3.3** Verificar que el botón de crear/guardar receta solo se bloquee por incompatibilidades reales, no por unidades de catálogo no convertibles.

Validación del bloque:

- [ ] Ejecutar tests focalizados de `unit-validation-e2e.test.ts` y cualquier suite relacionada con creación/edición de recetas.

## Phase 4 — Cobertura de tests

- [ ] **4.1** Agregar casos en `src/lib/validators/production-units.test.ts` para productos de catálogo con unidades como `paquete`, `caja`, `frasco` o equivalentes tratados como `unit`.
- [ ] **4.2** Agregar casos para asegurar que una unidad ingresada no soportada por el usuario sigue devolviendo `unknown_unit`.
- [ ] **4.3** Agregar o ajustar tests del módulo de producción para reflejar que la mayoría de los ingredientes pueden consumirse como unidad completa y que el rendimiento de la receta es quien expresa cuánto produce esa unidad utilizada.

Validación del bloque:

- [ ] Ejecutar `pnpm test:run` focalizado sobre los archivos de test tocados.

## Phase 5 — Cierre técnico

- [ ] **5.1** Ejecutar `pnpm typecheck` y corregir cualquier error atribuible al cambio.
- [ ] **5.2** Verificar manualmente o con prueba focalizada que los productos con unidad convertible siguen requiriendo unidad explícita y que los productos de unidad completa ya no quedan imposibles de guardar.
- [ ] **5.3** Confirmar que el comportamiento legacy de masa/volumen y las normalizaciones existentes no regresionan.