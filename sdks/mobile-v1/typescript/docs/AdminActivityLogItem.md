
# AdminActivityLogItem


## Properties

Name | Type
------------ | -------------
`id` | string
`userId` | string
`action` | string
`details` | string
`ipAddress` | string
`userAgent` | string
`performedBy` | string
`createdAt` | Date

## Example

```typescript
import type { AdminActivityLogItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "userId": null,
  "action": null,
  "details": null,
  "ipAddress": null,
  "userAgent": null,
  "performedBy": null,
  "createdAt": null,
} satisfies AdminActivityLogItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminActivityLogItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


