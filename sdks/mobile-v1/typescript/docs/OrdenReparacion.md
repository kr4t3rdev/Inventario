
# OrdenReparacion

Orden de reparación.

## Properties

Name | Type
------------ | -------------
`ordenId` | string
`numeroOrden` | number
`clienteNombre` | string
`equipoTipo` | string
`marca` | string
`modelo` | string
`problemaReportado` | string
`estado` | string
`prioridad` | string
`esGarantia` | boolean
`tecnicoNombre` | string
`fechaRecepcion` | Date
`createdAt` | Date

## Example

```typescript
import type { OrdenReparacion } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ordenId": null,
  "numeroOrden": null,
  "clienteNombre": null,
  "equipoTipo": null,
  "marca": null,
  "modelo": null,
  "problemaReportado": null,
  "estado": null,
  "prioridad": null,
  "esGarantia": null,
  "tecnicoNombre": null,
  "fechaRecepcion": null,
  "createdAt": null,
} satisfies OrdenReparacion

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OrdenReparacion
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


