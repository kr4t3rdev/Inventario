# Spec: Pantalla de Cuadre para Cierre de Período

## Contratos de Server Action

### `obtenerCuadrePeriodoAction`

```typescript
// Input
input: {
  periodoId: string;
  pageVentas?: number;   // default 1
  pageOperaciones?: number;  // default 1
  pageSize?: number;     // default 20
  filtroOperacion?: 'todas' | 'venta' | 'servicio' | 'gasto' | 'transferencia' | 'ajuste';
}

// Output
{
  periodo: {
    periodoId: string;
    codigo: string | null;
    tipo: TipoPeriodo;
    estado: EstadoPeriodo;
    modoContable: ModoContable;
    fechaInicio: Date;
    fechaFin: Date;
    abiertoPorId: string | null;
    fechaApertura: Date | null;
  };

  balance: {
    saldosPorCuenta: Array<{
      cuentaId: string;
      nombre: string;
      moneda: string;
      saldoActual: number;
      saldoInicioPeriodo: number;
      variacion: number;
    }>;
    totalesPorMoneda: Array<{
      moneda: string;
      totalIngresos: number;
      totalEgresos: number;
      saldoNeto: number;
    }>;
  };

  ventasVsReconciliado: {
    items: Array<{
      id: string;
      tipo: 'VENTA' | 'SERVICIO';
      folio: string | null;
      fecha: Date;
      monto: number;
      moneda: string;
      metodoPago: string | null;
      estaReconciliado: boolean;
      montoReconciliado: number | null;
      diferencia: number;           // monto - montoReconciliado
      fechaReconciliacion: Date | null;
    }>;
    totales: {
      totalVentas: number;
      totalReconciliado: number;
      diferencia: number;
      cantidadVentas: number;
      cantidadReconciliadas: number;
      cantidadPendientes: number;
    };
    totalPages: number;
    page: number;
  };

  resumenDiario: Array<{
    fecha: string;                 // "2026-01-15"
    totalIngresos: number;
    totalEgresos: number;
    neto: number;
    cantidadOperaciones: number;
    desglose: Array<{
      tipo: string;
      monto: number;
      cantidad: number;
    }>;
  }>;

  operaciones?: {
    // Solo si se solicita el tab específico, o para lazy load
    items: Array<OperacionItem>;
    totalPages: number;
    page: number;
    totalCount: number;
  };
}

interface OperacionItem {
  id: string;
  tipo: 'VENTA' | 'SERVICIO' | 'GASTO' | 'TRANSFERENCIA' | 'AJUSTE' | 'CAPITAL' | 'PAGO_DEUDA' | 'PRESTAMO';
  descripcion: string;
  fecha: Date;
  monto: number;
  moneda: string;
  referencia: string | null;
  cuentaId: string | null;
  cuentaNombre: string | null;
}
```

## Especificaciones Given/When/Then

### S1: Apertura del modal de cuadre

```
Given Un período en estado ABIERTO o REABIERTO
  And el usuario hace clic en "Cerrar Período"
When se ejecuta obtenerCuadrePeriodoAction(periodoId)
Then se retorna el cuadre completo con:
  - datos del período
  - balance calculado con saldos actuales vs inicio del período
  - ventas del período paginadas 20 por página
  - resumen diario agregado por fecha
  - totales de ventas vs reconciliado
  And el modal se muestra en pantalla completa con los 4 tabs
```

### S2: Tab Balance — visualización

```
Given El modal de cuadre está abierto
  And el tab activo es "Balance"
When se renderiza la sección de balance
Then se muestra una tabla o cards con:
  - cada cuenta bancaria con nombre, moneda, saldo actual, saldo inicio período, variación
  - totales agrupados por moneda (ingresos, egresos, neto)
  - indicador visual de variación positiva/negativa (verde/rojo)
  - formato de moneda según cada moneda
```

### S3: Tab Ventas vs Reconciliado — paginación

```
Given El modal de cuadre está abierto
  And el tab activo es "Ventas vs Reconciliado"
When se renderiza la tabla de ventas
Then se muestra:
  - cards de totales arriba (Total Ventas, Total Reconciliado, Diferencia, Pendientes)
  - tabla con cada venta: folio, fecha, monto, método pago, estado (✅/❌), monto reconciliado, diferencia
  - paginación (20 por página)
  - filas con diferencia != 0 resaltadas en amarillo/rojo
  - al cambiar de página se llama obtenerCuadrePeriodoAction con pageVentas=N
```

### S4: Tab Resumen Diario — acordeón

```
Given El modal de cuadre está abierto
  And el tab activo es "Resumen Diario"
When se renderiza el resumen diario
Then se muestra:
  - fila por cada día del período con: fecha, total ingresos, egresos, neto, cantidad de operaciones
  - orden cronológico descendente (más reciente primero)
  - al hacer clic en una fila, se expande para mostrar las operaciones de ese día
  - el detalle expandido lista cada operación con tipo, monto, descripción
  - indicador de días con diferencias (neto != 0) resaltados
```

### S5: Tab Operaciones — filtros

```
Given El modal de cuadre está abierto
  And el tab activo es "Operaciones"
When se renderiza la lista de operaciones
Then se muestra:
  - filtro de tipo de operación (dropdown: todas, venta, servicio, gasto, transferencia, ajuste)
  - tabla paginada con todas las operaciones del período
  - al cambiar el filtro se recargan los datos con el nuevo filtro
  - columnas: fecha, tipo, descripción, monto, moneda, cuenta
```

### S6: Confirmar cierre exitoso

```
Given El modal de cuadre está abierto con datos cargados
  And el usuario hace clic en "Confirmar Cierre"
When se ejecuta cerrarPeriodoAction(periodoId)
Then se muestra estado de carga en el botón
  And si es exitoso:
    - se cierra el modal
    - se muestra toast de éxito "Período cerrado correctamente"
    - se ejecuta onSuccess del padre (recarga listado)
```

### S7: Error al confirmar cierre

```
Given El modal de cuadre está abierto
  And el usuario hace clic en "Confirmar Cierre"
When cerrarPeriodoAction retorna error
Then el modal NO se cierra
  And se muestra mensaje de error dentro del modal (no toast)
  And los datos del cuadre permanecen visibles
  And el botón vuelve a estado "Confirmar Cierre"
  And el usuario puede corregir e intentar de nuevo
```

### S8: Cancelar cierre

```
Given El modal de cuadre está abierto
When el usuario hace clic en "Cancelar" o clic fuera del modal
Then el modal se cierra sin ejecutar el cierre
  And no hay cambios en el estado del período
```

### S9: Modo Contable — campo de fecha

```
Given Un período con modoContable = "CAJA"
When se consultan las operaciones
Then se usa fechaReconciliacion como campo de filtro de fechas

Given Un período con modoContable = "DEVENGO"
When se consultan las operaciones
Then se usa createdAt como campo de filtro de fechas
```

### S10: Lazy loading de detalle diario

```
Given El tab Resumen Diario está visible
  And el usuario expande un día específico
When se solicita el detalle de ese día
Then se carga el detalle bajo demanda (no precargado)
  And se muestra indicador de carga mientras se obtienen los datos
  (alternativa: los datos ya vienen en obtenerCuadrePeriodoAction si el período es pequeño)
```

## Validaciones

| # | Condición | Respuesta esperada |
|---|-----------|-------------------|
| V1 | períodoId no existe o no pertenece al tenant | ActionError NOT_FOUND |
| V2 | período no está en estado ABIERTO/REABIERTO | ActionError con mensaje "El período debe estar abierto para ver el cuadre" |
| V3 | sin datos en el período | Balance en cero, ventas vacío, resumen diario vacío (no error) |
| V4 | page < 1 | Se trata como page=1 |

## Notas Técnicas

- La action principal usa `Promise.all` con queries paralelas para minimizar latencia
- El resumen diario se calcula con agregaciones SQL (`GROUP BY DATE(fechaOperacion)`)
- Las operaciones individuales para el expandible diario se cargan lazy (segunda query) o vienen embebidas si el total de días es < 31
- Las queries de modo caja usan `fechaReconciliacion`; modo devengo usa `createdAt`
