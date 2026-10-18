
# Empleado

Empleado.

## Properties

Name | Type
------------ | -------------
`empleadoId` | string
`nombre` | string
`apellido` | string
`telefono` | string
`cargo` | string
`salarioBases` | number
`fechaContratacion` | Date
`esTiempoCompleto` | boolean
`createdAt` | Date

## Example

```typescript
import type { Empleado } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "empleadoId": null,
  "nombre": null,
  "apellido": null,
  "telefono": null,
  "cargo": null,
  "salarioBases": null,
  "fechaContratacion": null,
  "esTiempoCompleto": null,
  "createdAt": null,
} satisfies Empleado

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Empleado
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


