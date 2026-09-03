
# AdminUserItem


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
`createdAt` | Date
`expiresAt` | Date
`lockedUntil` | Date
`avatar` | string
`tenantRole` | string
`tenantId` | string
`tenantName` | string
`membershipId` | string
`membershipCount` | number
`salesAgentProfile` | [AdminUserItemSalesAgentProfile](AdminUserItemSalesAgentProfile.md)
`salesAgentBalance` | [AdminUserItemSalesAgentBalance](AdminUserItemSalesAgentBalance.md)
`activeReferralCount` | number

## Example

```typescript
import type { AdminUserItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "userId": null,
  "name": null,
  "email": null,
  "role": null,
  "isActive": null,
  "onboardingType": null,
  "onboardingStatus": null,
  "createdAt": null,
  "expiresAt": null,
  "lockedUntil": null,
  "avatar": null,
  "tenantRole": null,
  "tenantId": null,
  "tenantName": null,
  "membershipId": null,
  "membershipCount": null,
  "salesAgentProfile": null,
  "salesAgentBalance": null,
  "activeReferralCount": null,
} satisfies AdminUserItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminUserItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


