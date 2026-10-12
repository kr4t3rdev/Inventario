
# Transferencia

Transferencia entre ubicaciones.

## Properties

Name | Type
------------ | -------------
`transferenciaId` | string
`numeroTransferencia` | string
`productoId` | string
`productoNombre` | string
`productoCodigo` | string
`cantidad` | number
`costoUnitario` | number
`costoTotal` | number
`origenNombre` | string
`destinoNombre` | string
`estado` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Transferencia } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "transferenciaId": null,
  "numeroTransferencia": null,
  "productoId": null,
  "productoNombre": null,
  "productoCodigo": null,
  "cantidad": null,
  "costoUnitario": null,
  "costoTotal": null,
  "origenNombre": null,
  "destinoNombre": null,
  "estado": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Transferencia

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Transferencia
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


