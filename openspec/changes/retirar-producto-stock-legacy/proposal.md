# Proposal: Retirar `producto.stock` del flujo operativo

## Executive Summary

Cerrar el legado de `producto.stock` sacándolo de las validaciones, mutaciones y lecturas operativas. `StockUbicacion` pasa a ser la única fuente de verdad, y el stock total se obtiene de una consulta agregada o de una proyección explícita derivada de `StockUbicacion`.

## Problem Statement

Hoy `producto.stock` todavía participa en lógica crítica:

- validaciones de venta sin PV,
- transferencias desde/hacia almacén,
- mermas,
- producción,
- compras/restock,
- dashboards y reportes.

Eso mantiene dos modelos vivos a la vez:

1. `StockUbicacion` como stock real por ubicación
2. `producto.stock` como agregado mutable legacy

Mientras ambos sigan siendo operativos, existe riesgo de divergencia, dobles descuentos y reportes inconsistentes.

## Goals

1. Eliminar lecturas operativas de `producto.stock`.
2. Eliminar escrituras manuales de `producto.stock` en acciones de negocio.
3. Introducir una API explícita para stock total derivado desde `StockUbicacion`.
4. Migrar UI/reportes relevantes para dejar de depender del campo legacy.
5. Mantener TDD estricto: test rojo → implementación mínima → refactor.

## Non-Goals

- Eliminar la columna `stock` del schema Prisma en esta primera slice.
- Reescribir todos los reportes históricos del sistema.
- Cambiar reservas más allá de respetar `cantidadDisponible`.

## Scope

### En alcance
- `src/lib/services/stock-ubicacion-service.ts`
- `src/lib/services/stock-ubicacion-queries.ts`
- `src/features/ventas/actions.ts`
- `src/features/transferencias/actions.ts`
- `src/features/mermas/actions.ts`
- `src/features/produccion/actions.ts`
- `src/features/compras-productos/actions.ts`
- `src/lib/api/productos-ubicacion.ts`
- `src/features/productos/actions-stock.ts`
- `src/features/dashboard/api/stats.ts`
- tests asociados

### Fuera de alcance por ahora
- todos los componentes UI legacy que muestran `producto.stock` pero no deciden negocio,
- eliminación física de la columna `Producto.stock`,
- refactor completo de seeds viejos no usados en runtime.

## Rollout Strategy

1. Introducir helper de stock total derivado.
2. Migrar primero mutaciones de negocio.
3. Migrar después lecturas agregadas/reportes.
4. Dejar `producto.stock` como campo read-only temporal.
5. Evaluar eliminación de columna en una change posterior.
