# Ventas - Server Actions Migration Specification

## Purpose

Define el comportamiento de las operaciones de ventas usando Server Actions, incluyendo la creación transaccional compleja y el manejo de facturación.

## Requirements

### Requirement: Listar Ventas (Server Component)

El sistema **DEBE** listar ventas directamente desde el Server Component con filtros y paginación.

#### Scenario: Listado con filtros de fecha

- GIVEN un rango de fechas (desde/hasta)
- WHEN carga `/busy/ventas`
- THEN el page.tsx **DEBE** ser un Server Component
- AND **DEBE** filtrar por fecha en Prisma
- AND **DEBE** incluir totales calculados

#### Scenario: Dashboard con métricas

- GIVEN la página `/busy/dashboard`
- WHEN carga
- THEN **DEBE** mostrar métricas de ventas (total del día, semana, mes)
- AND los datos **DEBEN** calcularse en el servidor

### Requirement: Crear Venta (Server Action)

El sistema **DEBE** proveer `createVentaAction()` que maneje la transacción completa de una venta.

#### Scenario: Venta simple con productos

- GIVEN una lista de líneas de venta (productoId, cantidad, precio)
- Y un cliente seleccionado
- WHEN se ejecuta `createVentaAction({ clienteId, lineas, tipoPagoId })`
- THEN **DEBE** crear la venta en una transacción de Prisma
- AND **DEBE** descontar stock de cada producto
- AND **DEBE** crear el movimiento contable correspondiente
- AND **DEBE** retornar `{ success: true, data: { venta, factura } }`

#### Scenario: Venta con facturación

- GIVEN una venta que requiere factura
- WHEN se crea la venta
- THEN el sistema **DEBE** generar la factura asociada
- AND **DEBE** asignar número de factura secuencial
- AND **DEBE** actualizar la serie de facturación

#### Scenario: Stock insuficiente

- GIVEN una línea de venta con cantidad 10 de un producto que tiene stock 5
- WHEN se intenta crear la venta
- THEN la transacción **DEBE** fallar
- AND **DEBE** retornar error indicando qué producto tiene stock insuficiente
- AND **NO DEBE** descontar stock de otros productos

#### Scenario: Validación de totales

- GIVEN líneas de venta donde la suma no coincide con el total enviado
- WHEN se ejecuta la Server Action
- THEN **DEBE** recalcular el total del lado del servidor
- AND **NO DEBE** confiar en el total enviado por el cliente

### Requirement: Anular Venta (Server Action)

El sistema **DEBE** proveer `anularVentaAction()` para reversar una venta.

#### Scenario: Anulación dentro del período permitido

- GIVEN una venta creada hace menos de 24 horas
- WHEN se ejecuta `anularVentaAction(ventaId)`
- THEN **DEBE** marcar la venta como anulada
- AND **DEBE** restaurar el stock
- AND **DEBE** crear movimiento contable de reversión
- AND **DEBE** anular la factura si existe

#### Scenario: Anulación fuera de período

- GIVEN una venta de hace más de 24 horas
- WHEN se intenta anular
- THEN **DEBE** retornar error "Período de anulación expirado"
- AND **NO DEBE** modificar la venta

### Requirement: Punto de Venta (POS)

El sistema **DEBE** mantener el POS como Client Component por su naturaleza interactiva.

#### Scenario: POS con Server Actions para guardar

- GIVEN el componente POS (`pv-interface.tsx`) con `'use client'`
- WHEN el usuario completa una venta
- THEN el formulario **DEBE** llamar `createVentaAction()`
- AND **DEBE** usar `useOptimistic` para actualizar la UI inmediatamente
- AND **DEBE** manejar errores mostrando toast

## Data Flow

```
page.tsx (Server Component)
  ↓ await prisma.venta.findMany({ where: { fecha: { gte, lte } } })
  ↓ props
VentasTable.tsx (Server Component)
  ↓ onCreate → createVentaAction()
POS.tsx (Client Component)
  ↓ useOptimistic()
  ↓ startTransition(() => createVentaAction(data))
  ↓ Error → toast.error()
  ↓ Success → router.push('/busy/ventas')
```

## Transaction Safety

Las Server Actions de ventas **DEBEN** usar transacciones de Prisma para garantizar:
1. La venta se crea **SI Y SOLO SI** el stock se descuenta
2. La factura se genera **SI Y SOLO SI** la venta se crea
3. Los movimientos contables se crean **SI Y SOLO SI** la venta se crea
4. Si cualquier paso falla, toda la operación **DEBE** rollback

## Performance

- Las queries de listado **DEBEN** usar `take` y `skip` para paginación
- Los totales del dashboard **PUEDEN** calcularse con agregaciones de Prisma
- Las relaciones **DEBEN** cargarse con `include` selectivo, no todas
