
# Servicio

Servicio.

## Properties

Name | Type
------------ | -------------
`servicioId` | string
`nombre` | string
`descripcion` | string
`precio` | number
`moneda` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Servicio } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "servicioId": null,
  "nombre": null,
  "descripcion": null,
  "precio": null,
  "moneda": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Servicio

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Servicio
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


