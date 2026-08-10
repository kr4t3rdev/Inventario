
# AccountingAdvancesPostRequest


## Properties

Name | Type
------------ | -------------
`tipo` | string
`contratoId` | string
`proveedorId` | string
`clienteId` | string
`monto` | number
`moneda` | string
`cuentaOrigenId` | string
`tipoPagoOrigenId` | string
`referenciaExterna` | string
`vigenciaHasta` | Date

## Example

```typescript
import type { AccountingAdvancesPostRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tipo": null,
  "contratoId": null,
  "proveedorId": null,
  "clienteId": null,
  "monto": null,
  "moneda": null,
  "cuentaOrigenId": null,
  "tipoPagoOrigenId": null,
  "referenciaExterna": null,
  "vigenciaHasta": null,
} satisfies AccountingAdvancesPostRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AccountingAdvancesPostRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


