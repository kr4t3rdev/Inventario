
# PostAdminSessionsRevokeResponse


## Properties

Name | Type
------------ | -------------
`success` | boolean
`sessionId` | string
`message` | string

## Example

```typescript
import type { PostAdminSessionsRevokeResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "success": null,
  "sessionId": null,
  "message": null,
} satisfies PostAdminSessionsRevokeResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAdminSessionsRevokeResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


