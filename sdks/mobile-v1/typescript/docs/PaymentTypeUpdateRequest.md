
# PaymentTypeUpdateRequest


## Properties

Name | Type
------------ | -------------
`nombre` | string
`descripcion` | string
`requiereCuenta` | boolean
`cuentaDefecto` | string
`isActive` | boolean

## Example

```typescript
import type { PaymentTypeUpdateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "nombre": null,
  "descripcion": null,
  "requiereCuenta": null,
  "cuentaDefecto": null,
  "isActive": null,
} satisfies PaymentTypeUpdateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PaymentTypeUpdateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


