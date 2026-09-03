
# GetAdminUsersResponse


## Properties

Name | Type
------------ | -------------
`users` | [Array&lt;AdminUserItem&gt;](AdminUserItem.md)
`total` | number

## Example

```typescript
import type { GetAdminUsersResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "users": null,
  "total": null,
} satisfies GetAdminUsersResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAdminUsersResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


