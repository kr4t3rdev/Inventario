
# GetAdminActivityLogsResponse


## Properties

Name | Type
------------ | -------------
`logs` | [Array&lt;AdminActivityLogItem&gt;](AdminActivityLogItem.md)
`total` | number

## Example

```typescript
import type { GetAdminActivityLogsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "logs": null,
  "total": null,
} satisfies GetAdminActivityLogsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAdminActivityLogsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


