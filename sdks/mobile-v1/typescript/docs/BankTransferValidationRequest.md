
# BankTransferValidationRequest


## Properties

Name | Type
------------ | -------------
`cuentaOrigenId` | string
`cuentaDestinoId` | string
`monto` | number
`motivo` | string
`descripcion` | string

## Example

```typescript
import type { BankTransferValidationRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "cuentaOrigenId": null,
  "cuentaDestinoId": null,
  "monto": null,
  "motivo": null,
  "descripcion": null,
} satisfies BankTransferValidationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BankTransferValidationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


