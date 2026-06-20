# Reportes Financieros

> **Feature**: `src/features/reportes-financieros/`
> **Ruta**: `/busy/reportes-financieros`

---

## Descripción

Módulo de reportes financieros. Genera informes de indicadores de rentabilidad, balances y resúmenes financieros por período. Incluye análisis de rentabilidad por compra (margen por lote).

## Funcionalidades

### Reporte Financiero por Período

**Descripción**: `getReporteFinancieroAction` genera un informe consolidado para un período específico (formato `YYYY-MM`).

**Indicadores calculados**:
- Total de ventas
- Total de compras (gastos de compra)
- Total de salarios (nómina)
- Total de mermas
- **Resultado neto** = ventas - compras - salarios - mermas

### Rentabilidad por Compra

**Descripción**: `getRentabilidadCompraAction` analiza la rentabilidad de cada compra realizada, comparando el costo de compra contra el precio de venta de los productos.

## Server Actions

| Action | Propósito | Input | Output |
|--------|-----------|-------|--------|
| `getReporteFinancieroAction` | Reporte financiero del período | `{ periodo: "YYYY-MM" }` | `{ periodo, resumen, detalles }` |
| `getRentabilidadCompraAction` | Rentabilidad por compra | Filtros varios | Datos de rentabilidad por lote |

## Reglas de Negocio

1. **Feature flag**: Requiere `reportes-financieros` habilitado en el plan.
2. **Período**: Formato `YYYY-MM`. Toma el mes completo (del día 1 al último del mes).
3. **Cálculo**: Los totales se calculan en el momento (no hay caché persistente).

## UI y Navegación

| Ruta | Componente | Propósito |
|------|-----------|-----------|
| `/busy/reportes-financieros` | ReportesPage | Reportes financieros con selector de período |

## Integraciones

| Módulo | Relación |
|--------|----------|
| `contabilidad` | Base para reportes financieros |
| `ventas` | Datos de ingresos |
| `compras-productos` | Datos de costos |
| `empleados` | Datos de nómina |
| `mermas` | Datos de pérdidas |
| `gastosDE` | Gastos operativos |

## Permisos y Roles

| Acción | Rol |
|--------|-----|
| Ver reportes | `admin`, `manager`, `economico` |

## Tests

```bash
pnpm test -- src/features/reportes-financieros/
```
