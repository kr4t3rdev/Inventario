
# CashPaymentRequest


## Properties

Name | Type
------------ | -------------
`monto` | number
`cuentaId` | string
`tipoPagoId` | string
`moneda` | string
`tasaCambio` | number
`observaciones` | string

## Example

```typescript
import type { CashPaymentRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "monto": null,
  "cuentaId": null,
  "tipoPagoId": null,
  "moneda": null,
  "tasaCambio": null,
  "observaciones": null,
} satisfies CashPaymentRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CashPaymentRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


