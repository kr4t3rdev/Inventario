
# DashboardLowStockItem

Producto con stock bajo.

## Properties

Name | Type
------------ | -------------
`id` | string
`nombre` | string
`stock` | number
`minimo` | number

## Example

```typescript
import type { DashboardLowStockItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "nombre": null,
  "stock": null,
  "minimo": null,
} satisfies DashboardLowStockItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardLowStockItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


