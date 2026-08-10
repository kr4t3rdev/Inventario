
# ReportFilters


## Properties

Name | Type
------------ | -------------
`fechaInicio` | Date
`fechaFin` | Date
`cuentaId` | string
`moneda` | string
`tipo` | string
`busqueda` | string

## Example

```typescript
import type { ReportFilters } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "fechaInicio": null,
  "fechaFin": null,
  "cuentaId": null,
  "moneda": null,
  "tipo": null,
  "busqueda": null,
} satisfies ReportFilters

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReportFilters
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


