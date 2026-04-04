# Tasks: Recetas — Acciones UI (Ver, Editar, Confirmar Eliminar)

## Phase 1: Bug Fix Backend

- [x] 1.1 `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` — en el loop de cálculo de `costoUnitario`, multiplicar por `(1 + ing.desperdicio)` para cada ingrediente

## Phase 2: Dialog Ver Receta

- [x] 2.1 `src/app/busy/produccion/page.tsx` — agregar estado `recetaVer: any | null` inicializado en `null`
- [x] 2.2 `page.tsx` — conectar botón Eye con `onClick={() => setRecetaVer(receta)}`
- [x] 2.3 `page.tsx` — agregar `<Dialog>` controlado por `recetaVer !== null`; contenido: nombre, rendimiento, producto asociado, instrucciones, tiempoPrep, tabla de ingredientes (nombre, cantidad, desperdicio %, costo estimado), costo unitario total

## Phase 3: Dialog Editar Receta

- [x] 3.1 `page.tsx` — agregar estados: `recetaEdit: any | null`, `editNombre: string`, `editRendimiento: number`, `editItems: { productoId: string; cantidad: number; desperdicio: number }[]`
- [x] 3.2 `page.tsx` — conectar botón Edit con `onClick` que setea `recetaEdit` y pre-llena los estados del form con los valores actuales de la receta
- [x] 3.3 `page.tsx` — agregar `<Dialog>` controlado por `recetaEdit !== null`; formulario con: Input nombre, Input rendimiento, Select producto asociado, tabla editable de ingredientes (producto, cantidad, desperdicio) con botón Agregar y botón Quitar por fila
- [x] 3.4 `page.tsx` — importar y conectar `useUpdateRecetaProduccionMutation` y `useSetIngredientesRecetaProduccionMutation`
- [x] 3.5 `page.tsx` — handler `handleGuardarEdicion`: validar nombre no vacío → llamar `updateRecetaProduccion` con los metadatos modificados → llamar `setIngredientesRecetaProduccion` con `editItems` → cerrar dialog en éxito

## Phase 4: Confirmación Eliminar

- [x] 4.1 `page.tsx` — agregar estado `recetaEliminar: { recetaId: string; nombre: string } | null` inicializado en `null`
- [x] 4.2 `page.tsx` — cambiar el `onClick` del botón Eliminar de `deleteReceta(receta.recetaId)` a `setRecetaEliminar({ recetaId: receta.recetaId, nombre: receta.nombre })`
- [x] 4.3 `page.tsx` — agregar `<AlertDialog>` controlado por `recetaEliminar !== null`; mensaje con el nombre de la receta; `AlertDialogAction` llama `deleteReceta(recetaEliminar.recetaId)` y limpia estado; `AlertDialogCancel` solo limpia estado

## Phase 5: Tests

- [x] 5.1 `src/lib/__tests__/produccion.test.ts` — test: `costoUnitario con desperdicio en ingredientes` — verificar que ingrediente con `desperdicio=0.10`, `precioCosto=10`, `cantidad=5` produce contribución de `55` (no `50`)
- [x] 5.2 `src/lib/__tests__/produccion.test.ts` — test: `costoUnitario backward compat` — verificar que `desperdicio=0` produce el mismo resultado que sin desperdicio (ya existe en suite, confirmar que sigue pasando)
