
# DashboardTransferenciasStats

Conteo de transferencias entre ubicaciones.

## Properties

Name | Type
------------ | -------------
`almacenAAlmacen` | number
`almacenAPuntoVenta` | number
`puntoVentaAAlmacen` | number
`puntoVentaAPuntoVenta` | number

## Example

```typescript
import type { DashboardTransferenciasStats } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "almacenAAlmacen": null,
  "almacenAPuntoVenta": null,
  "puntoVentaAAlmacen": null,
  "puntoVentaAPuntoVenta": null,
} satisfies DashboardTransferenciasStats

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardTransferenciasStats
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


