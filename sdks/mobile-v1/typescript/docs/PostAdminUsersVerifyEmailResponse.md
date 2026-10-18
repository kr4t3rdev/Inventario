
# PostAdminUsersVerifyEmailResponse


## Properties

Name | Type
------------ | -------------
`user` | [PostAdminUsersVerifyEmailResponseUser](PostAdminUsersVerifyEmailResponseUser.md)
`alreadyVerified` | boolean
`message` | string

## Example

```typescript
import type { PostAdminUsersVerifyEmailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "user": null,
  "alreadyVerified": null,
  "message": null,
} satisfies PostAdminUsersVerifyEmailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAdminUsersVerifyEmailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


