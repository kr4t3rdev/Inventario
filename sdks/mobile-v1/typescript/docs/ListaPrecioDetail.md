
# ListaPrecioDetail

Lista de precios con sus precios.

## Properties

Name | Type
------------ | -------------
`listaId` | string
`nombre` | string
`descripcion` | string
`esDefault` | boolean
`precios` | [Array&lt;PrecioListaItem&gt;](PrecioListaItem.md)
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { ListaPrecioDetail } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "listaId": null,
  "nombre": null,
  "descripcion": null,
  "esDefault": null,
  "precios": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies ListaPrecioDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ListaPrecioDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


