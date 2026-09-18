
# ReconciliationActivity


## Properties

Name | Type
------------ | -------------
`id` | string
`type` | string
`description` | string
`accountName` | string
`amount` | number
`date` | Date
`reference` | string

## Example

```typescript
import type { ReconciliationActivity } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "type": null,
  "description": null,
  "accountName": null,
  "amount": null,
  "date": null,
  "reference": null,
} satisfies ReconciliationActivity

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReconciliationActivity
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


