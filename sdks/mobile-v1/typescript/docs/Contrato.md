
# Contrato

Contrato.

## Properties

Name | Type
------------ | -------------
`contratoId` | string
`clienteId` | string
`clienteNombre` | string
`numeroContrato` | string
`observaciones` | string
`monto` | number
`estado` | string
`fechaInicio` | Date
`fechaFin` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Contrato } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "contratoId": null,
  "clienteId": null,
  "clienteNombre": null,
  "numeroContrato": null,
  "observaciones": null,
  "monto": null,
  "estado": null,
  "fechaInicio": null,
  "fechaFin": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Contrato

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Contrato
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


