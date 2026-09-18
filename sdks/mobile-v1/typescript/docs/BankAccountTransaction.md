
# BankAccountTransaction


## Properties

Name | Type
------------ | -------------
`transaccionId` | string
`fecha` | Date
`tipoMovimiento` | string
`descripcion` | string
`montoOriginal` | number
`monedaOriginal` | string
`tasaCambio` | number
`montoConvertido` | number
`observaciones` | string

## Example

```typescript
import type { BankAccountTransaction } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "transaccionId": null,
  "fecha": null,
  "tipoMovimiento": null,
  "descripcion": null,
  "montoOriginal": null,
  "monedaOriginal": null,
  "tasaCambio": null,
  "montoConvertido": null,
  "observaciones": null,
} satisfies BankAccountTransaction

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BankAccountTransaction
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


