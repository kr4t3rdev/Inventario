
# ReportTotals


## Properties

Name | Type
------------ | -------------
`total` | number
`montoTotal` | number
`totalIngresos` | number
`totalEgresos` | number
`flujoNeto` | number
`montoConvertidoTotal` | number
`saldoPendiente` | number
`cantidad` | number

## Example

```typescript
import type { ReportTotals } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "total": null,
  "montoTotal": null,
  "totalIngresos": null,
  "totalEgresos": null,
  "flujoNeto": null,
  "montoConvertidoTotal": null,
  "saldoPendiente": null,
  "cantidad": null,
} satisfies ReportTotals

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReportTotals
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


