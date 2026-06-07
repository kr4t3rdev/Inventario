# Spec: Unificación de Stock por Ubicación

> **Status**: Draft
> **Driver**: divergencia entre almacenes, puntos de venta y pantallas de stock
> **Dependencies**: `openspec/config.yaml` strict_tdd=true

---

## 1. Objetivo

El sistema MUST calcular el stock por almacén y punto de venta usando una única fuente de verdad materializada: `StockUbicacion`.

## 2. Reglas funcionales

### 2.1 Fuente de verdad

1. `StockUbicacion` MUST ser la fuente de verdad para stock por ubicación.
2. `producto.stock` MAY mantenerse como agregado de compatibilidad, pero MUST NOT ser la fuente primaria para calcular stock por ubicación.
3. Las lecturas por ubicación MUST usar `cantidadDisponible` cuando la operación dependa de disponibilidad vendible.

### 2.2 Validación de ventas

Scenario: venta en punto de venta con stock suficiente

Given un producto con `cantidadDisponible >= cantidad solicitada` en `StockUbicacion` del PV
When se crea la venta
Then la operación MUST aprobarse
And MUST descontar stock solo de la ubicación afectada

Scenario: venta en punto de venta sin stock suficiente

Given un producto con `cantidadDisponible < cantidad solicitada`
When se crea la venta
Then el sistema MUST rechazar la operación con `STOCK_INSUFICIENTE`
And MUST reportar la disponibilidad real de esa ubicación

### 2.3 Transferencias

Scenario: transferencia completada

Given una transferencia aprobada o en tránsito
When se completa
Then el sistema MUST descontar stock del origen
And MUST sumar stock al destino
And MUST mantener sincronizado `producto.stock` como agregado

Scenario: transferencia editada

Given una transferencia ya aplicada
When se actualiza su cantidad u origen/destino
Then el sistema MUST revertir el movimiento anterior
And MUST aplicar el nuevo movimiento
And MUST no dejar stock huérfano en ninguna ubicación

Scenario: transferencia cancelada

Given una transferencia ya aplicada
When se cancela
Then el sistema MUST revertir el stock en origen y destino
And MUST preservar consistencia con `StockUbicacion`

### 2.4 Cuadre POS

Scenario: cuadre con stock del PV

Given un turno con ventas en un punto de venta
When se consulta el cuadre
Then el sistema MUST leer el stock actual del PV desde `StockUbicacion`
And MUST calcular el restante por producto con la misma base

Scenario: inventario histórico incompleto

Given un producto sin registro materializado en `StockUbicacion`
When se consulta stock por ubicación
Then el sistema MAY reconstruirlo mediante backfill/reconciliación explícita
And MUST NOT mezclar silenciosamente reglas distintas por pantalla

### 2.5 Reservas

1. `cantidad` MUST representar stock físico.
2. `cantidadReservada` MUST representar stock comprometido.
3. `cantidadDisponible` MUST equal `cantidad - cantidadReservada` in a consistent record.
4. Las validaciones operativas MUST usar `cantidadDisponible`.

### 2.6 Cierre de implementación

Scenario: acciones de stock compilan con los campos seleccionados

Given una acción que arma mensajes o validaciones con datos de producto
When usa un campo del producto en tiempo de ejecución
Then el `select` de Prisma MUST incluir ese campo
And la acción MUST compilar sin casts implícitos rotos

Scenario: pantalla de cuadre consume ActionResponse correctamente

Given la página de cuadre de turno
When llama `getCuadreTurnoAction`
Then MUST hacer narrowing explícito de `result.success`
And MUST acceder `result.error` solo en la rama de error

Scenario: animaciones de cuadre tipan correctamente

Given los variants de Framer Motion de la pantalla de cuadre
When se ejecuta `tsc`
Then los objetos de animación MUST ser compatibles con `Variants`

Scenario: restock nueva instancia no deja ruido de tests

Given el flujo `tipoRestock = nueva_instancia`
When corren los tests focalizados
Then el test MUST cubrir dependencias nuevas del flujo
And MUST NOT depender de mocks incompletos para pasar

## 3. Casos límite

1. Si una ubicación no existe, la consulta MUST fallar con error explícito.
2. Si hay discrepancia entre `producto.stock` y la suma de `StockUbicacion`, el sistema SHOULD registrar la inconsistencia para reconciliación.
3. La UI MUST NOT ocultar una inconsistencia calculando con otra fuente diferente.
4. Los errores globales de `tsc` fuera de esta slice MAY permanecer, pero esta change MUST no introducir errores de compilación nuevos en sus archivos afectados.
