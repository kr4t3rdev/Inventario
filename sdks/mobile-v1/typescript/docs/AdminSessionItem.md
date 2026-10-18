
# AdminSessionItem


## Properties

Name | Type
------------ | -------------
`id` | string
`userId` | string
`ipAddress` | string
`userAgent` | string
`isActive` | boolean
`expiresAt` | Date
`createdAt` | Date
`lastActive` | Date
`user` | [AdminSessionItemUser](AdminSessionItemUser.md)

## Example

```typescript
import type { AdminSessionItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "userId": null,
  "ipAddress": null,
  "userAgent": null,
  "isActive": null,
  "expiresAt": null,
  "createdAt": null,
  "lastActive": null,
  "user": null,
} satisfies AdminSessionItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminSessionItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


