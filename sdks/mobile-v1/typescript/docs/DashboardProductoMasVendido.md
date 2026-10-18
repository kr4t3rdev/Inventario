
# DashboardProductoMasVendido

Producto dentro del top 10 de más vendidos.

## Properties

Name | Type
------------ | -------------
`id` | string
`nombre` | string
`categoria` | string
`ventas` | number
`ingresos` | number
`stock` | number

## Example

```typescript
import type { DashboardProductoMasVendido } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "nombre": null,
  "categoria": null,
  "ventas": null,
  "ingresos": null,
  "stock": null,
} satisfies DashboardProductoMasVendido

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardProductoMasVendido
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


