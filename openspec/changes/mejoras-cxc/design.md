# Mejoras Cuentas por Cobrar — Diseño Técnico

## Arquitectura

No se cambia la arquitectura general. Todas las mejoras operan dentro del patrón existente:
- Server Actions (`withAction`) para data fetching
- Componente cliente (`CuentasPorCobrarTable`) para UI
- Zod schemas para validación

## 1. Columna Saldo Pendiente

### Cambio en UI

En `cuentas-por-cobrar-table.tsx`:

1. Eliminar columna con `accessorKey: "montoPagado"` (header "Pagado").
2. La columna "Saldo" (id: "saldo") se renombra visualmente a "Pendiente".
3. El cálculo del saldo ya existe: `saldoFactura`. Solo se cambia el header y se unifica.

```typescript
// Antes: columnas Total | Pagado | Saldo | Estado
// Después: columnas Total | Pendiente | Estado
```

### Cálculo de Pendiente

```typescript
const pendiente = Number.isFinite(Number(cuenta.saldoFactura))
  ? Math.max(0, Number(cuenta.saldoFactura))
  : Math.max(0, Number(cuenta.montoDeuda) - Number(cuenta.montoPagado))
```

## 2. Dashboard de Métricas

### Server Action — nueva función

Agregar a `actions-cuentas.ts`:

```typescript
export interface CxcMetrics {
  totalPendiente: number
  porVencer: number
  vencidas: number
  totalCuentas: number
}

export const getCxcMetricsAction = withAction(
  async (_input: Record<string, never>, user: AuthenticatedUser): Promise<CxcMetrics> => {
    const tenantId = requireTenant(user)
    // Calcular métricas desde la BD
    const [pendientes, vencidas, total] = await Promise.all([
      prisma.cuentaPorCobrar.aggregate({
        where: { tenantId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        _sum: { montoDeuda: true },
      }),
      prisma.cuentaPorCobrar.count({
        where: { tenantId, estado: { not: 'PAGADA' }, fechaVencimiento: { lt: new Date() } },
      }),
      prisma.cuentaPorCobrar.count({ where: { tenantId } }),
    ])
    return { ... }
  }
)
```

### UI

Cards en la parte superior de la página, antes de la tabla. Usar el mismo patrón de `surfaceCardClass` que ya existe.

## 3. Búsqueda Textual

### Schema

Agregar a `getCuentasPorCobrarSchema`:

```typescript
search: z.string().optional(),
```

### Query

```typescript
if (f.search) {
  where.OR = [
    { numeroFactura: { contains: f.search, mode: 'insensitive' } },
    { cliente: { nombre: { contains: f.search, mode: 'insensitive' } } },
  ]
}
```

### UI

El input de búsqueda existente se mantiene pero ahora dispara un refetch con el parámetro `search` al servidor en lugar de filtrar localmente.

## 4. Aging

### Enriquecimiento

Agregar a `CuentaPorCobrarEnriquecida`:

```typescript
diasTranscurridos: number
rangoAntiguedad: string
```

Reutilizar `computeAging()` de actions-cuentas.ts (ya existe para CxP, mover a función compartida o duplicar).

### UI

Nueva columna en la tabla con badges:

```typescript
function AgingBadge({ rango }: { rango: string }) {
  const config = {
    '0-30': { label: 'Al día', className: 'bg-green-100 text-green-700' },
    '31-60': { label: '30+ días', className: 'bg-amber-100 text-amber-700' },
    '61-90': { label: '60+ días', className: 'bg-orange-100 text-orange-700' },
    '90+': { label: '90+ días', className: 'bg-red-100 text-red-700' },
  }
  // ...
}
```

## 5. Paginación Real

### State en página

```typescript
const [page, setPage] = useState(1)
const [limit] = useState(20)
const [totalPages, setTotalPages] = useState(1)
```

### Data fetching

```typescript
const loadCuentas = useCallback(async (pageNum: number) => {
  const result = await getCuentasPorCobrarAction({ page: pageNum, limit: 20, estado: filtroEstado, search: filtroSearch })
  if (result.success) {
    setCuentasData(result.data)
    setTotalPages(result.data.pagination.totalPages)
  }
}, [filtroEstado, filtroSearch])
```

### Tabla

La tabla recibe `page` y `totalPages` como props. Los controles de paginación existentes ya soportan `table.previousPage() / nextPage()`. Se adaptan para llamar al server.

## 6. Tests

Nuevo archivo: `src/features/contabilidad/api/__tests__/cuentas-por-cobrar-create.test.ts`

Mockear `prisma.venta.findFirst`, `prisma.cuentaPorCobrar.findFirst`, `prisma.cuentaPorCobrar.create`. Seguir el mismo patrón que los tests existentes.

## 7. Tipado

Crear interfaz `CuentaPorCobrarWithIncludes` en `actions-cuentas.ts`:

```typescript
interface CuentaPorCobrarWithIncludes {
  id: string
  tenantId: string
  // ... resto de campos del modelo
  cliente: { clienteId: string; nombre: string } | null
  factura: { ... } | null
  prestamoCash: { ... } | null
}
```

Usar este tipo en `enriquecerCuentaPorCobrar()` en lugar de `Record<string, unknown>`.

## Validación

- Las validaciones existentes (Zod, tenant) se mantienen.
- No se requieren nuevas validaciones.
