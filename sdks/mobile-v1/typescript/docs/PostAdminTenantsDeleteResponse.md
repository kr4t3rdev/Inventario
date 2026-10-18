
# PostAdminTenantsDeleteResponse


## Properties

Name | Type
------------ | -------------
`success` | boolean
`tenantId` | string
`message` | string

## Example

```typescript
import type { PostAdminTenantsDeleteResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "success": null,
  "tenantId": null,
  "message": null,
} satisfies PostAdminTenantsDeleteResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAdminTenantsDeleteResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


