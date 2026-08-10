
# GetAccountingCashLoansIdHistoryResponse

Respuesta de GET /accounting/cash-loans/{id}/history.

## Properties

Name | Type
------------ | -------------
`id` | string
`clienteId` | string
`montoCapital` | number
`moneda` | string
`tasaInteres` | number
`fechaVencimiento` | string
`estado` | string
`cuentaBancariaId` | string
`pagination` | [Pagination](Pagination.md)

## Example

```typescript
import type { GetAccountingCashLoansIdHistoryResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "clienteId": null,
  "montoCapital": null,
  "moneda": null,
  "tasaInteres": null,
  "fechaVencimiento": null,
  "estado": null,
  "cuentaBancariaId": null,
  "pagination": null,
} satisfies GetAccountingCashLoansIdHistoryResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingCashLoansIdHistoryResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


