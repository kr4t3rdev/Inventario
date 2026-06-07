# Tasks: Unificación de Stock por Ubicación

> **Base**: `proposal.md`, `spec.md`, `design.md`
> **TDD**: strict_tdd=true — escribir tests antes de la implementación
> **Orden**: por dependencia; no mezclar escritura/lectura antes de tener tests

---

## Fase 1 — Test de contratos y regresiones

### 1.1 — Cubrir el comportamiento actual y el esperado

**Archivos**
- `src/lib/services/__tests__/stock-ubicacion-service.test.ts`
- `src/features/ventas/__tests__/actions.test.ts`
- `src/features/transferencias/__tests__/actions.test.ts`
- `src/features/turnos-pos/__tests__/actions-cuadre.test.ts`
- `src/lib/api/productos-ubicacion.test.ts`

**Qué hacer**
- Agregar/ajustar tests para documentar:
  - venta POS valida contra stock de la ubicación correcta,
  - transferencias update/delete corrigen StockUbicacion,
  - cuadre POS usa la misma base por producto,
  - consultas de productos no mezclan PV y almacén,
  - `cantidadDisponible` es la base de validación.

---

## Fase 2 — Capa unificada de stock

### 2.1 — Extender `stock-ubicacion-service`

**Archivo**
- `src/lib/services/stock-ubicacion-service.ts`

**Qué hacer**
- Agregar helpers transaccionales para:
  - incrementar stock,
  - descontar stock,
  - transferir stock,
  - revertir movimiento.
- Mantener `cantidad`, `cantidadReservada` y `cantidadDisponible` sincronizados.

### 2.2 — Crear helper de consulta único

**Archivos**
- `src/lib/services/stock-ubicacion-queries.ts` o consolidación equivalente
- `src/lib/api/productos-ubicacion.ts`
- `src/features/productos/actions-stock.ts`

**Qué hacer**
- Unificar la resolución de stock por ubicación.
- Eliminar fallbacks silenciosos distintos por pantalla.

---

## Fase 3 — Escrituras de negocio

### 3.1 — Ventas

**Archivo**
- `src/features/ventas/actions.ts`

**Qué hacer**
- Validar con `cantidadDisponible`.
- Descontar solo la ubicación correcta.
- Evitar doble descuento de almacén/PV.
- Mantener `producto.stock` como agregado derivado.

### 3.2 — Transferencias

**Archivo**
- `src/features/transferencias/actions.ts`

**Qué hacer**
- Corregir `updateTransferenciaAction` para revertir/aplicar cambios sobre `StockUbicacion`.
- Corregir `deleteTransferenciaAction` para revertir el movimiento completo.
- Mantener `producto.stock` consistente en la misma transacción.

### 3.3 — Merma, producción y restock

**Archivos**
- `src/features/mermas/actions.ts`
- `src/features/produccion/actions.ts`
- `src/features/compras-productos/actions.ts`
- `src/features/productos/actions-crud.ts`

**Qué hacer**
- Reemplazar mutaciones manuales por la capa unificada.
- Asegurar que cada operación actualice origen/destino correcto.

---

## Fase 4 — Lecturas de UI

### 4.1 — Cuadre POS

**Archivo**
- `src/features/turnos-pos/actions-cuadre.ts`

**Qué hacer**
- Quitar el fallback global entre PV y almacén.
- Calcular stock por producto desde una sola base.

### 4.2 — Productos por ubicación

**Archivos**
- `src/lib/api/productos-ubicacion.ts`
- `src/features/productos/components/productos-content.tsx`
- `src/features/transferencias/components/producto-selector.tsx`

**Qué hacer**
- Garantizar que la tabla y los selectores consuman el mismo stock resuelto.
- Eliminar diferencias de cómputo por pantalla.

---

## Fase 5 — Backfill y reconciliación

### 5.1 — Script de reconciliación

**Archivos**
- `prisma/scripts/seed-stock-ubicacion.ts`
- `prisma/scripts/reconcile-stock-ubicacion.ts` o equivalente

**Qué hacer**
- Reconstruir `StockUbicacion` desde el estado histórico.
- Comparar contra `producto.stock`.
- Reportar discrepancias.

### 5.2 — Validación final

**Archivos**
- afectados por los pasos anteriores

**Qué hacer**
- Ejecutar tests focalizados.
- Ejecutar lint/typecheck de los slices tocados.
- Confirmar que lectura y escritura coinciden en almacén y PV.

---

## Fase 6 — Cierre de compilación y tipado

### 6.1 — Fix de tipado en ventas

**Archivo**
- `src/features/ventas/actions.ts`

**Qué hacer**
- Asegurar que el `select` de producto incluya todos los campos usados por mensajes/validaciones (`nombre` incluido).
- Confirmar que la acción compile sin errores de propiedades faltantes.

### 6.2 — Fix de tipado en página de cuadre

**Archivo**
- `src/app/busy/sales/cuadre/[turnoId]/page.tsx`

**Qué hacer**
- Corregir el narrowing de `ActionResponse`.
- Acceder `result.error` solo en la rama `!result.success`.
- Tipar `containerVariants` / `itemVariants` como `Variants` compatibles.

### 6.3 — Limpieza de restock y tests

**Archivos**
- `src/features/productos/actions-restock.ts`
- `src/features/productos/__tests__/actions.test.ts`

**Qué hacer**
- Dejar `@ts-expect-error` correctamente justificados o eliminarlos.
- Completar mocks del flujo `nueva_instancia` para cubrir dependencias reales (`precioProducto.findMany`, enums/constantes y servicios usados).
- Evitar ruido de errores “no bloqueantes” en tests cuando provienen de mocks incompletos.

### 6.4 — Verificación final de la slice

**Qué hacer**
- Ejecutar:
  - `pnpm exec vitest run src/features/productos/__tests__/actions.test.ts src/features/transferencias/__tests__/actions.test.ts src/features/ventas/__tests__/actions.test.ts src/features/turnos-pos/__tests__/actions-cuadre.test.ts src/lib/services/__tests__/stock-ubicacion-service.test.ts`
  - `pnpm exec eslint ...` sobre archivos tocados
  - `pnpm exec tsc --noEmit --pretty false`
- Separar errores globales heredados del repo de los errores atribuibles a esta change.
