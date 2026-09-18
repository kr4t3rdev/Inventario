
# PutAccountingPaymentTypesIdResponse


## Properties

Name | Type
------------ | -------------
`success` | any
`data` | [PaymentType](PaymentType.md)
`message` | string

## Example

```typescript
import type { PutAccountingPaymentTypesIdResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "success": null,
  "data": null,
  "message": null,
} satisfies PutAccountingPaymentTypesIdResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PutAccountingPaymentTypesIdResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


