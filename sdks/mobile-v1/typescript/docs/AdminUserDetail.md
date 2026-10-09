
# AdminUserDetail


## Properties

Name | Type
------------ | -------------
`userId` | string
`name` | string
`email` | string
`role` | string
`isActive` | boolean
`onboardingType` | string
`onboardingStatus` | string
`emailVerifiedAt` | Date
`createdAt` | Date
`updatedAt` | Date
`activatedAt` | Date
`expiresAt` | Date
`avatar` | string
`lockedUntil` | Date
`loginAttempts` | number
`lastFailedLogin` | Date
`memberships` | [Array&lt;AdminUserMembership&gt;](AdminUserMembership.md)
`activeSessions` | number

## Example

```typescript
import type { AdminUserDetail } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "userId": null,
  "name": null,
  "email": null,
  "role": null,
  "isActive": null,
  "onboardingType": null,
  "onboardingStatus": null,
  "emailVerifiedAt": null,
  "createdAt": null,
  "updatedAt": null,
  "activatedAt": null,
  "expiresAt": null,
  "avatar": null,
  "lockedUntil": null,
  "loginAttempts": null,
  "lastFailedLogin": null,
  "memberships": null,
  "activeSessions": null,
} satisfies AdminUserDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminUserDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


