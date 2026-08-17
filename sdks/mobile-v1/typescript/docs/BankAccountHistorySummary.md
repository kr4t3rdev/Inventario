
# BankAccountHistorySummary


## Properties

Name | Type
------------ | -------------
`saldoActual` | number
`totalIngresos` | number
`totalEgresos` | number
`totalMovimientos` | number

## Example

```typescript
import type { BankAccountHistorySummary } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "saldoActual": null,
  "totalIngresos": null,
  "totalEgresos": null,
  "totalMovimientos": null,
} satisfies BankAccountHistorySummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BankAccountHistorySummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


