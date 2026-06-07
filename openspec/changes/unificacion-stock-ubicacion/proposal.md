# Proposal: Unificación de Stock por Ubicación

## Executive Summary

Unificar el cálculo y la mutación del stock de almacenes y puntos de venta en `StockUbicacion` como **fuente de verdad única** por ubicación, manteniendo `producto.stock` solo como agregado de compatibilidad durante la transición.

## Problem Statement

Hoy el sistema mezcla tres fuentes/reglas:

- `producto.stock` para algunos flujos.
- `StockUbicacion.cantidad` para otros.
- Cálculos dinámicos por transferencias y ventas para pantallas históricas.

Eso produce divergencias entre:

- la tabla de productos,
- el POS,
- el cuadre de turno,
- y los movimientos de stock.

Además, algunas mutaciones actualizan `producto.stock` pero no sincronizan `StockUbicacion`, lo que rompe la consistencia por ubicación.

## Goals

1. Hacer que **todas las lecturas por ubicación** provengan de `StockUbicacion`.
2. Hacer que **todas las mutaciones de stock** pasen por una API unificada.
3. Usar `cantidadDisponible` para validar operaciones vendibles.
4. Mantener compatibilidad con `producto.stock` durante la transición.
5. Eliminar fallbacks silenciosos que mezclen almacén y PV en una misma vista.
6. Cerrar la implementación con tipado/compilación correctos en los archivos tocados por esta unificación.

## Non-Goals

- Eliminar `producto.stock` del schema en esta tanda.
- Introducir triggers de base de datos.
- Cambiar el modelo de reservas más allá de consumir `cantidadReservada` / `cantidadDisponible`.

## Rollback Plan

Si la unificación introduce regresiones:

1. Revertir el uso de la nueva capa de consultas.
2. Revertir las mutaciones al comportamiento previo solo en la capa de aplicación.
3. Ejecutar el script de reconciliación para restaurar `StockUbicacion` desde datos históricos.

## Affected Areas

- `src/lib/services/stock-ubicacion-service.ts`
- `src/lib/services/stock-ubicacion-queries.ts`
- `src/lib/api/productos-ubicacion.ts`
- `src/features/productos/actions-stock.ts`
- `src/features/turnos-pos/actions-cuadre.ts`
- `src/app/busy/sales/cuadre/[turnoId]/page.tsx`
- `src/features/ventas/actions.ts`
- `src/features/transferencias/actions.ts`
- `src/features/mermas/actions.ts`
- `src/features/produccion/actions.ts`
- `src/features/productos/actions-crud.ts`
- `src/features/productos/actions-restock.ts`
- `src/features/productos/__tests__/actions.test.ts`
- `prisma/scripts/seed-stock-ubicacion.ts`
