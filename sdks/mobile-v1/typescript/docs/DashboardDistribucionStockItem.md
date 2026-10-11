
# DashboardDistribucionStockItem

Distribución de stock por categoría.

## Properties

Name | Type
------------ | -------------
`categoria` | string
`productos` | number
`stockTotal` | number
`valorTotal` | number

## Example

```typescript
import type { DashboardDistribucionStockItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "categoria": null,
  "productos": null,
  "stockTotal": null,
  "valorTotal": null,
} satisfies DashboardDistribucionStockItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardDistribucionStockItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


