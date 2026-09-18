
# AdvanceWorkflowResult


## Properties

Name | Type
------------ | -------------
`anticipoId` | string
`movimientoId` | string
`documentoDestinoId` | string
`monto` | number
`saldoDisponible` | number
`estado` | string

## Example

```typescript
import type { AdvanceWorkflowResult } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "anticipoId": null,
  "movimientoId": null,
  "documentoDestinoId": null,
  "monto": null,
  "saldoDisponible": null,
  "estado": null,
} satisfies AdvanceWorkflowResult

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdvanceWorkflowResult
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


