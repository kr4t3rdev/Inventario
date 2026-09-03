
# PostAccountingBankTransfersValidateResponse

Respuesta de POST /accounting/bank-transfers/validate.

## Properties

Name | Type
------------ | -------------
`saldoSuficiente` | boolean
`advertencias` | Array&lt;string&gt;

## Example

```typescript
import type { PostAccountingBankTransfersValidateResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "saldoSuficiente": null,
  "advertencias": null,
} satisfies PostAccountingBankTransfersValidateResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingBankTransfersValidateResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


