
# AccountingAdvancesIdPutRequest


## Properties

Name | Type
------------ | -------------
`estado` | boolean
`saldoDisponible` | number
`vigenciaHasta` | Date
`referenciaExterna` | string

## Example

```typescript
import type { AccountingAdvancesIdPutRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "estado": null,
  "saldoDisponible": null,
  "vigenciaHasta": null,
  "referenciaExterna": null,
} satisfies AccountingAdvancesIdPutRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AccountingAdvancesIdPutRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


