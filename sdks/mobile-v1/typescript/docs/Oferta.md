
# Oferta

Oferta.

## Properties

Name | Type
------------ | -------------
`ofertaId` | string
`numeroOferta` | string
`clienteId` | string
`clienteNombre` | string
`fechaEmision` | Date
`fechaVencimiento` | string
`estado` | string
`subtotal` | number
`impuestos` | number
`total` | number
`observaciones` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Oferta } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ofertaId": null,
  "numeroOferta": null,
  "clienteId": null,
  "clienteNombre": null,
  "fechaEmision": null,
  "fechaVencimiento": null,
  "estado": null,
  "subtotal": null,
  "impuestos": null,
  "total": null,
  "observaciones": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Oferta

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Oferta
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


