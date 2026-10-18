
# PostAccountingBankAdjustmentsResponse

Respuesta de POST /accounting/bank-adjustments.

## Properties

Name | Type
------------ | -------------
`ajuste` | [AjusteBancario](AjusteBancario.md)
`saldoAnterior` | number
`saldoNuevo` | number
`advertenciaSaldoNegativo` | boolean
`message` | string

## Example

```typescript
import type { PostAccountingBankAdjustmentsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ajuste": null,
  "saldoAnterior": null,
  "saldoNuevo": null,
  "advertenciaSaldoNegativo": null,
  "message": null,
} satisfies PostAccountingBankAdjustmentsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingBankAdjustmentsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


