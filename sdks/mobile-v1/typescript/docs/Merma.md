
# Merma

Merma.

## Properties

Name | Type
------------ | -------------
`mermaId` | string
`productoId` | string
`productoNombre` | string
`productoCodigo` | string
`cantidad` | number
`motivo` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Merma } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "mermaId": null,
  "productoId": null,
  "productoNombre": null,
  "productoCodigo": null,
  "cantidad": null,
  "motivo": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Merma

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Merma
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


