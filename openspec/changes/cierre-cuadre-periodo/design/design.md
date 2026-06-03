# Design: Pantalla de Cuadre para Cierre de Período

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  CerrarPeriodoDialog (simplificado)             │
│  Al hacer clic "Cerrar Período":                │
│    → setShowCuadre(true)                        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  CuadrePeriodoModal                              │
│  ┌───────────────────────────────────────────┐  │
│  │ Header: "Cuadre - {codigoPeriodo}"        │  │
│  │ Tabs: Balance | Ventas | Operac. | Diario │  │
│  ├───────────────────────────────────────────┤  │
│  │  [Tab content]                            │  │
│  ├───────────────────────────────────────────┤  │
│  │ Footer: [Cancelar] [Confirmar Cierre]     │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ Confirmar → cerrarPeriodoAction
                   ▼
          Toast éxito + onSuccess()
```

## Árbol de Componentes

```
periodos-page-client.tsx
├── PeriodosDashboard
├── PeriodosTable
├── AbrirPeriodoDialog
├── CerrarPeriodoDialog (refactor)
│   └── CuadrePeriodoModal (NUEVO)
│       ├── CuadreTabs
│       │   ├── BalanceTab
│       │   │   └── SaldoCuentaCard[]
│       │   ├── VentasVsReconciliadoTab
│       │   │   ├── TotalesCards
│       │   │   └── VentasTable (paginada)
│       │   ├── OperacionesTab
│       │   │   ├── FiltroTipoOperacion
│       │   │   └── OperacionesTable (paginada)
│       │   └── ResumenDiarioTab
│       │       └── DiaAcordeon[]
│       │           └── OperacionesDelDia (lazy)
│       └── CuadreFooter (Cancelar + Confirmar)
├── ReabrirPeriodoDialog
└── PeriodoTimeline
```

## Data Flow

### Carga inicial (useEffect en CuadrePeriodoModal)

```
1. useEffect → setIsLoading(true)
2. const result = await obtenerCuadrePeriodoAction({ periodoId, pageVentas: 1 })
3. setData(result.data)
4. setIsLoading(false)
```

El result.data incluye TODO lo necesario para los 4 tabs + resumen diario completo.
Solo las páginas subsiguientes de ventas/operaciones hacen llamadas adicionales.

### Paginación de ventas

```
Al cambiar página en VentasTable:
  const result = await obtenerCuadrePeriodoAction({
    periodoId,
    pageVentas: nuevaPagina,
    pageSize: 20
  })
  setData(prev => ({
    ...prev,
    ventasVsReconciliado: result.data.ventasVsReconciliado
  }))
```

### Lazy loading de detalle diario

```
Al expandir un día en ResumenDiarioTab:
  Si el detalle ya vino en la carga inicial (días < 31):
    → mostrar directamente desde el state
  Sino:
    → obtenerOperacionesDiaAction({ periodoId, fecha })
    → mostrar indicador de carga
```

### Confirmar cierre

```
handleConfirmar:
  1. setIsSubmitting(true)
  2. const result = await cerrarPeriodoAction({ periodoId })
  3. if (result.success):
       toast.success("Período cerrado correctamente")
       onSuccess()
       onClose()
  4. else:
       setError(result.error.message)
  5. setIsSubmitting(false)
```

## Server Actions

### Nueva: `obtenerCuadrePeriodoAction`

**Archivo**: `src/features/contabilidad/actions-periodos.ts`

**Input Zod**:
```typescript
const obtenerCuadreSchema = z.object({
  periodoId: z.string().min(1),
  pageVentas: z.number().int().positive().default(1),
  pageOperaciones: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
  filtroOperacion: z.enum(['todas','venta','servicio','gasto','transferencia','ajuste']).default('todas'),
});
```

**Implementation sketch**:
```typescript
export const obtenerCuadrePeriodoAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user);
  const parsed = obtenerCuadreSchema.parse(input);

  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });
  if (!periodo) throw new ActionError("Período no encontrado", "NOT_FOUND");
  if (periodo.estado !== 'ABIERTO' && periodo.estado !== 'REABIERTO')
    throw new ActionError("El período debe estar abierto para ver el cuadre", "INVALID_STATE");

  const modoContable = periodo.modoContable ?? 'CAJA';
  const rango = { gte: periodo.fechaInicio, lte: periodo.fechaFin };

  // Promise.all con todas las queries
  const [balance, ventasData, resumenDiario, operaciones] = await Promise.all([
    this.obtenerBalanceConVariacion(tenantId, rango, modoContable),
    this.obtenerVentasVsReconciliado(tenantId, rango, modoContable, parsed.pageVentas, parsed.pageSize),
    this.obtenerResumenDiario(tenantId, rango, modoContable),
    this.obtenerOperacionesPeriodo(tenantId, rango, modoContable, parsed.pageOperaciones, parsed.pageSize, parsed.filtroOperacion),
  ]);

  return {
    periodo: mapPeriodo(periodo),
    balance,
    ventasVsReconciliado: ventasData,
    resumenDiario,
    operaciones,
  };
});
```

### Auxiliares (métodos privados)

Los siguientes helpers pueden ir como funciones separadas en `actions-periodos.ts` o en un nuevo archivo `src/features/contabilidad/cuadre-queries.ts`:

```typescript
// 1. Balance con variación vs inicio del período
async function obtenerBalanceConVariacion(
  tenantId: string,
  rango: { gte: Date; lte: Date },
  modoContable: string,
): Promise<BalanceData>

// Cómo: saldoActual de CuentaBancaria (campo saldo).
// saldoInicioPeriodo: calcular con snapshot previo o sumando operaciones hasta fechaInicio - 1 día.
// variación = saldoActual - saldoInicioPeriodo.

// 2. Ventas vs Reconciliado paginado
async function obtenerVentasVsReconciliado(
  tenantId: string,
  rango: { gte: Date; lte: Date },
  modoContable: string,
  page: number,
  pageSize: number,
): Promise<VentasVsReconciliadoData>

// Cómo: LEFT JOIN Venta con ReconciliacionVenta por ventaId.
// Si está reconciliada: estaReconciliado=true, montoReconciliado=montoConvertido, diferencia=monto-montoReconciliado.
// Si no: estaReconciliado=false, montoReconciliado=null, diferencia=monto.
// Incluir VentaServicios con ReconciliacionServicio similar.
// Paginación: skip = (page-1) * pageSize, take = pageSize.
// Total count para totalPages.

// 3. Resumen diario (agregado por fecha)
async function obtenerResumenDiario(
  tenantId: string,
  rango: { gte: Date; lte: Date },
  modoContable: string,
): Promise<ResumenDiarioItem[]>

// Cómo: GROUP BY DATE(fechaOperacion).
// Suma ingresos (ventas + servicios) y egresos (gastos) por día.
// Si días > 31, el detalle (desglose[]) se omite y se carga lazy.

// 4. Operaciones del período paginadas
async function obtenerOperacionesPeriodo(
  tenantId: string,
  rango: { gte: Date; lte: Date },
  modoContable: string,
  page: number,
  pageSize: number,
  filtro: string,
): Promise<OperacionesData>

// Cómo: UNION de todas las tablas de transacciones filtradas por fecha y tenant.
// El filtro excluye tipos no seleccionados.
```

### Ubicación de helpers

Opción recomendada: funciones auxiliares en `src/features/contabilidad/cuadre-queries.ts` para mantener `actions-periodos.ts` manejable.

## Componentes Detalle

### CuadrePeriodoModal

```tsx
interface CuadrePeriodoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  periodoId: string;
}
```

- Full-screen dialog (DialogContent con `className="max-w-5xl h-[90vh]"`)
- Estado interno: `data`, `activeTab`, `isLoading`, `error`, `isSubmitting`
- Al abrir: fetch inicial con page=1
- Mantiene scroll position al cambiar tabs

### BalanceTab

- Lista de `SaldoCuentaCard` (una por cuenta)
- Cards con: icono de banco, nombre, moneda badge, saldo actual (grande), variación con color
- Totals row: suma por moneda

### VentasVsReconciliadoTab

- TotalesCards arriba: 4 cards horizontales
  - Total Ventas (monto)
  - Total Reconciliado (monto)
  - Diferencia (monto, rojo si > 0)
  - Pendientes (cantidad)
- Tabla debajo con columnas: Folio, Fecha, Monto, Método Pago, Estado (ícono), Monto Reconc., Diferencia
- Paginación debajo
- Filas con diferencia !== 0 con bg-amber-50

### OperacionesTab

- Dropdown de filtro arriba a la izquierda
- Tabla: Fecha, Tipo (badge color-coded), Descripción, Monto, Moneda, Cuenta
- Paginación

### ResumenDiarioTab

- Tabla sin paginación (cabe en una pantalla para períodos <= 31 días)
- Columnas: Fecha, Ingresos (verde), Egresos (rojo), Neto, Operaciones (#)
- Cada fila expandible: al hacer clic, animación de acordeón
- Expandido: tabla interna con operaciones del día

### CuadreFooter

```tsx
<div className="flex justify-between items-center">
  {error && <p className="text-destructive text-sm">{error}</p>}
  <div className="flex gap-2 ml-auto">
    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
    <Button onClick={handleConfirmar} disabled={isSubmitting}>
      {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
      Confirmar Cierre
    </Button>
  </div>
</div>
```

## Estilos / UI

- Usar los mismos patrones que el dashboard de períodos existente (`periodos-dashboard.tsx`)
- Colores semánticos: verde para ingresos/positivo, rojo para egresos/diferencia, ámbar para advertencias
- Tabla con header fijo y scroll vertical (overflow-y-auto en el body)
- Padding consistente: p-6 en contenido, gap-4 entre secciones
- Badge de tipo de período en el header del modal

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/features/contabilidad/actions-periodos.ts` | Agregar `obtenerCuadrePeriodoAction` |
| `src/features/contabilidad/cuadre-queries.ts` | **CREAR** — helpers de queries |
| `src/features/contabilidad/components/periodos/cuadre-periodo-modal.tsx` | **CREAR** — modal full-screen |
| `src/features/contabilidad/components/periodos/balance-tab.tsx` | **CREAR** — tab de balance |
| `src/features/contabilidad/components/periodos/ventas-vs-reconciliado-tab.tsx` | **CREAR** — tab de ventas |
| `src/features/contabilidad/components/periodos/operaciones-tab.tsx` | **CREAR** — tab de operaciones |
| `src/features/contabilidad/components/periodos/resumen-diario-tab.tsx` | **CREAR** — tab de resumen diario |
| `src/features/contabilidad/components/periodos/cerrar-periodo-dialog.tsx` | **MODIFICAR** — simplificar, integrar CuadrePeriodoModal |

## Tests

### Unit tests para queries

- `cuadre-queries.test.ts`: testear cada helper con datos mock de Prisma

### Component tests

- `cuadre-periodo-modal.test.tsx`: render, tabs, confirmar, cancelar
- `ventas-vs-reconciliado-tab.test.tsx`: paginación, diferencias
- `resumen-diario-tab.test.tsx`: expandir/colapsar días

### Integration tests

- `cerrar-periodo-flow.test.ts`: flujo completo diálogo → modal → confirmar → cerrar
