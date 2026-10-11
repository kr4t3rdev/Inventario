
# DashboardIncomeExpenseResponse

Respuesta de GET /dashboard/income-expenses.

## Properties

Name | Type
------------ | -------------
`ingresos` | number
`gastos` | number
`serie` | [Array&lt;DashboardIncomeExpensePoint&gt;](DashboardIncomeExpensePoint.md)

## Example

```typescript
import type { DashboardIncomeExpenseResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ingresos": null,
  "gastos": null,
  "serie": null,
} satisfies DashboardIncomeExpenseResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardIncomeExpenseResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


