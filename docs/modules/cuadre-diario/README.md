# Cuadre Diario

> **Feature**: `src/features/cuadre-diario/`
> **Ruta**: `/busy/cuadre-diario`

---

## Descripción

Módulo de cuadre diario consolidado. Proporciona un resumen financiero del día operativo: total de ventas por método de pago, ingresos, gastos, diferencias de caja, y variación porcentual vs el día anterior. Es el reporte diario que usan los managers para verificar la integridad financiera.

## Funcionalidades

### Resumen Diario (`getCuadreDiarioAction`)

**Descripción**: Calcula el cuadre del día (fecha actual o especificada). Agrupa ventas por método de pago y calcula totales.

**Indicadores**:
- Ventas totales del día
- Desglose por método de pago: efectivo, tarjeta, transferencia, crédito, mixto
- Total de métodos electrónicos (no efectivo)
- Variación porcentual vs el día anterior

### Cuadre Financiero Consolidado

**Descripción**: `CuadreDiarioFinanciero` es el componente que muestra el cuadre completo: ventas, gastos, saldos y diferencias.

## Server Actions

| Action | Propósito | Input | Output |
|--------|-----------|-------|--------|
| `getCuadreDiarioAction` | Cuadre del día | `{ fecha?: string }` | `{ ventas, metodosPago, variacion }` |

## Reglas de Negocio

1. Los métodos de pago se etiquetan en español: efectivo, tarjeta, transferencia, credito, mixto.
2. La variación porcentual se calcula contra el día anterior hábil.
3. Si el día anterior tuvo 0 ventas y hoy tiene > 0, la variación es 100%.
4. Las ventas con `deletedAt` no null se excluyen del cálculo.

## UI y Navegación

| Ruta | Componente | Propósito |
|------|-----------|-----------|
| `/busy/cuadre-diario` | `CuadreDiarioFinanciero` | Cuadre completo del día |
| — | `CuadrePageClient` | Página cliente del cuadre |

## Integraciones

| Módulo | Relación |
|--------|----------|
| `ventas` | Fuente principal de ingresos |
| `turnos-pos` | Ventas agrupadas por turno |
| `arqueo-caja` | Diferencias de caja por turno |
| `contabilidad` | Alimenta el resumen financiero |

## Permisos

| Acción | Rol |
|--------|-----|
| Ver cuadre | `admin`, `manager`, `economico` |
