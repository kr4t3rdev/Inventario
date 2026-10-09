
# GetAdminUserLoginHistoryResponse


## Properties

Name | Type
------------ | -------------
`sessions` | [Array&lt;AdminSessionItem&gt;](AdminSessionItem.md)
`total` | number
`userId` | string

## Example

```typescript
import type { GetAdminUserLoginHistoryResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "sessions": null,
  "total": null,
  "userId": null,
} satisfies GetAdminUserLoginHistoryResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAdminUserLoginHistoryResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


