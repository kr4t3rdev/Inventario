
# ReportStatistics


## Properties

Name | Type
------------ | -------------
`totalRegistros` | number
`totalTransacciones` | number
`totalTransferencias` | number
`transferenciasConConversion` | number
`montoTotal` | number
`montoPromedio` | number
`montoTotalPorMoneda` | [{ [key: string]: JsonValue; }](JsonValue.md)
`porMoneda` | [{ [key: string]: JsonValue; }](JsonValue.md)
`porTipoDePago` | [{ [key: string]: JsonValue; }](JsonValue.md)

## Example

```typescript
import type { ReportStatistics } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "totalRegistros": null,
  "totalTransacciones": null,
  "totalTransferencias": null,
  "transferenciasConConversion": null,
  "montoTotal": null,
  "montoPromedio": null,
  "montoTotalPorMoneda": null,
  "porMoneda": null,
  "porTipoDePago": null,
} satisfies ReportStatistics

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReportStatistics
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


