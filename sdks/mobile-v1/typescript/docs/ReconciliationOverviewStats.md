
# ReconciliationOverviewStats


## Properties

Name | Type
------------ | -------------
`totalPending` | number
`completedToday` | number
`reconciledAmount` | number
`efficiency` | number

## Example

```typescript
import type { ReconciliationOverviewStats } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "totalPending": null,
  "completedToday": null,
  "reconciledAmount": null,
  "efficiency": null,
} satisfies ReconciliationOverviewStats

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReconciliationOverviewStats
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


