# Proposal: Pantalla de Cuadre para Cierre de Período

## Intent

Agregar una pantalla de **cuadre contable** como paso intermedio al cerrar un período. En lugar del diálogo de confirmación actual, el usuario ve un dashboard completo con el balance, operaciones, ventas vs reconciliado, y resumen diario del período. Solo después de revisar y confirmar se ejecuta el cierre.

## User Story

> Como administrador contable, al hacer clic en "Cerrar Período" quiero ver una pantalla completa con el cuadre del período — balance de cuentas, todas las operaciones, ventas reconciliadas vs físicas, y un resumen mensual con desglose diario — para poder verificar la integridad antes de confirmar el cierre.

## Scope

### Incluye

1. **Nueva Server Action `obtenerCuadrePeriodoAction`** — Query única que retorna:
   - Balance: saldo por cuenta bancaria al cierre del período
   - Operaciones: todas las transacciones (ventas, servicios, gastos, transferencias, ajustes) dentro del rango
   - Ventas vs Reconciliado: cada venta individual con su estado de reconciliación (reconciliada / pendiente), diferencia por método de pago
   - Resumen diario: agregación por día (total ingresos, egresos, neto, cantidad de operaciones)

2. **Nuevo componente `CuadrePeriodoModal`** — Modal de pantalla completa (full-screen drawer/dialog) con tabs:
   - **Tab Balance**: saldos por cuenta, totales por moneda, variación vs período anterior
   - **Tab Ventas vs Reconciliado**: tabla detallada operación x operación con indicador de estado, totales y diferencia
   - **Tab Operaciones**: listado completo de transacciones del período con filtros por tipo
   - **Tab Resumen Diario**: acordeón por día, cada día expandible para ver operaciones individuales

3. **Botón "Confirmar Cierre"** al pie del modal — ejecuta `cerrarPeriodoAction` existente

4. **Refactor del flujo actual**:
   - `CerrarPeriodoDialog` actual se simplifica: al hacer clic en "Cerrar Período" abre el `CuadrePeriodoModal`
   - El modal carga datos en vivo, muestra el cuadre, y al confirmar desencadena el cierre
   - En caso de error se muestra en el modal sin perder el cuadre

### Excluye

- Modificaciones al modelo de datos (schema) — solo queries
- Cambios en `cerrarPeriodoAction` — se reusa tal cual
- Persistencia del cuadre como reporte (post-cierre) — queda para futura iteración
- Exportación PDF/CSV del cuadre
- Períodos DIARIOS como feature activo

## Data Sources

### Prisma models involucrados (solo lectura):

| Modelo | Uso |
|--------|-----|
| `PeriodoContable` | Período actual, fechas, estado |
| `CuentaBancaria` | Saldos por cuenta |
| `Venta` | Ventas físicas del período |
| `VentaServicios` | Ventas de servicios |
| `ReconciliacionVenta` | Ventas reconciliadas + método de pago |
| `ReconciliacionServicio` | Servicios reconciliados |
| `Gasto` / `ReconciliacionGasto` | Gastos del período |
| `TransferenciaBancaria` | Transferencias entre cuentas |
| `AjusteBancario` | Ajustes |
| `InyeccionCapital` | Inyecciones de capital |
| `PagoDeuda` | Pagos de deuda |
| `Prestamo` / `DesembolsoPrestamo` | Préstamos |

### Modo contable

Usar `PeriodoContable.modoContable` (CAJA/DEVENGO) para determinar el campo de fecha:
- **CAJA**: `fechaReconciliacion` para reconciliaciones, `fechaOperacion` para operaciones
- **DEVENGO**: `createdAt` para todas las tablas

## Flujo de UI

```
[Clic en "Cerrar Período"]
       │
       ▼
[Loading: obtenerCuadrePeriodoAction]
       │
       ▼
[CuadrePeriodoModal - Pantalla Completa]
  ┌──────────────────────────────────┐
  │ ● Balance  ○ Ventas vs Reconc.  │
  │ ○ Operaciones  ○ Resumen Diario │ ← Tabs horizontales
  │──────────────────────────────────│
  │                                  │
  │ [Contenido del tab activo]       │
  │                                  │
  │                                  │
  ├──────────────────────────────────┤
  │ [Cancelar]        [Confirmar Cierre] │ ← Sticky footer
  └──────────────────────────────────┘
       │
       ▼ (si confirma)
[cerrarPeriodoAction] → [Toast éxito + recarga]
       │
       ▼ (si error)
[Error en modal, se queda en cuadre]
```

## Tradeoffs

| Item | Riesgo | Mitigación |
|------|--------|-----------|
| Query pesada con muchos joins | Timeout o lentitud en períodos largos | Usar Promise.all + agregaciones en DB, no en JS. Paginación en tabs de operaciones |
| Datos duplicados si cambian entre preview y cierre | Inconsistencia | El modal carga datos una vez. Si el usuario duda, puede cerrar y volver a abrir |
| Ventas sin reconciliar pueden ser muchas | Scroll infinito para ventas vs reconciliado | Paginación server-side (20 por página) en el tab de ventas |
| Períodos mensuales con muchos días | Acordeón lento | Cargar resumen diario agregado, detalle individual bajo demanda (lazy) |

## Dependencias

- No requiere cambios de schema
- Reusa `PeriodoContable.modoContable` existente
- Reusa `cerrarPeriodoAction` existente
- No afecta otros features

## Criterios de Aceptación

1. Al hacer clic en "Cerrar Período" se abre el modal de cuadre con los 4 tabs
2. El tab Balance muestra saldos correctos vs la BD
3. El tab Ventas muestra cada venta con estado de reconciliación
4. El tab Resumen Diario muestra días expandibles con operaciones
5. Confirmar cierre ejecuta el cierre real y cierra el modal
6. Si el cierre falla, el modal muestra el error y no se cierra
7. Tiempo de carga < 3s para períodos mensuales típicos
