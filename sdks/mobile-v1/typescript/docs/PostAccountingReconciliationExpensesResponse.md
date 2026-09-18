
# PostAccountingReconciliationExpensesResponse

Respuesta de POST /accounting/reconciliation/expenses.

## Properties

Name | Type
------------ | -------------
`reconciliaciones` | [Array&lt;Reconciliation&gt;](Reconciliation.md)
`cuentaPorPagar` | [PayableAccountSummary](PayableAccountSummary.md)
`pagoCuentaPorPagar` | [PayablePaymentSummary](PayablePaymentSummary.md)
`distribucionMultiCuenta` | boolean

## Example

```typescript
import type { PostAccountingReconciliationExpensesResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "reconciliaciones": null,
  "cuentaPorPagar": null,
  "pagoCuentaPorPagar": null,
  "distribucionMultiCuenta": null,
} satisfies PostAccountingReconciliationExpensesResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingReconciliationExpensesResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


