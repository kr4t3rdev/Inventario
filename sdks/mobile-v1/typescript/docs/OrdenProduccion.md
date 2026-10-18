
# OrdenProduccion

Orden de producción.

## Properties

Name | Type
------------ | -------------
`ordenId` | string
`recetaId` | string
`recetaNombre` | string
`productoNombre` | string
`cantidad` | number
`estado` | string
`fechaProduccion` | Date
`costoMateriales` | string
`createdAt` | Date

## Example

```typescript
import type { OrdenProduccion } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ordenId": null,
  "recetaId": null,
  "recetaNombre": null,
  "productoNombre": null,
  "cantidad": null,
  "estado": null,
  "fechaProduccion": null,
  "costoMateriales": null,
  "createdAt": null,
} satisfies OrdenProduccion

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OrdenProduccion
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


