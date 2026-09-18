
# ReportResult


## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;JsonValue&gt;](JsonValue.md)
`totales` | [ReportTotals](ReportTotals.md)
`estadisticas` | [ReportStatistics](ReportStatistics.md)
`pagination` | [Pagination](Pagination.md)
`filtros` | [ReportFilters](ReportFilters.md)

## Example

```typescript
import type { ReportResult } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "totales": null,
  "estadisticas": null,
  "pagination": null,
  "filtros": null,
} satisfies ReportResult

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReportResult
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


