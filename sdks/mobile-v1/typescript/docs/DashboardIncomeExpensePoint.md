
# DashboardIncomeExpensePoint

Punto mensual de ingresos vs gastos.

## Properties

Name | Type
------------ | -------------
`label` | string
`ingresos` | number
`gastos` | number

## Example

```typescript
import type { DashboardIncomeExpensePoint } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "label": null,
  "ingresos": null,
  "gastos": null,
} satisfies DashboardIncomeExpensePoint

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardIncomeExpensePoint
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


