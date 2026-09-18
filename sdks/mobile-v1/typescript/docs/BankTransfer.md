
# BankTransfer


## Properties

Name | Type
------------ | -------------
`transferenciaId` | string
`cuentaOrigenId` | string
`cuentaDestinoId` | string
`montoOrigen` | number
`montoDestino` | number
`tasaCambio` | number
`motivo` | string
`descripcion` | string

## Example

```typescript
import type { BankTransfer } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "transferenciaId": null,
  "cuentaOrigenId": null,
  "cuentaDestinoId": null,
  "montoOrigen": null,
  "montoDestino": null,
  "tasaCambio": null,
  "motivo": null,
  "descripcion": null,
} satisfies BankTransfer

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BankTransfer
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


