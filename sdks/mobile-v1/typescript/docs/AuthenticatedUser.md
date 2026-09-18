
# AuthenticatedUser


## Properties

Name | Type
------------ | -------------
`userId` | string
`name` | string
`email` | string
`role` | string
`tenantId` | string
`tenantRole` | string

## Example

```typescript
import type { AuthenticatedUser } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "userId": null,
  "name": null,
  "email": null,
  "role": null,
  "tenantId": null,
  "tenantRole": null,
} satisfies AuthenticatedUser

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AuthenticatedUser
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


