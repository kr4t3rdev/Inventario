
# DashboardProductoStockBajo

Producto con stock bajo o crítico (top 5 por menor stock).

## Properties

Name | Type
------------ | -------------
`id` | string
`nombre` | string
`stock` | number
`stockMinimo` | number
`precioCosto` | number
`precioVenta` | number
`almacenId` | string
`puntoDeVentaId` | string
`categoria` | [DashboardProductoStockBajoCategoria](DashboardProductoStockBajoCategoria.md)
`unidad` | [DashboardProductoStockBajoUnidad](DashboardProductoStockBajoUnidad.md)
`stockTotal` | number
`diferencia` | number
`umbralUsado` | number

## Example

```typescript
import type { DashboardProductoStockBajo } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "nombre": null,
  "stock": null,
  "stockMinimo": null,
  "precioCosto": null,
  "precioVenta": null,
  "almacenId": null,
  "puntoDeVentaId": null,
  "categoria": null,
  "unidad": null,
  "stockTotal": null,
  "diferencia": null,
  "umbralUsado": null,
} satisfies DashboardProductoStockBajo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardProductoStockBajo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


