
# GetAccountingCashDebtsStatsResponse

Respuesta de GET /accounting/cash-debts/stats.

## Properties

Name | Type
------------ | -------------
`total` | number
`pendiente` | number
`pagado` | number
`vencido` | number

## Example

```typescript
import type { GetAccountingCashDebtsStatsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "total": null,
  "pendiente": null,
  "pagado": null,
  "vencido": null,
} satisfies GetAccountingCashDebtsStatsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingCashDebtsStatsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


