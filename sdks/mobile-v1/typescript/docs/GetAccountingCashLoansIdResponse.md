
# GetAccountingCashLoansIdResponse

Respuesta de GET /accounting/cash-loans/{id}.

## Properties

Name | Type
------------ | -------------
`item` | [CashLoan](CashLoan.md)

## Example

```typescript
import type { GetAccountingCashLoansIdResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "item": null,
} satisfies GetAccountingCashLoansIdResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingCashLoansIdResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


