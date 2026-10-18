
# AdminUserMembership


## Properties

Name | Type
------------ | -------------
`membershipId` | string
`tenantId` | string
`tenantRole` | string
`isActive` | boolean
`tenant` | [AdminUserMembershipTenant](AdminUserMembershipTenant.md)

## Example

```typescript
import type { AdminUserMembership } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "membershipId": null,
  "tenantId": null,
  "tenantRole": null,
  "isActive": null,
  "tenant": null,
} satisfies AdminUserMembership

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminUserMembership
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


