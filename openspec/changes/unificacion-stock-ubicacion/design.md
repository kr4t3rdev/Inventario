# Design: Unificación de Stock por Ubicación

## 1. Enfoque

La solución usa una capa de servicio única para mutaciones y una capa de consulta única para lecturas.

### Principio rector

**Una ubicación = un registro materializado de stock = una única lectura.**

No se permitirá que cada pantalla rederive stock con fórmulas propias.

## 2. Arquitectura propuesta

### 2.1 Capa de mutación

Extender `src/lib/services/stock-ubicacion-service.ts` para que funcione como el núcleo de escritura:

- `incrementarStock(...)`
- `descontarStock(...)`
- `transferirStock(...)`
- `revertirMovimiento(...)`

Cada función MUST operar dentro de la misma transacción Prisma que la entidad de negocio que la dispara.

### 2.2 Capa de consulta

Crear o consolidar una API de consulta única para:

- stock disponible por ubicación,
- productos con stock por ubicación,
- resumen del cuadre POS.

La lectura MUST:

- priorizar `StockUbicacion`,
- usar `cantidadDisponible` cuando corresponda,
- y no mezclar fallback de PV y almacén dentro del mismo resultado.

### 2.3 Compatibilidad

`producto.stock` seguirá existiendo durante la transición para:

- pantallas legacy,
- reportes no migrados,
- y comprobaciones de integridad.

Pero la escritura deberá venir desde la capa unificada y no desde lógica duplicada.

## 3. Flujo de datos

### 3.1 Venta

1. `createVentaAction` valida disponibilidad contra `StockUbicacion`.
2. La venta se guarda.
3. Se descuenta stock de la ubicación correcta.
4. Se recalcula el agregado `producto.stock` dentro de la misma transacción.

### 3.2 Transferencia

1. La transferencia se confirma.
2. Se mueve stock del origen al destino.
3. Se corrige el agregado global.
4. Las cancelaciones y ediciones aplican el movimiento inverso antes de reescribir.

### 3.3 Cuadre POS

1. `getCuadreTurnoAction` lee ventas del turno.
2. Lee stock de ubicación desde `StockUbicacion`.
3. Calcula stock inicial/restante desde la misma base por producto.
4. No usa inferencia global por tipo de ubicación.

## 4. Migración de datos

### 4.1 Backfill

Reutilizar `prisma/scripts/seed-stock-ubicacion.ts` o reemplazarlo por un script de reconciliación que:

1. reconstruya el estado por ubicación,
2. compare `producto.stock` vs suma materializada,
3. reporte diferencias,
4. y deje los datos listos para consumo uniforme.

### 4.2 Reconciliación

Agregar una tarea de reconciliación que pueda ejecutarse manualmente después del despliegue para corregir registros históricos que quedaron fuera de sync.

## 5. Validación

### Server-side

- Zod para validar inputs.
- `ActionError` para stock insuficiente, ubicación inválida y inconsistencia detectada.

### Client-side

- La UI solo presenta el stock ya resuelto por la acción/consulta.
- No reimplementa fórmulas de stock.

## 6. Riesgos y mitigación

1. **Riesgo**: `producto.stock` y `StockUbicacion` quedan transitoriamente distintos.  
   **Mitigación**: backfill + reconciliación + tests de consistencia.

2. **Riesgo**: pérdida de stock al editar/cancelar transferencias.  
   **Mitigación**: movimientos inversos explícitos y tests de regresión.

3. **Riesgo**: divergencias entre pantallas legacy y nuevas.  
   **Mitigación**: cortar lecturas directas donde sea posible y dejar un solo helper de consulta.

4. **Riesgo**: la lógica queda verde en Vitest pero roja en TypeScript.  
   **Mitigación**: cierre explícito de compile slice en:
   - `src/features/ventas/actions.ts` (selects completos),
   - `src/app/busy/sales/cuadre/[turnoId]/page.tsx` (narrowing + `Variants`),
   - `src/features/productos/actions-restock.ts` y tests asociados (mocks/tipado residuales).

## 7. Cierre técnico de la slice

La implementación final de esta change se cierra en dos capas:

1. **Behavior green**  
   - ventas,
   - transferencias,
   - cuadre POS,
   - productos/restock relevantes.

2. **Compile green en la slice tocada**  
   - evitar selects incompletos,
   - hacer narrowing correcto de `ActionResponse`,
   - tipar explícitamente `Variants`,
   - limpiar mocks y residuos de `restock`.
