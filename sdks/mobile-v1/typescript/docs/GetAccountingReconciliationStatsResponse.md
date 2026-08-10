
# GetAccountingReconciliationStatsResponse

Respuesta de GET /accounting/reconciliation/stats.

## Properties

Name | Type
------------ | -------------
`modules` | [ReconciliationModules](ReconciliationModules.md)
`stats` | [ReconciliationOverviewStats](ReconciliationOverviewStats.md)
`recentActivity` | [Array&lt;ReconciliationActivity&gt;](ReconciliationActivity.md)

## Example

```typescript
import type { GetAccountingReconciliationStatsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "modules": null,
  "stats": null,
  "recentActivity": null,
} satisfies GetAccountingReconciliationStatsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingReconciliationStatsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


