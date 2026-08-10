
# GetAccountingReportsMovementsResponse

Respuesta de GET /accounting/reports/movements.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;ReportResult&gt;](ReportResult.md)
`totales` | [ReportTotals](ReportTotals.md)
`pagination` | [Pagination](Pagination.md)
`filtros` | [ReportFilters](ReportFilters.md)
`exportContent` | string

## Example

```typescript
import type { GetAccountingReportsMovementsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "totales": null,
  "pagination": null,
  "filtros": null,
  "exportContent": null,
} satisfies GetAccountingReportsMovementsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingReportsMovementsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


