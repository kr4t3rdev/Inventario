
# PutAccountingCashDebtsIdResponse

Respuesta de PUT /accounting/cash-debts/{id}.

## Properties

Name | Type
------------ | -------------
`id` | string
`proveedorId` | string
`montoCapital` | number
`moneda` | string
`tasaInteres` | number
`fechaVencimiento` | string
`estado` | string
`cuentaBancariaId` | string

## Example

```typescript
import type { PutAccountingCashDebtsIdResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "proveedorId": null,
  "montoCapital": null,
  "moneda": null,
  "tasaInteres": null,
  "fechaVencimiento": null,
  "estado": null,
  "cuentaBancariaId": null,
} satisfies PutAccountingCashDebtsIdResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PutAccountingCashDebtsIdResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


