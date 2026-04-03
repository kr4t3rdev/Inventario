# Design: Comprobante y Detalle de Pagos para Préstamos en CxC

## Technical Approach

Tres cambios en capas: (1) Backend expande query Prisma para incluir `prestamoCash.reconciliaciones` y normaliza la respuesta, (2) Frontend reutiliza `PagosExpandidos` adaptándolo para consumir reconciliaciones de préstamos, (3) Nuevo endpoint PDF sigue el patrón exacto de `transferencias/comprobante/[id]/route.ts` con pdf-lib.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Comprobante ID | Label virtual `PREST-{idNumerico}` generado en frontend | Campo en BD | No requiere migración; `idNumerico` ya existe como autoincrement en PrestamoCash |
| Reconciliaciones en CxC API | Include `prestamoCash.reconciliaciones` en query Prisma existente | Endpoint separado | Una sola query, sin round-trip extra; sigue patrón de `factura.venta.reconciliaciones` |
| Normalización de pagos | Campo virtual `_reconciliaciones` en mapper del API | Modificar modelo Prisma | Sin migración; frontend consume campo normalizado sin importar origen |
| PDF Layout | 2 secciones en 1 página con línea de corte | 2 páginas separadas | Ahorra papel; sigue convención de comprobantes duplicados en papel continuo |
| PDF Library | pdf-lib (server-side) | jsPDF | Consistencia con patrón existente en `transferencias/comprobante/` |

## Data Flow

```
GET /api/contabilidad/cuentas-por-cobrar
  └─ Prisma query
       ├─ factura.venta.reconciliaciones    (VENTA rows)
       └─ prestamoCash.reconciliaciones     (PRESTAMO_CASH rows) ← NEW include
  └─ Mapper normaliza ambos en campo `_reconciliaciones`
  └─ Frontend consume campo unificado

GET /api/contabilidad/prestamos-cash/{id}/comprobante  ← NEW endpoint
  └─ Prisma: PrestamoCash + cliente + cuentaPorCobrar
  └─ pdf-lib genera PDF con 2 copias
  └─ Response: Buffer PDF
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/contabilidad/cuentas-por-cobrar/route.ts` | Modify | Agregar `prestamoCash: { include: { reconciliaciones: { include: { tipoPago, cuentaBancaria } } } }` al include. En el mapper, normalizar `_reconciliaciones` desde `factura.venta.reconciliaciones` O `prestamoCash.reconciliaciones`. |
| `src/components/contabilidad/cuentas-por-cobrar-table.tsx` | Modify | (1) Columna `idFactura`: si `tipoCuenta === 'PRESTAMO_CASH'`, mostrar ID truncado de CxC. (2) Columna `numeroFactura`: si préstamo, mostrar `PREST-{prestamoCash.idNumerico}`. (3) Expander `tienePagos`: usar `_reconciliaciones` normalizado. (4) `PagosExpandidos`: consumir `_reconciliaciones` en vez de `factura.venta.reconciliaciones`. (5) Acciones: botón FileText para préstamos usa ruta `/api/contabilidad/prestamos-cash/{id}/comprobante`. |
| `src/app/models/model.ts` | Modify | Agregar `_reconciliaciones?: any[]` y `prestamoCash?: PrestamoCash` a interface `CuentaPorCobrar`. |
| `src/app/api/contabilidad/prestamos-cash/[id]/comprobante/route.ts` | Create | Endpoint GET: query PrestamoCash con cliente + cuentaPorCobrar + tasas. Genera PDF A4 con pdf-lib. 2 secciones: Copia Cliente (sin observaciones) y Copia Interna (con observaciones). Línea de corte entre secciones. |

## Interfaces / Contracts

```typescript
// Campo normalizado en respuesta API CxC (no persiste en BD)
interface CuentaPorCobrarResponse extends CuentaPorCobrar {
  _reconciliaciones: Array<{
    reconciliacionId: string
    monto: number
    moneda: string
    tasaCambio?: number
    fechaReconciliacion: string
    idTransferencia?: string
    observaciones?: string
    tipoPago: { nombre: string }
    cuentaBancaria: { nombreBanco: string }
  }>
  prestamoCash?: {
    id: string
    idNumerico: number
    montoCapital: number
    moneda: string
    tasaCambioAlCrear?: number
    observaciones?: string
  }
}
```

```typescript
// GET /api/contabilidad/prestamos-cash/{id}/comprobante
// Response: application/pdf, filename: comprobante-PREST-{idNumerico}.pdf
// 404 si no existe
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `normalizeMontoToCup`, mapper de `_reconciliaciones` | Vitest: entradas VENTA vs PRESTAMO_CASH |
| Unit | PDF comprobante genera ambas secciones | Vitest: mock prisma, verificar PDF bytes no vacío |
| Manual | Tabla CxC muestra PREST-{id}, expander funciona | Browser: crear préstamo, registrar pago, verificar tabla |
| Manual | PDF descarga con 2 copias correctas | Browser: clic botón descargar, verificar PDF |

## Migration / Rollout

No migration required. No schema changes. Feature is purely additive — new include in existing query + new endpoint + UI conditional rendering.
