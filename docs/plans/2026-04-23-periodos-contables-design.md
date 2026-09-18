# Diseño técnico — períodos contables mixtos

## Objetivo

Agregar soporte de apertura y cierre:

- diario operativo (caja / tesorería)
- mensual contable (devengo)
- anual fiscal-contable

sin romper el modelo actual de ventas, reconciliaciones y cierres legacy.

## Decisión central

El sistema adopta un enfoque **mixto**:

- **Caja** para cuadre diario, tesorería y conciliaciones efectivas.
- **Devengo** para resultados mensuales/anuales y posición contable.

## Nuevas entidades

### `PeriodoContable`

Representa el período gobernado por el sistema. Jerarquía:

- diario → mensual
- mensual → anual

Estados:

- `BORRADOR`
- `ABIERTO`
- `EN_CIERRE`
- `CERRADO`
- `APROBADO`
- `REABIERTO`

### `AperturaPeriodo`

Guarda saldos iniciales del período:

- caja
- bancos
- cuentas por cobrar
- cuentas por pagar
- inventario
- capital
- resultados acumulados

### `SnapshotPeriodo`

Persistencia inmutable del cierre por versión:

- base caja
- base devengo
- inconsistencias
- resumen

### `AuditoriaPeriodo`

Trail de acciones del período:

- crear
- abrir
- cerrar
- aprobar
- reabrir
- bloquear operación

## Reglas base

1. Solo `ABIERTO` y `REABIERTO` aceptan nuevas operaciones.
2. Un mensual no puede cerrarse si tiene diarios sin cerrar/aprobar.
3. Un anual no puede cerrarse si tiene meses sin cerrar/aprobar.
4. Cierre aprobado = snapshot inmutable; corrección posterior implica reapertura auditada o ajuste compensatorio.

## Primera iteración

1. Agregar schema de períodos.
2. Introducir servicio base de períodos con reglas puras.
3. En una fase posterior, conectar validaciones en:
   - ventas
   - reconciliaciones
   - gastos
   - compras

## Avance de implementación

- ✅ Servicio base de períodos (`periodo-contable-service`)
- ✅ Guard operativo para bloquear ventas y conciliaciones en períodos no operables
- ✅ Servicio base de apertura (`apertura-periodo-service`) con arrastre desde snapshot previo o saldos vivos

## Siguiente integración recomendada

1. Persistir aperturas diarias reales usando `PeriodoContable` + `AperturaPeriodo`.
2. Crear precierre diario sobre `/api/cuadre-diario`.
3. Propagar el guard a compras, transferencias y gastos operativos directos.
   - transferencias

## Tradeoff

No se incorpora todavía un subledger completo (`EventoContable`). Eso queda para una iteración posterior para evitar meter demasiada complejidad de una sola vez.
