
# PostAccountingBankTransfersResponse

Respuesta de POST /accounting/bank-transfers.

## Properties

Name | Type
------------ | -------------
`transferencia` | [BankTransfer](BankTransfer.md)
`numeroComprobante` | string

## Example

```typescript
import type { PostAccountingBankTransfersResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "transferencia": null,
  "numeroComprobante": null,
} satisfies PostAccountingBankTransfersResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingBankTransfersResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


