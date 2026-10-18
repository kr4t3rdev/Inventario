
# GetDashboardStatsResponse

Respuesta de GET /dashboard/stats.

## Properties

Name | Type
------------ | -------------
`totalProductos` | number
`totalAlmacenes` | number
`totalPuntosVenta` | number
`totalVentas` | number
`totalMermas` | number
`totalTransferencias` | number
`totalIngresos` | number
`totalGastosMermas` | number
`totalGastos` | number
`totalBeneficio` | number
`valorTotalInventario` | number
`datosPorMes` | [Array&lt;DashboardDatosPorMes&gt;](DashboardDatosPorMes.md)
`datosPorSemana` | [Array&lt;DashboardDatosPorSemana&gt;](DashboardDatosPorSemana.md)
`ventasDiarias` | [DashboardVentasDiarias](DashboardVentasDiarias.md)
`productosMasVendidos` | [Array&lt;DashboardProductoMasVendido&gt;](DashboardProductoMasVendido.md)
`productosStockBajo` | [Array&lt;DashboardProductoStockBajo&gt;](DashboardProductoStockBajo.md)
`distribucionStock` | [Array&lt;DashboardDistribucionStockItem&gt;](DashboardDistribucionStockItem.md)
`transferenciasStats` | [DashboardTransferenciasStats](DashboardTransferenciasStats.md)

## Example

```typescript
import type { GetDashboardStatsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "totalProductos": null,
  "totalAlmacenes": null,
  "totalPuntosVenta": null,
  "totalVentas": null,
  "totalMermas": null,
  "totalTransferencias": null,
  "totalIngresos": null,
  "totalGastosMermas": null,
  "totalGastos": null,
  "totalBeneficio": null,
  "valorTotalInventario": null,
  "datosPorMes": null,
  "datosPorSemana": null,
  "ventasDiarias": null,
  "productosMasVendidos": null,
  "productosStockBajo": null,
  "distribucionStock": null,
  "transferenciasStats": null,
} satisfies GetDashboardStatsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetDashboardStatsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


