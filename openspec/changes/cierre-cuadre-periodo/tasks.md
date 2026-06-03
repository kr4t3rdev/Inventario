# Tasks: Pantalla de Cuadre para Cierre de Período

## Overview

**Total estimado**: ~650 líneas nuevas / ~50 modificadas
**Archivos**: 6 nuevos, 1 modificado
**Dependencias**: Ninguna externa, solo lectura de datos existentes

---

## Task 1: Helpers de Query (cuadre-queries.ts) ⚡

**Archivo**: `src/features/contabilidad/cuadre-queries.ts` (CREAR, ~180 líneas)

**Dependencias**: Ninguna

**Contenido**:
- `obtenerBalanceConVariacion()` — saldos actuales vs inicio del período
  - Para `saldoInicioPeriodo`: sumar operaciones hasta fechaInicio - 1 día, o usar snapshot del período anterior
  - Agrupar por moneda para totales
- `obtenerVentasVsReconciliado()` — LEFT JOIN Venta + ReconciliacionVenta paginado
  - Incluir VentaServicios + ReconciliacionServicio
  - Calcular `estaReconciliado`, `montoReconciliado`, `diferencia`
  - Retornar `totalPages`, `page`, `items`, `totales`
- `obtenerResumenDiario()` — GROUP BY DATE con agregaciones
  - Sumar ingresos y egresos por día
  - Desglose por tipo de operación
  - Si días > 31, omitir desglose para lazy loading
- `obtenerOperacionesPeriodo()` — UNION de transacciones con filtro y paginación
  - Mapear tablas: Venta, VentaServicios, Gasto, TransferenciaBancaria, AjusteBancario, etc.
  - Aceptar filtro por tipo

**Criterio de aceptación**: Cada función retorna datos correctos con datos mock de Prisma

---

## Task 2: Server Action (obtenerCuadrePeriodoAction) ⚡

**Archivo**: `src/features/contabilidad/actions-periodos.ts` (~40 líneas nuevas)

**Dependencias**: Task 1

**Contenido**:
- Agregar schema Zod `obtenerCuadreSchema`
- Agregar `export const obtenerCuadrePeriodoAction = withAction(...)`
- Validar período existe, está ABIERTO/REABIERTO, pertenece al tenant
- `Promise.all` con los 4 helpers de Task 1
- Retornar objeto completo con periodo, balance, ventas, resumen diario, operaciones

**Criterio de aceptación**: Action retorna datos correctos <!-- especificados en spec.md -->

---

## Task 3: Componente BalanceTab ⚡

**Archivo**: `src/features/contabilidad/components/periodos/balance-tab.tsx` (CREAR, ~60 líneas)

**Dependencias**: Task 2 (tipo de dato)

**Contenido**:
- Cards de saldo por cuenta bancaria
- Totales por moneda
- Indicador de variación positiva/negativa

---

## Task 4: Componente VentasVsReconciliadoTab ⚡⚡ (más complejo)

**Archivo**: `src/features/contabilidad/components/periodos/ventas-vs-reconciliado-tab.tsx` (CREAR, ~120 líneas)

**Dependencias**: Task 2

**Contenido**:
- Cards de totales (Total Ventas, Reconciliado, Diferencia, Pendientes)
- Tabla con paginación (llama a obtenerCuadrePeriodoAction con pageVentas)
- Estado de reconciliación con ícono ✅/❌
- Filas con diferencia resaltadas

---

## Task 5: Componente OperacionesTab ⚡

**Archivo**: `src/features/contabilidad/components/periodos/operaciones-tab.tsx` (CREAR, ~80 líneas)

**Dependencias**: Task 2

**Contenido**:
- Dropdown filtro por tipo
- Tabla paginada
- Badge de tipo color-coded

---

## Task 6: Componente ResumenDiarioTab ⚡⚡ (acordeón)

**Archivo**: `src/features/contabilidad/components/periodos/resumen-diario-tab.tsx` (CREAR, ~100 líneas)

**Dependencias**: Task 2

**Contenido**:
- Acordeón con fila por día
- Al expandir: detalle de operaciones de ese día
- Lazy loading si días > 31
- Colores semánticos

---

## Task 7: Modal CuadrePeriodoModal + refactor CerrarPeriodoDialog ⚡⚡

**Archivos**:
- `src/features/contabilidad/components/periodos/cuadre-periodo-modal.tsx` (CREAR, ~150 líneas)
- `src/features/contabilidad/components/periodos/cerrar-periodo-dialog.tsx` (MODIFICAR, ~30 líneas)

**Dependencias**: Tasks 3-6

**Contenido**:
- `CuadrePeriodoModal`:
  - Dialog full-screen (max-w-5xl h-[90vh])
  - State: data, activeTab, isLoading, error, isSubmitting
  - Tabs horizontales (Balance, Ventas, Operaciones, Diario)
  - Footer con Cancelar + Confirmar Cierre
  - Manejo de error en modal (no se cierra)
- `CerrarPeriodoDialog`:
  - Simplificar: reemplazar contenido actual con apertura del modal
  - Mantener props interface igual

**Criterio de aceptación**: Flujo completo funcional: clic → modal → revisar tabs → confirmar → cerrar

---

## Orden de Implementación

```
Task 1 (queries) ─→ Task 2 (action) ─→ Task 3 (balance)
                                    ├→ Task 4 (ventas)
                                    ├→ Task 5 (operaciones)
                                    └→ Task 6 (diario)
                                           │
                                           ▼
                                      Task 7 (modal + refactor)
```

Tasks 3-6 pueden implementarse en paralelo después de Task 2.
Task 7 requiere Tasks 3-6.

## Review Protection

Si el diff total excede 400 líneas, considerar dividir:
- PR 1: Tasks 1+2 (queries + action)
- PR 2: Tasks 3+4+5+6 (componentes de tabs)
- PR 3: Task 7 (modal + integración)
