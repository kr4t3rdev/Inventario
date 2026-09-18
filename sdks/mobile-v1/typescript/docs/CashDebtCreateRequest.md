
# CashDebtCreateRequest


## Properties

Name | Type
------------ | -------------
`proveedorId` | string
`montoCapital` | number
`moneda` | string
`tasaInteres` | number
`fechaVencimiento` | Date
`observaciones` | string
`comprobanteUrl` | string
`cuentaBancariaId` | string

## Example

```typescript
import type { CashDebtCreateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "proveedorId": null,
  "montoCapital": null,
  "moneda": null,
  "tasaInteres": null,
  "fechaVencimiento": null,
  "observaciones": null,
  "comprobanteUrl": null,
  "cuentaBancariaId": null,
} satisfies CashDebtCreateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CashDebtCreateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


