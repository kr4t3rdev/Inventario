
# GetAccountingReportsOverdueInvoicesResponse

Respuesta de GET /accounting/reports/overdue-invoices.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;ReportResult&gt;](ReportResult.md)
`pagination` | [Pagination](Pagination.md)

## Example

```typescript
import type { GetAccountingReportsOverdueInvoicesResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "pagination": null,
} satisfies GetAccountingReportsOverdueInvoicesResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingReportsOverdueInvoicesResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


