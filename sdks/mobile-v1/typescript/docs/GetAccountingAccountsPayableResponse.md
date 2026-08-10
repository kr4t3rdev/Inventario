
# GetAccountingAccountsPayableResponse

Respuesta de GET /accounting/accounts-payable.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;AccountPayable&gt;](AccountPayable.md)
`pagination` | [Pagination](Pagination.md)
`metricas` | [ReportStatistics](ReportStatistics.md)

## Example

```typescript
import type { GetAccountingAccountsPayableResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "pagination": null,
  "metricas": null,
} satisfies GetAccountingAccountsPayableResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingAccountsPayableResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


