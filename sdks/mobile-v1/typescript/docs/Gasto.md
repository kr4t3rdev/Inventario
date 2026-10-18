
# Gasto

Gasto.

## Properties

Name | Type
------------ | -------------
`gastoId` | string
`conceptoId` | string
`conceptoNombre` | string
`monto` | number
`descripcion` | string
`comprobante` | string
`estado` | string
`periodo` | string
`fecha` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Gasto } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "gastoId": null,
  "conceptoId": null,
  "conceptoNombre": null,
  "monto": null,
  "descripcion": null,
  "comprobante": null,
  "estado": null,
  "periodo": null,
  "fecha": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Gasto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Gasto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


