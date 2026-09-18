
# PostAccountingCapitalInjectionsResponse

Respuesta de POST /accounting/capital-injections.

## Properties

Name | Type
------------ | -------------
`inyeccionId` | string
`monto` | number
`moneda` | string
`tipo` | string
`descripcion` | string
`cuentaBancariaId` | string

## Example

```typescript
import type { PostAccountingCapitalInjectionsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "inyeccionId": null,
  "monto": null,
  "moneda": null,
  "tipo": null,
  "descripcion": null,
  "cuentaBancariaId": null,
} satisfies PostAccountingCapitalInjectionsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingCapitalInjectionsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


