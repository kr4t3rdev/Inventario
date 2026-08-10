
# GetAccountingBankAdjustmentsResponse

Respuesta de GET /accounting/bank-adjustments.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;BankAdjustment&gt;](BankAdjustment.md)
`cuentaBancaria` | [BankAccount](BankAccount.md)
`pagination` | [Pagination](Pagination.md)

## Example

```typescript
import type { GetAccountingBankAdjustmentsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "cuentaBancaria": null,
  "pagination": null,
} satisfies GetAccountingBankAdjustmentsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingBankAdjustmentsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


