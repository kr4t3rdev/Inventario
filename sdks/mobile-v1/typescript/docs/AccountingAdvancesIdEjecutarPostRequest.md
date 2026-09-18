
# AccountingAdvancesIdEjecutarPostRequest


## Properties

Name | Type
------------ | -------------
`contexto` | string
`documentoDestinoId` | string
`montoObjetivo` | number
`monedaObjetivo` | string
`tasaAplicada` | number
`idempotencyKey` | string
`observaciones` | string

## Example

```typescript
import type { AccountingAdvancesIdEjecutarPostRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "contexto": null,
  "documentoDestinoId": null,
  "montoObjetivo": null,
  "monedaObjetivo": null,
  "tasaAplicada": null,
  "idempotencyKey": null,
  "observaciones": null,
} satisfies AccountingAdvancesIdEjecutarPostRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AccountingAdvancesIdEjecutarPostRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


