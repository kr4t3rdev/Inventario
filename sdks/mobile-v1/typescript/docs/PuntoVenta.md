
# PuntoVenta

Punto de venta.

## Properties

Name | Type
------------ | -------------
`pvId` | string
`nombre` | string
`ubicacion` | string
`tipoCaja` | string
`listaPrecioNombre` | string
`createdAt` | string

## Example

```typescript
import type { PuntoVenta } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "pvId": null,
  "nombre": null,
  "ubicacion": null,
  "tipoCaja": null,
  "listaPrecioNombre": null,
  "createdAt": null,
} satisfies PuntoVenta

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PuntoVenta
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


