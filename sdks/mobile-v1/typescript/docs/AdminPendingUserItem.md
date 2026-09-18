
# AdminPendingUserItem


## Properties

Name | Type
------------ | -------------
`userId` | string
`name` | string
`email` | string
`onboardingType` | string
`onboardingStatus` | string
`createdAt` | Date

## Example

```typescript
import type { AdminPendingUserItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "userId": null,
  "name": null,
  "email": null,
  "onboardingType": null,
  "onboardingStatus": null,
  "createdAt": null,
} satisfies AdminPendingUserItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminPendingUserItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


