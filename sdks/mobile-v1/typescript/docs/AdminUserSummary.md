
# AdminUserSummary


## Properties

Name | Type
------------ | -------------
`userId` | string
`name` | string
`email` | string
`role` | string
`isActive` | boolean
`lockedUntil` | Date
`loginAttempts` | number

## Example

```typescript
import type { AdminUserSummary } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "userId": null,
  "name": null,
  "email": null,
  "role": null,
  "isActive": null,
  "lockedUntil": null,
  "loginAttempts": null,
} satisfies AdminUserSummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminUserSummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


