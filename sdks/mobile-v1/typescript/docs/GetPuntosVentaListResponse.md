
# GetPuntosVentaListResponse

GET /puntos-venta.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;PuntoVenta&gt;](PuntoVenta.md)

## Example

```typescript
import type { GetPuntosVentaListResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
} satisfies GetPuntosVentaListResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetPuntosVentaListResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


