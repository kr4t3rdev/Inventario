# Tasks: Producción — Mejoras de Calidad

## Phase 1: Lógica de negocio — desperdicio en costos

- [x] 1.1 Actualizar `IngredienteReceta` en `src/lib/utils/produccion.ts` para incluir campo `desperdicio: number`
- [x] 1.2 Modificar `calcularCostoProduccion()` en `src/lib/utils/produccion.ts`: cantidad efectiva = `ingrediente.cantidad * (1 + ingrediente.desperdicio) * cantidadProducir`
- [x] 1.3 Actualizar `completar/route.ts` (`src/app/api/produccion/ordenes/[id]/completar/route.ts`) para usar `desperdicio` del ingrediente al calcular `costoMateriales`
- [x] 1.4 Actualizar `aprobar/route.ts` (`src/app/api/produccion/ordenes/[id]/aprobar/route.ts`) para usar cantidad con desperdicio al decrementar stock de materiales

## Phase 2: Atomicidad en creación de Vales de Salida

- [x] 2.1 Eliminar el bloque de validación pre-transacción (bucle `productosFaltantes`) en `src/app/api/produccion/vales/route.ts`
- [x] 2.2 Dentro de `prisma.$transaction`, agregar consulta de stock con `select` por cada ítem antes del decremento
- [x] 2.3 Si stock insuficiente detectado dentro de la transacción, lanzar error para forzar rollback automático
- [x] 2.4 Retornar 400 con `{ error: 'Stock insuficiente.', productosFaltantes }` desde el catch de la transacción

## Phase 3: Conceptos de Vales desacoplados de GastosDE

- [x] 3.1 Reemplazar `<Select>` de concepto en `src/app/busy/produccion/page.tsx` (dialog Nuevo Vale) por `<Input>` con `<datalist>` que acepte texto libre con sugerencias
- [x] 3.2 Las sugerencias deben seguir viniendo del endpoint `/api/produccion/conceptos` (no cambia el backend)
- [x] 3.3 El estado `selectedConcepto` pasa de `string` vacío inicial a manejarse como texto libre; quitar validación que impida submit si no matchea la lista

## Phase 4: Diálogos de confirmación en acciones de estado

- [x] 4.1 Agregar estado `confirmacion: { tipo: 'aprobar' | 'completar' | 'cancelar'; ordenId: string; recetaNombre: string; cantidad: number } | null` en `src/app/busy/produccion/page.tsx`
- [x] 4.2 Cambiar botones Aprobar/Completar/Cancelar de la tabla de órdenes para que solo setteen el estado de confirmación (no invocar mutations directamente)
- [x] 4.3 Agregar un único `<AlertDialog>` al final del JSX que usa el estado de confirmación para mostrar el mensaje adecuado según `tipo`
- [x] 4.4 Al confirmar en `AlertDialog`, invocar la mutation correspondiente (`handleAprobarOrden`, `handleCompletarOrden`, `handleCancelarOrden`) y limpiar el estado de confirmación
- [x] 4.5 Al cancelar en `AlertDialog`, solo limpiar el estado de confirmación (no ejecutar ninguna mutation)

## Phase 5: Tests

- [x] 5.1 Actualizar tests en `src/lib/__tests__/produccion.test.ts`: agregar casos para `calcularCostoProduccion` con `desperdicio > 0` y `desperdicio = 0`
- [x] 5.2 Agregar test: ingrediente con `desperdicio = 0.10`, cantidad 10, producir 5 → cantidad efectiva 55, no 50
- [x] 5.3 Agregar test: `calcularCostoProduccion` con `desperdicio = 0` produce el mismo resultado que el comportamiento previo
