
# SaleItem


## Properties

Name | Type
------------ | -------------
`id` | string
`productoId` | string
`cantidad` | number
`precioUnitario` | number
`total` | number

## Example

```typescript
import type { SaleItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "productoId": null,
  "cantidad": null,
  "precioUnitario": null,
  "total": null,
} satisfies SaleItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaleItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


