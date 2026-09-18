
# BankTransferCreateRequest


## Properties

Name | Type
------------ | -------------
`cuentaOrigenId` | string
`cuentaDestinoId` | string
`montoOrigen` | number
`montoDestino` | number
`motivo` | string
`descripcion` | string
`tasaCambio` | number
`monedaPrincipal` | string

## Example

```typescript
import type { BankTransferCreateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "cuentaOrigenId": null,
  "cuentaDestinoId": null,
  "montoOrigen": null,
  "montoDestino": null,
  "motivo": null,
  "descripcion": null,
  "tasaCambio": null,
  "monedaPrincipal": null,
} satisfies BankTransferCreateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BankTransferCreateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


