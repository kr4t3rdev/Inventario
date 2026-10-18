
# PrecioListaItem

Precio de un producto en la lista.

## Properties

Name | Type
------------ | -------------
`productoId` | string
`productoNombre` | string
`precio` | number

## Example

```typescript
import type { PrecioListaItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "productoId": null,
  "productoNombre": null,
  "precio": null,
} satisfies PrecioListaItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PrecioListaItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


